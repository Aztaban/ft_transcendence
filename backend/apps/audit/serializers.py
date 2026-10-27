"""Audit log representation from api-plan §10.9."""

from rest_framework import serializers

from apps.accounts.references import UserRefSerializer
from apps.audit.models import AuditLog


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
