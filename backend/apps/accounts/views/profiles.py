"""Account profiles views."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
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
from apps.accounts.services.locking import lock_users
from apps.core.exceptions import validation_error_response
from apps.core.schema import CSRF_HEADER, error_responses

User = get_user_model()


class MeView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    @extend_schema(
        auth=[{"cookieAuth": []}],
        summary="Return the authenticated user's profile",
        responses={200: ProfileSerializer, **error_responses({401: ("not_authenticated",)})},
    )
    def get(self, request: Request):
        """Return the authenticated user's profile (GET /api/v1/users/me/)."""
        if not request.user.is_authenticated:
            raise NotAuthenticated()

        return Response(ProfileSerializer(request.user).data)

    @extend_schema(
        auth=[{"cookieAuth": []}],
        parameters=[CSRF_HEADER],
        summary="Update the current user's display name or language",
        request=ProfileUpdateSerializer,
        responses={
            204: None,
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
    @transaction.atomic
    def patch(self, request: Request):
        """Update the current user's display name or language"""
        if not request.user.is_authenticated:
            raise NotAuthenticated()

        lock_users(request.user.pk)
        current = User.objects.filter(pk=request.user.pk).first()
        if current is None or not current.is_active:
            raise NotAuthenticated()
        serializer = ProfileUpdateSerializer(instance=current, data=request.data, partial=True)
        if not serializer.is_valid():
            return validation_error_response(
                serializer.errors, _("Please correct the profile fields.")
            )

        serializer.save()
        return Response(status=status.HTTP_204_NO_CONTENT)


@extend_schema(
    summary="Return a user's public profile",
    responses={
        200: PublicProfileSerializer,
        **error_responses({401: ("not_authenticated",), 404: ("not_found",)}),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def user_detail(request, user_id):
    """Return a user's public profile (authenticated community visibility)."""
    _ = request
    target = get_object_or_404(User.objects.exclude(status=User.Status.DELETED), pk=user_id)
    return Response(PublicProfileSerializer(target).data)
