"""Student Council message serializers (api-plan §8.10, §10.6)."""

from django.conf import settings
from django.utils.translation import gettext_lazy as _
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


class SCMessageUpdateSerializer(serializers.Serializer):
    """Body for PATCH /sc-messages/{id}/ (api-plan §10.6)."""

    is_read = serializers.BooleanField(required=False)
    discussion_note = serializers.CharField(
        max_length=settings.SC_MESSAGE_MAX_LENGTH, required=False, allow_blank=True
    )
    discussion_note_version = serializers.IntegerField(min_value=0, required=False)

    def validate(self, attrs):
        if "discussion_note" in attrs and "discussion_note_version" not in attrs:
            raise serializers.ValidationError(
                {"discussion_note_version": [_("This field is required.")]}
            )
        if "is_read" not in attrs and "discussion_note" not in attrs:
            raise serializers.ValidationError([_("Send is_read or discussion_note.")])
        return attrs


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
