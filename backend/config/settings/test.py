"""Automated tests use a disposable MySQL database, never the development DB."""

from copy import deepcopy

from . import dev as development_settings
from .dev import *  # noqa: F403

# Preserve the same MySQL connection parameters as the real application.
# Django's test runner connects to MySQL to CREATE a separate test database,
# runs migrations and tests there, then drops that test database.
DATABASES = deepcopy(development_settings.DATABASES)

if DATABASES["default"]["ENGINE"] != "django.db.backends.mysql":
    raise RuntimeError("Test settings must use the project's MySQL engine")

_development_db_name = DATABASES["default"]["NAME"]
if not _development_db_name:
    raise RuntimeError("A development database name is required")

DATABASES["default"]["TEST"] = {
    "NAME": f"test_{_development_db_name}",
}

if DATABASES["default"]["TEST"]["NAME"] == _development_db_name:
    raise RuntimeError("Test database must differ from the development database")
