"""Account conflicts with API-contract error codes."""

from django.utils.translation import gettext_lazy as _
from rest_framework.exceptions import APIException


class EmailAlreadyExists(APIException):
    status_code = 409
    default_code = "email_already_exists"
    default_detail = _("An account with this email already exists.")
