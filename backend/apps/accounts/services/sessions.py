"""User-wide session invalidation for administrative actions."""

from django.contrib.auth import SESSION_KEY
from django.contrib.sessions.models import Session

from apps.core.events import publish_session_ended


def end_user_sessions(user_id: int) -> None:
    """Call inside the account action's transaction while holding the user's lock.

    Django's session table has no user FK. Decode the signed data to select only
    this user's rows, including expired sessions, without deleting other logins.
    """
    keys = [
        session.session_key
        for session in Session.objects.only("session_key", "session_data").iterator()
        if str(session.get_decoded().get(SESSION_KEY)) == str(user_id)
    ]
    Session.objects.filter(session_key__in=keys).delete()
    publish_session_ended(user_id=user_id)
