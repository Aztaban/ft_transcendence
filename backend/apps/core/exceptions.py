"""One error format for the whole API (docs/api-plan.md §5.5 and §5.6).

Every error leaves the API as {"error": {"code", "message", "fields"}}. Views either
return error_response() themselves or raise any DRF exception; the exception handler
below converts DRF's own formats so they never reach the client.
"""

import logging

from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from django.utils.translation import gettext_lazy as _
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import exception_handler as drf_exception_handler
from rest_framework.views import set_rollback

logger = logging.getLogger(__name__)

# Messages of the generic codes. Codes specific to one endpoint carry their own message.
MESSAGES = {
    "validation_error": _("Please correct the highlighted fields."),
    "not_authenticated": _("Authentication required."),
    "csrf_failed": _("CSRF verification failed. Reload the page and try again."),
    "permission_denied": _("You do not have permission to perform this action."),
    "not_found": _("Not found."),
    "method_not_allowed": _("Method not allowed."),
    "not_acceptable": _("The requested response format is not available."),
    "unsupported_media_type": _("Unsupported media type."),
    "throttled": _("Too many requests. Try again later."),
    "server_error": _("Something went wrong. Please try again."),
}

# DRF's default error codes, renamed to the contract's codes.
_DRF_CODES = {
    "authentication_failed": "not_authenticated",
    "not_authenticated": "not_authenticated",
    "permission_denied": "permission_denied",
    "not_found": "not_found",
    "method_not_allowed": "method_not_allowed",
    "not_acceptable": "not_acceptable",
    "unsupported_media_type": "unsupported_media_type",
    "throttled": "throttled",
    "error": "server_error",
}


def error_response(code, message, http_status, fields=None):
    """Build an error response in the contract's envelope."""
    error = {"code": code, "message": str(message)}
    if fields is not None:
        error["fields"] = fields
    return Response({"error": error}, status=http_status)


def _describe(exc):
    """Return the contract code, message and field errors for a DRF exception."""
    if isinstance(exc, exceptions.ValidationError):
        detail = exc.detail
        fields = detail if isinstance(detail, dict) else {api_settings.NON_FIELD_ERRORS_KEY: detail}
        return "validation_error", MESSAGES["validation_error"], fields

    if isinstance(exc, exceptions.ParseError):
        fields = {api_settings.NON_FIELD_ERRORS_KEY: [exc.detail]}
        return "validation_error", MESSAGES["validation_error"], fields

    # SessionAuthentication reports a CSRF failure as a plain PermissionDenied.
    if isinstance(exc, exceptions.PermissionDenied) and str(exc.detail).startswith("CSRF Failed"):
        return "csrf_failed", MESSAGES["csrf_failed"], None

    code = exc.get_codes()
    if not isinstance(code, str):
        code = exc.default_code
    code = _DRF_CODES.get(code, code)
    return code, MESSAGES.get(code, exc.detail), None


def envelope_exception_handler(exc, context):
    """DRF EXCEPTION_HANDLER: render every exception in the contract's envelope."""
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()
    elif isinstance(exc, DjangoPermissionDenied):
        exc = exceptions.PermissionDenied()

    if not isinstance(exc, exceptions.APIException):
        logger.exception("Unhandled exception in %s", context.get("view"), exc_info=exc)
        set_rollback()
        return error_response(
            "server_error", MESSAGES["server_error"], status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    # DRF's handler keeps headers such as Retry-After and rolls back the transaction.
    response = drf_exception_handler(exc, context)
    code, message, fields = _describe(exc)
    if code == "not_authenticated":
        # SessionAuthentication sends no WWW-Authenticate header, so DRF downgrades a
        # missing session to 403. The contract promises 401.
        response.status_code = status.HTTP_401_UNAUTHORIZED

    error = {"code": code, "message": str(message)}
    if fields is not None:
        error["fields"] = fields
    response.data = {"error": error}
    return response
