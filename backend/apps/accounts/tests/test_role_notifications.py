"""Assign and revoke send role.changed only when the membership actually changes."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, call

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = pytest.mark.django_db
PASSWORD = "RoleRulesPassword123!"

TUTOR = Role.Name.TUTOR
ADMIN = Role.Name.ADMIN


def make_user(email, *roles):
    user = get_user_model().objects.create_user(
        email=email, password=PASSWORD, display_name=email.split("@")[0]
    )
    user.roles.set(Role.objects.filter(name__in=roles))
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def logged_in_browser(user):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == status.HTTP_200_OK
    return client


def csrf_header(client):
    return {"HTTP_HOST": "localhost", "HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value}


def assign(client, target, role, **extra):
    return client.post(
        reverse("api:users-assign-role", kwargs={"user_id": target.id}),
        {"role": role},
        format="json",
        **extra,
    )


def revoke(client, target, role_name, **extra):
    role = Role.objects.get(name=role_name)
    return client.delete(
        reverse("api:users-revoke-role", kwargs={"user_id": target.id, "role_id": role.id}),
        **extra,
    )


@pytest.fixture
def send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


def assert_role_notification(target, role, action):
    notification = Notification.objects.get()
    assert {
        "recipient_id": notification.recipient_id,
        "type": notification.type,
        "payload": notification.payload,
        "target_url": notification.target_url,
        "read_at": notification.read_at,
    } == {
        "recipient_id": target.pk,
        "type": "role.changed",
        "payload": {"role": role, "action": action},
        "target_url": "/profile",
        "read_at": None,
    }
    return notification


def test_assign_notifies_the_user_after_commit(send, django_capture_on_commit_callbacks):
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com")
    browser = logged_in_browser(admin)

    without = assign(browser, target, TUTOR, HTTP_HOST="localhost")
    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json() == {
        "error": {
            "code": "csrf_failed",
            "message": "CSRF verification failed. Reload the page and try again.",
        }
    }
    assert not target.has_role(TUTOR)
    assert not Notification.objects.exists()

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = assign(browser, target, TUTOR, **csrf_header(browser))
        assert response.status_code == status.HTTP_200_OK
        send.assert_not_awaited()
        notification = assert_role_notification(target, TUTOR, "assigned")
    assert len(callbacks) == 2
    assert send.await_args_list == [
        call(
            f"user_{target.pk}",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notification.pk},
            },
        ),
        call(
            f"user_{target.pk}",
            {"type": "user.event", "event": "role.changed", "data": {}},
        ),
    ]


def test_revoke_notifies_the_user_after_commit(send, django_capture_on_commit_callbacks):
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com", TUTOR)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = revoke(client_for(admin), target, TUTOR)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert response.content == b""
        send.assert_not_awaited()
        notification = assert_role_notification(target, TUTOR, "revoked")
    assert not target.has_role(TUTOR)
    assert len(callbacks) == 2
    assert send.await_args_list == [
        call(
            f"user_{target.pk}",
            {
                "type": "user.event",
                "event": "notification.created",
                "data": {"id": notification.pk},
            },
        ),
        call(
            f"user_{target.pk}",
            {"type": "user.event", "event": "role.changed", "data": {}},
        ),
    ]


def test_assigning_a_role_already_held_sends_nothing(send, django_capture_on_commit_callbacks):
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com", TUTOR)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = assign(client_for(admin), target, TUTOR)
    assert response.status_code == status.HTTP_200_OK
    assert target.roles.filter(name=TUTOR).count() == 1
    assert callbacks == []
    send.assert_not_awaited()
    assert not Notification.objects.exists()


def test_revoking_a_role_not_held_sends_nothing(send, django_capture_on_commit_callbacks):
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com")

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = revoke(client_for(admin), target, TUTOR)
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert callbacks == []
    send.assert_not_awaited()
    assert not Notification.objects.exists()


def test_notification_failure_rolls_back_the_assignment(
    send, monkeypatch, django_capture_on_commit_callbacks
):
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com")

    def fail_after_notification(**kwargs):
        create_notification(**kwargs)
        raise RuntimeError("Injected notification failure")

    monkeypatch.setattr("apps.accounts.notifications.create_notification", fail_after_notification)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = assign(client_for(admin), target, TUTOR)
    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json() == {
        "error": {
            "code": "server_error",
            "message": "Something went wrong. Please try again.",
        }
    }
    assert not target.has_role(TUTOR)
    assert not Notification.objects.exists()
    assert callbacks == []
    send.assert_not_awaited()
