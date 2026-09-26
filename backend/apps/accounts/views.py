"""Views for the accounts application: profile and role assignment"""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import CanAssignRoles, IsAdminRole
from apps.accounts.serializers import MeSerializer, RoleAssignSerializer

User = get_user_model()


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return the authenticated user's full profile."""
    return Response(MeSerializer(request.user).data)


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
    return Response(MeSerializer(target).data, status=status.HTTP_200_OK)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminRole])
def revoke_role(request, user_id, role_name):
    _ = request  # keep signature for DRF
    """Revoke a role from the target user (Admin only)."""
    target = get_object_or_404(User, pk=user_id)
    role = get_object_or_404(Role, name=role_name)
    target.roles.remove(role)
    return Response(status=status.HTTP_204_NO_CONTENT)
