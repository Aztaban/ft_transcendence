"""GET /api/v1/sc-messages/ and /sc-messages/{id}/: the council inbox (api-plan §10.6, §8.10)."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.council.models import SCMessage

pytestmark = pytest.mark.django_db

User = get_user_model()
LIST = "api:sc-message-list"
DETAIL = "api:sc-message-detail"
NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user():
    def _make(email, roles=()):
        user = User.objects.create_user(
            email=email, password="secret", display_name=email.split("@")[0]
        )
        user.roles.set(Role.objects.filter(name__in=roles))
        return user

    return _make


@pytest.fixture
def council(api_client, make_user):
    """An API client logged in as an SC Member."""
    api_client.force_authenticate(user=make_user("council@example.com", (Role.Name.SC_MEMBER,)))
    return api_client


def iso(dt):
    return DateTimeField().to_representation(dt)


def shown(message):
    """The §8.10 representation of a message: never the sender."""
    return {
        "id": message.id,
        "body": message.body,
        "read_at": iso(message.read_at) if message.read_at else None,
        "discussion_note": message.discussion_note,
        "discussion_note_version": message.discussion_note_version,
        "created_at": iso(message.created_at),
    }


def test_list_shows_the_council_every_message_newest_first_without_the_sender(council, make_user):
    anna = make_user("anna@example.com")
    older = SCMessage.objects.create(sender=anna, body="The fridge is broken.")
    newer = SCMessage.objects.create(
        sender=anna,
        body="The printer is out of paper.",
        read_at=timezone.now(),
        discussion_note="Asked the staff.",
        discussion_note_version=1,
    )

    response = council.get(reverse(LIST))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "count": 2,
        "next": None,
        "previous": None,
        "results": [shown(newer), shown(older)],
    }


def test_list_is_open_to_admins(api_client, make_user):
    message = SCMessage.objects.create(body="The fridge is broken.")
    api_client.force_authenticate(user=make_user("admin@example.com", (Role.Name.ADMIN,)))

    response = api_client.get(reverse(LIST))

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["results"] == [shown(message)]


def test_list_keeps_only_unread_messages_when_asked(council):
    unread = SCMessage.objects.create(body="The fridge is broken.")
    SCMessage.objects.create(body="The printer is out of paper.", read_at=timezone.now())

    response = council.get(reverse(LIST), {"unread": "true"})

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [shown(unread)],
    }


@pytest.mark.parametrize("value", ["false", "yes", ""], ids=["false", "yes", "empty"])
def test_list_rejects_an_unknown_unread_value(council, value):
    response = council.get(reverse(LIST), {"unread": value})

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {"unread": ["Must be true."]},
        }
    }


def test_list_is_paginated(council):
    messages = [SCMessage.objects.create(body=f"Message {number}") for number in range(21)]

    first = council.get(reverse(LIST))
    second = council.get(reverse(LIST), {"page": 2})

    assert first.json()["count"] == 21
    assert first.json()["next"] == "http://testserver/api/v1/sc-messages/?page=2"
    assert first.json()["previous"] is None
    assert first.json()["results"] == [shown(message) for message in reversed(messages[1:])]
    assert second.json() == {
        "count": 21,
        "next": None,
        "previous": "http://testserver/api/v1/sc-messages/",
        "results": [shown(messages[0])],
    }


def test_list_needs_a_session(api_client):
    response = api_client.get(reverse(LIST))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


@pytest.mark.parametrize(
    "roles",
    [(Role.Name.STUDENT,), (Role.Name.TUTOR,), (Role.Name.HEAD_TUTOR,)],
    ids=["student", "tutor", "head_tutor"],
)
def test_list_is_forbidden_outside_the_council(api_client, make_user, roles):
    SCMessage.objects.create(body="The fridge is broken.")
    api_client.force_authenticate(user=make_user("anna@example.com", roles))

    response = api_client.get(reverse(LIST))

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }


def test_reading_the_inbox_does_not_count_toward_the_send_limit(council):
    for _ in range(12):
        assert council.get(reverse(LIST)).status_code == status.HTTP_200_OK

    for number in range(10):
        sent = council.post(reverse(LIST), {"body": f"Message {number}"}, format="json")
        assert sent.status_code == status.HTTP_201_CREATED


def test_detail_shows_one_message_without_marking_it_read(council, make_user):
    message = SCMessage.objects.create(
        sender=make_user("anna@example.com"), body="The fridge is broken."
    )

    response = council.get(reverse(DETAIL, args=[message.id]))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": message.id,
        "body": "The fridge is broken.",
        "read_at": None,
        "discussion_note": "",
        "discussion_note_version": 0,
        "created_at": iso(message.created_at),
    }
    message.refresh_from_db()
    assert message.read_at is None


def test_detail_of_a_missing_message_is_not_found(council):
    response = council.get(reverse(DETAIL, args=[999]))

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == NOT_FOUND


@pytest.mark.parametrize(
    "roles",
    [(Role.Name.STUDENT,), (Role.Name.TUTOR,), (Role.Name.HEAD_TUTOR,)],
    ids=["student", "tutor", "head_tutor"],
)
def test_detail_is_hidden_outside_the_council(api_client, make_user, roles):
    # 404, not 403: an existing message looks exactly like a missing one (§5.5).
    message = SCMessage.objects.create(body="The fridge is broken.")
    api_client.force_authenticate(user=make_user("anna@example.com", roles))

    existing = api_client.get(reverse(DETAIL, args=[message.id]))
    missing = api_client.get(reverse(DETAIL, args=[message.id + 1]))

    assert existing.status_code == status.HTTP_404_NOT_FOUND
    assert existing.json() == NOT_FOUND
    assert missing.json() == NOT_FOUND


def test_detail_needs_a_session(api_client):
    message = SCMessage.objects.create(body="The fridge is broken.")

    response = api_client.get(reverse(DETAIL, args=[message.id]))

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
