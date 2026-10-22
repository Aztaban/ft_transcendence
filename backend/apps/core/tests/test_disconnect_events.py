"""Disconnect cleanup and server-initiated session termination."""

from types import SimpleNamespace

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model

from apps.core.consumers import ConnectionConsumer


@pytest.fixture
def layer(settings):
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}
    return get_channel_layer()


def socket(*, user_id=7, session_key="session-a"):
    consumer = ConnectionConsumer()
    communicator = WebsocketCommunicator(consumer, "/ws/")
    communicator.scope["user"] = get_user_model()(id=user_id, status="active")
    communicator.scope["session"] = SimpleNamespace(session_key=session_key)
    return communicator


@pytest.mark.parametrize("group", ["session_session-a", "user_7"])
def test_session_ended_notifies_before_closing_only_target_connections(layer, group):
    async def connect():
        first = socket()
        second = socket()
        device = socket(session_key="session-b")
        other = socket(user_id=8, session_key="session-c")
        communicators = [first, second, device, other]
        try:
            for communicator in communicators:
                assert await communicator.connect() == (True, None)
            await layer.group_send(group, {"type": "session.ended", "data": {}})
            targets = [first, second, device] if group == "user_7" else [first, second]
            for communicator in targets:
                assert await communicator.receive_json_from() == {
                    "event": "session.ended",
                    "data": {},
                }
                assert await communicator.receive_output() == {
                    "type": "websocket.close",
                    "code": 4401,
                }
                await communicator.disconnect(code=4401)
            assert await other.receive_nothing(timeout=0.05)
            if group == "session_session-a":
                assert await device.receive_nothing(timeout=0.05)
                assert set(layer.groups) == {
                    "user_7",
                    "session_session-b",
                    "user_8",
                    "session_session-c",
                }
            else:
                assert set(layer.groups) == {"user_8", "session_session-c"}
        finally:
            for communicator in communicators:
                await communicator.disconnect()
        assert layer.groups == {}

    async_to_sync(connect)()


@pytest.mark.parametrize("code", [1000, 1001, 1006])
def test_client_disconnect_cleans_groups_and_stops_consumer(layer, code):
    async def connect():
        communicator = socket()
        assert await communicator.connect() == (True, None)
        await communicator.disconnect(code=code)
        assert layer.groups == {}
        assert communicator.future.done()
        assert communicator.future.result() is None

    async_to_sync(connect)()


def test_repeated_session_ended_does_not_send_after_close(layer):
    async def connect():
        communicator = socket()
        try:
            assert await communicator.connect() == (True, None)
            await layer.group_send("user_7", {"type": "session.ended", "data": {}})
            assert await communicator.receive_json_from() == {"event": "session.ended", "data": {}}
            assert await communicator.receive_output() == {"type": "websocket.close", "code": 4401}
            await layer.group_send("session_session-a", {"type": "session.ended", "data": {}})
            assert await communicator.receive_nothing(timeout=0.05)
        finally:
            await communicator.disconnect(code=4401)
        assert layer.groups == {}

    async_to_sync(connect)()
