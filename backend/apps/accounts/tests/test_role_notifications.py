"""Assign and revoke send role.changed only when the membership actually changes."""

from unittest.mock import call

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.notifications.models import Notification
from apps.notifications.services import create_notification

pytestmark = pytest.mark.django_db

TUTOR = Role.Name.TUTOR
ADMIN = Role.Name.ADMIN


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
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


def test_assign_notifies_the_user_after_commit(
    make_user, user_event_sender, django_capture_on_commit_callbacks, api_login
):
    admin = make_user("admin@example.com", roles=(ADMIN,))
    target = make_user("target@example.com")
    browser = api_login(admin)

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
        user_event_sender.assert_not_awaited()
        notification = assert_role_notification(target, TUTOR, "assigned")
    assert len(callbacks) == 2
    assert user_event_sender.await_args_list == [
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


def test_self_assignment_keeps_audit_and_event_without_notification(
    make_user, user_event_sender, django_capture_on_commit_callbacks, api_login
):
    admin = make_user("admin@example.com", roles=(ADMIN, Role.Name.STUDENT))
    browser = api_login(admin)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = assign(browser, admin, TUTOR, **csrf_header(browser))
        assert response.status_code == status.HTTP_200_OK
        assert response.json() == {
            "id": admin.pk,
            "display_name": admin.display_name,
            "avatar_url": None,
            "roles": [
                {"id": Role.objects.get(name=ADMIN).pk, "name": "admin"},
                {"id": Role.objects.get(name="student").pk, "name": "student"},
                {"id": Role.objects.get(name=TUTOR).pk, "name": "tutor"},
            ],
        }
        user_event_sender.assert_not_awaited()
        assert admin.has_role(TUTOR)
        assert not Notification.objects.exists()
        assert list(
            AuditLog.objects.values(
                "actor_id", "action", "target_type", "target_id", "reason", "metadata"
            )
        ) == [
            {
                "actor_id": admin.pk,
                "action": "role.assigned",
                "target_type": "user",
                "target_id": admin.pk,
                "reason": "",
                "metadata": {"role": "tutor"},
            }
        ]
    assert len(callbacks) == 1
    user_event_sender.assert_awaited_once_with(
        f"user_{admin.pk}", {"type": "user.event", "event": "role.changed", "data": {}}
    )


def test_revoke_notifies_the_user_after_commit(
    make_user, user_event_sender, django_capture_on_commit_callbacks
):
    admin = make_user("admin@example.com", roles=(ADMIN,))
    target = make_user("target@example.com", roles=(TUTOR,))

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = revoke(client_for(admin), target, TUTOR)
        assert response.status_code == status.HTTP_204_NO_CONTENT
        assert response.content == b""
        user_event_sender.assert_not_awaited()
        notification = assert_role_notification(target, TUTOR, "revoked")
    assert not target.has_role(TUTOR)
    assert len(callbacks) == 2
    assert user_event_sender.await_args_list == [
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


def test_assigning_a_role_already_held_sends_nothing(
    make_user, user_event_sender, django_capture_on_commit_callbacks
):
    admin = make_user("admin@example.com", roles=(ADMIN,))
    target = make_user("target@example.com", roles=(TUTOR,))

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = assign(client_for(admin), target, TUTOR)
    assert response.status_code == status.HTTP_200_OK
    assert target.roles.filter(name=TUTOR).count() == 1
    assert callbacks == []
    user_event_sender.assert_not_awaited()
    assert not Notification.objects.exists()


def test_revoking_a_role_not_held_sends_nothing(
    make_user, user_event_sender, django_capture_on_commit_callbacks
):
    admin = make_user("admin@example.com", roles=(ADMIN,))
    target = make_user("target@example.com")

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = revoke(client_for(admin), target, TUTOR)
    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert callbacks == []
    user_event_sender.assert_not_awaited()
    assert not Notification.objects.exists()


def test_notification_failure_rolls_back_the_assignment(
    make_user, user_event_sender, monkeypatch, django_capture_on_commit_callbacks
):
    admin = make_user("admin@example.com", roles=(ADMIN,))
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
    user_event_sender.assert_not_awaited()
