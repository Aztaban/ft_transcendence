"""Production settings."""

import os

from .base import *  # noqa: F403

DEBUG = False

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

ALLOWED_HOSTS = [
    host.strip() for host in os.environ["DJANGO_ALLOWED_HOSTS"].split(",") if host.strip()
]

# Require HTTPS for authentication and CSRF cookies in deployment.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True

# `collectstatic` gathers the admin's CSS/JS here; nginx serves them (docker-compose.prod.yml).
STATIC_ROOT = BASE_DIR / "staticfiles"  # noqa: F405

# With DEBUG off, Django's default logging drops request errors; send everything to the console.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
