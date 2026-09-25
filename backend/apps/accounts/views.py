"""Views for the accounts application."""

from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .serializers import ProfileSerializer


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def profile(request):
    """Return the authenticated user's profile."""
    return Response(ProfileSerializer(request.user).data)
