"""Shared user reference representation from api-plan §8.1."""

from rest_framework import serializers


class UserRefSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    # Until avatar storage exists, users without an avatar return null.
    # A string permits relative download URLs as required by api-plan §10.7.
    avatar_url = serializers.CharField(read_only=True, allow_null=True, default=None)
