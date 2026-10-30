"""Student Council inbox permissions (api-plan §10.6).

Anyone signed in may send a message; only SC Members and Admins may read the inbox.
"""

from rest_framework.exceptions import NotFound
from rest_framework.permissions import BasePermission

from apps.accounts.models import Role

COUNCIL_ROLES = frozenset({Role.Name.SC_MEMBER, Role.Name.ADMIN})


def is_council(user):
    """Whether the user may read the council inbox: SC Member or Admin (api-plan §10.6)."""
    return user.roles.filter(name__in=COUNCIL_ROLES).exists()


class CanReadCouncilInbox(BasePermission):
    """Allow anyone to send a message; only the council may list the inbox (403 otherwise)."""

    def has_permission(self, request, view):
        if request.method == "POST":
            return True
        return is_council(request.user)


class IsCouncilOrNotFound(BasePermission):
    """Allow only the council; answer 404 to anyone else so messages stay hidden (§5.5)."""

    def has_permission(self, request, view):
        if not is_council(request.user):
            raise NotFound()
        return True
