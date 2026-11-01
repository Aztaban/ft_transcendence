"""Administrative user representations and inputs."""

from rest_framework import serializers

from apps.accounts.exceptions import EmailAlreadyExists
from apps.accounts.models import Role, User
from apps.accounts.serializers.profiles import ProfileSerializer, ProfileUpdateSerializer

ADMIN_USER_ORDERINGS = tuple(
    prefix + field
    for field in ("display_name", "email", "created_at", "last_login")
    for prefix in ("", "-")
)


class AdminUserSerializer(ProfileSerializer):
    class Meta(ProfileSerializer.Meta):
        fields = ProfileSerializer.Meta.fields + ("status", "created_at", "last_login")
        read_only_fields = fields


class AdminUserUpdateSerializer(ProfileUpdateSerializer):
    # The contract requires 409 for duplicates, rather than ModelSerializer's 400.
    email = serializers.EmailField(max_length=254)

    class Meta(ProfileUpdateSerializer.Meta):
        fields = ProfileUpdateSerializer.Meta.fields + ("email",)

    def validate_email(self, value):
        value = User.objects.normalize_email(value)
        if User.objects.filter(email=value).exclude(pk=self.instance.pk).exists():
            raise EmailAlreadyExists()
        return value


class AccountStatusChangeSerializer(serializers.Serializer):
    reason = serializers.CharField(min_length=1, max_length=500)


class AdminUserQuerySerializer(serializers.Serializer):
    q = serializers.CharField(required=False, allow_blank=True)
    role = serializers.CharField(required=False)
    status = serializers.CharField(required=False)
    ordering = serializers.ChoiceField(choices=ADMIN_USER_ORDERINGS, default="display_name")

    def validate_role(self, value):
        field = serializers.ChoiceField(choices=Role.Name.choices)
        return [field.run_validation(item) for item in value.split(",")]

    def validate_status(self, value):
        field = serializers.ChoiceField(choices=User.Status.choices)
        return [field.run_validation(item) for item in value.split(",")]
