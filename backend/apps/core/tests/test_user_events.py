"""User-group delivery preserves session isolation and the public event envelope."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model

from apps.core.consumers import ConnectionConsumer
from apps.core.events import publish_user_event


@pytest.fixture
def layer(settings):
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    return get_channel_layer()


def socket(user_id, session_key):
    communicator = WebsocketCommunicator(ConnectionConsumer.as_asgi(), "/ws/")
    communicator.scope["user"] = get_user_model()(id=user_id, status="active")
    communicator.scope["session"] = SimpleNamespace(session_key=session_key)
    return communicator


def test_user_event_reaches_all_recipient_tabs_and_devices_only(layer):
    async def connect():
        first, second = socket(7, "session-a"), socket(7, "session-a")
        device, other = socket(7, "session-b"), socket(8, "session-c")
        sockets = (first, second, device, other)
        try:
            for communicator in sockets:
                assert await communicator.connect() == (True, None)
            await layer.group_send(
                "user_7",
                {
                    "type": "user.event",
                    "event": "evaluation.confirmed",
                    "data": {"id": 17, "status": "confirmed"},
                },
            )
            for communicator in (first, second, device):
                assert await communicator.receive_json_from() == {
                    "event": "evaluation.confirmed",
                    "data": {"id": 17, "status": "confirmed"},
                }
                assert await communicator.receive_nothing(timeout=0.05)
            assert await other.receive_nothing(timeout=0.05)
            # The connection stays usable; domain events do not end a session.
            await layer.group_send("session_session-a", {"type": "session.ended", "data": {}})
            for communicator in (first, second):
                assert await communicator.receive_json_from() == {
                    "event": "session.ended",
                    "data": {},
                }
                assert await communicator.receive_output() == {
                    "type": "websocket.close",
                    "code": 4401,
                }
            assert await device.receive_nothing(timeout=0.05)
        finally:
            for communicator in sockets:
                await communicator.disconnect()

    async_to_sync(connect)()


def test_shared_delivery_snapshots_payload(monkeypatch):
    send = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=send)
    )
    callbacks = []
    monkeypatch.setattr(
        "apps.core.events.transaction.on_commit",
        lambda callback, **kwargs: callbacks.append(callback),
    )
    data = {"id": 17}
    publish_user_event(event="notification.created", data=data, user_ids=[7])
    data["id"] = 99
    send.assert_not_awaited()
    assert len(callbacks) == 1
    callbacks[0]()
    send.assert_awaited_once_with(
        "user_7", {"type": "user.event", "event": "notification.created", "data": {"id": 17}}
    )


@pytest.mark.django_db(transaction=True)
def test_failed_event_delivery_does_not_skip_later_commit_callbacks(monkeypatch, caplog):
    from django.db import transaction

    send = AsyncMock(side_effect=ConnectionError("Redis unavailable"))
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=send)
    )
    completed = []
    with transaction.atomic():
        publish_user_event(event="evaluation.confirmed", data={"id": 17}, user_ids=[7])
        transaction.on_commit(lambda: completed.append(True))
        send.assert_not_awaited()
    assert completed == [True]
    assert "Redis unavailable" in caplog.text
