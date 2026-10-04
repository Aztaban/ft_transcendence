"""Development settings."""

from .base import *  # noqa: F403

DEBUG = True

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# HTTP-only local development must be able to send these cookies.
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
