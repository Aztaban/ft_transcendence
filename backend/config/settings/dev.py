"""Development settings."""

from .base import *  # noqa: F403

DEBUG = True

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
