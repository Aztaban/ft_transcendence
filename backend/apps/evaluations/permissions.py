"""Request permissions use the user's actual roles."""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException
from rest_framework.permissions import BasePermission

from apps.accounts.models import Role

from .models import TutorEligibility

HITCHHIKER_ROLES = (Role.Name.TUTOR, Role.Name.HEAD_TUTOR)
OVERRIDE_ROLES = (Role.Name.HEAD_TUTOR, Role.Name.ADMIN)


class NotEligible(APIException):
    status_code = 403
    default_code = "not_eligible"
    default_detail = _("You are not eligible to evaluate this project.")


class CannotPickOwnRequest(APIException):
    status_code = 403
    default_code = "cannot_pick_own_request"
    default_detail = _("You cannot pick your own request.")


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


class CanPickSlot(BasePermission):
    """An eligible Hitchhiker may pick a slot, never on their own request (§7.1, §10.4)."""

    def has_object_permission(self, request, view, obj):
        user = request.user
        is_hitchhiker = user.roles.filter(name__in=HITCHHIKER_ROLES).exists()
        if is_hitchhiker and obj.student_id == user.pk:
            raise CannotPickOwnRequest()
        eligible = TutorEligibility.objects.filter(tutor=user, project_id=obj.project_id).exists()
        if not is_hitchhiker or not eligible:
            raise NotEligible()
        return True
