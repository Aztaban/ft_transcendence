"""Views for the accounts application."""

from django.db import IntegrityError, transaction
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response

from .serializers import ProfileSerializer, ProfileUpdateSerializer, RegistrationSerializer


def _not_authenticated_response():
    return Response(
        {
            "error": {
                "code": "not_authenticated",
                "message": "Authentication required.",
            }
        },
        status=status.HTTP_401_UNAUTHORIZED,
    )


def _correct_fields_response(errors):
    return Response(
        {
            "error": {
                "code": "validation_error",
                "message": "Please correct the profile fields",
                "fields": errors,
            },
        },
        status=status.HTTP_400_BAD_REQUEST,
    )

class MeView(APIView):
    
    permission_classes = [AllowAny]

    def get(self, request: Request):
        """Return the authenticated user's profile (GET /api/v1/users/me/)."""
        if not request.user.is_authenticated:
            return _not_authenticated_response()

        return Response(ProfileSerializer(request.user).data)

    def patch(self, request: Request):
        """Update the current user's display name or language"""
        if not request.user.is_authenticated:
            return _not_authenticated_response()

        serializer = ProfileUpdateSerializer(instance=request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return _correct_fields_response(serializer.errors)
        
        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _email_conflict_response():
    return Response(
        {
            "error": {
                "code": "email_already_exists",
                "message": "An account with this email already exists.",
            }
        },
        status=status.HTTP_409_CONFLICT,
    )


def _has_unique_email_error(serializer):
    return any(
        getattr(error, "code", None) == "unique" for error in serializer.errors.get("email", [])
    )


@api_view(["POST"])
@permission_classes([AllowAny])
def register(request):
    """Create a user account without authenticating the new user."""
    serializer = RegistrationSerializer(data=request.data)
    if not serializer.is_valid():
        if _has_unique_email_error(serializer):
            return _email_conflict_response()

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

    try:
        with transaction.atomic():
            serializer.save()
    except IntegrityError:
        # Email is the only caller-supplied unique field in this endpoint.
        # Keep the database constraint as the final authority for races.
        return _email_conflict_response()

    return Response(
        {
            **serializer.data,
            "message": "Account created successfully.",
        },
        status=status.HTTP_201_CREATED,
    )
