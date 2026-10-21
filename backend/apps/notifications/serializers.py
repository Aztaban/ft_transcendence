"""Notification representations from api-plan §8.8."""

from rest_framework import serializers

from apps.notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    payload = serializers.DictField(read_only=True)

    class Meta:
        model = Notification
        fields = ("id", "type", "payload", "target_url", "read_at", "created_at")
        read_only_fields = fields


class NotificationFilterSerializer(serializers.Serializer):
    unread = serializers.ChoiceField(choices=("true", "false"), required=False)


class NotificationUnreadCountSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=0, read_only=True)
