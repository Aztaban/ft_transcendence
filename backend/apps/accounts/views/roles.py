"""Account roles views."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role, UserRole
from apps.accounts.notifications import notify_role_changed
from apps.accounts.permissions import NOT_REVOCABLE, CanAssignRoles, IsAdminRole, can_assign
from apps.accounts.serializers.profiles import RoleAssignmentResultSerializer
from apps.accounts.serializers.roles import RoleAssignSerializer
from apps.core.exceptions import error_response
from apps.core.schema import CSRF_HEADER, error_responses

User = get_user_model()


@extend_schema(
    parameters=[CSRF_HEADER],
    summary="Assign a role",
    request=RoleAssignSerializer,
    responses={
        200: RoleAssignmentResultSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied", "role_not_assignable", "csrf_failed"),
                415: ("unsupported_media_type",),
                404: ("not_found",),
            }
        ),
    },
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
    # TODO(audit): role.assigned (#53). The audit log is not on this branch.
    with transaction.atomic():
        _membership, created = UserRole.objects.get_or_create(user=target, role=role)
        if created:
            notify_role_changed(target.pk, role.name, "assigned")
    return Response(
        RoleAssignmentResultSerializer(target).data,
        status=status.HTTP_200_OK,
    )


@extend_schema(
    summary="Revoke a user's role",
    description=(
        "Admin only; idempotent. Cannot revoke student/admin or modify your own roles. "
        "Existing eligibility and picked evaluations are preserved."
    ),
    parameters=[CSRF_HEADER],
    request=None,
    responses={
        204: OpenApiResponse(description="Role removed or already absent; no response body."),
        **error_responses(
            {
                401: ("not_authenticated",),
                403: ("permission_denied", "csrf_failed"),
                404: ("not_found",),
                409: ("role_not_revocable", "cannot_modify_self"),
            }
        ),
    },
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
    # TODO(audit): role.revoked (#53). The audit log is not on this branch.
    with transaction.atomic():
        deleted, _per_model = UserRole.objects.filter(user=target, role=role).delete()
        if deleted:
            notify_role_changed(target.pk, role.name, "revoked")
    return Response(status=status.HTTP_204_NO_CONTENT)
