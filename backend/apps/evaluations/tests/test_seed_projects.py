"""The projects seeded by migration 0003 (schema §3.1)."""

from importlib import import_module
from types import SimpleNamespace

import pytest
from django.db import connection
from django.db.migrations.loader import MigrationLoader

from apps.evaluations.models import Project

pytestmark = pytest.mark.django_db

SEEDED = [
    ("agent-smith", "Agent Smith", True),
    ("born2beroot", "born2beroot", True),
    ("codexion", "Codexion", True),
    ("cpp09", "cpp09", True),
    ("fly-in", "Fly-In", True),
    ("minishell", "minishell", True),
    ("push_swap", "push_swap", True),
    ("rag-against-the-machine", "RAG against the machine", True),
    ("the-answer-protocol", "The Answer Protocol", True),
]


def run_seed():
    migration = import_module("apps.evaluations.migrations.0003_seed_projects")
    historical_apps = (
        MigrationLoader(connection).project_state([("evaluations", "0003_seed_projects")]).apps
    )
    migration.seed_projects(historical_apps, SimpleNamespace(connection=connection))


def test_migrations_seed_the_hitchhiker_evaluated_projects():
    assert list(Project.objects.values_list("slug", "name", "is_active")) == SEEDED


def test_seed_is_idempotent_and_keeps_admin_edits():
    Project.objects.filter(slug="cpp09").update(name="CPP Module 09", is_active=False)

    run_seed()
    run_seed()

    assert Project.objects.count() == 9
    assert Project.objects.filter(slug="cpp09").values_list("name", "is_active").get() == (
        "CPP Module 09",
        False,
    )
