"""Development settings."""

from .base import *  # noqa: F403

DEBUG = True

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# The app is used through nginx's TLS (https://localhost), so the cookies are Secure here too.
# Direct http://localhost:8000 still answers, but browsers will not keep a session there.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
