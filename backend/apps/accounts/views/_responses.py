"""Account responses views."""

from rest_framework import status
from rest_framework.response import Response


def _error_response(code, message, http_status, fields=None):
    error = {"code": code, "message": message}
    if fields is not None:
        error["fields"] = fields
    return Response({"error": error}, status=http_status)


def _validation_error_response(errors, message):
    return _error_response("validation_error", message, status.HTTP_400_BAD_REQUEST, errors)
