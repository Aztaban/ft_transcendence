"""Creation, note editing and slot picking."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException

from .models import EvaluationRequest


class ActiveRequestExists(APIException):
    status_code = 409
    default_code = "active_request_exists"
    default_detail = _("You already have an active request for this project.")


class InvalidStateTransition(APIException):
    status_code = 409
    default_code = "invalid_state_transition"
    default_detail = _("Only pending requests can be edited.")


class RequestNotPending(APIException):
    status_code = 409
    default_code = "request_not_pending"
    default_detail = _("This request is no longer pending.")


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
    """Claim a pending request the caller is already allowed to pick (§7.1, §10.4).

    Eligibility is CanPickSlot on the view. The conditional update is the single
    winner (schema §4.2). A pending row cannot store a pick, so the same
    statement moves it to awaiting_confirmation. Row locks around overlap
    checks are #193.
    """
    updated = EvaluationRequest.objects.filter(
        pk=evaluation.pk,
        status=EvaluationRequest.Status.PENDING,
        picked_by__isnull=True,
    ).update(
        status=EvaluationRequest.Status.AWAITING_CONFIRMATION,
        picked_by=user,
        starts_at=starts_at,
        ends_at=ends_at,
        updated_at=timezone.now(),
    )
    if updated != 1:
        raise RequestNotPending()
    evaluation.refresh_from_db()
    return evaluation
