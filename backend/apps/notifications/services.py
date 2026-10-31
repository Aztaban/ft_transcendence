"""Backend notification creation."""

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils.translation import gettext_lazy as _

from apps.accounts.models import User
from apps.core.events import publish_user_event
from apps.notifications.models import Notification


@transaction.atomic
def create_notification(
    *, recipient_id: int, notification_type: str, payload: dict, target_url: str = ""
) -> Notification | None:
    """Store event facts and schedule the recipient's badge refresh after commit.

    Workflow callers select recipients and construct the type-specific payload and
    target from api-plan §8.8. Call within the action's transaction so both changes
    roll back together. The shared event publisher waits for the outermost commit.
    """
    if not isinstance(payload, dict):
        raise ValidationError({"payload": _("Notification payload must be an object.")})

    # Serialize with anonymization: an in-flight workflow must not recreate
    # notifications for an account after its deletion cleanup has committed.
    recipient = User.objects.select_for_update().filter(pk=recipient_id).first()
    if recipient is not None and recipient.status == User.Status.DELETED:
        return None

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
