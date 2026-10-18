"""Account profiles serializers."""

from django.contrib.auth import get_user_model
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .roles import RoleSerializer

User = get_user_model()


class ProfileSerializer(serializers.ModelSerializer):
    # avatar_url stub until Files API exists — always present for clients.
    avatar_url = serializers.SerializerMethodField()
    roles = RoleSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = (
            "id",
            "email",
            "display_name",
            "avatar_url",
            "language",
            "roles",
            "intra_login",
        )
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_avatar_url(self, obj):
        return None


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("display_name", "language")


class PublicProfileSerializer(serializers.ModelSerializer):
    """Authenticated community profile — no email, intra_login, language."""

    avatar_url = serializers.SerializerMethodField()
    roles = RoleSerializer(many=True, read_only=True)

    class Meta:
        model = User
        fields = ("id", "display_name", "avatar_url", "roles")
        read_only_fields = fields

    @extend_schema_field(serializers.CharField(allow_null=True))
    def get_avatar_url(self, obj):
        return None


class RoleAssignmentResultSerializer(PublicProfileSerializer):
    """Limited payload after role assign — same visibility as public profile."""
