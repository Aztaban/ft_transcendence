"""User/session group membership."""

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


def socket(*, user_id=7, session_key="session-a", status="active"):
    consumer = ConnectionConsumer()
    communicator = WebsocketCommunicator(consumer, "/ws/")
    communicator.scope["user"] = get_user_model()(id=user_id, status=status)
    communicator.scope["session"] = SimpleNamespace(session_key=session_key)
    return communicator, consumer


def members(layer):
    return {group: set(channels) for group, channels in layer.groups.items()}


def test_connection_joins_exactly_two_groups_and_leaves_on_disconnect(layer):
    async def connect():
        communicator, consumer = socket()
        try:
            assert await communicator.connect() == (True, None)
            assert members(layer) == {
                "user_7": {consumer.channel_name},
                "session_session-a": {consumer.channel_name},
            }
            assert await communicator.receive_nothing(timeout=0.05)
        finally:
            await communicator.disconnect()
        assert members(layer) == {}

    async_to_sync(connect)()


def test_tabs_devices_and_users_have_separate_memberships(layer):
    async def connect():
        first, first_consumer = socket()
        second, second_consumer = socket()
        device, device_consumer = socket(session_key="session-b")
        other, other_consumer = socket(user_id=8, session_key="session-c")
        communicators = [first, second, device, other]
        try:
            for communicator in communicators:
                assert await communicator.connect() == (True, None)
            assert members(layer) == {
                "user_7": {
                    first_consumer.channel_name,
                    second_consumer.channel_name,
                    device_consumer.channel_name,
                },
                "session_session-a": {first_consumer.channel_name, second_consumer.channel_name},
                "session_session-b": {device_consumer.channel_name},
                "user_8": {other_consumer.channel_name},
                "session_session-c": {other_consumer.channel_name},
            }
            await first.disconnect()
            assert members(layer) == {
                "user_7": {second_consumer.channel_name, device_consumer.channel_name},
                "session_session-a": {second_consumer.channel_name},
                "session_session-b": {device_consumer.channel_name},
                "user_8": {other_consumer.channel_name},
                "session_session-c": {other_consumer.channel_name},
            }
        finally:
            for communicator in communicators:
                await communicator.disconnect()
        assert members(layer) == {}

    async_to_sync(connect)()


def test_reconnect_replaces_old_channel_membership(layer):
    async def connect():
        first, first_consumer = socket()
        try:
            assert await first.connect() == (True, None)
        finally:
            await first.disconnect()
        second, second_consumer = socket()
        try:
            assert await second.connect() == (True, None)
            assert first_consumer.channel_name != second_consumer.channel_name
            assert members(layer) == {
                "user_7": {second_consumer.channel_name},
                "session_session-a": {second_consumer.channel_name},
            }
        finally:
            await second.disconnect()
        assert members(layer) == {}

    async_to_sync(connect)()


@pytest.mark.parametrize(
    "kwargs", [{"status": "suspended"}, {"status": "deleted"}, {"session_key": None}]
)
def test_rejected_connection_never_joins_groups(layer, kwargs):
    async def connect():
        communicator, _ = socket(**kwargs)
        try:
            assert await communicator.connect() == (True, None)
            assert await communicator.receive_output() == {"type": "websocket.close", "code": 4401}
            assert members(layer) == {}
        finally:
            await communicator.disconnect()
        assert members(layer) == {}

    async_to_sync(connect)()


def test_failed_second_join_removes_first_membership(layer, monkeypatch):
    original_add = layer.group_add

    async def fail_session_join(group, channel):
        if group == "session_session-a":
            raise RuntimeError("Channel layer unavailable")
        await original_add(group, channel)

    monkeypatch.setattr(layer, "group_add", fail_session_join)

    async def connect():
        communicator, _ = socket()
        with pytest.raises(RuntimeError, match="Channel layer unavailable"):
            await communicator.connect()
        assert members(layer) == {}

    async_to_sync(connect)()
