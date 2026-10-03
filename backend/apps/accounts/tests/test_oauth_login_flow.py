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
    OAUTH_42_STATE_SESSION_KEY,
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
def test_oauth_redirect_rejects_missing_provider_configuration():
    response = APIClient().get(reverse("api:oauth_42_redirect"), HTTP_HOST="localhost")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json()["error"]["code"] == "oauth_not_configured"


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

    assert response.status_code == status.HTTP_200_OK
    assert response.json()["authenticated"] is True
    assert captured["request"].full_url == OAUTH_42_TOKEN_URL
    assert captured["request"].get_method() == "POST"
    payload = parse_qs(captured["request"].data.decode())
    assert payload == {
        "grant_type": ["authorization_code"],
        "client_id": [OAUTH_SETTINGS["FT_OAUTH_CLIENT_ID"]],
        "client_secret": [OAUTH_SETTINGS["FT_OAUTH_CLIENT_SECRET"]],
        "code": ["secret-authorization-code"],
        "redirect_uri": [OAUTH_SETTINGS["FT_OAUTH_REDIRECT_URI"]],
    }
    body = response.content.decode()
    assert "secret-provider-token" not in body
    assert "secret-authorization-code" not in body
    assert OAUTH_SETTINGS["FT_OAUTH_CLIENT_SECRET"] not in body
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

    assert response.status_code == status.HTTP_502_BAD_GATEWAY
    assert response.json()["error"]["code"] == "oauth_token_exchange_failed"
    assert "secret-code" not in response.content.decode()
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

    assert response.status_code == status.HTTP_502_BAD_GATEWAY
    assert response.json()["error"]["code"] == "oauth_token_exchange_failed"
