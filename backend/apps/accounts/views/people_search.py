"""People search with filters, sorting and pagination."""

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import Role
from apps.accounts.serializers.people_search import (
    PeopleSearchQuerySerializer,
    PeopleSearchSerializer,
)
from apps.core.pagination import APIPageNumberPagination
from apps.evaluations.models import TutorEligibility


class PeopleSearchThrottle(UserRateThrottle):
    scope = "people_search"


@extend_schema(
    tags=["Search"],
    description="Search active Hitchhikers and Student Council members.",
    parameters=[
        OpenApiParameter(
            "q", str, description="2–64 characters; display name or private 42 login match."
        ),
        OpenApiParameter(
            "role",
            str,
            description=(
                "Comma-separated roles: tutor, head_tutor, sc_member. Tutor includes Head Tutors."
            ),
        ),
        OpenApiParameter("project", str, description="Project slug; eligible Hitchhikers only."),
        OpenApiParameter(
            "ordering",
            str,
            enum=["display_name", "-display_name"],
            description="Display name order; ascending by default.",
        ),
    ],
)
class PeopleSearchView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PeopleSearchSerializer
    pagination_class = APIPageNumberPagination
    throttle_classes = [PeopleSearchThrottle]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return get_user_model().objects.none()
        # QueryDict's HTML-input handling treats an optional empty field as omitted.
        # A supplied q must still satisfy the contract's 2–64 character rule.
        query = PeopleSearchQuerySerializer(data=dict(self.request.query_params.items()))
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        queryset = get_user_model().objects.filter(
            status="active",
            roles__name__in=(Role.Name.TUTOR, Role.Name.HEAD_TUTOR, Role.Name.SC_MEMBER),
        )
        if "q" in filters:
            queryset = queryset.filter(
                Q(display_name__icontains=filters["q"]) | Q(intra_login__icontains=filters["q"])
            )
        if "role" in filters:
            queryset = queryset.filter(roles__name__in=filters["role"])
        if "project" in filters:
            queryset = queryset.filter(
                roles__name__in=(Role.Name.TUTOR, Role.Name.HEAD_TUTOR),
                eligibilities__project=filters["project"],
            )
        return (
            queryset.distinct()
            .order_by(filters["ordering"], "id")
            .prefetch_related(
                Prefetch("roles", queryset=Role.objects.order_by("name")),
                Prefetch(
                    "eligibilities",
                    queryset=TutorEligibility.objects.filter(project__is_active=True)
                    .select_related("project")
                    .order_by("project__name", "project_id"),
                    to_attr="search_eligibilities",
                ),
            )
        )
