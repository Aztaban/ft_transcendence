"""Shared OpenAPI descriptions for API errors and CSRF."""

from drf_spectacular.openapi import AutoSchema
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse
from rest_framework import serializers


class DeleteBodySchema(AutoSchema):
    """Include explicitly annotated DELETE bodies, which spectacular otherwise omits."""

    def _get_request_body(self, direction="request"):
        if self.method != "DELETE":
            return super()._get_request_body(direction)
        request_serializer = self.get_request_serializer()
        resolve_request = self.get_request_serializer
        self.get_request_serializer = lambda: request_serializer
        self.method = "POST"
        try:
            return super()._get_request_body(direction)
        finally:
            self.method = "DELETE"
            self.get_request_serializer = resolve_request


class ErrorSerializer(serializers.Serializer):
    code = serializers.CharField()
    message = serializers.CharField()
    fields = serializers.DictField(
        child=serializers.ListField(child=serializers.CharField()),
        required=False,
        help_text="Present only for validation_error; each input field maps to a list of messages.",
    )


class ErrorResponseSerializer(serializers.Serializer):
    error = ErrorSerializer()


CSRF_HEADER = OpenApiParameter(
    "X-CSRFToken",
    location=OpenApiParameter.HEADER,
    required=True,
    description=(
        "Current csrftoken cookie value, including for anonymous requests. Read it again after "
        "login."
    ),
)


def error_responses(codes=None):
    """Describe endpoint errors alongside shared negotiation, throttling and server errors."""
    errors = {406: ("not_acceptable",), 429: ("throttled",), 500: ("server_error",)}
    errors.update(codes or {})
    return {
        status: OpenApiResponse(
            response=ErrorResponseSerializer,
            description="Error code: " + ", ".join(f"`{code}`" for code in values) + ".",
        )
        for status, values in errors.items()
    }
