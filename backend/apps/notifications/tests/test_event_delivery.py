"""Notification pushes and badge refreshes across real sessions, MySQL and Redis."""

from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import uuid4

import pytest
from asgiref.sync import async_to_sync
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.notifications.services import create_notification
from config.asgi import application

pytestmark = pytest.mark.django_db(transaction=True)
PASSWORD = "NotificationDeliveryPassword123!"
NOW = datetime(2026, 10, 22, 12, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def isolated_redis(settings, monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    config = dict(
        settings.CHANNEL_LAYERS["default"]["CONFIG"], prefix=f"test.notifications.{uuid4().hex}"
    )
    settings.CHANNEL_LAYERS = {
        "default": {"BACKEND": "channels_redis.core.RedisChannelLayer", "CONFIG": config}
    }


def login_client(user):
    client = APIClient(enforce_csrf_checks=True)
    response = client.get(reverse("api:session"))
    assert response.status_code == 200
    assert response.json() == {"authenticated": False, "user": None}
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
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
def participants():
    # Transactional tests flush roles seeded by migrations.
    Role.objects.get_or_create(name=Role.Name.STUDENT)
    owner = get_user_model().objects.create_user(
        email="notification-owner@example.com", display_name="Owner", password=PASSWORD
    )
    other = get_user_model().objects.create_user(
        email="notification-other@example.com", display_name="Other", password=PASSWORD
    )
    first = login_client(owner)
    return owner, other, [first, first, login_client(owner), login_client(other)]


@asynccontextmanager
async def connected_clients(clients):
    layer = get_channel_layer()
    sockets = []
    try:
        for client in clients:
            key = client.cookies[settings.SESSION_COOKIE_NAME].value
            socket = WebsocketCommunicator(
                application,
                "/ws/",
                headers=[
                    (b"origin", b"https://localhost"),
                    (b"cookie", f"{settings.SESSION_COOKIE_NAME}={key}".encode()),
                ],
            )
            sockets.append(socket)
            assert await socket.connect() == (True, None)
        yield sockets
    finally:
        for socket in sockets:
            await socket.disconnect()
        # Flush only this test's prefix, never the application's Redis keys.
        await layer.flush()
        await layer.close_pools()


def notify(recipient):
    return create_notification(
        recipient_id=recipient.pk,
        notification_type="resource.deleted",
        payload={"title": "Guide"},
    ).pk


def assert_count(client, count):
    response = client.get(reverse("api:notification-unread-count"))
    assert response.status_code == 200
    assert response.json() == {"count": count}


@pytest.mark.parametrize("rollback", [False, True], ids=["commit", "rollback"])
def test_creation_reaches_only_recipient_tabs_and_devices_after_commit(participants, rollback):
    owner, _, clients = participants

    def create():
        with transaction.atomic():
            notification_id = notify(owner)
            if rollback:
                transaction.set_rollback(True)
        return notification_id

    async def exercise():
        async with connected_clients(clients) as sockets:
            notification_id = await database_sync_to_async(create)()
            for index, socket in enumerate(sockets):
                if not rollback and index < 3:
                    assert await socket.receive_json_from(timeout=3) == {
                        "event": "notification.created",
                        "data": {"id": notification_id},
                    }
                    # REST is immediately consistent when the push arrives.
                    await database_sync_to_async(assert_count)(clients[index], 1)
                assert await socket.receive_nothing(timeout=0.1)
            await database_sync_to_async(assert_count)(clients[0], 0 if rollback else 1)
            await database_sync_to_async(assert_count)(clients[3], 0)

    async_to_sync(exercise)()
    assert Notification.objects.count() == (0 if rollback else 1)


@pytest.mark.parametrize("action", ["read", "read-all", "delete"])
def test_badge_refresh_reflects_read_and_delete_actions_on_every_session(participants, action):
    owner, other, clients = participants
    # A different user's unread notification must survive every owner action.
    notify(other)

    def change(notification_id):
        client = clients[0]
        headers = {"HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value}
        if action == "delete":
            response = client.delete(
                reverse("api:notification-delete", kwargs={"pk": notification_id}), **headers
            )
        elif action == "read-all":
            response = client.post(reverse("api:notification-read-all"), **headers)
        else:
            response = client.post(
                reverse("api:notification-read", kwargs={"pk": notification_id}), **headers
            )
        assert response.status_code == (200 if action == "read" else 204)
        if action == "read":
            assert response.json() == {
                "id": notification_id,
                "type": "resource.deleted",
                "payload": {"title": "Guide"},
                "target_url": "",
                "read_at": "2026-10-22T12:00:00Z",
                "created_at": "2026-10-22T12:00:00Z",
            }
        else:
            assert response.content == b""

    async def exercise():
        async with connected_clients(clients) as sockets:
            for _ in range(2):
                notification_id = await database_sync_to_async(notify)(owner)
                for socket in sockets[:3]:
                    assert await socket.receive_json_from(timeout=3) == {
                        "event": "notification.created",
                        "data": {"id": notification_id},
                    }
            for client in clients[:3]:
                await database_sync_to_async(assert_count)(client, 2)
            await database_sync_to_async(change)(notification_id)
            for client in clients[:3]:
                await database_sync_to_async(assert_count)(client, 0 if action == "read-all" else 1)
            await database_sync_to_async(assert_count)(clients[3], 1)
            for socket in sockets:
                assert await socket.receive_nothing(timeout=0.1)

    async_to_sync(exercise)()


def test_reconnect_recovers_missed_notification_and_count_over_rest(participants):
    owner, _, clients = participants

    async def exercise():
        async with connected_clients([clients[0]]):
            await database_sync_to_async(assert_count)(clients[0], 0)
        notification_id = await database_sync_to_async(notify)(owner)
        async with connected_clients([clients[0]]) as sockets:
            # Missed events are not replayed (api-plan §9.4).
            assert await sockets[0].receive_nothing(timeout=0.1)
            await database_sync_to_async(assert_count)(clients[0], 1)

            def refresh():
                response = clients[0].get(reverse("api:notification-list"), {"unread": "true"})
                assert response.status_code == 200
                assert response.json() == {
                    "count": 1,
                    "next": None,
                    "previous": None,
                    "results": [
                        {
                            "id": notification_id,
                            "type": "resource.deleted",
                            "payload": {"title": "Guide"},
                            "target_url": "",
                            "read_at": None,
                            "created_at": "2026-10-22T12:00:00Z",
                        }
                    ],
                }

            await database_sync_to_async(refresh)()

    async_to_sync(exercise)()
