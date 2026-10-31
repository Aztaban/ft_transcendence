"""Admin-only user listing, detail and editing."""

from django.db import IntegrityError, transaction
from django.db.models import Prefetch, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.exceptions import CannotModifySelf, EmailAlreadyExists, InvalidUserStatus
from apps.accounts.models import Role, User
from apps.accounts.permissions import IsAdminRole
from apps.accounts.serializers.admin_users import (
    ADMIN_USER_ORDERINGS,
    AccountStatusChangeSerializer,
    AdminUserQuerySerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)
from apps.accounts.services.locking import lock_users
from apps.accounts.services.sessions import end_user_sessions
from apps.audit.models import AuditLog
from apps.audit.services import record_audit
from apps.core.exceptions import error_response
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, error_responses
from apps.notifications.models import Notification
from apps.notifications.services import create_notification


def _admin_users():
    return User.objects.prefetch_related(Prefetch("roles", queryset=Role.objects.order_by("name")))


def _locked_admin_target(actor, user_id):
    # Audit rows reference the actor. Lock both users in ID order so Admins
    # changing each other's accounts cannot deadlock on foreign-key checks.
    lock_users(actor.pk, user_id)
    return get_object_or_404(_admin_users(), pk=user_id)


@extend_schema(
    summary="List users for administration",
    parameters=[
        OpenApiParameter("q", str, description="Match email, display name or 42 login."),
        OpenApiParameter("role", str, many=True, enum=Role.Name.values, explode=False),
        OpenApiParameter("status", str, many=True, enum=User.Status.values, explode=False),
        OpenApiParameter("ordering", str, enum=ADMIN_USER_ORDERINGS),
    ],
    responses={
        200: AdminUserSerializer(many=True),
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied",),
                404: ("not_found",),
            }
        ),
    },
)
class AdminUserListView(ListAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = AdminUserSerializer
    pagination_class = APIPageNumberPagination

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return User.objects.none()
        query = AdminUserQuerySerializer(data=dict(self.request.query_params.items()))
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        users = _admin_users()
        if filters.get("q"):
            users = users.filter(
                Q(email__icontains=filters["q"])
                | Q(display_name__icontains=filters["q"])
                | Q(intra_login__icontains=filters["q"])
            )
        if "role" in filters:
            users = users.filter(roles__name__in=filters["role"])
        if "status" in filters:
            users = users.filter(status__in=filters["status"])
        return users.distinct().order_by(filters["ordering"], "pk")


class AdminUserDetailView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = AdminUserSerializer
    lookup_url_kwarg = "user_id"

    def get_queryset(self):
        return _admin_users()

    @extend_schema(
        summary="Inspect a user for administration",
        responses={
            200: AdminUserSerializer,
            **error_responses(
                {401: ("not_authenticated",), 403: ("permission_denied",), 404: ("not_found",)}
            ),
        },
    )
    def get(self, request, user_id):
        return Response(self.get_serializer(self.get_object()).data)

    @extend_schema(
        summary="Edit a user's profile as an Admin",
        parameters=[CSRF_HEADER],
        request=AdminUserUpdateSerializer,
        responses={
            200: AdminUserSerializer,
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("not_authenticated",),
                    403: ("permission_denied", "csrf_failed"),
                    404: ("not_found",),
                    409: ("email_already_exists", "invalid_user_status"),
                    415: ("unsupported_media_type",),
                }
            ),
        },
    )
    def patch(self, request, user_id):
        with transaction.atomic():
            target = _locked_admin_target(request.user, user_id)
            if target.status == User.Status.DELETED:
                return error_response(
                    "invalid_user_status", _("Deleted accounts cannot be edited."), 409
                )
            serializer = AdminUserUpdateSerializer(target, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            changes = {
                field: value
                for field, value in serializer.validated_data.items()
                if getattr(target, field) != value
            }
            if changes:
                old = {field: getattr(target, field) for field in changes}
                try:
                    with transaction.atomic():
                        User.objects.filter(pk=target.pk).update(
                            **changes, updated_at=timezone.now()
                        )
                except IntegrityError:
                    # Email is the only writable unique field. The database also
                    # arbitrates simultaneous edits that pass the serializer check.
                    if "email" in changes:
                        raise EmailAlreadyExists() from None
                    raise
                record_audit(
                    actor=request.user,
                    action=AuditLog.Action.USER_UPDATED,
                    target_type=AuditLog.TargetType.USER,
                    target_id=target.pk,
                    metadata={"old": old, "new": changes},
                )
                if target.pk != request.user.pk:
                    create_notification(
                        recipient_id=target.pk,
                        notification_type=Notification.Type.ACCOUNT_UPDATED,
                        payload={"fields": sorted(changes)},
                        target_url="/profile",
                    )
                target.refresh_from_db()
            return Response(self.get_serializer(target).data)


class _AdminUserStatusChangeView(GenericAPIView):
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = AdminUserSerializer

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=AccountStatusChangeSerializer,
        responses={
            200: AdminUserSerializer,
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("not_authenticated",),
                    403: ("permission_denied", "csrf_failed"),
                    404: ("not_found",),
                    409: ("cannot_modify_self", "invalid_user_status"),
                    415: ("unsupported_media_type",),
                }
            ),
        },
    )
    def post(self, request, user_id):
        with transaction.atomic():
            target = _locked_admin_target(request.user, user_id)
            if target.pk == request.user.pk:
                raise CannotModifySelf()
            serializer = AccountStatusChangeSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            now = timezone.now()
            updated = User.objects.filter(pk=target.pk, status=self.expected_status).update(
                status=self.new_status, updated_at=now
            )
            if updated != 1:
                raise InvalidUserStatus()
            record_audit(
                actor=request.user,
                action=self.audit_action,
                target_type=AuditLog.TargetType.USER,
                target_id=target.pk,
                reason=serializer.validated_data["reason"],
            )
            if self.new_status == User.Status.SUSPENDED:
                end_user_sessions(target.pk)
            target.status = self.new_status
            target.updated_at = now
            return Response(self.get_serializer(target).data)


@extend_schema(summary="Suspend a user account")
class AdminUserSuspendView(_AdminUserStatusChangeView):
    expected_status = User.Status.ACTIVE
    new_status = User.Status.SUSPENDED
    audit_action = AuditLog.Action.USER_SUSPENDED


@extend_schema(summary="Reactivate a user account")
class AdminUserReactivateView(_AdminUserStatusChangeView):
    expected_status = User.Status.SUSPENDED
    new_status = User.Status.ACTIVE
    audit_action = AuditLog.Action.USER_REACTIVATED
