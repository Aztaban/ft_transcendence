"""People-search result and query serializers."""

from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.models import Role
from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.accounts.serializers.profiles import PublicProfileSerializer
from apps.evaluations.models import Project
from apps.evaluations.references import ProjectRefSerializer


class PeopleSearchSerializer(PublicProfileSerializer):
    eligible_projects = serializers.SerializerMethodField()

    class Meta(PublicProfileSerializer.Meta):
        fields = PublicProfileSerializer.Meta.fields + ("eligible_projects",)
        read_only_fields = fields

    @extend_schema_field(ProjectRefSerializer(many=True))
    def get_eligible_projects(self, obj):
        if not any(role.name in HITCHHIKER_ROLES for role in obj.roles.all()):
            return []
        return ProjectRefSerializer(
            [eligibility.project for eligibility in obj.search_eligibilities], many=True
        ).data


class PeopleSearchQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, min_length=2, max_length=64)
    role = serializers.CharField(required=False)
    project = serializers.SlugRelatedField(
        required=False,
        slug_field="slug",
        queryset=Project.objects.filter(is_active=True),
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
