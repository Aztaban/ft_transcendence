"""DRF permission classes based on Role.has_role.

Role checks live on each view via @permission_classes (explicit decorators),
not in Django middleware, so restricted endpoints stay easy to audit.
"""

from rest_framework.permissions import BasePermission

from apps.accounts.models import Role


class HasRole(BasePermission):
    """Allow authenticated users who hold ``role_name``."""

    role_name: str = ""

    def has_permission(self, request, view):
        _ = view
        user = request.user
        return bool(
            user and user.is_authenticated and self.role_name and user.has_role(self.role_name)
        )


class IsStudentRole(HasRole):
    """Allow users with the student role."""

    role_name = Role.Name.STUDENT


class IsTutorRole(HasRole):
    """Allow users with the tutor (hitchhiker) role."""

    role_name = Role.Name.TUTOR


class IsHeadTutorRole(HasRole):
    """Allow users with the head_tutor role."""

    role_name = Role.Name.HEAD_TUTOR


class IsSCMemberRole(HasRole):
    """Allow users with the sc_member role."""

    role_name = Role.Name.SC_MEMBER


class IsAdminRole(HasRole):
    """Allow users with the admin role."""

    role_name = Role.Name.ADMIN


class CanAssignRoles(BasePermission):
    """Admin or Head Tutor may hit the assign endpoint.

    Head Tutor is limited to the tutor role inside the view body.
    """

    def has_permission(self, request, view):
        _ = view
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.has_role(Role.Name.ADMIN) or user.has_role(Role.Name.HEAD_TUTOR)
