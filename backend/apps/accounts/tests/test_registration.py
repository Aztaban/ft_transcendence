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
