"""PATCH /api/v1/sc-messages/{id}/: read state and the shared note (api-plan §10.6, §8.10)."""

from datetime import datetime, timezone

import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.council.models import SCMessage

pytestmark = pytest.mark.django_db

PASSWORD = "secret"
DETAIL = "api:sc-message-detail"
INVALID = "Please correct the highlighted fields."
NOT_FOUND = {"error": {"code": "not_found", "message": "Not found."}}
FIRST_READ = datetime(2026, 1, 5, 10, 0, tzinfo=timezone.utc)


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def council(api_client, make_user):
    """An API client logged in as an SC Member."""
    api_client.force_authenticate(
        user=make_user("council@example.com", roles=(Role.Name.SC_MEMBER,))
    )
    return api_client


def iso(dt):
    return DateTimeField().to_representation(dt)


def update(client, message_id, data):
    return client.patch(reverse(DETAIL, args=[message_id]), data, format="json")


def unchanged(message):
    """The fields a rejected PATCH must leave as they were."""
    message.refresh_from_db()
    return message.read_at, message.discussion_note, message.discussion_note_version


def test_mark_read_sets_read_at_and_returns_the_message(council):
    message = SCMessage.objects.create(body="The fridge is broken.")

    response = update(council, message.id, {"is_read": True})

    message.refresh_from_db()
    assert message.read_at is not None
    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": message.id,
        "body": "The fridge is broken.",
        "read_at": iso(message.read_at),
        "discussion_note": "",
        "discussion_note_version": 0,
        "created_at": iso(message.created_at),
    }


def test_mark_read_again_keeps_the_first_read_time(council):
    message = SCMessage.objects.create(body="The fridge is broken.", read_at=FIRST_READ)

    response = update(council, message.id, {"is_read": True})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["read_at"] == "2026-01-05T10:00:00Z"


def test_mark_unread_clears_read_at(council):
    message = SCMessage.objects.create(body="The fridge is broken.", read_at=FIRST_READ)

    response = update(council, message.id, {"is_read": False})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["read_at"] is None
    message.refresh_from_db()
    assert message.read_at is None


def test_note_is_saved_and_its_version_goes_up(council):
    message = SCMessage.objects.create(
        body="The fridge is broken.", discussion_note="Asked the staff.", discussion_note_version=4
    )

    response = update(
        council,
        message.id,
        {"discussion_note": "Forwarded to the building manager.", "discussion_note_version": 4},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": message.id,
        "body": "The fridge is broken.",
        "read_at": None,
        "discussion_note": "Forwarded to the building manager.",
        "discussion_note_version": 5,
        "created_at": iso(message.created_at),
    }


def test_note_and_read_state_change_together(council):
    message = SCMessage.objects.create(body="The fridge is broken.")

    response = update(
        council,
        message.id,
        {"is_read": True, "discussion_note": "On it.", "discussion_note_version": 0},
    )

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["read_at"] is not None
    assert response.json()["discussion_note"] == "On it."
    assert response.json()["discussion_note_version"] == 1


def test_note_can_be_cleared(council):
    message = SCMessage.objects.create(
        body="The fridge is broken.", discussion_note="Asked the staff.", discussion_note_version=2
    )

    response = update(council, message.id, {"discussion_note": "", "discussion_note_version": 2})

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["discussion_note"] == ""
    assert response.json()["discussion_note_version"] == 3


def test_note_accepts_the_longest_allowed_text(council):
    message = SCMessage.objects.create(body="The fridge is broken.")

    response = update(
        council, message.id, {"discussion_note": "x" * 5000, "discussion_note_version": 0}
    )

    assert response.status_code == status.HTTP_200_OK


def test_note_with_an_old_version_is_a_conflict_and_changes_nothing(council):
    # Ben saved version 5 while Anna was still editing version 4.
    message = SCMessage.objects.create(
        body="The fridge is broken.", discussion_note="Ben's note.", discussion_note_version=5
    )

    response = update(
        council,
        message.id,
        {"is_read": True, "discussion_note": "Anna's note.", "discussion_note_version": 4},
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "edit_conflict",
            "message": "Someone else saved the note since you loaded it. Reload it and try again.",
        }
    }
    assert unchanged(message) == (None, "Ben's note.", 5)


@pytest.mark.parametrize(
    ("data", "fields"),
    [
        ({}, {"non_field_errors": ["Send is_read or discussion_note."]}),
        (
            {"discussion_note_version": 0},
            {"non_field_errors": ["Send is_read or discussion_note."]},
        ),
        ({"discussion_note": "On it."}, {"discussion_note_version": ["This field is required."]}),
        (
            {"discussion_note": "x" * 5001, "discussion_note_version": 0},
            {"discussion_note": ["Ensure this field has no more than 5000 characters."]},
        ),
        (
            {"discussion_note": "On it.", "discussion_note_version": -1},
            {"discussion_note_version": ["Ensure this value is greater than or equal to 0."]},
        ),
        (
            {"discussion_note": "On it.", "discussion_note_version": "four"},
            {"discussion_note_version": ["A valid integer is required."]},
        ),
        ({"is_read": "maybe"}, {"is_read": ["Must be a valid boolean."]}),
    ],
    ids=[
        "empty",
        "only-version",
        "note-without-version",
        "note-too-long",
        "negative-version",
        "version-not-a-number",
        "is-read-not-a-boolean",
    ],
)
def test_update_rejects_an_invalid_body(council, data, fields):
    message = SCMessage.objects.create(body="The fridge is broken.")

    response = update(council, message.id, data)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json() == {
        "error": {"code": "validation_error", "message": INVALID, "fields": fields}
    }
    assert unchanged(message) == (None, "", 0)


def test_update_is_open_to_admins(api_client, make_user):
    message = SCMessage.objects.create(body="The fridge is broken.")
    api_client.force_authenticate(user=make_user("admin@example.com", roles=(Role.Name.ADMIN,)))

    response = update(api_client, message.id, {"is_read": True})

    assert response.status_code == status.HTTP_200_OK


def test_update_of_a_missing_message_is_not_found(council):
    response = update(council, 999, {"is_read": True})

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == NOT_FOUND


@pytest.mark.parametrize(
    "roles",
    [(Role.Name.STUDENT,), (Role.Name.TUTOR,), (Role.Name.HEAD_TUTOR,)],
    ids=["student", "tutor", "head_tutor"],
)
def test_update_is_hidden_outside_the_council(api_client, make_user, roles):
    # 404, not 403: an existing message looks exactly like a missing one (§5.5).
    message = SCMessage.objects.create(body="The fridge is broken.")
    api_client.force_authenticate(user=make_user("anna@example.com", roles=roles))
    note = {"is_read": True, "discussion_note": "Mine now.", "discussion_note_version": 0}

    existing = update(api_client, message.id, note)
    missing = update(api_client, message.id + 1, note)

    assert existing.status_code == status.HTTP_404_NOT_FOUND
    assert existing.json() == NOT_FOUND
    assert missing.json() == NOT_FOUND
    assert unchanged(message) == (None, "", 0)


def test_update_needs_a_session(api_client):
    message = SCMessage.objects.create(body="The fridge is broken.")

    response = update(api_client, message.id, {"is_read": True})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }
    assert unchanged(message) == (None, "", 0)


def test_update_through_session_needs_csrf(make_user):
    member = make_user("council@example.com", roles=(Role.Name.SC_MEMBER,))
    message = SCMessage.objects.create(body="The fridge is broken.")
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": member.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK
    url = reverse(DETAIL, args=[message.id])

    without = browser.patch(url, {"is_read": True}, format="json", HTTP_HOST="localhost")
    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json()["error"]["code"] == "csrf_failed"
    assert unchanged(message) == (None, "", 0)

    with_token = browser.patch(
        url,
        {"is_read": True},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert with_token.status_code == status.HTTP_200_OK
    message.refresh_from_db()
    assert message.read_at is not None
