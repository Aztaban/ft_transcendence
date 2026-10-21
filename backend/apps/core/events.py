"""Server-push delivery to user groups."""

from collections.abc import Iterable
from copy import deepcopy

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction


def publish_user_event(*, event: str, data: dict, user_ids: Iterable[int]) -> None:
    """Snapshot an event and its recipients, then publish only after commit.

    Callers select authorized recipients. Multiple tabs/devices are handled by
    their existing user group memberships; duplicate recipients receive one push.
    """
    recipients = tuple(sorted(set(user_ids)))
    if not recipients:
        return
    message = {"type": "user.event", "event": event, "data": deepcopy(data)}

    def dispatch():
        send = async_to_sync(get_channel_layer().group_send)
        for user_id in recipients:
            send(f"user_{user_id}", message)

    # Django logs failures from robust callbacks without failing the already
    # committed HTTP action or preventing later commit callbacks from running.
    transaction.on_commit(dispatch, robust=True)
