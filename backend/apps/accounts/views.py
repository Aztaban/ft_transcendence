"""Views for the accounts application: registration, profile, and role assignment."""

from django.contrib.auth import authenticate, get_user_model, login, logout
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.eligibility import list_approved_projects_for_tutor
from apps.accounts.models import Role
from apps.accounts.permissions import CanAssignRoles, IsAdminRole
from apps.accounts.serializers import (
    LoginSerializer,
    ProfileSerializer,
    ProfileUpdateSerializer,
    PublicProfileSerializer,
    RegistrationSerializer,
    RoleAssignmentResultSerializer,
    RoleAssignSerializer,
    TutorEligibleProjectSerializer,
)

User = get_user_model()


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    """Return a user's public profile (authenticated community visibility)."""
    _ = request
    target = get_object_or_404(User, pk=user_id)
    return Response(PublicProfileSerializer(target).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tutor_eligibility(request, user_id):
    """Return projects this hitchhiker is approved to evaluate (public listing)."""
    _ = request
    tutor = get_object_or_404(User, pk=user_id)
    projects = list_approved_projects_for_tutor(tutor)
    return Response(TutorEligibleProjectSerializer(projects, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated, CanAssignRoles])
def assign_role(request, user_id):
    """Assign a role to the target user (Admin any; Head Tutor only tutor)."""
    target = get_object_or_404(User, pk=user_id)
    serializer = RoleAssignSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    role_name = serializer.validated_data["role"]
    actor = request.user
    if not actor.has_role(Role.Name.ADMIN):
        if role_name != Role.Name.TUTOR:
            return Response(
                {"detail": "Head Tutors may only assign the tutor role."},
                status=status.HTTP_403_FORBIDDEN,
            )
    role = Role.objects.get(name=role_name)
    target.roles.add(role)
    return Response(
        RoleAssignmentResultSerializer(target).data,
        status=status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminRole])
def revoke_role(request, user_id, role_id):
    """Revoke a role from the target user (Admin only)."""
    _ = request  # keep signature for DRF
    target = get_object_or_404(User, pk=user_id)
    role = get_object_or_404(Role, pk=role_id)
    target.roles.remove(role)
    return Response(status=status.HTTP_204_NO_CONTENT)
