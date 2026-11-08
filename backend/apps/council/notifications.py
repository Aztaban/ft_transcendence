"""Student Council notification facts and recipients (api-plan §8.8)."""

from apps.core.events import publish_user_event
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


def delete_sc_message_created_notifications(message) -> None:
    """Drop this message's sc_message.created rows and refresh those recipients.

    Read and unread rows both go. Each recipient gets notification.updated with
    {} after commit (§9.3, §10.6). Call this inside the delete transaction,
    before the message itself is removed, so a rolled-back delete keeps the rows.
    """
    matching = Notification.objects.filter(
        type=Notification.Type.SC_MESSAGE_CREATED,
        payload__message_id=message.pk,
    )
    recipient_ids = list(matching.values_list("recipient_id", flat=True))
    matching.delete()
    publish_user_event(event="notification.updated", data={}, user_ids=recipient_ids)
