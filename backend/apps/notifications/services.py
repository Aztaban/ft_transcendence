"""Backend notification creation."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.core.events import publish_user_event
from apps.notifications.models import Notification


@transaction.atomic
def create_notification(
    *, recipient_id: int, notification_type: str, payload: dict, target_url: str = ""
) -> Notification:
    """Store event facts and schedule the recipient's badge refresh after commit.

    Workflow callers select recipients and construct the type-specific payload and
    target from api-plan §8.8. Call within the action's transaction so both changes
    roll back together. The shared event publisher waits for the outermost commit.
    """
    if not isinstance(payload, dict):
        raise ValidationError({"payload": _("Notification payload must be an object.")})

    notification = Notification(
        recipient_id=recipient_id,
        type=notification_type,
        payload=payload,
        target_url=target_url,
    )
    notification.full_clean()
    notification.save()
    publish_user_event(
        event="notification.created",
        data={"id": notification.pk},
        user_ids=[recipient_id],
    )
    return notification
