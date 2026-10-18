"""Account profiles views."""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import NotAuthenticated
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.serializers.profiles import (
    ProfileSerializer,
    ProfileUpdateSerializer,
    PublicProfileSerializer,
)
from apps.core.exceptions import validation_error_response

User = get_user_model()


class MeView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(
        summary="Return the authenticated user's profile",
        responses={200: ProfileSerializer},
    )
    def get(self, request: Request):
        """Return the authenticated user's profile (GET /api/v1/users/me/)."""
        if not request.user.is_authenticated:
            raise NotAuthenticated()

        return Response(ProfileSerializer(request.user).data)

    @extend_schema(
        summary="Update the current user's display name or language",
        request=ProfileUpdateSerializer,
        responses={204: None},
    )
    def patch(self, request: Request):
        """Update the current user's display name or language"""
        if not request.user.is_authenticated:
            raise NotAuthenticated()

        serializer = ProfileUpdateSerializer(instance=request.user, data=request.data, partial=True)
        if not serializer.is_valid():
            return validation_error_response(
                serializer.errors, "Please correct the profile fields."
            )

        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(summary="Return a user's public profile", responses={200: PublicProfileSerializer})
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    """Return a user's public profile (authenticated community visibility)."""
    _ = request
    target = get_object_or_404(User, pk=user_id)
    return Response(PublicProfileSerializer(target).data)
