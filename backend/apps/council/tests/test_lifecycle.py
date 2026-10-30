"""One message, from send through moderation (api-plan §8.8, §8.10, §10.6).

Keeps the pieces several people edit on one path: sending, the council notification,
who may see the inbox, read state, the note version, revealing the sender, and deletion.
"""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.audit.models import AuditLog
from apps.council.models import SCMessage
from apps.notifications.models import Notification

pytestmark = pytest.mark.django_db

LIST = "api:sc-message-list"
DETAIL = "api:sc-message-detail"
REVEAL = "api:sc-message-reveal-sender"
BODY = "The fridge is broken again."
NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}
FORBIDDEN = {
    "error": {
        "code": "permission_denied",
        "message": "You do not have permission to perform this action.",
    }
}
CONFLICT = {
    "error": {
        "code": "edit_conflict",
        "message": "Someone else saved the note since you loaded it. Reload it and try again.",
    }
}


@pytest.fixture
def group_send(monkeypatch):
    sender = AsyncMock()
    monkeypatch.setattr(
        "apps.core.events.get_channel_layer", lambda: SimpleNamespace(group_send=sender)
    )
    return sender


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def iso(dt):
    return DateTimeField().to_representation(dt)


def shown(message):
    """The §8.10 representation: never the sender."""
    return {
        "id": message.id,
        "body": BODY,
        "read_at": iso(message.read_at) if message.read_at else None,
        "discussion_note": message.discussion_note,
        "discussion_note_version": message.discussion_note_version,
        "created_at": iso(message.created_at),
    }


def page(message):
    return {"count": 1, "next": None, "previous": None, "results": [shown(message)]}


def test_a_message_moves_from_send_through_moderation(
    make_user, group_send, django_capture_on_commit_callbacks
):
    anna = make_user("anna@example.com")
    ada = make_user("ada@example.com", roles=(Role.Name.SC_MEMBER,))
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    student = client_for(anna)
    council = client_for(ada)
    admin_client = client_for(admin)

    with django_capture_on_commit_callbacks(execute=True) as callbacks:
        sent = student.post(reverse(LIST), {"body": f"  {BODY}  "}, format="json")
        assert sent.status_code == status.HTTP_201_CREATED
        group_send.assert_not_awaited()

    message = SCMessage.objects.get()
    assert sent.json() == {"id": message.id, "created_at": iso(message.created_at)}
    assert message.sender_id == anna.id
    assert message.body == BODY
    assert message.read_at is None
    assert list(
        Notification.objects.order_by("recipient_id").values(
            "recipient_id", "type", "payload", "target_url", "read_at"
        )
    ) == [
        {
            "recipient_id": ada.id,
            "type": "sc_message.created",
            "payload": {"message_id": message.id},
            "target_url": f"/council/inbox/{message.id}",
            "read_at": None,
        }
    ]
    assert len(callbacks) == 1
    notification = Notification.objects.get()
    group_send.assert_awaited_once_with(
        f"user_{ada.id}",
        {
            "type": "user.event",
            "event": "notification.created",
            "data": {"id": notification.id},
        },
    )

    hidden_list = student.get(reverse(LIST))
    hidden_detail = student.get(reverse(DETAIL, args=[message.id]))
    assert hidden_list.status_code == status.HTTP_403_FORBIDDEN
    assert hidden_list.json() == FORBIDDEN
    assert hidden_detail.status_code == status.HTTP_404_NOT_FOUND
    assert hidden_detail.json() == NOT_FOUND

    for reader in (council, admin_client):
        unread = reader.get(reverse(LIST), {"unread": "true"})
        detail = reader.get(reverse(DETAIL, args=[message.id]))
        assert unread.status_code == status.HTTP_200_OK
        assert unread.json() == page(message)
        assert detail.status_code == status.HTTP_200_OK
        assert detail.json() == shown(message)
    message.refresh_from_db()
    assert message.read_at is None

    marked = council.patch(reverse(DETAIL, args=[message.id]), {"is_read": True}, format="json")
    message.refresh_from_db()
    assert marked.status_code == status.HTTP_200_OK
    assert marked.json() == shown(message)
    assert message.read_at is not None
    still_unread = council.get(reverse(LIST), {"unread": "true"})
    assert still_unread.json() == {"count": 0, "next": None, "previous": None, "results": []}
    kept = council.get(reverse(LIST))
    assert kept.json() == page(message)

    noted = council.patch(
        reverse(DETAIL, args=[message.id]),
        {"discussion_note": "Forwarded to the building manager.", "discussion_note_version": 0},
        format="json",
    )
    message.refresh_from_db()
    assert noted.status_code == status.HTTP_200_OK
    assert noted.json() == shown(message)
    assert message.discussion_note == "Forwarded to the building manager."
    assert message.discussion_note_version == 1
    read_at = message.read_at

    # An Admin may edit the same shared note (api-plan §10.6). The version they send is the one
    # the council member just saved.
    admin_note = admin_client.patch(
        reverse(DETAIL, args=[message.id]),
        {"discussion_note": "Building manager replied.", "discussion_note_version": 1},
        format="json",
    )
    message.refresh_from_db()
    assert admin_note.status_code == status.HTTP_200_OK
    assert admin_note.json() == shown(message)
    assert message.discussion_note == "Building manager replied."
    assert message.discussion_note_version == 2
    assert message.read_at == read_at

    conflict = council.patch(
        reverse(DETAIL, args=[message.id]),
        {"is_read": False, "discussion_note": "A later note.", "discussion_note_version": 1},
        format="json",
    )
    message.refresh_from_db()
    assert conflict.status_code == status.HTTP_409_CONFLICT
    assert conflict.json() == CONFLICT
    assert message.read_at == read_at
    assert message.discussion_note == "Building manager replied."
    assert message.discussion_note_version == 2

    # Only an Admin may look up the sender, and the inbox still hides them (api-plan §10.6).
    council_reveal = council.post(
        reverse(REVEAL, args=[message.id]), {"reason": "Investigating abuse."}, format="json"
    )
    student_reveal = student.post(
        reverse(REVEAL, args=[message.id]), {"reason": "Investigating abuse."}, format="json"
    )
    revealed = admin_client.post(
        reverse(REVEAL, args=[message.id]), {"reason": "Investigating abuse."}, format="json"
    )
    message.refresh_from_db()
    assert council_reveal.status_code == status.HTTP_403_FORBIDDEN
    assert council_reveal.json() == FORBIDDEN
    assert student_reveal.status_code == status.HTTP_404_NOT_FOUND
    assert student_reveal.json() == NOT_FOUND
    assert revealed.status_code == status.HTTP_200_OK
    assert revealed.json() == {
        "sender": {"id": anna.id, "display_name": "anna", "email": "anna@example.com"}
    }
    assert message.sender_id == anna.id
    assert council.get(reverse(DETAIL, args=[message.id])).json() == shown(message)

    council_delete = council.delete(
        reverse(DETAIL, args=[message.id]), {"reason": "Abusive content."}, format="json"
    )
    student_delete = student.delete(
        reverse(DETAIL, args=[message.id]), {"reason": "Abusive content."}, format="json"
    )
    removed = admin_client.delete(
        reverse(DETAIL, args=[message.id]), {"reason": "Abusive content."}, format="json"
    )
    assert council_delete.status_code == status.HTTP_403_FORBIDDEN
    assert council_delete.json() == FORBIDDEN
    assert student_delete.status_code == status.HTTP_404_NOT_FOUND
    assert student_delete.json() == NOT_FOUND
    assert removed.status_code == status.HTTP_204_NO_CONTENT
    assert removed.content == b""
    assert not SCMessage.objects.filter(pk=message.id).exists()
    assert council.get(reverse(LIST)).json() == {
        "count": 0,
        "next": None,
        "previous": None,
        "results": [],
    }
    assert list(
        Notification.objects.order_by("recipient_id").values(
            "recipient_id", "type", "payload", "target_url", "read_at"
        )
    ) == [
        {
            "recipient_id": ada.id,
            "type": "sc_message.created",
            "payload": {"message_id": message.id},
            "target_url": f"/council/inbox/{message.id}",
            "read_at": None,
        }
    ]
    assert group_send.await_count == 1
    assert list(
        AuditLog.objects.order_by("id").values(
            "actor_id", "action", "target_type", "target_id", "reason", "metadata"
        )
    ) == [
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
            "action": "sc_message.deleted",
            "target_type": "sc_message",
            "target_id": message.id,
            "reason": "Abusive content.",
            "metadata": {},
        },
    ]
