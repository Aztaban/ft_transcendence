"""Serializers for registration, user profiles, visibility, roles, and tutor eligibility."""

from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.accounts.models import Role

User = get_user_model()


class RegistrationSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    email = serializers.EmailField(max_length=254)
    display_name = serializers.CharField(max_length=64)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value):
        email = User.objects.normalize_email(value)
        if User.objects.filter(email=email).exists():
            raise serializers.ValidationError(
                "An account with this email already exists.",
                code="unique",
            )
        return email

    def validate(self, attrs):
        user = User(
            email=attrs["email"],
            display_name=attrs["display_name"],
        )

        try:
            password_validation.validate_password(attrs["password"], user=user)
        except DjangoValidationError as exc:
            raise serializers.ValidationError({"password": exc.messages}) from exc

        return attrs

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


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


class PublicProfileSerializer(serializers.ModelSerializer):
    """Authenticated community profile — no email, intra_login, status, language."""

    roles = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "display_name", "roles")
        read_only_fields = fields

    def get_roles(self, obj):
        return _role_names(obj)


class RoleAssignmentResultSerializer(PublicProfileSerializer):
    """Limited payload after role assign — same visibility as public profile."""


class TutorEligibleProjectSerializer(serializers.Serializer):
    """Public project listing item for tutor eligibility (api-plan Project)."""

    id = serializers.IntegerField()
    slug = serializers.CharField()
    name = serializers.CharField()
