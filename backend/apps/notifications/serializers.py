"""Notification representations from api-plan §8.8."""

from rest_framework import serializers

from apps.evaluations.visibility import visible_evaluation_requests
from apps.notifications.models import Notification


def evaluation_request_id(notification):
    """The request an `evaluation.*` notification is about; None for every other type."""
    if notification.type.startswith("evaluation."):
        return notification.payload["request_id"]
    return None


def openable_request_ids(user, notifications):
    """The requests of these notifications that the user can still open (§8.7), in one query."""
    request_ids = {evaluation_request_id(notification) for notification in notifications}
    request_ids.discard(None)
    if not request_ids:
        return set()
    return set(
        visible_evaluation_requests(user).filter(pk__in=request_ids).values_list("pk", flat=True)
    )


class NotificationListSerializer(serializers.ListSerializer):
    """Checks the evaluation links of a whole page at once, not one query per notification."""

    def to_representation(self, data):
        notifications = list(data)
        self.child.openable_request_ids = openable_request_ids(
            self.context["request"].user, notifications
        )
        return super().to_representation(notifications)


class NotificationSerializer(serializers.ModelSerializer):
    payload = serializers.DictField(read_only=True)

    # Set by NotificationListSerializer for a page; None when a single notification is returned.
    openable_request_ids = None

    class Meta:
        model = Notification
        fields = ("id", "type", "payload", "target_url", "read_at", "created_at")
        read_only_fields = fields
        list_serializer_class = NotificationListSerializer

    def to_representation(self, notification):
        data = super().to_representation(notification)
        request_id = evaluation_request_id(notification)
        if request_id is None:
            return data
        openable = self.openable_request_ids
        if openable is None:
            # The views return only the caller's own notifications, so the caller is the recipient.
            openable = openable_request_ids(self.context["request"].user, [notification])
        if request_id not in openable:
            # The request is hidden from the recipient now, and its page would answer 404 (R17).
            data["target_url"] = ""
        return data


class NotificationFilterSerializer(serializers.Serializer):
    unread = serializers.ChoiceField(choices=("true", "false"), required=False)


class NotificationUnreadCountSerializer(serializers.Serializer):
    count = serializers.IntegerField(min_value=0, read_only=True)
