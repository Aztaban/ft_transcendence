"""Shared OpenAPI descriptions for API errors and CSRF."""

from drf_spectacular.openapi import AutoSchema as SpectacularAutoSchema
from drf_spectacular.utils import OpenApiParameter, OpenApiResponse
from rest_framework import serializers


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


class AutoSchema(SpectacularAutoSchema):
    """drf-spectacular omits a body on DELETE. Document one when the view declares it.

    ``@extend_schema`` subclasses this class, so every DELETE with a ``request``
    serializer is documented. That includes ``DELETE /sc-messages/{id}/`` and
    ``DELETE /projects/{slug}/eligibility/{tutor_id}/`` (api-plan §10.3, §10.6).
    """

    def _get_request_body(self, direction="request"):
        if self.method != "DELETE":
            return super()._get_request_body(direction)
        # Resolve the annotation while the method is still DELETE. A method-scoped
        # ``request=`` would not match after the parent guard is satisfied.
        request_serializer = self.get_request_serializer()
        if request_serializer is None:
            return None
        resolve_request = self.get_request_serializer
        self.get_request_serializer = lambda: request_serializer
        self.method = "POST"
        try:
            return super()._get_request_body(direction)
        finally:
            self.method = "DELETE"
            self.get_request_serializer = resolve_request
