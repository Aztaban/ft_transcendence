"""Evaluation event envelopes; workflow callers select recipients (api-plan §9.3)."""

from collections.abc import Iterable
from enum import StrEnum

from apps.core.events import publish_user_event
from apps.evaluations.models import EvaluationRequest


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
