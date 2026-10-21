"""Student Council message serializers (api-plan §8.10, §10.6)."""

from django.conf import settings
from rest_framework import serializers


class SCMessageCreateSerializer(serializers.Serializer):
    """Body for POST /sc-messages/ (api-plan §10.6)."""

    body = serializers.CharField(max_length=settings.SC_MESSAGE_MAX_LENGTH)


class SCMessageCreatedSerializer(serializers.Serializer):
    """Response to POST /sc-messages/: only the id and time (api-plan §10.6).

    Deliberately nothing more, so the sender never gets the message back.
    """

    id = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
