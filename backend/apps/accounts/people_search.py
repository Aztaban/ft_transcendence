"""People search with filters, sorting and pagination."""

from django.contrib.auth import get_user_model
from django.db.models import Prefetch, Q
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_field
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.throttling import UserRateThrottle

from apps.accounts.models import Role
from apps.accounts.serializers import RoleSerializer, TutorEligibleProjectSerializer
from apps.evaluations.models import Project, TutorEligibility


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


class PeopleSearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, min_length=2, max_length=64)
    role = serializers.CharField(required=False)
    project = serializers.SlugRelatedField(
        required=False,
        slug_field="slug",
        queryset=Project.objects.all(),
        error_messages={"does_not_exist": _("Unknown project slug.")},
    )
    ordering = serializers.ChoiceField(
        choices=("display_name", "-display_name"), required=False, default="display_name"
    )

    def validate_role(self, value):
        names = value.split(",")
        allowed = (Role.Name.TUTOR, Role.Name.HEAD_TUTOR, Role.Name.SC_MEMBER)
        if any(name not in allowed for name in names):
            raise serializers.ValidationError(
                _("Choose tutor, head_tutor or sc_member."), code="invalid_choice"
            )
        # The tutor filter includes head_tutor even when it is the user's only tutor role.
        if Role.Name.TUTOR in names:
            names.append(Role.Name.HEAD_TUTOR)
        return names


class PeopleSearchPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


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
    pagination_class = PeopleSearchPagination
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
