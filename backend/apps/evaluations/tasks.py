"""Automatic evaluation expiry."""

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from apps.evaluations.events import publish_expired_event
from apps.evaluations.models import EvaluationRequest
from apps.evaluations.notifications import notify_evaluation_expired
from apps.evaluations.services import lock_participants


@shared_task(name="expire_evaluation_requests")
def expire_evaluation_requests() -> int:
    """Expire due requests once, preserving each row's previous notification facts."""
    at = timezone.now()
    cutoff = at - timedelta(days=settings.EVALUATION_REQUEST_TTL_DAYS)
    due = Q(status=EvaluationRequest.Status.PENDING, created_at__lt=cutoff) | Q(
        status=EvaluationRequest.Status.AWAITING_CONFIRMATION, starts_at__lte=at
    )
    candidates = (
        EvaluationRequest.objects.filter(due)
        .order_by("pk")
        .values_list("pk", "student_id", "picked_by_id")
    )
    expired = 0
    for request_id, student_id, picker_id in candidates.iterator():
        # Match the pick workflow's lock order before taking the request row lock.
        # Each request commits separately; retries skip rows already expired.
        with transaction.atomic():
            lock_participants(picker_id if picker_id is not None else student_id, student_id)
            evaluation = (
                EvaluationRequest.objects.select_for_update()
                .filter(pk=request_id)
                .filter(due)
                .first()
            )
            if evaluation is None:
                continue
            previous_status = evaluation.status
            previous_picker_id = evaluation.picked_by_id
            updated = (
                EvaluationRequest.objects.filter(pk=request_id, status=previous_status)
                .filter(due)
                .update(
                    status=EvaluationRequest.Status.EXPIRED,
                    expired_at=at,
                    picked_by=None,
                    starts_at=None,
                    ends_at=None,
                    updated_at=at,
                )
            )
            if updated != 1:
                continue
            evaluation.refresh_from_db()
            publish_expired_event(
                evaluation,
                previous_status=previous_status,
                previous_picker_id=previous_picker_id,
            )
            notify_evaluation_expired(
                evaluation,
                previous_status=previous_status,
                previous_picker_id=previous_picker_id,
            )
            expired += 1
    return expired
