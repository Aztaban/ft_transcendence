"""DRF permission helpers based on Role.has_role."""

from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class IsAdminRole(BasePermission):
    """Allow only users with the admin role."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_role(Role.Name.ADMIN)
        )


class CanAssignRoles(BasePermission):
    """Admin may assign any role; Head Tutor may assign the tutor role only."""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.has_role(Role.Name.ADMIN) or user.has_role(Role.Name.HEAD_TUTOR)
