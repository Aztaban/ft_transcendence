"""Student Council inbox endpoints (api-plan §10.6)."""

from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.core.schema import CSRF_HEADER, error_responses
from apps.core.throttling import SCMessageSendRateThrottle

from .models import SCMessage
from .serializers import SCMessageCreatedSerializer, SCMessageCreateSerializer


@extend_schema(
    parameters=[CSRF_HEADER],
    summary="Send an anonymous message to the Student Council",
    request=SCMessageCreateSerializer,
    responses={
        201: SCMessageCreatedSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("csrf_failed",),
                415: ("unsupported_media_type",),
            }
        ),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([UserRateThrottle, SCMessageSendRateThrottle])
def sc_message_list(request):
    """Send an anonymous message; the sender is stored but never returned (api-plan §10.6)."""
    serializer = SCMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    message = SCMessage.objects.create(
        sender=request.user,
        body=serializer.validated_data["body"],
    )
    # TODO(notifications): sc_message.created to all SC Members (api-plan §8.8), once the
    # notification backend (#611, #612, #616) is on main.
    return Response(SCMessageCreatedSerializer(message).data, status=status.HTTP_201_CREATED)
