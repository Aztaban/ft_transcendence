"""Evaluation request inputs and representations."""

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import EvaluationRequest, Project


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
    student = UserRefSerializer(read_only=True)
    project = ProjectRefSerializer(read_only=True)
    picked_by = UserRefSerializer(read_only=True, allow_null=True)
    cancelled_by = UserRefSerializer(read_only=True, allow_null=True)
    is_history = serializers.SerializerMethodField()

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


class EvaluationRequestQuerySerializer(serializers.Serializer):
    scope = serializers.ChoiceField(choices=("mine", "open", "picked", "all"), default="mine")
    status = serializers.CharField(required=False)
    history = serializers.ChoiceField(choices=("true", "false"), required=False)
    project = serializers.CharField(required=False)
    ordering = serializers.ChoiceField(
        choices=("created_at", "-created_at", "starts_at", "-starts_at"), default="-created_at"
    )

    def validate_status(self, value):
        field = serializers.ChoiceField(choices=EvaluationRequest.Status.choices)
        return [field.run_validation(item) for item in value.split(",")]
