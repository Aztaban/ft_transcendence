"""Transactional account anonymization and related cleanup."""

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_noop
from rest_framework.exceptions import NotAuthenticated, PermissionDenied

from apps.accounts.exceptions import CannotModifySelf, InvalidUserStatus
from apps.accounts.models import Role, User, UserRole
from apps.accounts.services.locking import lock_users
from apps.accounts.services.sessions import end_user_sessions
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.council.models import SCMessage
from apps.evaluations.models import EvaluationRequest, TutorEligibility, TutorEligibilityRequest
from apps.evaluations.services import cancel_request, release_deleted_user_slot
from apps.notifications.models import Notification


class _ParticipantsChanged(Exception):
    """Retry without retaining a partial set of user locks."""


def _affected_evaluations(user_id, at):
    own = Q(student_id=user_id) & (
        Q(
            status__in=(
                EvaluationRequest.Status.PENDING,
                EvaluationRequest.Status.AWAITING_CONFIRMATION,
            )
        )
        | Q(status=EvaluationRequest.Status.CONFIRMED, starts_at__gt=at)
    )
    picks = Q(picked_by_id=user_id, status__in=EvaluationRequest.PICKED_STATUSES, starts_at__gt=at)
    return EvaluationRequest.objects.filter(own | picks)


def _participant_ids(rows):
    return {
        user_id
        for _, student_id, picker_id in rows
        for user_id in (student_id, picker_id)
        if user_id is not None
    }


def delete_account(*, actor, user_id, reason):
    if actor.pk == user_id:
        raise CannotModifySelf()
    if not actor.has_role(Role.Name.ADMIN):
        raise PermissionDenied()
    # Discover counterparts before locking any users. A pick may have changed
    # between discovery and locking; roll back and retry in global ID order.
    while True:
        try:
            with transaction.atomic():
                rows = list(
                    _affected_evaluations(user_id, timezone.now()).values_list(
                        "pk", "student_id", "picked_by_id"
                    )
                )
                user_ids = {actor.pk, user_id} | _participant_ids(rows)
                lock_users(*user_ids)
                target = get_object_or_404(User, pk=user_id)
                if not User.objects.filter(pk=actor.pk, status=User.Status.ACTIVE).exists():
                    raise NotAuthenticated()
                if target.status == User.Status.DELETED:
                    raise InvalidUserStatus()
                at = timezone.now()
                rows = list(
                    _affected_evaluations(user_id, at).values_list(
                        "pk", "student_id", "picked_by_id"
                    )
                )
                if not _participant_ids(rows) <= user_ids:
                    raise _ParticipantsChanged()
                evaluations = list(
                    EvaluationRequest.objects.select_for_update()
                    .filter(pk__in=[row[0] for row in rows])
                    .order_by("pk")
                )
                updated = User.objects.filter(pk=user_id, status=target.status).update(
                    status=User.Status.DELETED,
                    email=f"deleted-{user_id}@deleted.invalid",
                    # This canonical stored value is required by schema §2.4.
                    display_name=gettext_noop("Deleted user"),
                    intra_id=None,
                    intra_login=None,
                    password=make_password(None),
                    updated_at=at,
                )
                if updated != 1:
                    raise InvalidUserStatus()
                # Schedule this first, so the deleted account's sockets close
                # before any subsequent workflow refreshes are dispatched.
                end_user_sessions(user_id)
                for evaluation in evaluations:
                    if evaluation.student_id == user_id:
                        cancel_request(
                            evaluation, actor, reason=reason, exclude_user_ids=(user_id,), at=at
                        )
                    else:
                        release_deleted_user_slot(
                            evaluation, actor, deleted_user_id=user_id, reason=reason, at=at
                        )
                TutorEligibilityRequest.objects.filter(
                    requester_id=user_id, status=TutorEligibilityRequest.Status.PENDING
                ).update(
                    status=TutorEligibilityRequest.Status.DECLINED,
                    reviewed_by=actor,
                    reviewed_at=at,
                    updated_at=at,
                )
                TutorEligibility.objects.filter(tutor_id=user_id).delete()
                UserRole.objects.filter(user_id=user_id).delete()
                SCMessage.objects.filter(sender_id=user_id).update(sender=None)
                Notification.objects.filter(recipient_id=user_id).delete()
                # Avatars are null stubs in this implementation. The user row
                # survives, so resource/history owner references remain intact.
                record_audit(
                    actor=actor,
                    action=AuditLog.Action.USER_DELETED,
                    target_type=AuditLog.TargetType.USER,
                    target_id=user_id,
                    reason=reason,
                )
            return
        except _ParticipantsChanged:
            continue
