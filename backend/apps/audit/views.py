"""Admin audit log list (api-plan §10.9)."""

from drf_spectacular.utils import extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import IsAdminRole
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import error_responses


@extend_schema(
    auth=[{"cookieAuth": []}],
    summary="List audit log entries, newest first",
    responses={
        200: AuditLogSerializer(many=True),
        **error_responses({401: ("not_authenticated",), 403: ("permission_denied",)}),
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
        # Query filters (actor, action, target_type, target_id, from, to) are a
        # separate task. This list only returns the paginated log.
        return AuditLog.objects.select_related("actor").order_by("-created_at", "-id")
