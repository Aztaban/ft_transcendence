"""Creation and note editing concurrency rules."""

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
