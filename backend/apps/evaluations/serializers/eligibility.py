"""Tutor eligibility request serializers (api-plan §8.9, §10.3)."""

from django.conf import settings
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.references import UserRefSerializer
from apps.evaluations.models import TutorEligibilityRequest
from apps.evaluations.references import ProjectRefSerializer


class EligibilityRequestSerializer(serializers.ModelSerializer):
    """Eligibility request representation (api-plan §8.9)."""

    requester = UserRefSerializer(read_only=True)
    reviewed_by = UserRefSerializer(read_only=True, allow_null=True)
    projects = serializers.SerializerMethodField()

    class Meta:
        model = TutorEligibilityRequest
        fields = (
            "id",
            "requester",
            "projects",
            "status",
            "reviewed_by",
            "reviewed_at",
            "review_note",
            "created_at",
        )
        read_only_fields = fields

    @extend_schema_field(ProjectRefSerializer(many=True))
    def get_projects(self, obj):
        projects = sorted(obj.projects.all(), key=lambda project: project.name)
        return ProjectRefSerializer(projects, many=True).data


class EligibilityRequestPageSerializer(serializers.Serializer):
    """Paginated eligibility-request list (api-plan §5.7 wrapping §8.9)."""

    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = EligibilityRequestSerializer(many=True)


class EligibilityRequestCreateSerializer(serializers.Serializer):
    """Body for POST /tutor-eligibility-requests/ (api-plan §10.3)."""

    project_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )

    def validate_project_ids(self, value):
        if len(value) != len(set(value)):
            raise serializers.ValidationError(_("Project ids must be distinct."))
        max_projects = settings.ELIGIBILITY_REQUEST_MAX_PROJECTS
        if len(value) > max_projects:
            raise serializers.ValidationError(
                _("Select at most %(max)s projects.") % {"max": max_projects}
            )
        return value


class EligibilityRequestReviewSerializer(serializers.Serializer):
    """Body for POST /tutor-eligibility-requests/{id}/review/ (api-plan §10.3)."""

    decision = serializers.ChoiceField(
        choices=(
            TutorEligibilityRequest.Status.APPROVED,
            TutorEligibilityRequest.Status.DECLINED,
        )
    )
    review_note = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=500,
        default="",
    )
