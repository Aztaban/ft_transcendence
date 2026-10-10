"""Request permissions use the user's actual roles."""

from rest_framework.permissions import BasePermission

from apps.accounts.models import Role

HITCHHIKER_ROLES = (Role.Name.TUTOR, Role.Name.HEAD_TUTOR)
OVERRIDE_ROLES = (Role.Name.HEAD_TUTOR, Role.Name.ADMIN)


class EvaluationRequestPermission(BasePermission):
    def has_permission(self, request, view):
        if request.method != "GET" or "pk" in view.kwargs:
            return True
        scope = request.query_params.get("scope", "mine")
        if scope in ("open", "picked"):
            return request.user.roles.filter(name__in=HITCHHIKER_ROLES).exists()
        if scope == "all":
            return request.user.roles.filter(name__in=OVERRIDE_ROLES).exists()
        return True

    def has_object_permission(self, request, view, obj):
        return request.method == "GET" or obj.student_id == request.user.pk
