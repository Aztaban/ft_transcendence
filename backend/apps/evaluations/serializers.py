"""Evaluation request inputs and representations."""

from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import EvaluationRequest, Project
from .permissions import OVERRIDE_ROLES


class UserRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    # Avatar storage is not implemented yet; users without an avatar return null.
    avatar_url = serializers.URLField(read_only=True, allow_null=True, default=None)


class ProjectRefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ("id", "slug", "name")
        read_only_fields = fields


class ProjectSerializer(ProjectRefSerializer):
    """The detail view supplies eligible_tutors, filtered and sorted."""

    eligible_tutors = UserRefSerializer(many=True, read_only=True)

    class Meta(ProjectRefSerializer.Meta):
        fields = (*ProjectRefSerializer.Meta.fields, "eligible_tutors")
        read_only_fields = fields


class EvaluationRequestSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    project = ProjectRefSerializer(read_only=True)
    picked_by = UserRefSerializer(read_only=True, allow_null=True)
    cancelled_by = UserRefSerializer(read_only=True, allow_null=True)
    is_history = serializers.SerializerMethodField()

    @extend_schema_field(UserRefSerializer(allow_null=True))
    def get_student(self, instance):
        """A pending request is anonymous to Hitchhikers until one picks it (api-plan 8.7).

        Only the student, the Hitchhiker in picked_by, Head Tutors and Admins see who asked
        """
        request = self.context.get("request")
        if request is None:
            return None
        viewer_id = request.user.pk
        if viewer_id in (instance.student_id, instance.picked_by_id) or self._sees_all_students():
            return UserRefSerializer(instance.student).data
        return None

    def _sees_all_students(self):
        if "sees_all_students" not in self.context:
            user = self.context["request"].user
            self.context["sees_all_students"] = user.roles.filter(name__in=OVERRIDE_ROLES).exists()
        return self.context["sees_all_students"]

    @extend_schema_field(serializers.BooleanField())
    def get_is_history(self, instance):
        return instance.status in (
            EvaluationRequest.Status.CANCELLED,
            EvaluationRequest.Status.EXPIRED,
        ) or (
            instance.status == EvaluationRequest.Status.CONFIRMED
            and instance.ends_at < timezone.now()
        )

    class Meta:
        model = EvaluationRequest
        fields = (
            "id",
            "student",
            "project",
            "note",
            "status",
            "picked_by",
            "starts_at",
            "ends_at",
            "cancelled_by",
            "cancelled_at",
            "expired_at",
            "result",
            "feedback",
            "completed_at",
            "is_history",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields


class EvaluationRequestCreateSerializer(serializers.Serializer):
    project_id = serializers.PrimaryKeyRelatedField(queryset=Project.objects.filter(is_active=True))
    note = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class EvaluationRequestNoteSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=500, required=False, allow_blank=True)


class TimezoneRequiredDateTimeField(serializers.DateTimeField):
    """ISO 8601 datetime that must include Z or an offset (api-plan §5.2)."""

    default_error_messages = {
        "naive": _("Datetime must include a timezone (Z or an offset)."),
    }

    def enforce_timezone(self, value):
        if timezone.is_naive(value):
            self.fail("naive")
        return super().enforce_timezone(value)


class EvaluationRequestPickSlotSerializer(serializers.Serializer):
    """Body of POST /evaluation-requests/{id}/pick-slot/ (api-plan §10.4)."""

    starts_at = TimezoneRequiredDateTimeField()
    ends_at = TimezoneRequiredDateTimeField()


class EvaluationRequestQuerySerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=("mine", "open", "picked", "all"), default="mine")
    status = serializers.CharField(required=False)
    history = serializers.ChoiceField(choices=("true", "false"), required=False)
    project = serializers.CharField(required=False)
    result = serializers.CharField(required=False)
    ordering = serializers.ChoiceField(
        choices=("created_at", "-created_at", "starts_at", "-starts_at"), default="-created_at"
    )

    def validate_status(self, value):
        field = serializers.ChoiceField(choices=EvaluationRequest.Status.choices)
        return [field.run_validation(item) for item in value.split(",")]

    def validate_result(self, value):
        # `none` is requests without a result (api-plan 10.4)
        field = serializers.ChoiceField(choices=(*EvaluationRequest.Result.values, "none"))
        return [field.run_validation(item) for item in value.split(",")]
