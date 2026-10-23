"""Student Council inbox endpoints (api-plan §10.6)."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import Role
from apps.core.exceptions import error_response
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, error_responses
from apps.core.throttling import SCMessageSendRateThrottle

from .models import SCMessage
from .notifications import notify_sc_message_created
from .serializers import (
    SCMessageCreatedSerializer,
    SCMessageCreateSerializer,
    SCMessagePageSerializer,
    SCMessageSerializer,
    SCMessageUpdateSerializer,
)

_COUNCIL_ROLES = frozenset({Role.Name.SC_MEMBER, Role.Name.ADMIN})


def _create_sc_message(request):
    """Send an anonymous message; the sender is stored but never returned (api-plan §10.6)."""
    serializer = SCMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        message = SCMessage.objects.create(
            sender=request.user,
            body=serializer.validated_data["body"],
        )
        notify_sc_message_created(message)
    return Response(SCMessageCreatedSerializer(message).data, status=status.HTTP_201_CREATED)


def _is_council(user):
    """Whether the user may read the council inbox: SC Member or Admin (api-plan §10.6)."""
    return user.roles.filter(name__in=_COUNCIL_ROLES).exists()


def _list_sc_messages(request):
    """The council inbox: newest first, optionally only unread (api-plan §10.6)."""
    if not _is_council(request.user):
        raise PermissionDenied(
            _("You do not have permission to perform this action."),
            code="permission_denied",
        )
    messages = SCMessage.objects.order_by("-created_at", "-pk")
    unread = request.query_params.get("unread")
    if unread == "true":
        messages = messages.filter(read_at__isnull=True)
    elif unread is not None:
        raise ValidationError({"unread": [_("Must be true.")]})
    paginator = APIPageNumberPagination()
    page = paginator.paginate_queryset(messages, request)
    serializer = SCMessageSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


def _update_sc_message(request, pk):
    """Change the read state and/or the note; the note only if its version matches (§10.6)."""
    message = get_object_or_404(SCMessage, pk=pk)
    serializer = SCMessageUpdateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    now = timezone.now()
    with transaction.atomic():
        if "discussion_note" in data:
            version = data["discussion_note_version"]
            updated = SCMessage.objects.filter(
                pk=message.pk, discussion_note_version=version
            ).update(
                discussion_note=data["discussion_note"],
                discussion_note_version=version + 1,
                updated_at=now,
            )
            if updated == 0:
                return error_response(
                    "edit_conflict",
                    _("Someone else saved the note since you loaded it. Reload it and try again."),
                    status.HTTP_409_CONFLICT,
                )
        if "is_read" in data:
            if data["is_read"]:
                SCMessage.objects.filter(pk=message.pk, read_at__isnull=True).update(
                    read_at=now, updated_at=now
                )
            else:
                SCMessage.objects.filter(pk=message.pk).update(read_at=None, updated_at=now)
    message.refresh_from_db()
    return Response(SCMessageSerializer(message).data)


@extend_schema(
    methods=["GET"],
    # A function view looks like "retrieve" to drf-spectacular; name it like the other lists.
    operation_id="v1_sc_messages_list",
    summary="List the Student Council inbox",
    parameters=[
        OpenApiParameter(
            name="unread",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=False,
            enum=["true"],
            description="Only messages nobody has marked read yet.",
        ),
        OpenApiParameter(
            name="page",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
        ),
        OpenApiParameter(
            name="page_size",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
        ),
    ],
    responses={
        200: SCMessagePageSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied",),
            }
        ),
    },
)
@extend_schema(
    methods=["POST"],
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
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([UserRateThrottle, SCMessageSendRateThrottle])
def sc_message_list(request):
    """List the council inbox or send it a message (api-plan §10.6)."""
    if request.method == "POST":
        return _create_sc_message(request)
    return _list_sc_messages(request)


@extend_schema(
    methods=["GET"],
    summary="Read one Student Council message",
    responses={
        200: SCMessageSerializer,
        **error_responses(
            {
                401: ("not_authenticated",),
                404: ("not_found",),
            }
        ),
    },
)
@extend_schema(
    methods=["PATCH"],
    summary="Mark a Student Council message read or edit its note",
    parameters=[CSRF_HEADER],
    request=SCMessageUpdateSerializer,
    responses={
        200: SCMessageSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("csrf_failed",),
                404: ("not_found",),
                409: ("edit_conflict",),
                415: ("unsupported_media_type",),
            }
        ),
    },
)
@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def sc_message_detail(request, pk):
    """Read one council message, or change its read state and note (api-plan §10.6).

    Anyone outside the council gets 404, so they cannot tell which messages exist (§5.5).
    """
    if not _is_council(request.user):
        raise NotFound()
    if request.method == "PATCH":
        return _update_sc_message(request, pk)
    message = get_object_or_404(SCMessage, pk=pk)
    return Response(SCMessageSerializer(message).data)
