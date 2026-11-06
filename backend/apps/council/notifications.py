"""Student Council notification facts and recipients (api-plan §8.8)."""

from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def notify_sc_message_created(message, *, recipient_ids) -> None:
    """Notify every SC Member inside the send transaction. The payload has no sender."""
    payload = {"message_id": message.pk}
    target_url = f"/council/inbox/{message.pk}"
    for recipient_id in sorted(set(recipient_ids)):
        create_notification(
            recipient_id=recipient_id,
            notification_type=Notification.Type.SC_MESSAGE_CREATED,
            payload=payload,
            target_url=target_url,
        )
