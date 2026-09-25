"""Production settings."""

import os

from .base import *  # noqa: F403

DEBUG = False

SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]

ALLOWED_HOSTS = [
    host.strip() for host in os.environ["DJANGO_ALLOWED_HOSTS"].split(",") if host.strip()
]

# Require HTTPS for authentication and CSRF cookies in deployment.
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
