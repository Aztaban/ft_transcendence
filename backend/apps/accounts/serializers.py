from django.contrib.auth import get_user_model, password_validation
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

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


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(trim_whitespace=False)


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
        user = User(
            email=validated_data["email"],
            display_name=validated_data["intra_login"],
            intra_id=validated_data["intra_id"],
            intra_login=validated_data["intra_login"],
        )
        user.set_unusable_password()
        user.save()
        return user
