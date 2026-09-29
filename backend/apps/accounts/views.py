"""Views for the accounts application."""

import secrets

from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import LoginSerializer, RegistrationSerializer

OAUTH_42_STATE_SESSION_KEY = "oauth_42_state"


def _email_conflict_response():
    return Response(
        {
            "error": {
                "code": "email_already_exists",
                "message": "An account with this email already exists.",
            }
        },
        status=status.HTTP_409_CONFLICT,
    )


def _has_unique_email_error(serializer):
    return any(
        getattr(error, "code", None) == "unique" for error in serializer.errors.get("email", [])
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Create a user account without authenticating the new user."""
    serializer = RegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        if _has_unique_email_error(serializer):
            return _email_conflict_response()

        return Response(
            {
                "error": {
                    "code": "validation_error",
                    "message": "Please correct the registration fields.",
                    "fields": serializer.errors,
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    try:
        with transaction.atomic():
            user = serializer.save()
    except IntegrityError:
        # Email is the only caller-supplied unique field in this endpoint.
        # Keep the database constraint as the final authority for races.
        return _email_conflict_response()

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "message": "Account created successfully.",
        },
        status=status.HTTP_201_CREATED,
    )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """CSRF-protected session login, including for anonymous requests."""

    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                {
                    "error": {
                        "code": "validation_error",
                        "message": "Please correct the login fields.",
                        "fields": serializer.errors,
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)
        if user is None:
            return Response(
                {
                    "error": {
                        "code": "invalid_credentials",
                        "message": "Invalid email or password.",
                    }
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        login(request, user)
        return Response(
            {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "message": "Logged in successfully.",
            },
            status=status.HTTP_200_OK,
        )


@ensure_csrf_cookie
@api_view(["GET"])
@authentication_classes([SessionAuthentication])
@permission_classes([AllowAny])
def session_status(request):
    """Expose the current Django session to the browser without creating a login."""
    if not request.user.is_authenticated:
        return Response(
            {
                "error": {
                    "code": "not_authenticated",
                    "message": "Authentication required.",
                }
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    user = request.user
    return Response(
        {
            "authenticated": True,
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
            },
        },
        status=status.HTTP_200_OK,
    )


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    """Invalidate the current Django session, including on repeated logout."""

    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@never_cache
@api_view(["GET"])
@permission_classes([AllowAny])
def oauth_42_callback(request):
    """Validate the 42 callback; token exchange and sign-in belong to #133."""
    expected_state = request.session.get(OAUTH_42_STATE_SESSION_KEY)
    returned_state = request.query_params.get("state", "")

    if (
        not isinstance(expected_state, str)
        or not expected_state
        or not returned_state
        or not secrets.compare_digest(expected_state, returned_state)
    ):
        return Response(
            {
                "error": {
                    "code": "oauth_invalid_state",
                    "message": "Invalid or expired 42 authorization request.",
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Each authorization response can be processed only once.
    request.session.pop(OAUTH_42_STATE_SESSION_KEY, None)

    # Django's SessionMiddleware does not persist modified sessions for 5xx
    # responses. #132 intentionally returns 501 for the not-yet-implemented
    # login step, so persist the consumed state before that response.
    request.session.save()

    if request.query_params.get("error"):
        is_denied = request.query_params["error"] == "access_denied"
        return Response(
            {
                "error": {
                    "code": "oauth_access_denied" if is_denied else "oauth_provider_error",
                    "message": (
                        "42 authorization was cancelled."
                        if is_denied
                        else "42 authorization failed."
                    ),
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    if not request.query_params.get("code"):
        return Response(
            {
                "error": {
                    "code": "oauth_missing_code",
                    "message": "42 did not return an authorization code.",
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    # #133 will exchange the code and continue the login flow. Never echo it.
    return Response(
        {
            "error": {
                "code": "oauth_login_not_implemented",
                "message": "42 sign-in is not available yet.",
            }
        },
        status=status.HTTP_501_NOT_IMPLEMENTED,
    )
