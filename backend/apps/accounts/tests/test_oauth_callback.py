"""42 OAuth callback browser-redirect tests; no external provider requests."""

from http.client import IncompleteRead
from unittest.mock import MagicMock, Mock
from urllib.parse import parse_qs, urlparse

import pytest
from django.contrib.auth import SESSION_KEY, get_user_model
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.views.oauth import (
    OAUTH_42_ERROR_PATH,
    OAUTH_42_STATE_SESSION_KEY,
    OAUTH_42_SUCCESS_PATH,
)

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


def assert_frontend_redirect(response, path, error_code=None):
    assert response.status_code == status.HTTP_302_FOUND
    location = urlparse(response["Location"])
    assert location.path == path
    query = parse_qs(location.query)
    if error_code is None:
        assert query == {}
    else:
        assert query == {"oauth": [error_code]}


def test_callback_route_is_public_but_rejects_request_without_session_state():
    client = APIClient(enforce_csrf_checks=True)

    response = callback(client, code="fake-code", state=STATE)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_invalid_state")
    assert SESSION_KEY not in client.session


@pytest.mark.parametrize("state", ["", "wrong-state", "č", "🙂"])
def test_callback_rejects_missing_or_mismatched_state_without_consuming_valid_state(
    state, monkeypatch
):
    def unexpected_provider_call(*args, **kwargs):
        pytest.fail("An invalid state must be rejected before contacting 42.")

    monkeypatch.setattr("apps.accounts.services.oauth.urlopen", unexpected_provider_call)
    client = client_with_state()

    response = callback(client, code="fake-code", state=state)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_invalid_state")
    assert client.session[OAUTH_42_STATE_SESSION_KEY] == STATE
    assert SESSION_KEY not in client.session


def test_callback_rejects_non_ascii_session_state():
    client = client_with_state()
    session = client.session
    session[OAUTH_42_STATE_SESSION_KEY] = "č"
    session.save()

    response = callback(client, code="fake-code", state=STATE)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_invalid_state")
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

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, expected_code)
    assert "sensitive provider detail" not in response["Location"]
    assert OAUTH_42_STATE_SESSION_KEY not in client.session
    assert SESSION_KEY not in client.session


def test_callback_rejects_missing_code_after_valid_state():
    client = client_with_state()

    response = callback(client, state=STATE)

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_missing_code")
    assert OAUTH_42_STATE_SESSION_KEY not in client.session


@override_settings(
    FT_OAUTH_CLIENT_ID="test-client-id",
    FT_OAUTH_CLIENT_SECRET="test-client-secret",
    FT_OAUTH_REDIRECT_URI="https://localhost/api/v1/auth/42/callback/",
)
def test_callback_accepts_valid_state_and_code_and_creates_session(monkeypatch):
    monkeypatch.setattr(
        "apps.accounts.services.oauth.exchange_42_code_for_access_token",
        lambda code: "temporary-provider-token",
    )
    monkeypatch.setattr(
        "apps.accounts.services.oauth.retrieve_42_account_information",
        lambda token: {
            "intra_id": 4242,
            "intra_login": "oauth-user",
            "email": "oauth-user@student.42.fr",
        },
    )
    client = client_with_state()

    response = callback(client, code="secret-authorization-code", state=STATE)

    assert_frontend_redirect(response, OAUTH_42_SUCCESS_PATH)
    assert "secret-authorization-code" not in response["Location"]
    assert "no-store" in response["Cache-Control"]
    assert OAUTH_42_STATE_SESSION_KEY not in client.session
    assert SESSION_KEY in client.session

    replay = callback(client, code="secret-authorization-code", state=STATE)
    assert_frontend_redirect(replay, OAUTH_42_ERROR_PATH, "oauth_invalid_state")


def test_callback_only_accepts_get():
    client = APIClient()

    response = client.post(reverse(CALLBACK_URL), {}, format="json", HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_405_METHOD_NOT_ALLOWED


@pytest.mark.parametrize(
    "read_error",
    [ConnectionResetError("Connection lost during read"), IncompleteRead(b"partial", 100)],
    ids=["connection_reset", "incomplete_read"],
)
@pytest.mark.parametrize(
    "stage,expected_code",
    [
        ("token", "oauth_token_exchange_failed"),
        ("profile", "oauth_profile_retrieval_failed"),
    ],
)
@override_settings(
    FT_OAUTH_CLIENT_ID="test-client-id",
    FT_OAUTH_CLIENT_SECRET="test-client-secret",
    FT_OAUTH_REDIRECT_URI="https://localhost/api/v1/auth/42/callback/",
)
def test_callback_redirects_when_provider_response_read_fails(
    monkeypatch, read_error, stage, expected_code
):
    failed_response = MagicMock()
    failed_response.__enter__.return_value = failed_response
    failed_response.__exit__.return_value = False
    failed_response.read.side_effect = read_error
    responses = [failed_response]
    if stage == "profile":
        token_response = MagicMock()
        token_response.__enter__.return_value = token_response
        token_response.read.return_value = b'{"access_token": "temporary-provider-token"}'
        responses.insert(0, token_response)
    provider = Mock(side_effect=responses)
    monkeypatch.setattr("apps.accounts.services.oauth.urlopen", provider)
    client = client_with_state()

    response = callback(client, code="secret-authorization-code", state=STATE)

    assert response.status_code == status.HTTP_302_FOUND
    assert response["Location"] == f"/login?oauth={expected_code}"
    assert provider.call_count == (1 if stage == "token" else 2)
    failed_response.read.assert_called_once_with()
    assert SESSION_KEY not in client.session
    assert OAUTH_42_STATE_SESSION_KEY not in client.session
    assert not get_user_model().objects.exists()
