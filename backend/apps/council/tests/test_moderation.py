"""DELETE a council message and reveal its sender (api-plan §10.6, §5.5)."""

from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import call

import pytest
from django.db import close_old_connections, connection
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.council.models import SCMessage
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

PASSWORD = "secret"
DETAIL = "api:sc-message-detail"
REVEAL = "api:sc-message-reveal-sender"
NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}
FORBIDDEN = {
    "error": {
        "code": "permission_denied",
        "message": "You do not have permission to perform this action.",
    }
}
UNAUTHENTICATED = {"error": {"code": "not_authenticated", "message": "Authentication required."}}
INVALID = "Please correct the highlighted fields."


def message_from(sender, body="The fridge is broken."):
    return SCMessage.objects.create(sender=sender, body=body)


def delete(client, pk, reason="Abusive content."):
    return client.delete(reverse(DETAIL, args=[pk]), {"reason": reason}, format="json")


def reveal(client, pk, reason="Investigating abuse."):
    return client.post(reverse(REVEAL, args=[pk]), {"reason": reason}, format="json")


def audit_rows():
    return list(
        AuditLog.objects.order_by("id").values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    )


def notification_rows():
    return list(
        Notification.objects.order_by("pk").values(
            "id", "recipient_id", "type", "payload", "target_url", "read_at"
        )
    )


def sc_notification(recipient, message, *, read_at=None):
    return Notification.objects.create(
        recipient=recipient,
        type=Notification.Type.SC_MESSAGE_CREATED,
        payload={"message_id": message.pk},
        target_url=f"/council/inbox/{message.pk}",
        read_at=read_at,
    )


def test_admin_deletes_a_message_and_writes_an_audit_row(api_client, make_user):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    message = message_from(alice)
    api_client.force_authenticate(user=admin)

    response = delete(api_client, message.id, "  Abusive content.  ")

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert response.content == b""
    assert not SCMessage.objects.filter(pk=message.id).exists()
    assert audit_rows() == [
        {
            "actor_id": admin.id,
            "action": "sc_message.deleted",
            "target_type": "sc_message",
            "target_id": message.id,
            "reason": "Abusive content.",
            "metadata": {},
        }
    ]


def test_admin_reveals_the_sender_and_the_inbox_stays_anonymous(api_client, make_user):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    member = make_user("ada@example.com", "Ada", (Role.Name.SC_MEMBER,))
    message = message_from(alice)
    api_client.force_authenticate(user=admin)

    first = reveal(api_client, message.id, "  Investigating abuse.  ")
    second = reveal(api_client, message.id, "Asked again.")

    assert first.status_code == status.HTTP_200_OK
    assert first.json() == {
        "sender": {"id": alice.id, "display_name": "Alice", "email": "alice@example.com"}
    }
    assert second.json() == first.json()
    assert audit_rows() == [
        {
            "actor_id": admin.id,
            "action": "sc_message.sender_revealed",
            "target_type": "sc_message",
            "target_id": message.id,
            "reason": "Investigating abuse.",
            "metadata": {},
        },
        {
            "actor_id": admin.id,
            "action": "sc_message.sender_revealed",
            "target_type": "sc_message",
            "target_id": message.id,
            "reason": "Asked again.",
            "metadata": {},
        },
    ]
    message.refresh_from_db()
    assert message.sender_id == alice.id
    api_client.force_authenticate(user=member)
    inbox = api_client.get(reverse(DETAIL, args=[message.id]))
    assert inbox.status_code == status.HTTP_200_OK
    assert inbox.json() == {
        "id": message.id,
        "body": "The fridge is broken.",
        "read_at": None,
        "discussion_note": "",
        "discussion_note_version": 0,
        "created_at": DateTimeField().to_representation(message.created_at),
    }


def test_reveal_of_a_deleted_account_returns_null_and_is_still_audited(api_client, make_user):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    message = message_from(alice)
    alice.delete()
    api_client.force_authenticate(user=admin)

    response = reveal(api_client, message.id)

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"sender": None}
    assert audit_rows() == [
        {
            "actor_id": admin.id,
            "action": "sc_message.sender_revealed",
            "target_type": "sc_message",
            "target_id": message.id,
            "reason": "Investigating abuse.",
            "metadata": {},
        }
    ]


def test_a_failed_delete_rolls_the_audit_row_back(api_client, make_user, monkeypatch):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    message = message_from(alice)
    api_client.force_authenticate(user=admin)

    def fail_delete(self, *args, **kwargs):
        raise RuntimeError("storage failed")

    monkeypatch.setattr(SCMessage, "delete", fail_delete)
    response = delete(api_client, message.id)

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    assert SCMessage.objects.filter(pk=message.id).exists()
    assert audit_rows() == []


@pytest.mark.parametrize(
    "call,body,message",
    [
        (delete, {}, "This field is required."),
        (delete, {"reason": ""}, "This field may not be blank."),
        (delete, {"reason": "   "}, "This field may not be blank."),
        (delete, {"reason": "x" * 501}, "Ensure this field has no more than 500 characters."),
        (reveal, {}, "This field is required."),
        (reveal, {"reason": "too short"}, "Ensure this field has at least 10 characters."),
        (reveal, {"reason": "x" * 501}, "Ensure this field has no more than 500 characters."),
    ],
)
def test_moderation_rejects_a_bad_reason(api_client, make_user, call, body, message):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    stored = message_from(alice)
    api_client.force_authenticate(user=admin)

    if call is delete:
        response = api_client.delete(reverse(DETAIL, args=[stored.id]), body, format="json")
    else:
        response = api_client.post(reverse(REVEAL, args=[stored.id]), body, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {"code": "validation_error", "message": INVALID, "fields": {"reason": [message]}}
    }
    assert SCMessage.objects.filter(pk=stored.id).exists()
    assert audit_rows() == []


@pytest.mark.parametrize("length", [1, 500])
def test_delete_accepts_the_reason_length_bounds(api_client, make_user, length):
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    stored = message_from(make_user("alice@example.com", "Alice"))
    api_client.force_authenticate(user=admin)

    response = delete(api_client, stored.id, "x" * length)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert audit_rows()[0]["reason"] == "x" * length


@pytest.mark.parametrize("length", [10, 500])
def test_reveal_accepts_the_reason_length_bounds(api_client, make_user, length):
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    stored = message_from(make_user("alice@example.com", "Alice"))
    api_client.force_authenticate(user=admin)

    response = reveal(api_client, stored.id, "x" * length)

    assert response.status_code == status.HTTP_200_OK
    assert audit_rows()[0]["reason"] == "x" * length


def test_moderation_needs_a_session(api_client, make_user):
    stored = message_from(make_user("alice@example.com", "Alice"))

    assert delete(api_client, stored.id).status_code == status.HTTP_401_UNAUTHORIZED
    assert delete(api_client, stored.id).json() == UNAUTHENTICATED
    assert reveal(api_client, stored.id).json() == UNAUTHENTICATED
    assert SCMessage.objects.filter(pk=stored.id).exists()
    assert audit_rows() == []


@pytest.mark.parametrize(
    "roles",
    [(Role.Name.STUDENT,), (Role.Name.TUTOR,), (Role.Name.HEAD_TUTOR,)],
    ids=["student", "tutor", "head_tutor"],
)
@pytest.mark.parametrize("call", [delete, reveal], ids=["delete", "reveal"])
def test_moderation_is_hidden_outside_the_council(api_client, make_user, roles, call):
    stored = message_from(make_user("alice@example.com", "Alice"))
    api_client.force_authenticate(user=make_user("anna@example.com", "Anna", roles))

    existing = call(api_client, stored.id)
    missing = call(api_client, stored.id + 1)

    assert existing.status_code == status.HTTP_404_NOT_FOUND
    assert existing.json() == NOT_FOUND
    assert missing.json() == NOT_FOUND
    assert SCMessage.objects.filter(pk=stored.id).exists()
    assert audit_rows() == []


@pytest.mark.parametrize("call", [delete, reveal], ids=["delete", "reveal"])
def test_council_member_cannot_moderate(api_client, make_user, call):
    stored = message_from(make_user("alice@example.com", "Alice"))
    api_client.force_authenticate(user=make_user("ada@example.com", "Ada", (Role.Name.SC_MEMBER,)))

    existing = call(api_client, stored.id)
    missing = call(api_client, stored.id + 1)

    assert existing.status_code == status.HTTP_403_FORBIDDEN
    assert existing.json() == FORBIDDEN
    assert missing.status_code == status.HTTP_403_FORBIDDEN
    assert missing.json() == FORBIDDEN
    assert SCMessage.objects.filter(pk=stored.id).exists()
    assert audit_rows() == []


@pytest.mark.parametrize("call", [delete, reveal], ids=["delete", "reveal"])
def test_admin_gets_not_found_for_a_missing_message(api_client, make_user, call):
    api_client.force_authenticate(user=make_user("admin@example.com", "Admin", (Role.Name.ADMIN,)))

    response = call(api_client, 999)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == NOT_FOUND
    assert audit_rows() == []


def test_moderation_through_a_session_needs_csrf(make_user):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    stored = message_from(alice)
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": admin.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK
    token = browser.cookies["csrftoken"].value

    hidden_reveal = browser.post(
        reverse(REVEAL, args=[stored.id]),
        {"reason": "Investigating abuse."},
        format="json",
        HTTP_HOST="localhost",
    )
    revealed = browser.post(
        reverse(REVEAL, args=[stored.id]),
        {"reason": "Investigating abuse."},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=token,
    )
    hidden_delete = browser.delete(
        reverse(DETAIL, args=[stored.id]),
        {"reason": "Abusive content."},
        format="json",
        HTTP_HOST="localhost",
    )
    removed = browser.delete(
        reverse(DETAIL, args=[stored.id]),
        {"reason": "Abusive content."},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=token,
    )

    assert hidden_reveal.status_code == status.HTTP_403_FORBIDDEN
    assert hidden_reveal.json()["error"]["code"] == "csrf_failed"
    assert revealed.status_code == status.HTTP_200_OK
    assert revealed.json() == {
        "sender": {"id": alice.id, "display_name": "Alice", "email": "alice@example.com"}
    }
    assert hidden_delete.status_code == status.HTTP_403_FORBIDDEN
    assert hidden_delete.json()["error"]["code"] == "csrf_failed"
    assert removed.status_code == status.HTTP_204_NO_CONTENT
    assert not SCMessage.objects.filter(pk=stored.id).exists()
    assert [row["action"] for row in audit_rows()] == [
        "sc_message.sender_revealed",
        "sc_message.deleted",
    ]


def test_delete_through_a_session_removes_its_notifications(
    make_user, user_event_sender, django_capture_on_commit_callbacks
):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    first = make_user("ada@example.com", "Ada", (Role.Name.SC_MEMBER,))
    second = make_user("bea@example.com", "Bea", (Role.Name.SC_MEMBER,))
    make_user("cara@example.com", "Cara", (Role.Name.SC_MEMBER,))
    message = message_from(alice)
    other = message_from(alice, "The printer is jammed.")
    sc_notification(first, message)
    sc_notification(second, message, read_at=timezone.now())
    sc_notification(first, other)
    Notification.objects.create(
        recipient=second,
        type=Notification.Type.ROLE_CHANGED,
        payload={"role": "sc_member", "action": "assigned"},
        target_url="/profile",
    )
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": admin.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = browser.delete(
            reverse(DETAIL, args=[message.id]),
            {"reason": "Abusive content."},
            format="json",
            HTTP_HOST="localhost",
            HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
        )
        assert response.status_code == status.HTTP_204_NO_CONTENT
        user_event_sender.assert_not_awaited()

    assert response.content == b""
    assert not SCMessage.objects.filter(pk=message.id).exists()
    assert list(
        Notification.objects.order_by("pk").values(
            "recipient_id", "type", "payload", "target_url", "read_at"
        )
    ) == [
        {
            "recipient_id": first.id,
            "type": "sc_message.created",
            "payload": {"message_id": other.id},
            "target_url": f"/council/inbox/{other.id}",
            "read_at": None,
        },
        {
            "recipient_id": second.id,
            "type": "role.changed",
            "payload": {"role": "sc_member", "action": "assigned"},
            "target_url": "/profile",
            "read_at": None,
        },
    ]
    assert len(callbacks) == 1
    assert user_event_sender.await_count == 2
    user_event_sender.assert_has_awaits(
        [
            call(
                f"user_{user_id}",
                {"type": "user.event", "event": "notification.updated", "data": {}},
            )
            for user_id in sorted((first.id, second.id))
        ]
    )


def test_a_bad_reason_keeps_the_message_notifications(
    api_client, make_user, user_event_sender, django_capture_on_commit_callbacks
):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    member = make_user("ada@example.com", "Ada", (Role.Name.SC_MEMBER,))
    message = message_from(alice)
    sc_notification(member, message, read_at=timezone.now())
    before = notification_rows()
    api_client.force_authenticate(user=admin)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = delete(api_client, message.id, "")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": INVALID,
            "fields": {"reason": ["This field may not be blank."]},
        }
    }
    assert SCMessage.objects.filter(pk=message.id).exists()
    assert notification_rows() == before
    assert audit_rows() == []
    assert callbacks == []
    user_event_sender.assert_not_awaited()


def test_a_missing_message_keeps_the_notifications(
    api_client, make_user, user_event_sender, django_capture_on_commit_callbacks
):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    member = make_user("ada@example.com", "Ada", (Role.Name.SC_MEMBER,))
    message = message_from(alice)
    sc_notification(member, message)
    before = notification_rows()
    api_client.force_authenticate(user=admin)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = delete(api_client, message.id + 1)

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == NOT_FOUND
    assert SCMessage.objects.filter(pk=message.id).exists()
    assert notification_rows() == before
    assert audit_rows() == []
    assert callbacks == []
    user_event_sender.assert_not_awaited()


def test_a_rolled_back_delete_keeps_the_notifications(
    api_client, make_user, user_event_sender, django_capture_on_commit_callbacks, monkeypatch
):
    alice = make_user("alice@example.com", "Alice")
    admin = make_user("admin@example.com", "Admin", (Role.Name.ADMIN,))
    member = make_user("ada@example.com", "Ada", (Role.Name.SC_MEMBER,))
    message = message_from(alice)
    sc_notification(member, message)
    before = notification_rows()
    api_client.force_authenticate(user=admin)

    def fail_delete(self, *args, **kwargs):
        raise RuntimeError("storage failed")

    monkeypatch.setattr(SCMessage, "delete", fail_delete)
    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        response = delete(api_client, message.id)

    assert response.status_code == status.HTTP_500_INTERNAL_SERVER_ERROR
    assert response.json() == {
        "error": {"code": "server_error", "message": "Something went wrong. Please try again."}
    }
    assert SCMessage.objects.filter(pk=message.id).exists()
    assert notification_rows() == before
    assert audit_rows() == []
    assert callbacks == []
    user_event_sender.assert_not_awaited()


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("call", [delete, reveal], ids=["delete", "reveal"])
def test_moderation_and_sender_anonymization_follow_the_same_lock_order(
    make_user, seeded_roles, monkeypatch, call, user_event_sender
):
    from apps.accounts.services import deletion

    sender = make_user("sender@example.com", "Sender")
    moderator = make_user("moderator@example.com", "Moderator", (Role.Name.ADMIN,))
    deleting_admin = make_user("deleting@example.com", "Deleting admin", (Role.Name.ADMIN,))
    message = message_from(sender)
    users_locked = Event()
    moderation_lock_attempted = Event()
    original_lock_users = deletion.lock_users
    locking_queries = []

    def pause_deletion_after_user_locks(*user_ids):
        original_lock_users(*user_ids)
        users_locked.set()
        assert moderation_lock_attempted.wait(timeout=10)

    monkeypatch.setattr(deletion, "lock_users", pause_deletion_after_user_locks)

    def anonymize():
        close_old_connections()
        try:
            deletion.delete_account(actor=deleting_admin, user_id=sender.pk, reason="Requested")
        finally:
            close_old_connections()

    def moderate():
        close_old_connections()
        try:
            assert users_locked.wait(timeout=10)

            def track_lock(execute, sql, params, many, context):
                if "FOR UPDATE" in sql:
                    locking_queries.append(sql)
                    # Resume anonymization once moderation tries its first lock.
                    moderation_lock_attempted.set()
                return execute(sql, params, many, context)

            client = APIClient()
            client.force_authenticate(moderator)
            with connection.execute_wrapper(track_lock):
                response = call(client, message.pk)
            assert response.status_code == (204 if call is delete else 200)
            if call is reveal:
                assert response.json() == {"sender": None}
        finally:
            close_old_connections()

    with ThreadPoolExecutor(max_workers=2) as pool:
        deletion_future = pool.submit(anonymize)
        moderation_future = pool.submit(moderate)
        deletion_future.result(timeout=20)
        moderation_future.result(timeout=20)

    assert "`user`" in locking_queries[0]
    assert "sc_message" not in locking_queries[0]
    sender.refresh_from_db()
    assert sender.status == "deleted"
    assert list(AuditLog.objects.order_by("pk").values_list("action", flat=True)) == [
        "user.deleted",
        "sc_message.deleted" if call is delete else "sc_message.sender_revealed",
    ]
