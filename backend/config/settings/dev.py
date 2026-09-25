"""Development settings."""

from .base import *  # noqa: F403

DEBUG = True

# HTTP-only local development must be able to send these cookies.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
