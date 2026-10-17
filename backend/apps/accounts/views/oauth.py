"""Account oauth views."""

import json
import secrets
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as URLRequest
from urllib.request import urlopen

from django.conf import settings
from django.contrib.auth import get_user_model, login
from django.db import IntegrityError, transaction
from django.http import HttpResponseRedirect
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.accounts.serializers.oauth import (
    OAuth42IdentitySerializer,
    OAuth42ProfileSerializer,
    OAuth42UserCreationSerializer,
)

User = get_user_model()

OAUTH_42_STATE_SESSION_KEY = "oauth_42_state"

OAUTH_42_AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize"

OAUTH_42_TOKEN_URL = "https://api.intra.42.fr/oauth/token"

OAUTH_42_ME_URL = "https://api.intra.42.fr/v2/me"

OAUTH_42_USER_AGENT = "ft-transcendence/1.0"

OAUTH_42_HTTP_TIMEOUT_SECONDS = 5

OAUTH_42_SUCCESS_PATH = "/"

OAUTH_42_ERROR_PATH = "/login"


def _oauth_42_is_configured():
    return all(
        (
            settings.FT_OAUTH_CLIENT_ID,
            settings.FT_OAUTH_CLIENT_SECRET,
            settings.FT_OAUTH_REDIRECT_URI,
        )
    )


def _exchange_42_code_for_access_token(code):
    payload = urlencode(
        {
            "grant_type": "authorization_code",
            "client_id": settings.FT_OAUTH_CLIENT_ID,
            "client_secret": settings.FT_OAUTH_CLIENT_SECRET,
            "code": code,
            "redirect_uri": settings.FT_OAUTH_REDIRECT_URI,
        }
    ).encode()
    token_request = URLRequest(
        OAUTH_42_TOKEN_URL,
        data=payload,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": OAUTH_42_USER_AGENT,
        },
        method="POST",
    )

    try:
        with urlopen(token_request, timeout=OAUTH_42_HTTP_TIMEOUT_SECONDS) as response:
            token_data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError):
        return None

    access_token = token_data.get("access_token") if isinstance(token_data, dict) else None
    if not isinstance(access_token, str) or not access_token:
        return None

    return access_token


def _retrieve_42_account_information(access_token):
    profile_request = URLRequest(
        OAUTH_42_ME_URL,
        headers={
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}",
            "User-Agent": OAUTH_42_USER_AGENT,
        },
        method="GET",
    )

    try:
        with urlopen(profile_request, timeout=OAUTH_42_HTTP_TIMEOUT_SECONDS) as response:
            profile_data = json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, UnicodeDecodeError, json.JSONDecodeError):
        return None

    serializer = OAuth42ProfileSerializer(data=profile_data)
    if not serializer.is_valid():
        return None

    profile = serializer.validated_data
    return {
        "intra_id": profile["id"],
        "intra_login": profile["login"],
        "email": profile["email"],
    }


def _oauth_42_frontend_redirect(error_code=None):
    if error_code:
        query = urlencode({"oauth": error_code})
        return HttpResponseRedirect(f"{OAUTH_42_ERROR_PATH}?{query}")
    return HttpResponseRedirect(OAUTH_42_SUCCESS_PATH)


def _persist_42_identity(user, account_information):
    serializer = OAuth42IdentitySerializer(
        user,
        data={
            "intra_id": account_information["intra_id"],
            "intra_login": account_information["intra_login"],
        },
    )
    if not serializer.is_valid():
        return None
    return serializer.save()


def _handle_42_login(request, account_information):
    user = User.objects.filter(intra_id=account_information["intra_id"]).first()
    if user is not None:
        if not user.is_active:
            return "oauth_account_suspended"

        user = _persist_42_identity(user, account_information)
        if user is None:
            return "oauth_identity_conflict"

        login(request, user)
        return None

    normalized_email = User.objects.normalize_email(account_information["email"])
    if User.objects.filter(email=normalized_email).exists():
        return "oauth_account_exists"

    serializer = OAuth42UserCreationSerializer(
        data={
            "email": normalized_email,
            "intra_id": account_information["intra_id"],
            "intra_login": account_information["intra_login"],
        }
    )
    if not serializer.is_valid():
        return "oauth_account_conflict"

    try:
        with transaction.atomic():
            user = serializer.save()
    except IntegrityError:
        return "oauth_account_conflict"

    login(request, user)
    return None


@never_cache
@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_42_redirect(request):
    """Start the 42 OAuth authorization-code flow."""
    if not _oauth_42_is_configured():
        return _oauth_42_frontend_redirect("oauth_not_configured")

    oauth_state = secrets.token_urlsafe(32)
    request.session[OAUTH_42_STATE_SESSION_KEY] = oauth_state

    authorization_query = urlencode(
        {
            "client_id": settings.FT_OAUTH_CLIENT_ID,
            "redirect_uri": settings.FT_OAUTH_REDIRECT_URI,
            "response_type": "code",
            "state": oauth_state,
        }
    )
    return HttpResponseRedirect(f"{OAUTH_42_AUTHORIZE_URL}?{authorization_query}")


@never_cache
@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_42_callback(request):
    """Complete 42 OAuth login and return the browser to the frontend."""
    expected_state = request.session.get(OAUTH_42_STATE_SESSION_KEY)
    returned_state = request.query_params.get("state", "")

    if (
        not isinstance(expected_state, str)
        or not expected_state
        or not expected_state.isascii()
        or not returned_state
        or not returned_state.isascii()
        or not secrets.compare_digest(expected_state, returned_state)
    ):
        return _oauth_42_frontend_redirect("oauth_invalid_state")

    # Each authorization response can be processed only once.
    request.session.pop(OAUTH_42_STATE_SESSION_KEY, None)
    request.session.save()

    if request.query_params.get("error"):
        error_code = (
            "oauth_access_denied"
            if request.query_params["error"] == "access_denied"
            else "oauth_provider_error"
        )
        return _oauth_42_frontend_redirect(error_code)

    code = request.query_params.get("code")
    if not code:
        return _oauth_42_frontend_redirect("oauth_missing_code")

    if not _oauth_42_is_configured():
        return _oauth_42_frontend_redirect("oauth_not_configured")

    access_token = _exchange_42_code_for_access_token(code)
    if access_token is None:
        return _oauth_42_frontend_redirect("oauth_token_exchange_failed")

    account_information = _retrieve_42_account_information(access_token)
    if account_information is None:
        return _oauth_42_frontend_redirect("oauth_profile_retrieval_failed")

    # The provider token remains server-side. OAuth login creates/reuses a local
    # account and establishes the normal Django session. Existing password
    # accounts are not automatically linked by matching email.
    error_code = _handle_42_login(request, account_information)
    if error_code:
        return _oauth_42_frontend_redirect(error_code)

    return _oauth_42_frontend_redirect()
