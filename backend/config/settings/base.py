"""Base Django settings shared by development and production."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

# config/settings/base.py -> backend/
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# No fallback, in any environment: `make env` writes a random key into .env.
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "")
if SECRET_KEY in ("", "change-me-in-dev"):
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY is missing or still the example value. Set a random key in .env "
        "(e.g. `openssl rand -hex 32`); `make env` does this for a new .env."
    )
DEBUG = False
ALLOWED_HOSTS = [
    host.strip()
    for host in os.getenv("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",")
    if host.strip()
]

# 42 Intra API v2 OAuth
FT_OAUTH_CLIENT_ID = os.getenv("FT_OAUTH_CLIENT_ID", "")
FT_OAUTH_CLIENT_SECRET = os.getenv("FT_OAUTH_CLIENT_SECRET", "")
FT_OAUTH_REDIRECT_URI = os.getenv("FT_OAUTH_REDIRECT_URI", "")

INSTALLED_APPS = [
    # Daphne's ASGI runserver must take precedence over staticfiles' command.
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "drf_spectacular",
    "apps.accounts",
    "apps.evaluations",
    "apps.notifications",
    "apps.council",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",
        "NAME": os.getenv("MYSQL_DATABASE", "transcendence"),
        "USER": os.getenv("MYSQL_USER", "transcendence"),
        "PASSWORD": os.getenv("MYSQL_PASSWORD", ""),
        "HOST": os.getenv("MYSQL_HOST", "db"),
        "PORT": os.getenv("MYSQL_PORT", "3306"),
    }
}

AUTH_USER_MODEL = "accounts.User"

# Session IDs stay inaccessible to JavaScript. React reads the separate CSRF
# cookie and sends its value in the X-CSRFToken request header.
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

# Password validation
# https://docs.djangoproject.com/en/5.2/ref/settings/#auth-password-validators
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
# https://docs.djangoproject.com/en/5.2/topics/i18n/
LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

# Pick-slot timing (api-plan §7.1). The frontend copies these defaults.
EVALUATION_SLOT_GRID_MINUTES = 15
EVALUATION_SLOT_MIN_DURATION_MINUTES = 15
EVALUATION_SLOT_MAX_DURATION_MINUTES = 120
EVALUATION_SLOT_MIN_LEAD_MINUTES = 30
EVALUATION_SLOT_MAX_LEAD_DAYS = 14

# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/5.2/howto/static-files/
STATIC_URL = "static/"
# Default primary key field type
# https://docs.djangoproject.com/en/5.2/ref/settings/#default-auto-field
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "EXCEPTION_HANDLER": "apps.core.exceptions.envelope_exception_handler",
    # JSON only: no browsable API pages, so `Accept: text/html` is a 406 (api-plan §5.6).
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    # Rate limits (api-plan §5.9). Anonymous callers of the default limit are
    # counted per IP. Exceeding a limit gives 429 `throttled` with Retry-After.
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "user": "1000/hour",
        "auth": "10/minute",
        "sc_message_send": "10/hour",
    },
    # Nginx is the one proxy in front of Django: the client IP is the last
    # X-Forwarded-For entry, so a forged header cannot pick its own IP.
    "NUM_PROXIES": 1,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "ft_transcendence API",
    "VERSION": "1.0.0",
}

# Eligibility request submit: max projects in one request.
ELIGIBILITY_REQUEST_MAX_PROJECTS = 50

# Unpicked evaluation requests expire after this many days.
EVALUATION_REQUEST_TTL_DAYS = 14

# Student Council message body and discussion note (api-plan §10.6): max characters.
SC_MESSAGE_MAX_LENGTH = 5000

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

# Shared by every backend process, so rate limit counters are not per process.
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
    }
}
CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True
NOTIFICATION_RETENTION_DAYS = 90
CELERY_BEAT_SCHEDULE = {
    "heartbeat-every-10s": {
        "task": "heartbeat",
        "schedule": 10.0,
    },
    "purge-old-notifications-daily": {
        "task": "purge_old_notifications",
        "schedule": 86400.0,
    },
    "expire-evaluation-requests-every-5m": {
        "task": "expire_evaluation_requests",
        "schedule": 300.0,
    },
}

PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.Argon2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
    "django.contrib.auth.hashers.PBKDF2SHA1PasswordHasher",
    "django.contrib.auth.hashers.BCryptSHA256PasswordHasher",
    "django.contrib.auth.hashers.ScryptPasswordHasher",
]
