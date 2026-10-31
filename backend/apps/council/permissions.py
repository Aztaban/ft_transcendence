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


def _moderate_or_hide(user):
    """Admin may moderate a message. An SC Member already sees it, so the refusal is 403.

    Everyone else gets 404, the same answer as a missing message (§5.5, §10.6).
    """
    if user.has_role(Role.Name.ADMIN):
        return True
    if user.has_role(Role.Name.SC_MEMBER):
        return False
    raise NotFound()


class CanAccessCouncilMessage(BasePermission):
    """GET and PATCH stay with the council. DELETE is the admin moderation action."""

    def has_permission(self, request, view):
        if request.method == "DELETE":
            return _moderate_or_hide(request.user)
        if is_council(request.user):
            return True
        raise NotFound()


class CanModerateCouncilMessage(BasePermission):
    """Admin-only action on one message: 403 for the council, 404 for everyone else."""

    def has_permission(self, request, view):
        return _moderate_or_hide(request.user)
