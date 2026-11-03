"""Sending a council message notifies every SC Member (api-plan §8.8, §10.6)."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.db import transaction
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.council.models import SCMessage
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

SEND = "api:sc-message-list"


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def group_send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


def send(client, body="The fridge is broken again."):
    return client.post(reverse(SEND), {"body": body}, format="json")


def iso(dt):
    return DateTimeField().to_representation(dt)


def test_send_notifies_every_sc_member_once_and_nobody_else(
    api_client, make_user, group_send, django_capture_on_commit_callbacks
):
    anna = make_user("anna@example.com")
    first = make_user("ada@example.com", roles=(Role.Name.SC_MEMBER, Role.Name.ADMIN))
    second = make_user("bea@example.com", roles=(Role.Name.SC_MEMBER,))
    make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    api_client.force_authenticate(user=anna)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = send(api_client)
        assert response.status_code == status.HTTP_201_CREATED
        group_send.assert_not_awaited()
        message_id = response.json()["id"]
        stored = list(
            Notification.objects.order_by("recipient_id").values(
                "recipient_id", "type", "payload", "target_url", "read_at"
            )
        )

    assert stored == [
        {
            "recipient_id": first.id,
            "type": "sc_message.created",
            "payload": {"message_id": message_id},
            "target_url": f"/council/inbox/{message_id}",
            "read_at": None,
        },
        {
            "recipient_id": second.id,
            "type": "sc_message.created",
            "payload": {"message_id": message_id},
            "target_url": f"/council/inbox/{message_id}",
            "read_at": None,
        },
    ]
    assert len(callbacks) == 2
    assert group_send.await_count == 2
    notifications = list(Notification.objects.order_by("recipient_id"))
    group_send.assert_has_awaits(
        [
            call(
                f"user_{first.id}",
                {
                    "type": "user.event",
                    "event": "notification.created",
                    "data": {"id": notifications[0].id},
                },
            ),
            call(
                f"user_{second.id}",
                {
                    "type": "user.event",
                    "event": "notification.created",
                    "data": {"id": notifications[1].id},
                },
            ),
        ]
    )


def test_an_sc_member_who_sends_is_notified_without_being_named(
    api_client, make_user, group_send, django_capture_on_commit_callbacks
):
    member = make_user("ada@example.com", roles=(Role.Name.SC_MEMBER,))
    api_client.force_authenticate(user=member)

    with django_capture_on_commit_callbacks(execute=True):
        response = send(api_client)

    message = SCMessage.objects.get()
    assert response.status_code == status.HTTP_201_CREATED
    assert response.json() == {"id": message.id, "created_at": iso(message.created_at)}
    assert list(
        Notification.objects.values("recipient_id", "type", "payload", "target_url", "read_at")
    ) == [
        {
            "recipient_id": member.id,
            "type": "sc_message.created",
            "payload": {"message_id": message.id},
            "target_url": f"/council/inbox/{message.id}",
            "read_at": None,
        }
    ]


def test_send_with_no_council_stores_the_message_and_no_notification(
    api_client, make_user, group_send, django_capture_on_commit_callbacks
):
    api_client.force_authenticate(user=make_user("anna@example.com"))

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = send(api_client)

    assert response.status_code == status.HTTP_201_CREATED
    assert SCMessage.objects.count() == 1
    assert not Notification.objects.exists()
    assert callbacks == []
    group_send.assert_not_awaited()


def test_invalid_send_creates_no_message_and_no_notification(api_client, make_user, group_send):
    make_user("ada@example.com", roles=(Role.Name.SC_MEMBER,))
    api_client.force_authenticate(user=make_user("anna@example.com"))

    response = api_client.post(reverse(SEND), {"body": ""}, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert not SCMessage.objects.exists()
    assert not Notification.objects.exists()
    group_send.assert_not_awaited()


def test_outer_rollback_discards_the_message_and_its_notifications(
    api_client, make_user, group_send, django_capture_on_commit_callbacks
):
    make_user("ada@example.com", roles=(Role.Name.SC_MEMBER,))
    api_client.force_authenticate(user=make_user("anna@example.com"))

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        with pytest.raises(RuntimeError, match="rollback"):
            with transaction.atomic():
                response = send(api_client)
                assert response.status_code == status.HTTP_201_CREATED
                assert Notification.objects.count() == 1
                raise RuntimeError("rollback")

    assert not SCMessage.objects.exists()
    assert not Notification.objects.exists()
    assert callbacks == []
    group_send.assert_not_awaited()
