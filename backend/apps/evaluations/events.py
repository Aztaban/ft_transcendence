"""Evaluation event envelopes; workflow callers select recipients (api-plan §9.3)."""

from collections.abc import Iterable
from enum import StrEnum

from apps.accounts.models import Role
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


def publish_slot_picked_event(evaluation: EvaluationRequest) -> None:
    """Refresh both participants and eligible Hitchhikers' queues.

    Eligibility rows survive role revocation, so only active users who still
    have a Hitchhiker role are queue recipients.
    """
    eligible_ids = TutorEligibility.objects.filter(
        project_id=evaluation.project_id,
        tutor__status="active",
        tutor__roles__name__in=(Role.Name.TUTOR, Role.Name.HEAD_TUTOR),
    ).values_list("tutor_id", flat=True)
    publish_evaluation_event(
        EvaluationEvent.SLOT_PICKED,
        evaluation,
        user_ids=[evaluation.student_id, evaluation.picked_by_id, *eligible_ids],
    )
