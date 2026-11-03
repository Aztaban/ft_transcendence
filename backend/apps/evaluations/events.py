"""Evaluation event envelopes; workflow callers select recipients (api-plan §9.3)."""

from collections.abc import Iterable
from enum import StrEnum

from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.core.events import publish_user_event
from apps.evaluations.models import EvaluationRequest, TutorEligibility


class EvaluationEvent(StrEnum):
    CREATED = "evaluation.created"
    UPDATED = "evaluation.updated"
    SLOT_PICKED = "evaluation.slot_picked"
    CONFIRMED = "evaluation.confirmed"
    DECLINED = "evaluation.declined"
    RELEASED = "evaluation.released"
    CANCELLED = "evaluation.cancelled"
    EXPIRED = "evaluation.expired"


def publish_evaluation_event(
    event: EvaluationEvent, evaluation: EvaluationRequest, *, user_ids: Iterable[int]
) -> None:
    """Capture the updated request's id/status before any subsequent transition."""
    publish_user_event(
        event=EvaluationEvent(event).value,
        data={"id": evaluation.pk, "status": evaluation.status},
        user_ids=user_ids,
    )


def _eligible_hitchhiker_ids(project_id: int):
    """Eligibility rows are inert without an active account and Hitchhiker role."""
    return (
        TutorEligibility.objects.filter(
            project_id=project_id,
            tutor__status="active",
            tutor__roles__name__in=HITCHHIKER_ROLES,
        )
        .values_list("tutor_id", flat=True)
        .distinct()
    )


def publish_created_event(evaluation: EvaluationRequest) -> None:
    """Refresh eligible Hitchhikers' queues when a request appears."""
    publish_evaluation_event(
        EvaluationEvent.CREATED,
        evaluation,
        user_ids=_eligible_hitchhiker_ids(evaluation.project_id),
    )


def publish_updated_event(evaluation: EvaluationRequest) -> None:
    """Refresh participants and, while pending, eligible Hitchhikers (§9.3)."""
    recipients = [evaluation.student_id]
    if evaluation.picked_by_id is not None:
        recipients.append(evaluation.picked_by_id)
    if evaluation.status == EvaluationRequest.Status.PENDING:
        recipients.extend(_eligible_hitchhiker_ids(evaluation.project_id))
    publish_evaluation_event(EvaluationEvent.UPDATED, evaluation, user_ids=recipients)


def publish_released_event(evaluation: EvaluationRequest, *, previous_picker_id: int) -> None:
    """Keep the releasing Hitchhiker among recipients after clearing the pick."""
    publish_evaluation_event(
        EvaluationEvent.RELEASED,
        evaluation,
        user_ids=[
            evaluation.student_id,
            previous_picker_id,
            *_eligible_hitchhiker_ids(evaluation.project_id),
        ],
    )


def publish_slot_picked_event(evaluation: EvaluationRequest) -> None:
    """Refresh both participants and eligible Hitchhikers' queues."""
    publish_evaluation_event(
        EvaluationEvent.SLOT_PICKED,
        evaluation,
        user_ids=[
            evaluation.student_id,
            evaluation.picked_by_id,
            *_eligible_hitchhiker_ids(evaluation.project_id),
        ],
    )


def publish_declined_event(evaluation: EvaluationRequest, *, previous_picker_id: int) -> None:
    """Notify the former picker even though the pending request has no pick (§9.3)."""
    publish_evaluation_event(
        EvaluationEvent.DECLINED,
        evaluation,
        user_ids=[
            evaluation.student_id,
            previous_picker_id,
            *_eligible_hitchhiker_ids(evaluation.project_id),
        ],
    )


def publish_cancelled_event(evaluation: EvaluationRequest, *, previous_status: str) -> None:
    """Refresh the open queue only when cancellation removed a pending request."""
    recipients = [evaluation.student_id]
    if evaluation.picked_by_id is not None:
        recipients.append(evaluation.picked_by_id)
    if previous_status == EvaluationRequest.Status.PENDING:
        recipients.extend(_eligible_hitchhiker_ids(evaluation.project_id))
    publish_evaluation_event(EvaluationEvent.CANCELLED, evaluation, user_ids=recipients)


def publish_expired_event(
    evaluation: EvaluationRequest, *, previous_status: str, previous_picker_id: int | None
) -> None:
    """Refresh former participants and queues affected by expiry (api-plan §9.3)."""
    recipients = [evaluation.student_id]
    if previous_picker_id is not None:
        recipients.append(previous_picker_id)
    if previous_status == EvaluationRequest.Status.PENDING:
        recipients.extend(_eligible_hitchhiker_ids(evaluation.project_id))
    publish_evaluation_event(EvaluationEvent.EXPIRED, evaluation, user_ids=recipients)
