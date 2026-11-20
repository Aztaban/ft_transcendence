"""Admin-only user listing, detail and editing."""

from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import GenericAPIView, ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role, User
from apps.accounts.permissions import IsAdminRole
from apps.accounts.serializers.admin_users import (
    ADMIN_USER_ORDERINGS,
    AccountStatusChangeSerializer,
    AdminUserQuerySerializer,
    AdminUserSerializer,
    AdminUserUpdateSerializer,
)
from apps.accounts.services.admin_users import (
    locked_profile_target,
    locked_status_target,
    reactivate_account,
    suspend_account,
    update_user_profile,
)
from apps.accounts.services.deletion import delete_account
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, AutoSchema, error_responses
from apps.core.serializers import ReasonSerializer


def _admin_users():
    return User.objects.prefetch_related(Prefetch("roles", queryset=Role.objects.order_by("name")))


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
    schema = AutoSchema()
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = AdminUserSerializer
    lookup_url_kwarg = "user_id"

    def get_queryset(self):
        return _admin_users()

    @extend_schema(
        summary="Anonymize an account and clean up its active workflows",
        parameters=[CSRF_HEADER],
        request=ReasonSerializer,
        responses={
            204: None,
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
    def delete(self, request, user_id):
        serializer = ReasonSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        delete_account(
            actor=request.user, user_id=user_id, reason=serializer.validated_data["reason"]
        )
        return Response(status=204)

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
        with locked_profile_target(actor=request.user, user_id=user_id) as target:
            serializer = AdminUserUpdateSerializer(target, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            target = update_user_profile(
                actor=request.user, target=target, data=serializer.validated_data
            )
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
        with locked_status_target(actor=request.user, user_id=user_id) as target:
            serializer = AccountStatusChangeSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            target = self.change_status(
                actor=request.user,
                target=target,
                reason=serializer.validated_data["reason"],
            )
            return Response(self.get_serializer(target).data)


@extend_schema(summary="Suspend a user account")
class AdminUserSuspendView(_AdminUserStatusChangeView):
    change_status = staticmethod(suspend_account)


@extend_schema(summary="Reactivate a user account")
class AdminUserReactivateView(_AdminUserStatusChangeView):
    change_status = staticmethod(reactivate_account)
