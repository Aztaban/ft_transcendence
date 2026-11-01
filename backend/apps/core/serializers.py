"""Shared inputs whose validation is identical across API workflows."""

from rest_framework import serializers


class ReasonSerializer(serializers.Serializer):
    # Keep endpoint component descriptions unchanged when inheriting this input.
    reason = serializers.CharField(min_length=1, max_length=500)
