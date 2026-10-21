"""Evaluation and eligibility notification facts and recipients."""

from datetime import timezone

from django.contrib.auth import get_user_model
from rest_framework.fields import DateTimeField

from apps.accounts.models import Role
from apps.core.events import publish_user_event
from apps.evaluations.models import EvaluationRequest, TutorEligibilityRequest
from apps.evaluations.references import ProjectRefSerializer
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def notify_slot_picked(evaluation: EvaluationRequest) -> None:
    """Store the student's confirmation prompt inside the successful pick transaction."""
    timestamp = DateTimeField(default_timezone=timezone.utc)
    create_notification(
        recipient_id=evaluation.student_id,
        notification_type=Notification.Type.EVALUATION_SLOT_PICKED,
        payload={
            "request_id": evaluation.pk,
            "project": ProjectRefSerializer(evaluation.project).data,
            "tutor": {
                "id": evaluation.picked_by_id,
                "display_name": evaluation.picked_by.display_name,
            },
            "starts_at": timestamp.to_representation(evaluation.starts_at),
            "ends_at": timestamp.to_representation(evaluation.ends_at),
        },
        target_url=f"/evaluations/{evaluation.pk}",
    )


def notify_evaluation_confirmed(evaluation: EvaluationRequest) -> None:
    """Notify the current picker inside the successful confirmation transaction."""
    timestamp = DateTimeField(default_timezone=timezone.utc)
    create_notification(
        recipient_id=evaluation.picked_by_id,
        notification_type=Notification.Type.EVALUATION_CONFIRMED,
        payload={
            "request_id": evaluation.pk,
            "project": ProjectRefSerializer(evaluation.project).data,
            "student": {
                "id": evaluation.student_id,
                "display_name": evaluation.student.display_name,
            },
            "starts_at": timestamp.to_representation(evaluation.starts_at),
            "ends_at": timestamp.to_representation(evaluation.ends_at),
        },
        target_url=f"/evaluations/{evaluation.pk}",
    )


def notify_evaluation_declined(evaluation: EvaluationRequest, *, previous_picker_id: int) -> None:
    """Notify the picker captured before the declined slot was cleared."""
    create_notification(
        recipient_id=previous_picker_id,
        notification_type=Notification.Type.EVALUATION_DECLINED,
        payload={
            "request_id": evaluation.pk,
            "project": ProjectRefSerializer(evaluation.project).data,
            "student": {
                "id": evaluation.student_id,
                "display_name": evaluation.student.display_name,
            },
        },
        target_url=f"/evaluations/{evaluation.pk}",
    )


def notify_eligibility_requested(eligibility_request: TutorEligibilityRequest) -> None:
    """Call inside the submission transaction, after assigning selected projects."""
    head_ids = list(
        get_user_model()
        .objects.filter(roles__name=Role.Name.HEAD_TUTOR)
        .order_by("pk")
        .values_list("pk", flat=True)
        .distinct()
    )
    payload = {
        "request_id": eligibility_request.pk,
        "requester": {
            "id": eligibility_request.requester_id,
            "display_name": eligibility_request.requester.display_name,
        },
        "projects": ProjectRefSerializer(
            eligibility_request.projects.order_by("name", "pk"), many=True
        ).data,
    }
    for recipient_id in head_ids:
        if recipient_id != eligibility_request.requester_id:
            create_notification(
                recipient_id=recipient_id,
                notification_type=Notification.Type.ELIGIBILITY_REQUESTED,
                payload=payload,
                target_url=f"/eligibility-requests/{eligibility_request.pk}",
            )
    # The event refreshes all Head Tutors' review queues, including the requester.
    publish_user_event(
        event="eligibility.requested", data={"id": eligibility_request.pk}, user_ids=head_ids
    )


def notify_eligibility_decided(eligibility_request: TutorEligibilityRequest) -> None:
    """Call inside the winning review transaction, after grants and refresh."""
    create_notification(
        recipient_id=eligibility_request.requester_id,
        notification_type=Notification.Type.ELIGIBILITY_DECIDED,
        payload={
            "request_id": eligibility_request.pk,
            "decision": eligibility_request.status,
            "review_note": eligibility_request.review_note,
        },
        target_url=f"/eligibility-requests/{eligibility_request.pk}",
    )
    publish_user_event(
        event="eligibility.decided",
        data={"id": eligibility_request.pk, "status": eligibility_request.status},
        user_ids=[eligibility_request.requester_id],
    )
