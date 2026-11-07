"""Four-byte characters survive the MySQL connection (utf8mb4, not utf8mb3)."""

from datetime import datetime, timezone

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.fields import DateTimeField
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.council.models import SCMessage
from apps.evaluations.models import EvaluationRequest, Project

pytestmark = pytest.mark.django_db

PASSWORD = "secret"
EMOJI_NAME = "Ada 😀"
EMOJI_BODY = "🍕 🍰 Fridge 🍓 🍣 ☕ 🧋"
EMOJI_NOTE = "Forwarded 😀"
EMOJI_EVALUATION_NOTE = "Need help 😀 ✨ 🔥"
NOW = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)


def iso(dt):
    return DateTimeField().to_representation(dt)


def test_display_name_round_trips_emoji(make_user):
    user = make_user("ada@example.com", display_name="Ada")
    client = APIClient()
    # A session loads the user from the database on each request.
    client.force_login(user)

    updated = client.patch(reverse("api:me"), {"display_name": EMOJI_NAME}, format="json")
    fetched = client.get(reverse("api:me"))

    assert updated.status_code == status.HTTP_204_NO_CONTENT
    assert updated.content == b""
    user.refresh_from_db()
    assert user.display_name == EMOJI_NAME
    assert fetched.status_code == status.HTTP_200_OK
    assert fetched.json() == {
        "id": user.id,
        "email": "ada@example.com",
        "display_name": EMOJI_NAME,
        "avatar_url": None,
        "language": "en",
        "roles": [{"id": Role.objects.get(name="student").id, "name": "student"}],
        "intra_login": None,
    }


def test_display_name_limit_counts_each_emoji_as_one_character(make_user):
    user = make_user("ada@example.com", display_name="Ada")
    client = APIClient()
    client.force_login(user)

    saved = client.patch(reverse("api:me"), {"display_name": "😀" * 64}, format="json")

    assert saved.status_code == status.HTTP_204_NO_CONTENT
    user.refresh_from_db()
    assert user.display_name == "😀" * 64

    rejected = client.patch(reverse("api:me"), {"display_name": "😀" * 65}, format="json")

    assert rejected.status_code == status.HTTP_400_BAD_REQUEST
    assert rejected.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the profile fields.",
            "fields": {"display_name": ["Ensure this field has no more than 64 characters."]},
        }
    }
    user.refresh_from_db()
    assert user.display_name == "😀" * 64


def test_discussion_note_round_trips_emoji(make_user):
    member = make_user("council@example.com", roles=(Role.Name.SC_MEMBER,))
    message = SCMessage.objects.create(body="The fridge is broken.")
    client = APIClient()
    client.force_authenticate(user=member)

    response = client.patch(
        reverse("api:sc-message-detail", args=[message.id]),
        {"discussion_note": EMOJI_NOTE, "discussion_note_version": 0},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    message.refresh_from_db()
    assert message.discussion_note == EMOJI_NOTE
    assert message.discussion_note_version == 1
    assert response.json() == {
        "id": message.id,
        "body": "The fridge is broken.",
        "read_at": None,
        "discussion_note": EMOJI_NOTE,
        "discussion_note_version": 1,
        "created_at": iso(message.created_at),
    }


def test_council_message_round_trips_emoji_through_a_session(make_user):
    sender = make_user("anna@example.com")
    member = make_user("council@example.com", roles=(Role.Name.SC_MEMBER,))
    browser = APIClient(enforce_csrf_checks=True)
    browser.get(reverse("api:session"), HTTP_HOST="localhost")
    login = browser.post(
        reverse("api:login"),
        {"email": sender.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )
    assert login.status_code == status.HTTP_200_OK

    created = browser.post(
        reverse("api:sc-message-list"),
        {"body": EMOJI_BODY},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value,
    )

    assert created.status_code == status.HTTP_201_CREATED
    message = SCMessage.objects.get()
    assert created.json() == {"id": message.id, "created_at": iso(message.created_at)}
    assert message.sender_id == sender.id
    assert message.body == EMOJI_BODY

    inbox = APIClient()
    inbox.force_authenticate(user=member)
    detail = inbox.get(reverse("api:sc-message-detail", args=[message.id]))

    assert detail.status_code == status.HTTP_200_OK
    assert detail.json() == {
        "id": message.id,
        "body": EMOJI_BODY,
        "read_at": None,
        "discussion_note": "",
        "discussion_note_version": 0,
        "created_at": iso(message.created_at),
    }


@pytest.mark.usefixtures("empty_project_catalog")
def test_evaluation_note_round_trips_emoji(monkeypatch):
    monkeypatch.setattr("django.utils.timezone.now", lambda: NOW)
    student = get_user_model().objects.create_user(
        id=7, email="alice@example.com", display_name="Alice", password=PASSWORD
    )
    Project.objects.create(id=4, slug="libft", name="Libft")
    client = APIClient()
    client.force_authenticate(user=student)

    response = client.post(
        reverse("api:evaluation-request-list"),
        {"project_id": 4, "note": EMOJI_EVALUATION_NOTE},
        format="json",
    )

    assert response.status_code == status.HTTP_201_CREATED
    created = EvaluationRequest.objects.get()
    assert created.note == EMOJI_EVALUATION_NOTE
    assert response.json() == {
        "id": created.pk,
        "student": {"id": 7, "display_name": "Alice", "avatar_url": None},
        "project": {"id": 4, "slug": "libft", "name": "Libft"},
        "note": EMOJI_EVALUATION_NOTE,
        "status": "pending",
        "picked_by": None,
        "starts_at": None,
        "ends_at": None,
        "cancelled_by": None,
        "cancelled_at": None,
        "expired_at": None,
        "result": None,
        "feedback": "",
        "completed_at": None,
        "is_history": False,
        "created_at": "2026-11-06T12:00:00Z",
        "updated_at": "2026-11-06T12:00:00Z",
    }
