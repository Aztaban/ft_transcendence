"""Views for the accounts application."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import ProfileSerializer


@api_view(["GET"])
@permission_classes([AllowAny])
def me(request):
    """Return the authenticated user's profile (GET /api/v1/users/me/)."""
    if not request.user.is_authenticated:
        return Response(
            {
                "error": {
                    "code": "not_authenticated",
                    "message": "Authentication required.",
                }
            },
            status=status.HTTP_401_UNAUTHORIZED,
        )

    return Response(ProfileSerializer(request.user).data)
