"""Creation, note editing, slot picking and student confirmation."""

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
    # TODO(notifications): evaluation.confirmed to picked_by (§8.8); send the
    # §9.3 event to student and picked_by via on_commit once dispatch exists.
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
    return evaluation
