"""Server-push delivery to user groups."""

from collections.abc import Iterable
from copy import deepcopy

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction


def _publish_to_groups(message: dict, groups: tuple[str, ...]) -> None:
    if not groups:
        return
    message = deepcopy(message)

    def dispatch():
        send = async_to_sync(get_channel_layer().group_send)
        for group in groups:
            send(group, message)

    # Delivery failures cannot undo committed actions or block later callbacks.
    transaction.on_commit(dispatch, robust=True)


def publish_user_event(*, event: str, data: dict, user_ids: Iterable[int]) -> None:
    """Snapshot an event and its recipients, then publish only after commit.

    Callers select authorized recipients. Multiple tabs/devices are handled by
    their existing user group memberships; duplicate recipients receive one push.
    """
    recipients = tuple(sorted(set(user_ids)))
    if not recipients:
        return
    _publish_to_groups(
        {"type": "user.event", "event": event, "data": data},
        tuple(f"user_{user_id}" for user_id in recipients),
    )


def publish_session_ended(*, user_id: int) -> None:
    """Tell all of a user's connections to notify the client and close with 4401."""
    _publish_to_groups({"type": "session.ended", "data": {}}, (f"user_{user_id}",))
