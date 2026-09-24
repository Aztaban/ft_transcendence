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
