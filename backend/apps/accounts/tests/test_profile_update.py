"""API tests for PATCH /api/v1/users/me/ (isolated MySQL test database)."""

import json

import pytest
from django.contrib.auth import get_user_model
from django.test import Client
from django.urls import reverse
from rest_framework import status

pytestmark = pytest.mark.django_db


def _create_user(**overrides):
    defaults = {
        "email": "user@example.com",
        "password": "secret",
        "display_name": "User",
        "language": "en",
    }
    defaults.update(overrides)
    return get_user_model().objects.create_user(**defaults)


def _patch_me(client, payload, **headers):
    return client.patch(
        reverse("api:me"),
        data=json.dumps(payload),
        content_type="application/json",
        headers=headers,
    )


def test_patch_requires_authentication(client):
    response = _patch_me(client, {"display_name": "Nobody"})

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
    assert response.json() == {
        "error": {
            "code": "not_authenticated",
            "message": "Authentication required.",
        }
    }


def test_patch_updates_display_name_and_returns_empty_204(client):
    user = _create_user(display_name="Old Name")
    client.force_login(user)

    response = _patch_me(client, {"display_name": "New Name"})

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert response.content == b""
    user.refresh_from_db()
    assert user.display_name == "New Name"


def test_patch_updates_both_fields(client):
    user = _create_user(display_name="Old Name", language="en")
    client.force_login(user)

    response = _patch_me(client, {"display_name": "Nuevo", "language": "es"})

    assert response.status_code == status.HTTP_204_NO_CONTENT
    user.refresh_from_db()
    assert (user.display_name, user.language) == ("Nuevo", "es")


def test_patch_with_only_language_keeps_display_name(client):
    user = _create_user(display_name="Keep Me", language="en")
    client.force_login(user)

    response = _patch_me(client, {"language": "cs"})

    assert response.status_code == status.HTTP_204_NO_CONTENT
    user.refresh_from_db()
    assert user.language == "cs"
    assert user.display_name == "Keep Me"


def test_patch_changes_only_the_logged_in_user(client):
    alice = _create_user(email="alice@example.com", display_name="Alice")
    bob = _create_user(email="bob@example.com", display_name="Bob")
    client.force_login(alice)

    _patch_me(client, {"display_name": "Alice 2"})

    alice.refresh_from_db()
    bob.refresh_from_db()
    assert alice.display_name == "Alice 2"
    assert bob.display_name == "Bob"


def test_patch_accepts_display_name_at_max_length(client):
    user = _create_user()
    client.force_login(user)

    response = _patch_me(client, {"display_name": "a" * 64})

    assert response.status_code == status.HTTP_204_NO_CONTENT
    user.refresh_from_db()
    assert user.display_name == "a" * 64


@pytest.mark.parametrize(
    ("payload", "bad_field"),
    [
        ({"language": "cz"}, "language"),
        ({"language": ""}, "language"),
        ({"display_name": "a" * 65}, "display_name"),
        ({"display_name": ""}, "display_name"),
        ({"display_name": None}, "display_name"),
    ],
)
def test_patch_rejects_invalid_values_without_saving(client, payload, bad_field):
    user = _create_user(display_name="Unchanged", language="en")
    client.force_login(user)

    response = _patch_me(client, payload)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert set(error["fields"]) == {bad_field}
    user.refresh_from_db()
    assert (user.display_name, user.language) == ("Unchanged", "en")


def test_patch_with_one_invalid_field_saves_nothing(client):
    user = _create_user(display_name="Unchanged", language="en")
    client.force_login(user)

    response = _patch_me(client, {"display_name": "Valid", "language": "cz"})

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    user.refresh_from_db()
    assert user.display_name == "Unchanged"


@pytest.mark.parametrize(
    "payload",
    [
        {"email": "hijack@example.com"},
        {"intra_login": "hijack42"},
        {"id": 9999},
        {"is_staff": True},
        {"is_superuser": True},
        {"status": "suspended"},
    ],
)
def test_patch_ignores_non_editable_fields(client, payload):
    user = _create_user(email="owner@example.com", intra_login="owner42")
    client.force_login(user)
    original_id = user.id

    _patch_me(client, payload)

    user.refresh_from_db()
    assert user.id == original_id
    assert user.email == "owner@example.com"
    assert user.intra_login == "owner42"
    assert user.is_staff is False
    assert user.is_superuser is False
    assert user.status == "active"


def test_patch_without_csrf_token_is_rejected():
    user = _create_user(display_name="Unchanged")
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)

    response = _patch_me(client, {"display_name": "Forged"})

    assert response.status_code == status.HTTP_403_FORBIDDEN
    user.refresh_from_db()
    assert user.display_name == "Unchanged"


def test_patch_with_csrf_token_is_accepted():
    user = _create_user()
    client = Client(enforce_csrf_checks=True)
    client.force_login(user)
    token = "a" * 32
    client.cookies["csrftoken"] = token

    response = _patch_me(client, {"display_name": "Legit"}, X_CSRFTOKEN=token)

    assert response.status_code == status.HTTP_204_NO_CONTENT
    user.refresh_from_db()
    assert user.display_name == "Legit"
