"""Account conflicts with API-contract error codes."""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException


class EmailAlreadyExists(APIException):
    status_code = 409
    default_code = "email_already_exists"
    default_detail = _("An account with this email already exists.")


class CannotModifySelf(APIException):
    status_code = 409
    default_code = "cannot_modify_self"
    default_detail = _("You cannot change your own account status.")


class InvalidUserStatus(APIException):
    status_code = 409
    default_code = "invalid_user_status"
    default_detail = _("This action is not allowed in the user's current status.")
