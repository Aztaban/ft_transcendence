"""Account roles serializers."""

from rest_framework import serializers

from apps.accounts.models import Role


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ("id", "name")
        read_only_fields = fields


class RoleAssignSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.Name.choices)

    def validate_role(self, value):
        if not Role.objects.filter(name=value).exists():
            raise serializers.ValidationError("Unknown role.")
        return value
