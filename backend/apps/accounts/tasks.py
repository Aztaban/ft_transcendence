"""Database session maintenance."""

from celery import shared_task
from django.core.management import call_command


@shared_task(name="clear_expired_sessions")
def clear_expired_sessions():
    """Use Django's session backend cleanup to remove expired database rows."""
    call_command("clearsessions")
