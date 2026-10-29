"""Student Council notification facts and recipients (api-plan §8.8)."""

from django.contrib.auth import get_user_model

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def notify_sc_message_created(message) -> None:
    """Notify every SC Member inside the send transaction. The payload has no sender."""
    recipient_ids = (
        get_user_model()
        .objects.filter(roles__name=Role.Name.SC_MEMBER)
        .order_by("pk")
        .values_list("pk", flat=True)
        .distinct()
    )
    payload = {"message_id": message.pk}
    target_url = f"/council/inbox/{message.pk}"
    for recipient_id in recipient_ids:
        create_notification(
            recipient_id=recipient_id,
            notification_type=Notification.Type.SC_MESSAGE_CREATED,
            payload=payload,
            target_url=target_url,
        )
