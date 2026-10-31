"""Student Council inbox endpoints."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import NotAuthenticated, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import Role, User
from apps.accounts.services.locking import lock_users
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.core.exceptions import error_response
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, DeleteBodySchema, error_responses
from apps.core.throttling import SCMessageSendRateThrottle

from .models import SCMessage
from .notifications import notify_sc_message_created
from .permissions import CanAccessCouncilMessage, CanModerateCouncilMessage, CanReadCouncilInbox
from .serializers import (
    SCMessageCreatedSerializer,
    SCMessageCreateSerializer,
    SCMessageDeleteSerializer,
    SCMessagePageSerializer,
    SCMessageRevealResponseSerializer,
    SCMessageRevealSerializer,
    SCMessageSerializer,
    SCMessageUpdateSerializer,
)


def _create_sc_message(request):
    """Send an anonymous message; the sender is stored but never returned (api-plan §10.6)."""
    serializer = SCMessageCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    with transaction.atomic():
        # Lock the sender and Council recipients in one order before inserting
        # either the message or notifications that reference their user rows.
        council_ids = User.objects.filter(roles__name=Role.Name.SC_MEMBER).values_list(
            "pk", flat=True
        )
        lock_users(request.user.pk, *council_ids)
        sender = User.objects.get(pk=request.user.pk)
        if not sender.is_active:
            raise NotAuthenticated()
        message = SCMessage.objects.create(
            sender=sender,
            body=serializer.validated_data["body"],
        )
        notify_sc_message_created(message)
    return Response(SCMessageCreatedSerializer(message).data, status=status.HTTP_201_CREATED)


def _list_sc_messages(request):
    """The council inbox: newest first, optionally only unread (api-plan §10.6)."""
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


def _not_found():
    return error_response("not_found", _("Not found."), status.HTTP_404_NOT_FOUND)


def _lock_message(pk):
    return SCMessage.objects.select_for_update().select_related("sender").filter(pk=pk).first()


def _delete_sc_message(request, pk):
    """Remove one message. The audit row survives because target_id is not a foreign key."""
    with transaction.atomic():
        message = _lock_message(pk)
        if message is None:
            return _not_found()
        serializer = SCMessageDeleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record_audit(
            actor=request.user,
            action=AuditLog.Action.SC_MESSAGE_DELETED,
            target_type=AuditLog.TargetType.SC_MESSAGE,
            target_id=message.pk,
            reason=serializer.validated_data["reason"],
        )
        message.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


def _reveal_sender(request, pk):
    """Return the sender once, and always leave an audit row for that lookup (§10.6)."""
    with transaction.atomic():
        message = _lock_message(pk)
        if message is None:
            return _not_found()
        serializer = SCMessageRevealSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        record_audit(
            actor=request.user,
            action=AuditLog.Action.SC_MESSAGE_SENDER_REVEALED,
            target_type=AuditLog.TargetType.SC_MESSAGE,
            target_id=message.pk,
            reason=serializer.validated_data["reason"],
        )
        sender = message.sender
    if sender is None:
        payload = {"sender": None}
    else:
        payload = {
            "sender": {
                "id": sender.id,
                "display_name": sender.display_name,
                "email": sender.email,
            }
        }
    return Response(SCMessageRevealResponseSerializer(payload).data)


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
@permission_classes([IsAuthenticated, CanReadCouncilInbox])
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
@extend_schema(
    methods=["DELETE"],
    auth=[{"cookieAuth": []}],
    summary="Delete an abusive Student Council message",
    parameters=[CSRF_HEADER],
    request=SCMessageDeleteSerializer,
    responses={
        204: None,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied", "csrf_failed"),
                404: ("not_found",),
                415: ("unsupported_media_type",),
            }
        ),
    },
)
@api_view(["GET", "PATCH", "DELETE"])
@permission_classes([IsAuthenticated, CanAccessCouncilMessage])
def sc_message_detail(request, pk):
    """Read one council message, change its read state and note, or delete it (api-plan §10.6).

    Anyone outside the council gets 404, so they cannot tell which messages exist (§5.5).
    Deleting is admin only. An SC Member, who can already read the message, gets 403.
    """
    if request.method == "PATCH":
        return _update_sc_message(request, pk)
    if request.method == "DELETE":
        return _delete_sc_message(request, pk)
    message = get_object_or_404(SCMessage, pk=pk)
    return Response(SCMessageSerializer(message).data)


@extend_schema(
    auth=[{"cookieAuth": []}],
    summary="Reveal who sent a Student Council message",
    parameters=[CSRF_HEADER],
    request=SCMessageRevealSerializer,
    responses={
        200: SCMessageRevealResponseSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied", "csrf_failed"),
                404: ("not_found",),
                415: ("unsupported_media_type",),
            }
        ),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated, CanModerateCouncilMessage])
def sc_message_reveal_sender(request, pk):
    """Look up the sender of one message. Every lookup is audited (api-plan §10.6)."""
    return _reveal_sender(request, pk)


_ExtendedSchema = sc_message_detail.cls.kwargs["schema"]


class _DeleteBodySchema(DeleteBodySchema, _ExtendedSchema):
    """drf-spectacular omits a body on DELETE. This endpoint requires ``reason`` (§10.6)."""


sc_message_detail.cls.kwargs["schema"] = _DeleteBodySchema
for _method_name in sc_message_detail.cls.http_method_names:
    _handler = getattr(sc_message_detail.cls, _method_name)
    if getattr(_handler, "kwargs", {}).get("schema") is _ExtendedSchema:
        _handler.kwargs["schema"] = _DeleteBodySchema
