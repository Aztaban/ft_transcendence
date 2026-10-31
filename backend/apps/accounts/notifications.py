"""Role-change notification facts and the recipient's live refresh."""

from apps.core.events import publish_user_event
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def notify_role_changed(user_id: int, role_name: str, action: str) -> None:
    """Call inside the membership transaction, after the row is created or deleted.

    ``action`` is ``"assigned"`` or ``"revoked"`` (api-plan §8.8). Both the
    notification and ``role.changed`` wait for that transaction to commit.
    """
    create_notification(
        recipient_id=user_id,
        notification_type=Notification.Type.ROLE_CHANGED,
        payload={"role": role_name, "action": action},
        target_url="/profile",
    )
    publish_user_event(event="role.changed", data={}, user_ids=[user_id])
