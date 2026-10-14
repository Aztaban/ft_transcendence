"""Core people directory (api-plan §§5.7, 5.9, 8.3 and 10.8).

Query matching and optional role/project/ordering controls belong to the next PR.
"""

from django.contrib.auth import get_user_model
from django.db.models import Prefetch
from drf_spectacular.utils import extend_schema, extend_schema_field
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import Role
from apps.accounts.serializers import RoleSerializer, TutorEligibleProjectSerializer
from apps.evaluations.models import TutorEligibility


class PeopleSearchSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    roles = RoleSerializer(many=True, read_only=True)
    eligible_projects = serializers.SerializerMethodField()

    class Meta:
        model = get_user_model()
        fields = ("id", "display_name", "avatar_url", "roles", "eligible_projects")
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_avatar_url(self, obj):
        # Current main has no avatar file relation; null means the default avatar.
        return None

    @extend_schema_field(TutorEligibleProjectSerializer(many=True))
    def get_eligible_projects(self, obj):
        if not any(
            role.name in (Role.Name.TUTOR, Role.Name.HEAD_TUTOR) for role in obj.roles.all()
        ):
            return []
        return TutorEligibleProjectSerializer(
            [eligibility.project for eligibility in obj.search_eligibilities], many=True
        ).data


class PeopleSearchPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class PeopleSearchThrottle(UserRateThrottle):
    scope = "people_search"


@extend_schema(tags=["Search"], description="List active Hitchhikers and Student Council members.")
class PeopleSearchView(ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = PeopleSearchSerializer
    pagination_class = PeopleSearchPagination
    throttle_classes = [PeopleSearchThrottle]

    def get_queryset(self):
        return (
            get_user_model()
            .objects.filter(
                status="active",
                roles__name__in=(Role.Name.TUTOR, Role.Name.HEAD_TUTOR, Role.Name.SC_MEMBER),
            )
            .distinct()
            .order_by("display_name", "id")
            .prefetch_related(
                Prefetch("roles", queryset=Role.objects.order_by("name")),
                Prefetch(
                    "eligibilities",
                    queryset=TutorEligibility.objects.select_related("project").order_by(
                        "project__name", "project_id"
                    ),
                    to_attr="search_eligibilities",
                ),
            )
        )
