"""Views for the accounts application: registration, profile, and role assignment."""

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.accounts.eligibility import list_approved_projects_for_tutor
from apps.accounts.models import Role
from apps.accounts.permissions import CanAssignRoles, IsAdminRole
from apps.accounts.serializers import (
    MeSerializer,
    PublicProfileSerializer,
    RegistrationSerializer,
    RoleAssignmentResultSerializer,
    RoleAssignSerializer,
    TutorEligibleProjectSerializer,
)

User = get_user_model()


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


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the authenticated user's full profile."""
    return Response(MeSerializer(request.user).data)


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
