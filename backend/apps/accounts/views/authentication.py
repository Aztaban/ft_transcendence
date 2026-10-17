"""Account authentication views."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import OpenApiExample, OpenApiParameter, OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.authentication import CsrfEnforcedSessionAuthentication
from apps.accounts.serializers.authentication import (
    AuthenticationResultSerializer,
    LoginSerializer,
    RegistrationSerializer,
    SessionStatusSerializer,
)
from apps.core.exceptions import error_response, validation_error_response
from apps.core.schema import CSRF_HEADER, error_responses
from apps.core.throttling import AuthRateThrottle


def _email_conflict_response():
    return error_response(
        "email_already_exists",
        "An account with this email already exists.",
        status.HTTP_409_CONFLICT,
    )


def _has_unique_email_error(serializer):
    return any(
        getattr(error, "code", None) == "unique" for error in serializer.errors.get("email", [])
    )


@extend_schema(
    summary="Register an account",
    description="Creates a student account without logging in.",
    auth=[],
    parameters=[CSRF_HEADER],
    request=RegistrationSerializer,
    responses={
        201: AuthenticationResultSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                403: ("csrf_failed",),
                409: ("email_already_exists",),
                415: ("unsupported_media_type",),
            }
        ),
    },
)
@api_view(["POST"])
@authentication_classes([CsrfEnforcedSessionAuthentication])
@permission_classes([AllowAny])
@throttle_classes([AuthRateThrottle])
def register(request):
    """Create a user account without authenticating the new user."""
    serializer = RegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        if _has_unique_email_error(serializer):
            return _email_conflict_response()

        return validation_error_response(
            serializer.errors, "Please correct the registration fields."
        )

    try:
        with transaction.atomic():
            serializer.save()
    except IntegrityError:
        # Email is the only caller-supplied unique field in this endpoint.
        # Keep the database constraint as the final authority for races.
        return _email_conflict_response()

    return Response(
        {
            **serializer.data,
            "message": "Account created successfully.",
        },
        status=status.HTTP_201_CREATED,
    )


class LoginView(APIView):
    """CSRF-protected session login, including for anonymous requests."""

    authentication_classes = [CsrfEnforcedSessionAuthentication]
    permission_classes = [AllowAny]
    throttle_classes = [AuthRateThrottle]

    @extend_schema(
        summary="Log in with email and password",
        description="Starts a session. Suspended/deleted accounts return invalid_credentials.",
        auth=[],
        parameters=[
            CSRF_HEADER,
            OpenApiParameter(
                "Set-Cookie",
                location=OpenApiParameter.HEADER,
                response=[200],
                description=(
                    "Sets sessionid and rotates csrftoken; use the new CSRF token after " "login."
                ),
            ),
        ],
        request=LoginSerializer,
        responses={
            200: AuthenticationResultSerializer,
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("invalid_credentials",),
                    403: ("csrf_failed",),
                    415: ("unsupported_media_type",),
                }
            ),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return validation_error_response(serializer.errors, "Please correct the login fields.")

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)
        if user is None:
            return error_response(
                "invalid_credentials", "Invalid email or password.", status.HTTP_401_UNAUTHORIZED
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


@extend_schema(
    summary="Check the current session and initialize CSRF",
    description="Returns a user summary or user=null; a missing session returns 200.",
    auth=[],
    parameters=[
        OpenApiParameter(
            "Set-Cookie",
            location=OpenApiParameter.HEADER,
            response=[200],
            description="Sets the csrftoken cookie.",
        )
    ],
    responses={
        200: OpenApiResponse(
            SessionStatusSerializer,
            examples=[
                OpenApiExample("Anonymous session", value={"authenticated": False, "user": None}),
                OpenApiExample(
                    "Authenticated session",
                    value={
                        "authenticated": True,
                        "user": {"id": 7, "email": "alice@example.com", "display_name": "Alice"},
                    },
                ),
            ],
        ),
        **error_responses(),
    },
)
@ensure_csrf_cookie
@api_view(["GET"])
@authentication_classes([SessionAuthentication])
@permission_classes([AllowAny])
def session_status(request):
    """Expose the current Django session to the browser without creating a login."""
    if not request.user.is_authenticated:
        return Response({"authenticated": False, "user": None}, status=status.HTTP_200_OK)

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


class LogoutView(APIView):
    """Invalidate the current Django session, including on repeated logout."""

    authentication_classes = [CsrfEnforcedSessionAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Log out of the current session",
        description="With valid CSRF, returns 204 even when already logged out.",
        auth=[],
        parameters=[
            CSRF_HEADER,
            OpenApiParameter(
                "Set-Cookie",
                location=OpenApiParameter.HEADER,
                response=[204],
                description="Expires an incoming sessionid cookie when present.",
            ),
        ],
        request=None,
        responses={
            204: OpenApiResponse(description="Session ended or already absent."),
            **error_responses({403: ("csrf_failed",)}),
        },
    )
    def post(self, request):
        with transaction.atomic():
            session_key = request.session.session_key
            logout(request)
            if session_key:
                transaction.on_commit(
                    lambda: async_to_sync(get_channel_layer().group_send)(
                        f"session_{session_key}", {"type": "session.ended", "data": {}}
                    )
                )
        return Response(status=status.HTTP_204_NO_CONTENT)
