"""Creation, note editing and slot picking."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException

from .models import EvaluationRequest, TutorEligibility
from .permissions import HITCHHIKER_ROLES


class ActiveRequestExists(APIException):
    status_code = 409
    default_code = "active_request_exists"
    default_detail = _("You already have an active request for this project.")


class InvalidStateTransition(APIException):
    status_code = 409
    default_code = "invalid_state_transition"
    default_detail = _("Only pending requests can be edited.")


class NotEligible(APIException):
    status_code = 403
    default_code = "not_eligible"
    default_detail = _("You are not eligible to evaluate this project.")


class CannotPickOwnRequest(APIException):
    status_code = 403
    default_code = "cannot_pick_own_request"
    default_detail = _("You cannot pick your own request.")


def history_filter(at):
    return Q(status__in=(EvaluationRequest.Status.CANCELLED, EvaluationRequest.Status.EXPIRED)) | Q(
        status=EvaluationRequest.Status.CONFIRMED, ends_at__lt=at
    )


@transaction.atomic
def create_request(student, project, note):
    get_user_model().objects.select_for_update().get(pk=student.pk)
    active = Q(
        status__in=(
            EvaluationRequest.Status.PENDING,
            EvaluationRequest.Status.AWAITING_CONFIRMATION,
        )
    ) | Q(status=EvaluationRequest.Status.CONFIRMED, ends_at__gt=timezone.now())
    if EvaluationRequest.objects.filter(active, student=student, project=project).exists():
        raise ActiveRequestExists()
    evaluation = EvaluationRequest.objects.create(student=student, project=project, note=note)
    # Notifications (§8.8) and on_commit WebSocket events (§9.3) are deferred by
    return evaluation


@transaction.atomic
def edit_note(evaluation, validated_data):
    updated = EvaluationRequest.objects.filter(
        pk=evaluation.pk, student_id=evaluation.student_id, status=EvaluationRequest.Status.PENDING
    ).update(**validated_data, updated_at=timezone.now())
    if updated != 1:
        raise InvalidStateTransition()
    evaluation.refresh_from_db()
    # evaluation.updated dispatch is deferred to the WebSocket infrastructure task.
    return evaluation


def pick_slot(evaluation, user, starts_at, ends_at):
    """Accept a proposed slot from an eligible Hitchhiker (api-plan §7.1, §10.4).

    A single winner (#192), the row locks (#193) and the move to
    awaiting_confirmation (#194) are the next steps. Until they land, an
    allowed call leaves the request unchanged.
    """
    _ = (starts_at, ends_at)
    is_hitchhiker = user.roles.filter(name__in=HITCHHIKER_ROLES).exists()
    if is_hitchhiker and evaluation.student_id == user.pk:
        raise CannotPickOwnRequest()
    eligible = TutorEligibility.objects.filter(
        tutor=user, project_id=evaluation.project_id
    ).exists()
    if not is_hitchhiker or not eligible:
        raise NotEligible()
    return evaluation
