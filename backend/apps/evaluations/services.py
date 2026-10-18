"""Evaluation request creation, editing and participant transitions."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException, PermissionDenied

from .events import (
    EvaluationEvent,
    publish_cancelled_event,
    publish_declined_event,
    publish_evaluation_event,
    publish_slot_picked_event,
)
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


class SlotOverlaps(APIException):
    status_code = 409
    default_code = "slot_overlaps"
    default_detail = _("You already have an evaluation at that time.")


class StudentUnavailable(APIException):
    status_code = 409
    default_code = "student_unavailable"
    default_detail = _("The student already has an evaluation at that time.")


class EvaluationAlreadyStarted(APIException):
    status_code = 409
    default_code = "evaluation_already_started"
    default_detail = _("This evaluation has already started.")


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


@transaction.atomic
def confirm_request(evaluation):
    """Accept the current pick before its start (api-plan §7.1, schema §4.2)."""
    current = EvaluationRequest.objects.select_for_update().get(pk=evaluation.pk)
    if current.status != EvaluationRequest.Status.AWAITING_CONFIRMATION:
        raise InvalidStateTransition(_("Only requests awaiting confirmation can be confirmed."))
    at = timezone.now()
    if current.starts_at <= at:
        raise EvaluationAlreadyStarted()
    updated = EvaluationRequest.objects.filter(
        pk=current.pk,
        student_id=evaluation.student_id,
        status=EvaluationRequest.Status.AWAITING_CONFIRMATION,
        starts_at__gt=at,
    ).update(status=EvaluationRequest.Status.CONFIRMED, updated_at=at)
    if updated != 1:
        raise InvalidStateTransition(_("Only requests awaiting confirmation can be confirmed."))
    evaluation.refresh_from_db()
    publish_evaluation_event(
        EvaluationEvent.CONFIRMED,
        evaluation,
        user_ids=(evaluation.student_id, evaluation.picked_by_id),
    )
    # TODO(notifications): evaluation.confirmed to picked_by (§8.8) once dispatch exists.
    return evaluation


@transaction.atomic
def decline_request(evaluation):
    """Return an unanswered pick to pending."""
    current = EvaluationRequest.objects.select_for_update().get(pk=evaluation.pk)
    previous_picker_id = current.picked_by_id
    updated = EvaluationRequest.objects.filter(
        pk=evaluation.pk,
        student_id=evaluation.student_id,
        status=EvaluationRequest.Status.AWAITING_CONFIRMATION,
    ).update(
        status=EvaluationRequest.Status.PENDING,
        picked_by=None,
        starts_at=None,
        ends_at=None,
        updated_at=timezone.now(),
    )
    if updated != 1:
        raise InvalidStateTransition(_("Only requests awaiting confirmation can be declined."))
    evaluation.refresh_from_db()
    publish_declined_event(evaluation, previous_picker_id=previous_picker_id)
    # TODO(notifications): evaluation.declined to previous_picker_id (§8.8) once dispatch exists.
    return evaluation


@transaction.atomic
def cancel_request(evaluation):
    """Cancel the owning student's request before its slot starts."""
    current = EvaluationRequest.objects.select_for_update().get(pk=evaluation.pk)
    cancellable = (
        EvaluationRequest.Status.PENDING,
        EvaluationRequest.Status.AWAITING_CONFIRMATION,
        EvaluationRequest.Status.CONFIRMED,
    )
    if current.status not in cancellable:
        raise InvalidStateTransition(_("Only active requests without a result can be cancelled."))
    at = timezone.now()
    if current.starts_at is not None and current.starts_at <= at:
        raise EvaluationAlreadyStarted()
    if current.result is not None:
        raise InvalidStateTransition(_("Only active requests without a result can be cancelled."))
    updated = (
        EvaluationRequest.objects.filter(
            pk=current.pk,
            student_id=evaluation.student_id,
            status=current.status,
            result__isnull=True,
        )
        .filter(Q(starts_at__isnull=True) | Q(starts_at__gt=at))
        .update(
            status=EvaluationRequest.Status.CANCELLED,
            cancelled_by_id=current.student_id,
            cancelled_at=at,
            updated_at=at,
        )
    )
    if updated != 1:
        raise InvalidStateTransition(_("Only active requests without a result can be cancelled."))
    evaluation.refresh_from_db()
    publish_cancelled_event(evaluation, previous_status=current.status)
    # TODO(notifications): evaluation.cancelled to picked_by, if present (§8.8).
    return evaluation


@transaction.atomic
def release_slot(evaluation, user):
    """Return the picking Hitchhiker's slot to the queue before its start (§10.4)."""
    current = EvaluationRequest.objects.select_for_update().get(pk=evaluation.pk)
    if current.status not in EvaluationRequest.PICKED_STATUSES:
        raise InvalidStateTransition(_("Only picked requests without a result can be released."))
    if current.picked_by_id != user.pk:
        raise PermissionDenied()
    at = timezone.now()
    if current.starts_at <= at:
        raise EvaluationAlreadyStarted()
    if current.result is not None:
        raise InvalidStateTransition(_("Only picked requests without a result can be released."))
    updated = EvaluationRequest.objects.filter(
        pk=current.pk,
        status=current.status,
        picked_by_id=user.pk,
        starts_at__gt=at,
        result__isnull=True,
    ).update(
        status=EvaluationRequest.Status.PENDING,
        picked_by=None,
        starts_at=None,
        ends_at=None,
        updated_at=at,
    )
    if updated != 1:
        raise InvalidStateTransition(_("Only picked requests without a result can be released."))
    evaluation.refresh_from_db()
    # TODO(notifications): evaluation.released to student, payload
    # {request_id, project, tutor} (§8.8). Future milestone: on_commit dispatch
    # evaluation.released {id, status} to student, releasing tutor and eligible
    # Hitchhikers (§9.3); notifications also emit notification.created.
    return evaluation


def lock_participants(hitchhiker_id, student_id):
    """Lock both user rows in ascending id order (schema §4.2)."""
    list(
        get_user_model()
        .objects.select_for_update()
        .filter(pk__in=(hitchhiker_id, student_id))
        .order_by("pk")
    )


def person_is_busy(person_id, starts_at, ends_at, request_id):
    """True when this person already has another overlapping picked evaluation."""
    return (
        EvaluationRequest.objects.filter(
            Q(student_id=person_id) | Q(picked_by_id=person_id),
            status__in=EvaluationRequest.PICKED_STATUSES,
            starts_at__lt=ends_at,
            ends_at__gt=starts_at,
        )
        .exclude(pk=request_id)
        .exists()
    )


def pick_slot(evaluation, user, starts_at, ends_at):
    """Claim a pending request the caller is already allowed to pick (§7.1, §10.4).

    Eligibility is CanPickSlot on the view. Inside one transaction the Hitchhiker
    and the student are locked, a request that is no longer pending is refused
    before the overlap checks, and the conditional update names the single winner
    (schema §4.2). A pending row cannot store a pick, so that update also moves
    the request to awaiting_confirmation.
    """
    with transaction.atomic():
        lock_participants(user.pk, evaluation.student_id)
        status = (
            EvaluationRequest.objects.select_for_update()
            .values_list("status", flat=True)
            .get(pk=evaluation.pk)
        )
        if status != EvaluationRequest.Status.PENDING:
            raise RequestNotPending()
        if person_is_busy(user.pk, starts_at, ends_at, evaluation.pk):
            raise SlotOverlaps()
        if person_is_busy(evaluation.student_id, starts_at, ends_at, evaluation.pk):
            raise StudentUnavailable()
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
        publish_slot_picked_event(evaluation)
    return evaluation
