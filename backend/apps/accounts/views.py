"""Views for the accounts application."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .serializers import RegistrationSerializer


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Create a user account without authenticating the new user."""
    serializer = RegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(
            {
                "error": {
                    "code": "validation_error",
                    "message": "Please correct the registration fields.",
                    "fields": serializer.errors,
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = serializer.save()

    return Response(
        {
            "id": user.id,
            "email": user.email,
            "display_name": user.display_name,
            "message": "Account created successfully.",
        },
        status=status.HTTP_201_CREATED,
    )
