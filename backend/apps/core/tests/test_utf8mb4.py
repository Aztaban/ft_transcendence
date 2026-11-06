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
EMOJI_BODY = "🍕 🍰 Fridge 🍓 🍣 ☕ 🧋"
EMOJI_EVALUATION_NOTE = "Need help 😀 ✨ 🔥"
NOW = datetime(2026, 11, 6, 12, 0, tzinfo=timezone.utc)


def iso(dt):
    return DateTimeField().to_representation(dt)


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
