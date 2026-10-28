"""Notification history retention."""

from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.utils import timezone

from apps.notifications.models import Notification


@shared_task(name="purge_old_notifications")
def purge_old_notifications():
    """Delete read and unread notifications strictly older than the retention window."""
    cutoff = timezone.now() - timedelta(days=settings.NOTIFICATION_RETENTION_DAYS)
    deleted, _ = Notification.objects.filter(created_at__lt=cutoff).delete()
    return deleted
