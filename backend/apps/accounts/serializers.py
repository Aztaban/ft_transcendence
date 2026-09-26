"""Serializers for user profiles and roles."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.accounts.models import Role

User = get_user_model()


class RoleAssignSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Role.Name.choices)

    def validate_role(self, value):
        if not Role.objects.filter(name=value).exists():
            raise serializers.ValidationError("Unknown role.")
        return value


def _role_names(user):
    return list(user.roles.order_by("name").values_list("name", flat=True))


class MeSerializer(serializers.ModelSerializer):
    """Own profile including assigned roles."""

    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "display_name",
            "intra_login",
            "language",
            "status",
            "roles",
        )
        read_only_fields = fields

    def get_roles(self, obj):
        return _role_names(obj)
