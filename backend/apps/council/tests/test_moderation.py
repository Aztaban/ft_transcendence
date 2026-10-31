"""DELETE a council message and reveal its sender (api-plan §10.6, §5.5)."""

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.council.models import SCMessage

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


@pytest.fixture
def api_client():
    return APIClient()


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
