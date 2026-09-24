"""API tests for user registration (isolated MySQL test database)."""

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def registration_payload(**overrides):
    payload = {
        "email": "student@example.com",
        "display_name": "student",
        "password": "TemporaryPassword123!",
    }
    payload.update(overrides)
    return payload


def assert_validation_error(response, field):
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["message"] == "Please correct the registration fields."
    assert field in body["error"]["fields"]


def test_register_creates_active_user_without_logging_in():
    client = APIClient()
    response = client.post(
        reverse("api:register"),
        {
            "email": "Issue118@Example.COM",
            "display_name": "issue118user",
            "password": "TemporaryPassword123!",
        },
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_201_CREATED

    user = get_user_model().objects.get(email="issue118@example.com")
    assert response.json() == {
        "id": user.id,
        "email": "issue118@example.com",
        "display_name": "issue118user",
        "message": "Account created successfully.",
    }
    assert user.display_name == "issue118user"
    assert user.status == get_user_model().Status.ACTIVE
    assert user.intra_login is None
    assert "password" not in response.json()
    assert SESSION_KEY not in client.session


def test_register_endpoint_rejects_get():
    client = APIClient()
    response = client.get(reverse("api:register"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.parametrize("missing_field", ["email", "display_name", "password"])
def test_register_requires_all_registration_fields(missing_field):
    client = APIClient()
    payload = registration_payload()
    payload.pop(missing_field)

    response = client.post(
        reverse("api:register"),
        payload,
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, missing_field)
    assert get_user_model().objects.count() == 0


def test_register_rejects_invalid_email():
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(email="not-an-email"),
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, "email")
    assert get_user_model().objects.count() == 0


@pytest.mark.parametrize("display_name", ["", " " * 8, "x" * 65])
def test_register_rejects_invalid_display_name(display_name):
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(display_name=display_name),
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, "display_name")
    assert get_user_model().objects.count() == 0


@pytest.mark.parametrize("password", ["short", "12345678"])
def test_register_rejects_passwords_that_fail_configured_validators(password):
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(password=password),
        format="json",
        HTTP_HOST="localhost",
    )

    assert_validation_error(response, "password")
    assert get_user_model().objects.count() == 0


def test_register_rejects_existing_email_case_insensitively():
    user_model = get_user_model()
    existing_user = user_model.objects.create_user(
        email="Existing@Example.COM",
        display_name="existing-user",
        password="ExistingPassword123!",
    )
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="existing@example.com",
            display_name="new-user",
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "email_already_exists",
            "message": "An account with this email already exists.",
        }
    }
    assert user_model.objects.count() == 1
    assert user_model.objects.get() == existing_user


def test_register_allows_duplicate_display_name():
    user_model = get_user_model()
    user_model.objects.create_user(
        email="first@example.com",
        display_name="shared-name",
        password="ExistingPassword123!",
    )
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="second@example.com",
            display_name="shared-name",
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_201_CREATED
    assert user_model.objects.filter(display_name="shared-name").count() == 2


def test_register_handles_database_uniqueness_race(monkeypatch):
    user_model = get_user_model()
    user_model.objects.create_user(
        email="race@example.com",
        display_name="existing-user",
        password="ExistingPassword123!",
    )

    class NoMatch:
        @staticmethod
        def exists():
            return False

    monkeypatch.setattr(user_model.objects, "filter", lambda **kwargs: NoMatch())
    client = APIClient()

    response = client.post(
        reverse("api:register"),
        registration_payload(
            email="RACE@example.com",
            display_name="racing-user",
        ),
        format="json",
        HTTP_HOST="localhost",
    )

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {
            "code": "email_already_exists",
            "message": "An account with this email already exists.",
        }
    }
    assert user_model.objects.count() == 1
