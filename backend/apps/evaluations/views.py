"""Create, list, retrieve and edit evaluation requests."""

from django.contrib.auth import get_user_model
from django.db.models import Q
from django.utils import timezone
from django.utils.translation import gettext as _
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.authentication import SessionAuthentication
from rest_framework.exceptions import NotAuthenticated
from rest_framework.generics import GenericAPIView, ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role

from .models import EvaluationRequest, Project, TutorEligibility
from .permissions import HITCHHIKER_ROLES, OVERRIDE_ROLES, EvaluationRequestPermission
from .serializers import (
    EvaluationRequestCreateSerializer,
    EvaluationRequestNoteSerializer,
    EvaluationRequestQuerySerializer,
    EvaluationRequestSerializer,
    ProjectRefSerializer,
    ProjectSerializer,
)
from .services import create_request, edit_note, history_filter


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


class RequestPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class EvaluationRequestBaseView(GenericAPIView):
    permission_classes = [IsAuthenticated, EvaluationRequestPermission]
    serializer_class = EvaluationRequestSerializer
    queryset = EvaluationRequest.objects.select_related(
        "student", "project", "picked_by", "cancelled_by"
    )


class EvaluationRequestListCreateView(EvaluationRequestBaseView):
    pagination_class = RequestPagination

    @extend_schema(
        parameters=[EvaluationRequestQuerySerializer],
        responses={200: EvaluationRequestSerializer(many=True)},
    )
    def get(self, request):
        query = EvaluationRequestQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        queryset = self.get_queryset()
        scope = filters["scope"]
        if scope == "mine":
            queryset = queryset.filter(student=request.user)
        elif scope == "open":
            queryset = queryset.filter(
                status=EvaluationRequest.Status.PENDING,
                project_id__in=TutorEligibility.objects.filter(tutor=request.user).values(
                    "project_id"
                ),
            ).exclude(student=request.user)
        elif scope == "picked":
            queryset = queryset.filter(picked_by=request.user)
        if "status" in filters:
            queryset = queryset.filter(status__in=filters["status"])
        if "project" in filters:
            queryset = queryset.filter(project__slug=filters["project"])
        if "history" in filters:
            history = history_filter(timezone.now())
            queryset = (
                queryset.filter(history)
                if filters["history"] == "true"
                else queryset.exclude(history)
            )
        queryset = queryset.order_by(filters["ordering"], "pk")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(
        request=EvaluationRequestCreateSerializer, responses={201: EvaluationRequestSerializer}
    )
    def post(self, request):
        serializer = EvaluationRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation = create_request(
            student=request.user,
            project=serializer.validated_data["project_id"],
            note=serializer.validated_data["note"],
        )
        return Response(self.get_serializer(evaluation).data, status=status.HTTP_201_CREATED)


class EvaluationRequestDetailView(EvaluationRequestBaseView):
    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.roles.filter(name__in=OVERRIDE_ROLES).exists():
            return queryset
        visible = Q(student=user) | Q(picked_by=user)
        if user.roles.filter(name__in=HITCHHIKER_ROLES).exists():
            visible |= Q(
                status=EvaluationRequest.Status.PENDING,
                project_id__in=TutorEligibility.objects.filter(tutor=user).values("project_id"),
            )
        return queryset.filter(visible)

    @extend_schema(responses={200: EvaluationRequestSerializer})
    def get(self, request, pk):
        return Response(self.get_serializer(self.get_object()).data)

    @extend_schema(
        request=EvaluationRequestNoteSerializer, responses={200: EvaluationRequestSerializer}
    )
    def patch(self, request, pk):
        evaluation = self.get_object()
        serializer = EvaluationRequestNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation = edit_note(evaluation, serializer.validated_data)
        return Response(self.get_serializer(evaluation).data)
