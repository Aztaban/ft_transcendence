"""Evaluation and eligibility notification facts and recipients."""

from datetime import timezone

from django.contrib.auth import get_user_model
from rest_framework.fields import DateTimeField

from apps.accounts.models import Role
from apps.core.events import publish_user_event
from apps.evaluations.events import _eligible_hitchhiker_ids
from apps.evaluations.models import EvaluationRequest, TutorEligibilityRequest
from apps.evaluations.references import ProjectRefSerializer
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def notify_evaluation_created(evaluation: EvaluationRequest) -> None:
    """Notify active eligible Hitchhikers without disclosing the student (§8.8)."""
    payload = {
        "request_id": evaluation.pk,
        "project": ProjectRefSerializer(evaluation.project).data,
    }
    for recipient_id in _eligible_hitchhiker_ids(evaluation.project_id).exclude(
        tutor_id=evaluation.student_id
    ):
        create_notification(
            recipient_id=recipient_id,
            notification_type=Notification.Type.EVALUATION_CREATED,
            payload=payload,
            target_url=f"/evaluations/{evaluation.pk}",
        )


def notify_evaluation_released(evaluation: EvaluationRequest, *, previous_picker) -> None:
    """Use the locked picker's facts after release has cleared the pick."""
    create_notification(
        recipient_id=evaluation.student_id,
        notification_type=Notification.Type.EVALUATION_RELEASED,
        payload={
            "request_id": evaluation.pk,
            "project": ProjectRefSerializer(evaluation.project).data,
            "tutor": {"id": previous_picker.pk, "display_name": previous_picker.display_name},
        },
        target_url=f"/evaluations/{evaluation.pk}",
    )


def notify_evaluation_expired(
    evaluation: EvaluationRequest, *, previous_status: str, previous_picker_id: int | None
) -> None:
    """Expiry callers must capture the prior state before clearing the pick (§8.8)."""
    if previous_status not in (
        EvaluationRequest.Status.PENDING,
        EvaluationRequest.Status.AWAITING_CONFIRMATION,
    ):
        raise ValueError("Only pending or awaiting-confirmation requests can expire")
    if (
        previous_status == EvaluationRequest.Status.AWAITING_CONFIRMATION
        and previous_picker_id is None
    ):
        raise ValueError("An awaiting-confirmation request must have a previous picker")
    recipients = {evaluation.student_id}
    if previous_status == EvaluationRequest.Status.AWAITING_CONFIRMATION:
        recipients.add(previous_picker_id)
    payload = {
        "request_id": evaluation.pk,
        "project": ProjectRefSerializer(evaluation.project).data,
        "previous_status": previous_status,
    }
    for recipient_id in sorted(recipients):
        create_notification(
            recipient_id=recipient_id,
            notification_type=Notification.Type.EVALUATION_EXPIRED,
            payload=payload,
            target_url=f"/evaluations/{evaluation.pk}",
        )


def notify_evaluation_result_recorded(evaluation: EvaluationRequest) -> None:
    """The admin calls this only when result changes from null to a value (§8.8)."""
    payload = {
        "request_id": evaluation.pk,
        "project": ProjectRefSerializer(evaluation.project).data,
        "result": evaluation.result,
    }
    for recipient_id in sorted({evaluation.student_id, evaluation.picked_by_id}):
        create_notification(
            recipient_id=recipient_id,
            notification_type=Notification.Type.EVALUATION_RESULT_RECORDED,
            payload=payload,
            target_url=f"/evaluations/{evaluation.pk}",
        )


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


def notify_evaluation_cancelled(evaluation: EvaluationRequest) -> None:
    """Notify the affected participants inside the cancellation transaction (§8.8)."""
    recipients = set()
    if evaluation.picked_by_id is not None:
        recipients.add(evaluation.picked_by_id)
    if evaluation.cancelled_by_id != evaluation.student_id:
        recipients.add(evaluation.student_id)
    recipients.discard(evaluation.cancelled_by_id)
    if not recipients:
        return
    payload = {
        "request_id": evaluation.pk,
        "project": ProjectRefSerializer(evaluation.project).data,
        "cancelled_by": {
            "id": evaluation.cancelled_by_id,
            "display_name": evaluation.cancelled_by.display_name,
        },
    }
    for recipient_id in sorted(recipients):
        create_notification(
            recipient_id=recipient_id,
            notification_type=Notification.Type.EVALUATION_CANCELLED,
            payload=payload,
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


def notify_eligibility_revoked(project, tutor_id: int) -> None:
    """Call inside the winning revocation transaction, after the eligibility row is gone."""
    create_notification(
        recipient_id=tutor_id,
        notification_type=Notification.Type.ELIGIBILITY_REVOKED,
        payload={"project": ProjectRefSerializer(project).data},
        target_url="/profile",
    )
    publish_user_event(
        event="eligibility.revoked",
        data={"project_id": project.pk},
        user_ids=[tutor_id],
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
