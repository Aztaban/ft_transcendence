"""Account roles views."""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import NOT_REVOCABLE, CanAssignRoles, IsAdminRole, can_assign
from apps.accounts.serializers.profiles import RoleAssignmentResultSerializer
from apps.accounts.serializers.roles import RoleAssignSerializer
from apps.core.exceptions import error_response

User = get_user_model()


@extend_schema(
    summary="Assign a role",
    request=RoleAssignSerializer,
    responses={200: RoleAssignmentResultSerializer},
)
@api_view(["POST"])
@permission_classes([IsAuthenticated, CanAssignRoles])
def assign_role(request, user_id):
    """Assign a role to the target user, following the rules of api-plan §5.8."""
    target = get_object_or_404(User, pk=user_id)
    serializer = RoleAssignSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    role_name = serializer.validated_data["role"]
    if not can_assign(request.user, role_name):
        raise PermissionDenied(_("You may not assign this role."), code="role_not_assignable")
    role = Role.objects.get(name=role_name)
    target.roles.add(role)
    return Response(
        RoleAssignmentResultSerializer(target).data,
        status=status.HTTP_200_OK,
    )


@api_view(["DELETE"])
@permission_classes([IsAuthenticated, IsAdminRole])
def revoke_role(request, user_id, role_id):
    """Revoke a role from the target user (Admin only, api-plan §5.8)."""
    target = get_object_or_404(User, pk=user_id)
    role = get_object_or_404(Role, pk=role_id)
    if role.name in NOT_REVOCABLE:
        return error_response(
            "role_not_revocable", _("This role cannot be revoked."), status.HTTP_409_CONFLICT
        )
    if target.pk == request.user.pk:
        return error_response(
            "cannot_modify_self", _("You cannot change your own roles."), status.HTTP_409_CONFLICT
        )
    target.roles.remove(role)
    return Response(status=status.HTTP_204_NO_CONTENT)
