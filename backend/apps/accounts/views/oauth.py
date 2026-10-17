"""Account oauth views."""

import secrets
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import login
from django.http import HttpResponseRedirect
from django.views.decorators.cache import never_cache
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny

from apps.accounts.services import oauth as oauth_service

OAUTH_42_STATE_SESSION_KEY = "oauth_42_state"

OAUTH_42_AUTHORIZE_URL = "https://api.intra.42.fr/oauth/authorize"


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


def _oauth_42_frontend_redirect(error_code=None):
    if error_code:
        query = urlencode({"oauth": error_code})
        return HttpResponseRedirect(f"{OAUTH_42_ERROR_PATH}?{query}")
    return HttpResponseRedirect(OAUTH_42_SUCCESS_PATH)


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

    access_token = oauth_service.exchange_42_code_for_access_token(code)
    if access_token is None:
        return _oauth_42_frontend_redirect("oauth_token_exchange_failed")

    account_information = oauth_service.retrieve_42_account_information(access_token)
    if account_information is None:
        return _oauth_42_frontend_redirect("oauth_profile_retrieval_failed")

    # The provider token remains server-side. OAuth login creates/reuses a local
    # account and establishes the normal Django session. Existing password
    # accounts are not automatically linked by matching email.
    user, error_code = oauth_service.resolve_42_user(account_information)
    if error_code:
        return _oauth_42_frontend_redirect(error_code)

    login(request, user)
    return _oauth_42_frontend_redirect()
