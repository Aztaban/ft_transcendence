"""Real session-cookie authentication and origin checks."""

from datetime import timedelta

import pytest
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sessions.models import Session
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from config.asgi import application

pytestmark = pytest.mark.django_db(transaction=True)
PASSWORD = "WebsocketTestPassword123!"


@pytest.fixture(autouse=True)
def memory_channel_layer(settings):
    settings.CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


@pytest.fixture
def user():
    # Transactional tests flush the roles originally seeded by migrations.
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    return get_user_model().objects.create_user(
        email="websocket@example.com", display_name="Socket user", password=PASSWORD
    )


@pytest.fixture
def logged_in_client(user):
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(reverse("api:session"), HTTP_HOST="localhost")
    assert response.status_code == 200
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 200
    return client


def socket(session_key=None, *, origin=b"https://localhost", path="/ws/"):
    headers = []
    if origin is not None:
        headers.append((b"origin", origin))
    if session_key is not None:
        headers.append((b"cookie", f"{settings.SESSION_COOKIE_NAME}={session_key}".encode()))
    return WebsocketCommunicator(application, path, headers=headers)


def assert_unauthenticated(communicator):
    async def connect():
        try:
            assert await communicator.connect() == (True, None)
            assert await communicator.receive_output() == {"type": "websocket.close", "code": 4401}
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()


def test_http_login_cookie_authenticates_websocket(logged_in_client, user, monkeypatch):
    from apps.core.consumers import ConnectionConsumer

    identities = []
    original_connect = ConnectionConsumer.connect

    async def capture_identity(consumer):
        identities.append((consumer.scope["user"].pk, consumer.scope["session"].session_key))
        await original_connect(consumer)

    monkeypatch.setattr(ConnectionConsumer, "connect", capture_identity)
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value

    async def connect():
        communicator = socket(key)
        try:
            assert await communicator.connect() == (True, None)
            groups = get_channel_layer().groups
            assert set(groups) == {f"user_{user.pk}", f"session_{key}"}
            assert set(groups[f"user_{user.pk}"]) == set(groups[f"session_{key}"])
            assert len(groups[f"user_{user.pk}"]) == 1
            assert await communicator.receive_nothing(timeout=0.05)
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()
    assert identities == [(user.pk, key)]


@pytest.mark.parametrize("key", [None, "invalid", "a" * 32])
def test_missing_or_unknown_cookie_closes_with_4401(key):
    assert_unauthenticated(socket(key))


def test_expired_session_closes_with_4401(logged_in_client):
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value
    Session.objects.filter(session_key=key).update(
        expire_date=timezone.now() - timedelta(seconds=1)
    )
    assert_unauthenticated(socket(key))


def test_logged_out_cookie_cannot_be_reused(logged_in_client):
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value
    response = logged_in_client.post(
        reverse("api:logout"),
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=logged_in_client.cookies["csrftoken"].value,
    )
    assert response.status_code == 204
    assert_unauthenticated(socket(key))


@pytest.mark.parametrize("status", ["suspended", "deleted"])
def test_inactive_user_cookie_closes_with_4401(logged_in_client, user, status):
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value
    get_user_model().objects.filter(pk=user.pk).update(status=status)
    assert_unauthenticated(socket(key))


def test_changed_password_invalidates_cookie(logged_in_client, user):
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value
    user.set_password("ChangedWebsocketPassword123!")
    user.save(update_fields=["password"])
    assert_unauthenticated(socket(key))


def test_query_string_cannot_replace_session_cookie(logged_in_client):
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value
    assert_unauthenticated(socket(path=f"/ws/?sessionid={key}"))


@pytest.mark.parametrize(
    "origin", [None, b"null", b"https://untrusted.invalid", b"https://localhost.evil.invalid"]
)
def test_invalid_origin_rejects_even_authenticated_session(logged_in_client, origin):
    key = logged_in_client.cookies[settings.SESSION_COOKIE_NAME].value

    async def connect():
        communicator = socket(key, origin=origin)
        try:
            assert await communicator.connect() == (False, 1000)
        finally:
            await communicator.disconnect()

    async_to_sync(connect)()
