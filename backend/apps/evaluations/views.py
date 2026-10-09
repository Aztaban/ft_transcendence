"""Project browsing endpoints (api-plan §10.3)."""

from django.contrib.auth import get_user_model
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import NotAuthenticated
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role

from .models import Project
from .serializers import ProjectRefSerializer, ProjectSerializer


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


class ProjectDetailView(RetrieveAPIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    queryset = Project.objects.filter(is_active=True)
    lookup_field = "slug"

    @extend_schema(summary="Retrieve an active project", responses={200: ProjectSerializer})
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        project = super().get_object()
        User = get_user_model()
        project.eligible_tutors = (
            User.objects.filter(
                status=User.Status.ACTIVE,
                roles__name__in=(Role.Name.TUTOR, Role.Name.HEAD_TUTOR),
                eligibilities__project=project,
            )
            .order_by("display_name")
            .distinct()
        )
        return project
