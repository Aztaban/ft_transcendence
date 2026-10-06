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


# Who may assign which role through the API (api-plan §5.8). `student` is given at
# account creation and `admin` only in the Django admin, so neither is listed.
ASSIGNABLE_BY = {
    Role.Name.TUTOR: {Role.Name.HEAD_TUTOR, Role.Name.ADMIN},
    Role.Name.HEAD_TUTOR: {Role.Name.ADMIN},
    Role.Name.SC_MEMBER: {Role.Name.SC_MEMBER, Role.Name.ADMIN},
}

# Roles the API never revokes (api-plan §5.8).
NOT_REVOCABLE = {Role.Name.STUDENT, Role.Name.ADMIN}


def can_assign(user, role_name):
    """True when ``user`` may assign ``role_name`` to someone."""
    allowed = ASSIGNABLE_BY.get(role_name, set())
    return user.roles.filter(name__in=allowed).exists()


class CanAssignRoles(BasePermission):
    """Users who may assign at least one role: Admin, Head Tutor, SC Member.

    Which role each of them may assign is checked in the view with ``can_assign``.
    """

    ASSIGNERS = {Role.Name.ADMIN, Role.Name.HEAD_TUTOR, Role.Name.SC_MEMBER}

    def has_permission(self, request, view):
        _ = view
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return user.roles.filter(name__in=self.ASSIGNERS).exists()
