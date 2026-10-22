"""42 OAuth provider calls and verified identity persistence (api-plan §10.1)."""

import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request as URLRequest
from urllib.request import urlopen

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from apps.accounts.serializers.oauth import (
    OAuth42IdentitySerializer,
    OAuth42ProfileSerializer,
    OAuth42UserCreationSerializer,
)

User = get_user_model()


OAUTH_42_TOKEN_URL = "https://api.intra.42.fr/oauth/token"

OAUTH_42_ME_URL = "https://api.intra.42.fr/v2/me"

OAUTH_42_USER_AGENT = "ft-transcendence/1.0"

OAUTH_42_HTTP_TIMEOUT_SECONDS = 5


def exchange_42_code_for_access_token(code):
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


def retrieve_42_account_information(access_token):
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


def resolve_42_user(account_information):
    """Return (user, None) or (None, OAuth error code), without changing a session."""
    user = User.objects.filter(intra_id=account_information["intra_id"]).first()
    if user is not None:
        if not user.is_active:
            return None, "oauth_account_suspended"

        user = _persist_42_identity(user, account_information)
        if user is None:
            return None, "oauth_identity_conflict"

        return user, None

    normalized_email = User.objects.normalize_email(account_information["email"])
    if User.objects.filter(email=normalized_email).exists():
        return None, "oauth_account_exists"

    serializer = OAuth42UserCreationSerializer(
        data={
            "email": normalized_email,
            "intra_id": account_information["intra_id"],
            "intra_login": account_information["intra_login"],
        }
    )
    if not serializer.is_valid():
        return None, "oauth_account_conflict"

    try:
        with transaction.atomic():
            user = serializer.save()
    except IntegrityError:
        return None, "oauth_account_conflict"

    return user, None
