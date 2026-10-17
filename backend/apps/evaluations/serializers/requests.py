"""Evaluation request inputs and representations."""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.accounts.references import UserRefSerializer
from apps.evaluations.models import EvaluationRequest, Project
from apps.evaluations.permissions import OVERRIDE_ROLES
from apps.evaluations.references import ProjectRefSerializer


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


def _on_slot_grid(value):
    """True when the UTC instant sits on the configured minute grid with no seconds."""
    return (
        value.second == 0
        and value.microsecond == 0
        and value.minute % settings.EVALUATION_SLOT_GRID_MINUTES == 0
    )


def _grid_message():
    return _("Time must be on a %(minutes)s-minute boundary, with zero seconds.") % {
        "minutes": settings.EVALUATION_SLOT_GRID_MINUTES
    }


def _duration_message():
    return _("Duration must be between %(minimum)s and %(maximum)s minutes.") % {
        "minimum": settings.EVALUATION_SLOT_MIN_DURATION_MINUTES,
        "maximum": settings.EVALUATION_SLOT_MAX_DURATION_MINUTES,
    }


def _min_lead_message():
    return _("Start time must be at least %(minutes)s minutes from now.") % {
        "minutes": settings.EVALUATION_SLOT_MIN_LEAD_MINUTES
    }


def _max_lead_message():
    return _("Start time must be at most %(days)s days from now.") % {
        "days": settings.EVALUATION_SLOT_MAX_LEAD_DAYS
    }


class EvaluationRequestPickSlotSerializer(serializers.Serializer):
    """Body of POST /evaluation-requests/{id}/pick-slot/ (api-plan §10.4)."""

    starts_at = TimezoneRequiredDateTimeField(
        help_text=(
            "Timezone required (Z or offset). After conversion to UTC, use a "
            f"{settings.EVALUATION_SLOT_GRID_MINUTES}-minute boundary with zero seconds and "
            "microseconds. Start between "
            f"{settings.EVALUATION_SLOT_MIN_LEAD_MINUTES} minutes and "
            f"{settings.EVALUATION_SLOT_MAX_LEAD_DAYS} days from now, inclusive."
        )
    )
    ends_at = TimezoneRequiredDateTimeField(
        help_text=(
            "Timezone required (Z or offset). After conversion to UTC, use a "
            f"{settings.EVALUATION_SLOT_GRID_MINUTES}-minute boundary with zero seconds and "
            "microseconds. Must be after starts_at, with a duration between "
            f"{settings.EVALUATION_SLOT_MIN_DURATION_MINUTES} and "
            f"{settings.EVALUATION_SLOT_MAX_DURATION_MINUTES} minutes, inclusive."
        )
    )

    def validate(self, attrs):
        # Times are already UTC. Rules are api-plan §7.1; limits are EVALUATION_SLOT_*.
        starts_at = attrs["starts_at"]
        ends_at = attrs["ends_at"]
        errors = {}

        if not _on_slot_grid(starts_at):
            errors["starts_at"] = [_grid_message()]
        if not _on_slot_grid(ends_at):
            errors["ends_at"] = [_grid_message()]

        # schema §4.1 eval_req_slot_order: a stored slot must end after it starts.
        if ends_at <= starts_at:
            errors.setdefault("ends_at", []).append(_("End time must be after start time."))
        else:
            duration = ends_at - starts_at
            minimum = timedelta(minutes=settings.EVALUATION_SLOT_MIN_DURATION_MINUTES)
            maximum = timedelta(minutes=settings.EVALUATION_SLOT_MAX_DURATION_MINUTES)
            if not minimum <= duration <= maximum:
                errors.setdefault("ends_at", []).append(_duration_message())

        now = timezone.now()
        earliest = now + timedelta(minutes=settings.EVALUATION_SLOT_MIN_LEAD_MINUTES)
        latest = now + timedelta(days=settings.EVALUATION_SLOT_MAX_LEAD_DAYS)
        if starts_at < earliest:
            errors.setdefault("starts_at", []).append(_min_lead_message())
        elif starts_at > latest:
            errors.setdefault("starts_at", []).append(_max_lead_message())

        if errors:
            raise serializers.ValidationError(errors)
        return attrs


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

    def validate_project(self, value):
        # Inactive projects remain valid filters for existing requests (schema §3.1).
        if not Project.objects.filter(slug=value).exists():
            raise serializers.ValidationError(_("Unknown project slug."))
        return value

    def validate_result(self, value):
        # `none` is requests without a result (api-plan 10.4)
        field = serializers.ChoiceField(choices=(*EvaluationRequest.Result.values, "none"))
        return [field.run_validation(item) for item in value.split(",")]
