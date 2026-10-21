from django.views.decorators.csrf import ensure_csrf_cookie
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiResponse,
    extend_schema,
    inline_serializer,
)
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.core.schema import error_responses


@extend_schema(
    summary="Return API status and initialize CSRF",
    auth=[],
    description="Sets the CSRF cookie for subsequent unsafe requests.",
    parameters=[
        OpenApiParameter(
            "Set-Cookie",
            location=OpenApiParameter.HEADER,
            response=[200],
            description="Sets the csrftoken cookie.",
        ),
    ],
    responses={
        200: OpenApiResponse(
            response=inline_serializer(
                name="APIRoot",
                fields={
                    "status": serializers.ChoiceField(choices=["ok"], read_only=True),
                    "version": serializers.ChoiceField(choices=["v1"], read_only=True),
                },
            ),
            description="API is available.",
        ),
        **error_responses(),
    },
)
@ensure_csrf_cookie
@api_view(["GET"])
@permission_classes([AllowAny])
def api_root(request):
    """Return API status and provide a CSRF cookie for browser login."""
    return Response(
        {
            "status": "ok",
            "version": "v1",
        }
    )
