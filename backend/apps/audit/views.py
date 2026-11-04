"""Admin audit log list (api-plan §10.9)."""

from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminRole
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogQuerySerializer, AuditLogSerializer
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import error_responses


@extend_schema(
    auth=[{"cookieAuth": []}],
    summary="List audit log entries, newest first",
    parameters=[
        OpenApiParameter("actor", OpenApiTypes.INT, description="User id of the actor."),
        OpenApiParameter(
            "action",
            OpenApiTypes.STR,
            many=True,
            enum=AuditLog.Action.values,
            style="form",
            explode=False,
            description="Comma-separated actions.",
        ),
        OpenApiParameter(
            "target_type",
            OpenApiTypes.STR,
            many=True,
            enum=AuditLog.TargetType.values,
            style="form",
            explode=False,
            description="Comma-separated target types.",
        ),
        OpenApiParameter("target_id", OpenApiTypes.INT, description="Id of the target row."),
        OpenApiParameter(
            "from",
            OpenApiTypes.DATETIME,
            description="Include entries created at or after this datetime. Timezone required.",
        ),
        OpenApiParameter(
            "to",
            OpenApiTypes.DATETIME,
            description="Include entries created at or before this datetime. Timezone required.",
        ),
    ],
    responses={
        200: AuditLogSerializer(many=True),
        **error_responses(
            {400: ("validation_error",), 401: ("not_authenticated",), 403: ("permission_denied",)}
        ),
    },
)
class AuditLogListView(ListAPIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class = AuditLogSerializer
    pagination_class = APIPageNumberPagination

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AuditLog.objects.none()
        query = AuditLogQuerySerializer(data=self.request.query_params)
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        queryset = AuditLog.objects.select_related("actor")
        if "actor" in filters:
            queryset = queryset.filter(actor_id=filters["actor"])
        if "action" in filters:
            queryset = queryset.filter(action__in=filters["action"])
        if "target_type" in filters:
            queryset = queryset.filter(target_type__in=filters["target_type"])
        if "target_id" in filters:
            queryset = queryset.filter(target_id=filters["target_id"])
        if "from" in filters:
            queryset = queryset.filter(created_at__gte=filters["from"])
        if "to" in filters:
            queryset = queryset.filter(created_at__lte=filters["to"])
        return queryset.order_by("-created_at", "-id")
