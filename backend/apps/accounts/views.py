"""Views for the accounts application."""

from django.contrib.auth import authenticate, login, logout
from django.db import IntegrityError, transaction
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import (
    LoginSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    RegistrationSerializer,
)


def _error_response(code, message, http_status, fields=None):
    error = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    return Response({"error": error}, status=http_status)


def _validation_error_response(errors, message):
    return _error_response("validation_error", message, status.HTTP_400_BAD_REQUEST, errors)


def _not_authenticated_response():
    return _error_response(
        "not_authenticated", "Authentication required.", status.HTTP_401_UNAUTHORIZED
    )


def _email_conflict_response():
    return _error_response(
        "email_already_exists",
        "An account with this email already exists.",
        status.HTTP_409_CONFLICT,
    )


class MeView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def get(self, request: Request):
        """Return the authenticated user's profile (GET /api/v1/users/me/)."""
        if not request.user.is_authenticated:
            return _not_authenticated_response()

        return Response(ProfileSerializer(request.user).data)

    def patch(self, request: Request):
        """Update the current user's display name or language"""
        if not request.user.is_authenticated:
            return _not_authenticated_response()

        serializer = ProfileUpdateSerializer(instance=request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return _validation_error_response(
                serializer.errors, "Please correct the profile fields."
            )

        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


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


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    """CSRF-protected session login, including for anonymous requests."""

    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

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
        return _not_authenticated_response()

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
