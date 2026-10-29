"""Audit log representation and list filters from api-plan §10.9."""

from rest_framework import serializers

from apps.accounts.references import UserRefSerializer
from apps.audit.models import AuditLog
from apps.evaluations.serializers.requests import TimezoneRequiredDateTimeField


class AuditLogSerializer(serializers.ModelSerializer):
    actor = UserRefSerializer(read_only=True, allow_null=True)
    metadata = serializers.DictField(read_only=True)

    class Meta:
        model = AuditLog
        fields = (
            "id",
            "actor",
            "action",
            "target_type",
            "target_id",
            "reason",
            "metadata",
            "created_at",
        )
        read_only_fields = fields


class AuditLogQuerySerializer(serializers.Serializer):
    """Query filters for GET /admin/audit-log/ (api-plan §5.7, §10.9)."""

    actor = serializers.IntegerField(required=False, min_value=1)
    action = serializers.CharField(required=False)
    target_type = serializers.CharField(required=False)
    target_id = serializers.IntegerField(required=False, min_value=1)
    to = TimezoneRequiredDateTimeField(required=False)

    def get_fields(self):
        fields = super().get_fields()
        fields["from"] = TimezoneRequiredDateTimeField(required=False)
        return fields

    def validate_action(self, value):
        field = serializers.ChoiceField(choices=AuditLog.Action.choices)
        return [field.run_validation(item) for item in value.split(",")]

    def validate_target_type(self, value):
        field = serializers.ChoiceField(choices=AuditLog.TargetType.choices)
        return [field.run_validation(item) for item in value.split(",")]
