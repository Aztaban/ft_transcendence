"""Account oauth serializers."""

from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()


class OAuth42ProfileSerializer(serializers.Serializer):
    """Validate the subset of the raw 42 `/v2/me` profile we rely on."""

    id = serializers.IntegerField(min_value=1)
    login = serializers.CharField(max_length=64, allow_blank=False)
    email = serializers.EmailField(max_length=254)


class OAuth42IdentitySerializer(serializers.ModelSerializer):
    """Persist the verified 42 identifiers on an existing local user."""

    class Meta:
        model = User
        fields = ("intra_id", "intra_login")
        extra_kwargs = {
            "intra_id": {"required": True, "allow_null": False},
            "intra_login": {
                "required": True,
                "allow_null": False,
                "allow_blank": False,
            },
        }

    def validate_intra_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("42 user ID must be a positive integer.")
        return value


class OAuth42UserCreationSerializer(serializers.ModelSerializer):
    """Create a local user from a verified 42 identity."""

    class Meta:
        model = User
        fields = ("email", "intra_id", "intra_login")
        extra_kwargs = {
            "email": {"required": True},
            "intra_id": {"required": True, "allow_null": False},
            "intra_login": {
                "required": True,
                "allow_null": False,
                "allow_blank": False,
            },
        }

    def validate_email(self, value):
        return User.objects.normalize_email(value)

    def validate_intra_id(self, value):
        if value <= 0:
            raise serializers.ValidationError("42 user ID must be a positive integer.")
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data["email"],
            password=None,
            display_name=validated_data["intra_login"],
            intra_id=validated_data["intra_id"],
            intra_login=validated_data["intra_login"],
        )
