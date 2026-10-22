"""Student Council message serializers (api-plan §8.10, §10.6)."""

from django.conf import settings
from rest_framework import serializers

from .models import SCMessage


class SCMessageCreateSerializer(serializers.Serializer):
    """Body for POST /sc-messages/ (api-plan §10.6)."""

    body = serializers.CharField(max_length=settings.SC_MESSAGE_MAX_LENGTH)


class SCMessageCreatedSerializer(serializers.Serializer):
    """Response to POST /sc-messages/: only the id and time (api-plan §10.6).

    Deliberately nothing more, so the sender never gets the message back.
    """

    id = serializers.IntegerField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)


class SCMessageSerializer(serializers.ModelSerializer):
    """Student Council message as the council sees it (api-plan §8.10); never the sender."""

    class Meta:
        model = SCMessage
        fields = (
            "id",
            "body",
            "read_at",
            "discussion_note",
            "discussion_note_version",
            "created_at",
        )
        read_only_fields = fields


class SCMessagePageSerializer(serializers.Serializer):
    """Paginated Student Council inbox (api-plan §5.7 wrapping §8.10)."""

    count = serializers.IntegerField()
    next = serializers.CharField(allow_null=True)
    previous = serializers.CharField(allow_null=True)
    results = SCMessageSerializer(many=True)
