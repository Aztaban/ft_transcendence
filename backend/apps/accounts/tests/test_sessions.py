"""Session invalidation skips expired data; scheduled cleanup removes it."""

from datetime import timedelta

import pytest
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.db import transaction
from django.utils import timezone

from apps.accounts.services.locking import lock_users
from apps.accounts.services.sessions import end_user_sessions
from apps.accounts.tasks import clear_expired_sessions

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("expiry_offset", [timedelta(), -timedelta(days=1)])
def test_invalidation_does_not_decode_expired_sessions(
    make_user, make_session_client, monkeypatch, user_event_sender, expiry_offset
):
    now = timezone.now()
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    target = make_user("target@example.com")
    other = make_user("other@example.com")
    target_key = make_session_client(target).session.session_key
    other_key = make_session_client(other).session.session_key
    expired = SessionStore()
    expired["_auth_user_id"] = str(target.pk)
    expired.save()
    Session.objects.filter(session_key=expired.session_key).update(expire_date=now + expiry_offset)
    decode = Session.get_decoded
    decoded_keys = []

    def track_decode(session):
        assert session.session_key != expired.session_key
        decoded_keys.append(session.session_key)
        return decode(session)

    monkeypatch.setattr(Session, "get_decoded", track_decode)
    with transaction.atomic():
        lock_users(target.pk)
        end_user_sessions(target.pk)

    assert set(decoded_keys) == {target_key, other_key}
    assert set(Session.objects.values_list("session_key", flat=True)) == {
        other_key,
        expired.session_key,
    }


def test_session_cleanup_removes_only_expired_rows_and_can_run_twice(monkeypatch):
    now = timezone.now()
    monkeypatch.setattr("django.utils.timezone.now", lambda: now)
    for key, expires in (("expired", now - timedelta(days=1)), ("live", now + timedelta(days=1))):
        Session.objects.create(session_key=key, session_data="", expire_date=expires)

    clear_expired_sessions()
    clear_expired_sessions()

    assert list(Session.objects.values("session_key", "session_data", "expire_date")) == [
        {"session_key": "live", "session_data": "", "expire_date": now + timedelta(days=1)}
    ]
