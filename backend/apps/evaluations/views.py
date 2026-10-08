"""Project browsing endpoints (api-plan §10.3)."""

from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import NotAuthenticated
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Project
from .serializers import ProjectRefSerializer


class ProjectListView(ListAPIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectRefSerializer
    queryset = Project.objects.filter(is_active=True).order_by("name")
    pagination_class = None

    @extend_schema(summary="List active projects", responses={200: ProjectRefSerializer(many=True)})
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def handle_exception(self, exc):
        if isinstance(exc, NotAuthenticated):
            return Response(
                {"error": {"code": "not_authenticated", "message": _("Authentication required.")}},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        return super().handle_exception(exc)
