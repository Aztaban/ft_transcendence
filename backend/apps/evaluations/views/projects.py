"""Project list and detail endpoints (api-plan §10.3)."""

from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema
from rest_framework.authentication import SessionAuthentication
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import IsAuthenticated

from apps.core.schema import error_responses
from apps.evaluations.eligibility import eligible_hitchhiker_ids
from apps.evaluations.models import Project
from apps.evaluations.references import ProjectRefSerializer
from apps.evaluations.serializers.projects import ProjectSerializer


class ProjectListView(ListAPIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectRefSerializer
    queryset = Project.objects.filter(is_active=True).order_by("name")
    pagination_class = None

    @extend_schema(
        summary="List active projects",
        responses={
            200: ProjectRefSerializer(many=True),
            **error_responses({401: ("not_authenticated",)}),
        },
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)


class ProjectDetailView(RetrieveAPIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [IsAuthenticated]
    serializer_class = ProjectSerializer
    queryset = Project.objects.filter(is_active=True)
    lookup_field = "slug"

    @extend_schema(
        summary="Retrieve an active project",
        responses={
            200: ProjectSerializer,
            **error_responses({401: ("not_authenticated",), 404: ("not_found",)}),
        },
    )
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_object(self):
        project = super().get_object()
        project.eligible_tutors = (
            get_user_model()
            .objects.filter(pk__in=eligible_hitchhiker_ids(project.pk))
            .order_by("display_name")
        )
        return project
