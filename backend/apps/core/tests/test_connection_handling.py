"""#231's consumer handshake and server-push-only behavior.

Scopes are supplied directly here; cookie authentication is tested in #232.
"""

from types import SimpleNamespace

import pytest
from asgiref.sync import async_to_sync
from channels.testing import WebsocketCommunicator
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser

from config.asgi import application

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture(autouse=True)
def memory_channel_layer(settings):
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def socket(*, user=None, session=None):
    communicator = WebsocketCommunicator(application, "/ws/")
    if user is not None:
        communicator.scope["user"] = user
    if session is not None:
        communicator.scope["session"] = session
    return communicator


@pytest.fixture
def active_user():
    return get_user_model()(id=7, status="active")


def test_active_session_connects_without_unsolicited_messages(active_user):
    async def connect():
        communicator = socket(user=active_user, session=SimpleNamespace(session_key="session-a"))
        try:
            assert await communicator.connect() == (True, None)
            assert await communicator.receive_nothing(timeout=0.05)
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()


@pytest.mark.parametrize(
    "case",
    ["missing_scope", "anonymous", "suspended", "deleted", "missing_session", "empty_session"],
)
def test_invalid_scope_accepts_then_closes_with_4401(active_user, case):
    user = active_user
    session = SimpleNamespace(session_key="session-a")
    if case == "missing_scope":
        user = session = None
    elif case == "anonymous":
        user = AnonymousUser()
    elif case in ("suspended", "deleted"):
        user = get_user_model()(id=7, status=case)
    elif case == "missing_session":
        session = None
    else:
        session = SimpleNamespace(session_key=None)

    async def connect():
        communicator = socket(user=user, session=session)
        try:
            assert await communicator.connect() == (True, None)
            assert await communicator.receive_output() == {"type": "websocket.close", "code": 4401}
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()


@pytest.mark.parametrize(
    "payload", ["not JSON", '{"event":"session.ended","data":{}}', b"\x00\xff"]
)
def test_client_messages_are_ignored(active_user, payload):
    async def connect():
        communicator = socket(user=active_user, session=SimpleNamespace(session_key="session-a"))
        try:
            assert await communicator.connect() == (True, None)
            if isinstance(payload, bytes):
                await communicator.send_to(bytes_data=payload)
            else:
                await communicator.send_to(text_data=payload)
            assert await communicator.receive_nothing(timeout=0.05)
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()


def test_tabs_have_independent_connection_lifetimes(active_user):
    async def connect():
        first = socket(user=active_user, session=SimpleNamespace(session_key="session-a"))
        second = socket(user=active_user, session=SimpleNamespace(session_key="session-a"))
        assert await first.connect() == (True, None)
        try:
            assert await second.connect() == (True, None)
            await first.disconnect()
            await second.send_to(text_data="ignored")
            assert await second.receive_nothing(timeout=0.05)
        finally:
            await second.disconnect()

    async_to_sync(connect)()
