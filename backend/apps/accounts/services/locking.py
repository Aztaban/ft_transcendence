"""Consistent user-row locking for account and evaluation transactions."""

from django.contrib.auth import get_user_model


def lock_users(*user_ids: int | None) -> None:
    """Acquire user locks in ascending ID order inside the caller's transaction."""
    list(
        get_user_model()
        .objects.select_for_update()
        .filter(pk__in={user_id for user_id in user_ids if user_id is not None})
        .order_by("pk")
    )
