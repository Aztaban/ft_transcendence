"""Full ASGI connection lifecycle using real MySQL sessions and Redis."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from channels_redis.core import RedisChannelLayer
from django.conf import settings
from django.contrib.auth import SESSION_KEY, get_user_model
from django.contrib.sessions.models import Session
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from config.asgi import application

pytestmark = pytest.mark.django_db(transaction=True)
PASSWORD = "SocketIntegrationPassword123!"


@pytest.fixture
def redis_config(settings):
    config = dict(settings.CHANNEL_LAYERS["default"]["CONFIG"], prefix=f"test.ws.{uuid4().hex}")
    settings.CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": config}
    }
    return config


def login_client(user):
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(reverse("api:session"), HTTP_HOST="localhost")
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    assert response.json() == {
        "id": user.pk,
        "email": user.email,
        "display_name": user.display_name,
        "message": "Logged in successfully.",
    }
    return client


@pytest.fixture
def sessions():
    # Transactional tests flush the role rows seeded by migrations.
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    user = get_user_model().objects.create_user(
        email="socket-owner@example.com", display_name="Socket owner", password=PASSWORD
    )
    other = get_user_model().objects.create_user(
        email="socket-other@example.com", display_name="Other user", password=PASSWORD
    )
    return user, login_client(user), login_client(user), login_client(other)


def session_key(client):
    return client.cookies[settings.SESSION_COOKIE_NAME].value


def socket(key):
    return WebsocketCommunicator(
        application,
        "/ws/",
        headers=[
            (b"origin", b"https://localhost"),
            (b"cookie", f"{settings.SESSION_COOKIE_NAME}={key}".encode()),
        ],
    )


@asynccontextmanager
async def redis_publisher(config):
    # Separate clients exercise the Redis boundary used by other server/worker
    # instances. Flush only this test's prefix, never the shared Redis database.
    publisher = RedisChannelLayer(**config)
    receiver = get_channel_layer()
    try:
        assert publisher is not receiver
        yield publisher
    finally:
        await publisher.flush()
        await publisher.close_pools()
        await receiver.close_pools()


async def assert_session_ended(communicator):
    assert await communicator.receive_json_from(timeout=3) == {"event": "session.ended", "data": {}}
    assert await communicator.receive_output(timeout=3) == {"type": "websocket.close", "code": 4401}
    await communicator.disconnect(code=4401)


@pytest.mark.parametrize("target", ["session", "user"])
def test_independent_redis_publisher_targets_authenticated_tabs_and_devices(
    redis_config, sessions, target
):
    user, current_client, device_client, other_client = sessions
    key = session_key(current_client)

    async def connect():
        async with redis_publisher(redis_config) as publisher:
            first, second = socket(key), socket(key)
            device, other = socket(session_key(device_client)), socket(session_key(other_client))
            communicators = [first, second, device, other]
            try:
                for communicator in communicators:
                    assert await communicator.connect() == (True, None)
                group = f"session_{key}" if target == "session" else f"user_{user.pk}"
                await publisher.group_send(group, {"type": "session.ended", "data": {}})
                await assert_session_ended(first)
                await assert_session_ended(second)
                if target == "user":
                    await assert_session_ended(device)
                else:
                    assert await device.receive_nothing(timeout=0.1)
                assert await other.receive_nothing(timeout=0.1)
            finally:
                for communicator in communicators:
                    await communicator.disconnect()

    async_to_sync(connect)()


@pytest.mark.parametrize("action", ["logout", "suspend", "delete"])
def test_http_session_ending_reaches_redis_sockets_and_revoked_cookie_cannot_reconnect(
    redis_config, sessions, action
):
    user, current_client, device_client, other_client = sessions
    key = session_key(current_client)
    device_key = session_key(device_client)

    if action != "logout":
        admin_role, _ = Role.objects.get_or_create(name=Role.Name.ADMIN)
        admin = get_user_model().objects.get(pk=other_client.session[SESSION_KEY])
        admin.roles.add(admin_role)
        now = datetime(2026, 10, 31, 10, tzinfo=timezone.utc)
        get_user_model().objects.filter(pk=user.pk).update(
            created_at=now, last_login=now, language="en"
        )

    def end_session():
        if action == "logout":
            response = current_client.post(
                reverse("api:logout"),
                HTTP_HOST="localhost",
                HTTP_X_CSRFTOKEN=current_client.cookies["csrftoken"].value,
            )
            assert response.status_code == 204
            assert response.content == b""
        elif action == "delete":
            response = other_client.delete(
                reverse("api:admin-users-detail", kwargs={"user_id": user.pk}),
                {"reason": "Policy review"},
                format="json",
                HTTP_HOST="localhost",
                HTTP_X_CSRFTOKEN=other_client.cookies["csrftoken"].value,
            )
            assert response.status_code == 204
            assert response.content == b""
            assert get_user_model().objects.get(pk=user.pk).status == "deleted"
        else:
            response = other_client.post(
                reverse("api:admin-users-suspend", kwargs={"user_id": user.pk}),
                {"reason": "Policy review"},
                format="json",
                HTTP_HOST="localhost",
                HTTP_X_CSRFTOKEN=other_client.cookies["csrftoken"].value,
            )
            assert response.status_code == 200
            assert response.json() == {
                "id": user.pk,
                "display_name": "Socket owner",
                "email": "socket-owner@example.com",
                "avatar_url": None,
                "language": "en",
                "intra_login": None,
                "roles": [{"id": Role.objects.get(name="student").pk, "name": "student"}],
                "status": "suspended",
                "created_at": "2026-10-31T10:00:00Z",
                "last_login": "2026-10-31T10:00:00Z",
            }
        assert not Session.objects.filter(session_key=key).exists()
        assert Session.objects.filter(session_key=device_key).exists() == (action == "logout")

    async def connect():
        async with redis_publisher(redis_config):
            first, second = socket(key), socket(key)
            device, other = socket(device_key), socket(session_key(other_client))
            replay = socket(key)
            try:
                for communicator in (first, second, device, other):
                    assert await communicator.connect() == (True, None)
                await database_sync_to_async(end_session)()
                await assert_session_ended(first)
                await assert_session_ended(second)
                if action != "logout":
                    await assert_session_ended(device)
                else:
                    assert await device.receive_nothing(timeout=0.1)
                assert await other.receive_nothing(timeout=0.1)
                assert await replay.connect() == (True, None)
                assert await replay.receive_output() == {"type": "websocket.close", "code": 4401}
            finally:
                for communicator in (first, second, device, other, replay):
                    await communicator.disconnect()

    async_to_sync(connect)()


@pytest.mark.parametrize("payload", ['{"event":"session.ended","data":{}}', b"\x00\xff"])
def test_reconnect_does_not_replay_missed_events_and_ignores_client_frames(
    redis_config, sessions, payload
):
    _, current_client, _, _ = sessions
    key = session_key(current_client)

    async def connect():
        async with redis_publisher(redis_config) as publisher:
            first = socket(key)
            try:
                assert await first.connect() == (True, None)
            finally:
                await first.disconnect()
            # Transport-only event; the valid session remains in MySQL. This
            # tests missed-event semantics, not a real account termination.
            await publisher.group_send(f"session_{key}", {"type": "session.ended", "data": {}})
            reconnected = socket(key)
            try:
                assert await reconnected.connect() == (True, None)
                assert await reconnected.receive_nothing(timeout=0.1)
                if isinstance(payload, bytes):
                    await reconnected.send_to(bytes_data=payload)
                else:
                    await reconnected.send_to(text_data=payload)
                assert await reconnected.receive_nothing(timeout=0.1)
                await publisher.group_send(f"session_{key}", {"type": "session.ended", "data": {}})
                await assert_session_ended(reconnected)
            finally:
                await reconnected.disconnect()

    async_to_sync(connect)()
