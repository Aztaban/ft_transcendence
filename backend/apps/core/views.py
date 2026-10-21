"""Views shared by the whole API."""

from drf_spectacular.utils import extend_schema
from rest_framework.decorators import (
    api_view,
    authentication_classes,
    permission_classes,
    throttle_classes,
)
from rest_framework.exceptions import NotFound
from rest_framework.permissions import AllowAny


@extend_schema(exclude=True)
@api_view(["GET", "POST", "PUT", "PATCH", "DELETE"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def api_not_found(request, *args, **kwargs):
    """Unknown API paths answer with the error envelope (api-plan §5.5), never an HTML page."""
    raise NotFound()
