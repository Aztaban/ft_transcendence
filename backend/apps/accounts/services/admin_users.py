"""Administrative profile edits and account status workflows."""

from contextlib import contextmanager

from django.db import IntegrityError, transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.accounts.exceptions import CannotModifySelf, EmailAlreadyExists, InvalidUserStatus
from apps.accounts.models import Role, User
from apps.accounts.services.locking import lock_users
from apps.accounts.services.sessions import end_user_sessions
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def _locked_admin_target(actor, user_id):
    # Audit rows reference the actor. Lock both users in ID order so Admins
    # changing each other's accounts cannot deadlock on foreign-key checks.
    lock_users(actor.pk, user_id)
    users = User.objects.prefetch_related(Prefetch("roles", queryset=Role.objects.order_by("name")))
    return get_object_or_404(users, pk=user_id)


@contextmanager
def locked_profile_target(*, actor, user_id):
    """Lock and check editability before the view validates profile inputs."""
    with transaction.atomic():
        target = _locked_admin_target(actor, user_id)
        if target.status == User.Status.DELETED:
            raise InvalidUserStatus(_("Deleted accounts cannot be edited."))
        yield target


@contextmanager
def locked_status_target(*, actor, user_id):
    """Lock and reject self changes before the view validates a reason."""
    with transaction.atomic():
        target = _locked_admin_target(actor, user_id)
        if target.pk == actor.pk:
            raise CannotModifySelf()
        yield target


def update_user_profile(*, actor, target, data):
    """Apply validated profile data inside locked_profile_target."""
    changes = {field: value for field, value in data.items() if getattr(target, field) != value}
    if changes:
        old = {field: getattr(target, field) for field in changes}
        try:
            with transaction.atomic():
                User.objects.filter(pk=target.pk).update(**changes, updated_at=timezone.now())
        except IntegrityError:
            # Email is the only writable unique field. The database also
            # arbitrates simultaneous edits that pass the serializer check.
            if "email" in changes:
                raise EmailAlreadyExists() from None
            raise
        record_audit(
            actor=actor,
            action=AuditLog.Action.USER_UPDATED,
            target_type=AuditLog.TargetType.USER,
            target_id=target.pk,
            metadata={"old": old, "new": changes},
        )
        if target.pk != actor.pk:
            create_notification(
                recipient_id=target.pk,
                notification_type=Notification.Type.ACCOUNT_UPDATED,
                payload={"fields": sorted(changes)},
                target_url="/profile",
            )
        target.refresh_from_db()
    return target


def _change_account_status(*, actor, target, expected_status, new_status, audit_action, reason):
    """Apply a conditional status change inside locked_status_target."""
    now = timezone.now()
    updated = User.objects.filter(pk=target.pk, status=expected_status).update(
        status=new_status, updated_at=now
    )
    if updated != 1:
        raise InvalidUserStatus()
    record_audit(
        actor=actor,
        action=audit_action,
        target_type=AuditLog.TargetType.USER,
        target_id=target.pk,
        reason=reason,
    )
    if new_status == User.Status.SUSPENDED:
        end_user_sessions(target.pk)
    target.status = new_status
    target.updated_at = now
    return target


def suspend_account(*, actor, target, reason):
    """Suspend inside locked_status_target, ending sessions in the same transaction."""
    return _change_account_status(
        actor=actor,
        target=target,
        expected_status=User.Status.ACTIVE,
        new_status=User.Status.SUSPENDED,
        audit_action=AuditLog.Action.USER_SUSPENDED,
        reason=reason,
    )


def reactivate_account(*, actor, target, reason):
    """Reactivate inside locked_status_target without restoring old sessions."""
    return _change_account_status(
        actor=actor,
        target=target,
        expected_status=User.Status.SUSPENDED,
        new_status=User.Status.ACTIVE,
        audit_action=AuditLog.Action.USER_REACTIVATED,
        reason=reason,
    )
