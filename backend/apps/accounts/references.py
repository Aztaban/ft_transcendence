"""Shared user reference representation from api-plan §8.1."""

from rest_framework import serializers


class UserRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    # Always null: avatars are not built (R19).
    avatar_url = serializers.CharField(read_only=True, allow_null=True, default=None)
