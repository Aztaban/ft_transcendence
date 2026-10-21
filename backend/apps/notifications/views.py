"""Recipient-owned notification API."""

from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import DestroyAPIView, GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, error_responses
from apps.notifications.models import Notification
from apps.notifications.serializers import (
    NotificationFilterSerializer,
    NotificationSerializer,
    NotificationUnreadCountSerializer,
)


class OwnNotificationsMixin:
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Notification.objects.none()
        return Notification.objects.filter(recipient=self.request.user)


class NotificationListView(OwnNotificationsMixin, ListAPIView):
    pagination_class = APIPageNumberPagination

    def get_queryset(self):
        queryset = super().get_queryset()
        filters = NotificationFilterSerializer(data=self.request.query_params.dict())
        filters.is_valid(raise_exception=True)
        if filters.validated_data.get("unread") == "true":
            queryset = queryset.filter(read_at__isnull=True)
        return queryset.order_by("-created_at", "-pk")

    @extend_schema(
        summary="List own notifications, newest first",
        parameters=[
            OpenApiParameter(
                "unread",
                type=str,
                enum=["true", "false"],
                description=(
                    "Use true to return only unread notifications; "
                    "false leaves the list unfiltered."
                ),
            ),
        ],
        responses={
            200: NotificationSerializer(many=True),
            **error_responses({400: ("validation_error",), 401: ("not_authenticated",)}),
        },
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class NotificationUnreadCountView(OwnNotificationsMixin, GenericAPIView):
    serializer_class = NotificationUnreadCountSerializer

    @extend_schema(
        summary="Count own unread notifications",
        responses={
            200: NotificationUnreadCountSerializer,
            **error_responses({401: ("not_authenticated",)}),
        },
    )
    def get(self, request):
        return Response({"count": self.get_queryset().filter(read_at__isnull=True).count()})


class NotificationDeleteView(OwnNotificationsMixin, DestroyAPIView):
    @extend_schema(
        summary="Delete an own notification",
        parameters=[CSRF_HEADER],
        responses={
            204: None,
            **error_responses(
                {401: ("not_authenticated",), 403: ("csrf_failed",), 404: ("not_found",)}
            ),
        },
    )
    def delete(self, request, *args, **kwargs):
        return super().delete(request, *args, **kwargs)
