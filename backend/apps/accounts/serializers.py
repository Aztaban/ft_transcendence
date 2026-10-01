from django.contrib.auth import get_user_model
from rest_framework import serializers


class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = get_user_model()
        fields = ("id", "email", "display_name", "intra_login", "language")
        read_only_fields = fields
