"""42 OAuth authorization redirect and token-exchange tests."""

import json
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse

import pytest
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.views import (
    OAUTH_42_AUTHORIZE_URL,
    OAUTH_42_ERROR_PATH,
    OAUTH_42_STATE_SESSION_KEY,
    OAUTH_42_SUCCESS_PATH,
    OAUTH_42_TOKEN_URL,
)

pytestmark = pytest.mark.django_db
OAUTH_SETTINGS = {
    "FT_OAUTH_CLIENT_ID": "test-client-id",
    "FT_OAUTH_CLIENT_SECRET": "test-client-secret",
    "FT_OAUTH_REDIRECT_URI": "https://localhost/api/v1/auth/42/callback/",
}


class FakeTokenResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode()


def client_with_state(state="known-state"):
    client = APIClient()
    session = client.session
    session[OAUTH_42_STATE_SESSION_KEY] = state
    session.save()
    return client


def assert_frontend_redirect(response, path, error_code=None):
    assert response.status_code == status.HTTP_302_FOUND
    location = urlparse(response["Location"])
    assert location.path == path
    query = parse_qs(location.query)
    if error_code is None:
        assert query == {}
    else:
        assert query == {"oauth": [error_code]}


@override_settings(**OAUTH_SETTINGS)
def test_oauth_redirect_generates_state_and_redirects_to_42():
    client = APIClient()

    response = client.get(reverse("api:oauth_42_redirect"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_302_FOUND
    parsed = urlparse(response["Location"])
    query = parse_qs(parsed.query)
    assert f"{parsed.scheme}://{parsed.netloc}{parsed.path}" == OAUTH_42_AUTHORIZE_URL
    assert query["client_id"] == [OAUTH_SETTINGS["FT_OAUTH_CLIENT_ID"]]
    assert query["redirect_uri"] == [OAUTH_SETTINGS["FT_OAUTH_REDIRECT_URI"]]
    assert query["response_type"] == ["code"]
    assert query["state"] == [client.session[OAUTH_42_STATE_SESSION_KEY]]
    assert len(query["state"][0]) >= 32
    assert "no-store" in response["Cache-Control"]


@override_settings(
    FT_OAUTH_CLIENT_ID="",
    FT_OAUTH_CLIENT_SECRET="",
    FT_OAUTH_REDIRECT_URI="",
)
def test_oauth_redirect_returns_frontend_error_when_provider_is_not_configured():
    response = APIClient().get(reverse("api:oauth_42_redirect"), HTTP_HOST="localhost")

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_not_configured")


@override_settings(**OAUTH_SETTINGS)
def test_callback_exchanges_code_without_exposing_secrets(monkeypatch):
    captured = {}

    def fake_urlopen(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeTokenResponse({"access_token": "secret-provider-token"})

    monkeypatch.setattr("apps.accounts.views.urlopen", fake_urlopen)
    monkeypatch.setattr(
        "apps.accounts.views._retrieve_42_account_information",
        lambda token: {
            "intra_id": 4242,
            "intra_login": "oauth-user",
            "email": "oauth-user@student.42.fr",
        },
    )
    client = client_with_state()

    response = client.get(
        reverse("api:oauth_42_callback"),
        {"code": "secret-authorization-code", "state": "known-state"},
        HTTP_HOST="localhost",
    )

    assert_frontend_redirect(response, OAUTH_42_SUCCESS_PATH)
    assert captured["request"].full_url == OAUTH_42_TOKEN_URL
    assert captured["request"].get_method() == "POST"
    assert captured["request"].get_header("User-agent") == "ft-transcendence/1.0"
    payload = parse_qs(captured["request"].data.decode())
    assert payload == {
        "grant_type": ["authorization_code"],
        "client_id": [OAUTH_SETTINGS["FT_OAUTH_CLIENT_ID"]],
        "client_secret": [OAUTH_SETTINGS["FT_OAUTH_CLIENT_SECRET"]],
        "code": ["secret-authorization-code"],
        "redirect_uri": [OAUTH_SETTINGS["FT_OAUTH_REDIRECT_URI"]],
    }
    location = response["Location"]
    assert "secret-provider-token" not in location
    assert "secret-authorization-code" not in location
    assert OAUTH_SETTINGS["FT_OAUTH_CLIENT_SECRET"] not in location
    assert OAUTH_42_STATE_SESSION_KEY not in client.session


@pytest.mark.parametrize(
    "provider_failure",
    [
        HTTPError(OAUTH_42_TOKEN_URL, 400, "Bad Request", hdrs=None, fp=None),
        URLError("provider unavailable"),
    ],
)
@override_settings(**OAUTH_SETTINGS)
def test_callback_handles_token_exchange_failure(monkeypatch, provider_failure):
    def failing_urlopen(request, timeout):
        raise provider_failure

    monkeypatch.setattr("apps.accounts.views.urlopen", failing_urlopen)
    client = client_with_state()

    response = client.get(
        reverse("api:oauth_42_callback"),
        {"code": "secret-code", "state": "known-state"},
        HTTP_HOST="localhost",
    )

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_token_exchange_failed")
    assert "secret-code" not in response["Location"]
    assert OAUTH_42_STATE_SESSION_KEY not in client.session


@pytest.mark.parametrize("payload", [{}, {"access_token": ""}, "not-a-dict"])
@override_settings(**OAUTH_SETTINGS)
def test_callback_rejects_token_response_without_access_token(monkeypatch, payload):
    monkeypatch.setattr(
        "apps.accounts.views.urlopen",
        lambda request, timeout: FakeTokenResponse(payload),
    )
    client = client_with_state()

    response = client.get(
        reverse("api:oauth_42_callback"),
        {"code": "secret-code", "state": "known-state"},
        HTTP_HOST="localhost",
    )

    assert_frontend_redirect(response, OAUTH_42_ERROR_PATH, "oauth_token_exchange_failed")
