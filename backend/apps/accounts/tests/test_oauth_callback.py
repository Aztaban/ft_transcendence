"""42 OAuth callback boundary tests; no external provider requests."""

import pytest
from django.contrib.auth import SESSION_KEY
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.views import OAUTH_42_STATE_SESSION_KEY

pytestmark = pytest.mark.django_db
CALLBACK_URL = "api:oauth_42_callback"
STATE = "oauth-state-from-authorization-start"


def client_with_state():
    client = APIClient(enforce_csrf_checks=True)
    session = client.session
    session[OAUTH_42_STATE_SESSION_KEY] = STATE
    session.save()
    return client


def callback(client, **query):
    return client.get(reverse(CALLBACK_URL), query, HTTP_HOST="localhost")


def test_callback_route_is_public_but_rejects_request_without_session_state():
    client = APIClient(enforce_csrf_checks=True)

    response = callback(client, code="fake-code", state=STATE)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "oauth_invalid_state"
    assert SESSION_KEY not in client.session


@pytest.mark.parametrize("state", ["", "wrong-state"])
def test_callback_rejects_missing_or_mismatched_state_without_consuming_valid_state(state):
    client = client_with_state()

    response = callback(client, code="fake-code", state=state)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "oauth_invalid_state"
    assert client.session[OAUTH_42_STATE_SESSION_KEY] == STATE
    assert SESSION_KEY not in client.session


@pytest.mark.parametrize(
    "provider_error,expected_code",
    [
        ("access_denied", "oauth_access_denied"),
        ("temporarily_unavailable", "oauth_provider_error"),
    ],
)
def test_callback_handles_provider_error_without_echoing_description(provider_error, expected_code):
    client = client_with_state()

    response = callback(
        client,
        error=provider_error,
        error_description="sensitive provider detail",
        state=STATE,
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == expected_code
    assert "sensitive provider detail" not in response.content.decode()
    assert OAUTH_42_STATE_SESSION_KEY not in client.session
    assert SESSION_KEY not in client.session


def test_callback_rejects_missing_code_after_valid_state():
    client = client_with_state()

    response = callback(client, state=STATE)

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert response.json()["error"]["code"] == "oauth_missing_code"
    assert OAUTH_42_STATE_SESSION_KEY not in client.session


def test_callback_accepts_valid_state_and_code_but_does_not_login_yet():
    client = client_with_state()

    response = callback(client, code="secret-authorization-code", state=STATE)

    assert response.status_code == status.HTTP_501_NOT_IMPLEMENTED
    assert response.json()["error"]["code"] == "oauth_login_not_implemented"
    assert "secret-authorization-code" not in response.content.decode()
    assert "no-store" in response["Cache-Control"]
    assert OAUTH_42_STATE_SESSION_KEY not in client.session
    assert SESSION_KEY not in client.session

    replay = callback(client, code="secret-authorization-code", state=STATE)
    assert replay.status_code == status.HTTP_400_BAD_REQUEST
    assert replay.json()["error"]["code"] == "oauth_invalid_state"


def test_callback_only_accepts_get():
    client = APIClient()

    response = client.post(reverse(CALLBACK_URL), {}, format="json", HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED
