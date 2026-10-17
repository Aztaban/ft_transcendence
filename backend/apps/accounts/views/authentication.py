"""Account authentication views."""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.views.decorators.csrf import ensure_csrf_cookie
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
from apps.accounts.serializers.authentication import LoginSerializer, RegistrationSerializer
from apps.core.throttling import AuthRateThrottle

from ._responses import _error_response, _validation_error_response


def _email_conflict_response():
    return _error_response(
        "email_already_exists",
        "An account with this email already exists.",
        status.HTTP_409_CONFLICT,
    )


def _has_unique_email_error(serializer):
    return any(
        getattr(error, "code", None) == "unique" for error in serializer.errors.get("email", [])
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

        return _validation_error_response(
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

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        if not serializer.is_valid():
            return _validation_error_response(serializer.errors, "Please correct the login fields.")

        email = serializer.validated_data["email"]
        password = serializer.validated_data["password"]
        user = authenticate(request, email=email, password=password)
        if user is None:
            return _error_response(
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
