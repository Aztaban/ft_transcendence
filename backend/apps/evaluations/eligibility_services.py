"""Eligibility submission, review and revocation workflows."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException, NotAuthenticated, NotFound, ValidationError

from apps.accounts.models import Role
from apps.accounts.services.locking import lock_users
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest
from apps.evaluations.notifications import (
    notify_eligibility_decided,
    notify_eligibility_requested,
    notify_eligibility_revoked,
)

User = get_user_model()


class EligibilityRequestPending(APIException):
    status_code = 409
    default_code = "eligibility_request_pending"
    default_detail = _("You already have a pending eligibility request.")


class EligibilityRequestAlreadyReviewed(APIException):
    status_code = 409
    default_code = "eligibility_request_already_reviewed"
    default_detail = _("This eligibility request has already been reviewed.")


def submit_eligibility_request(*, requester, project_ids):
    projects = list(Project.objects.filter(pk__in=project_ids, is_active=True))
    found_ids = {project.pk for project in projects}
    missing = sorted(set(project_ids) - found_ids)
    if missing:
        raise ValidationError(
            {
                "project_ids": [
                    _("Unknown or inactive project id(s): %(ids)s.")
                    % {"ids": ", ".join(str(pk) for pk in missing)}
                ]
            }
        )

    already_eligible = list(
        TutorEligibility.objects.filter(tutor=requester, project_id__in=project_ids)
        .select_related("project")
        .order_by("project__name")
    )
    if already_eligible:
        names = ", ".join(row.project.name for row in already_eligible)
        raise ValidationError(
            {"project_ids": [_("Already eligible for: %(names)s.") % {"names": names}]}
        )

    with transaction.atomic():
        heads = User.objects.filter(roles__name=Role.Name.HEAD_TUTOR)
        head_ids = list(heads.values_list("pk", flat=True).distinct())
        # Notification recipients belong in the same ordered lock set as the requester.
        lock_users(requester.pk, *head_ids)
        current = User.objects.get(pk=requester.pk)
        if not current.is_active:
            raise NotAuthenticated()
        head_ids = list(heads.filter(pk__in=head_ids).values_list("pk", flat=True).distinct())
        if TutorEligibilityRequest.objects.filter(
            requester=requester,
            status=TutorEligibilityRequest.Status.PENDING,
        ).exists():
            raise EligibilityRequestPending()
        eligibility_request = TutorEligibilityRequest.objects.create(requester=requester)
        eligibility_request.projects.set(projects)
        notify_eligibility_requested(eligibility_request, head_ids=head_ids)

    return eligibility_request


def review_eligibility_request(*, reviewer, eligibility_request, decision, review_note):
    reviewed_at = timezone.now()

    with transaction.atomic():
        # Deletion declines pending reviews and removes grants while holding
        # these user rows. A late reviewer must not recreate eligibility.
        lock_users(reviewer.pk, eligibility_request.requester_id)
        updated = TutorEligibilityRequest.objects.filter(
            pk=eligibility_request.pk,
            status=TutorEligibilityRequest.Status.PENDING,
        ).update(
            status=decision,
            reviewed_by=reviewer,
            reviewed_at=reviewed_at,
            review_note=review_note,
        )
        if updated != 1:
            raise EligibilityRequestAlreadyReviewed()

        if decision == TutorEligibilityRequest.Status.APPROVED:
            projects = list(eligibility_request.projects.all())
            TutorEligibility.objects.bulk_create(
                [
                    TutorEligibility(
                        tutor_id=eligibility_request.requester_id,
                        project=project,
                        granted_by_request_id=eligibility_request.pk,
                    )
                    for project in projects
                ],
                ignore_conflicts=True,
            )

        eligibility_request.refresh_from_db()
        record_audit(
            actor=reviewer,
            action=AuditLog.Action.ELIGIBILITY_REVIEWED,
            target_type=AuditLog.TargetType.TUTOR_ELIGIBILITY_REQUEST,
            target_id=eligibility_request.pk,
            metadata={"decision": decision},
        )
        notify_eligibility_decided(eligibility_request)

    return eligibility_request


def revoke_eligibility(*, actor, slug, tutor_id, reason):
    with transaction.atomic():
        # The notification insert locks the tutor. Pick already holds that user
        # before it locks the grant, so revocation takes the same order (schema §4.2).
        if User.objects.select_for_update().filter(pk=tutor_id).first() is None:
            raise NotFound()
        eligibility = (
            TutorEligibility.objects.select_for_update()
            .select_related("project")
            .filter(project__slug=slug, tutor_id=tutor_id)
            .first()
        )
        if eligibility is None:
            raise NotFound()
        project = eligibility.project
        record_audit(
            actor=actor,
            action=AuditLog.Action.ELIGIBILITY_REVOKED,
            target_type=AuditLog.TargetType.TUTOR_ELIGIBILITY,
            target_id=eligibility.pk,
            reason=reason,
        )
        eligibility.delete()
        notify_eligibility_revoked(project, tutor_id)
