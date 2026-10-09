"""Account creation and migration preserve the baseline role (schema §2.3)."""

from importlib import import_module
from types import SimpleNamespace

import pytest
from django.contrib.auth import get_user_model
from django.db import connection
from django.db.migrations.loader import MigrationLoader

from apps.accounts.models import Role, UserRole

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize("method", ["create_user", "create_superuser"])
def test_account_creation_assigns_only_student(method):
    user = getattr(get_user_model().objects, method)(
        email="new@example.com", password="NewUserPassword123!", display_name="New User"
    )
    assert list(user.roles.values_list("name", flat=True)) == ["student"]
    assert UserRole.objects.filter(user=user).count() == 1


def test_missing_seeded_role_does_not_leave_a_partially_created_account():
    Role.objects.get(name="student").delete()
    with pytest.raises(Role.DoesNotExist):
        get_user_model().objects.create_user(email="partial@example.com", display_name="Partial")
    assert not get_user_model().objects.filter(email="partial@example.com").exists()


def test_backfill_is_idempotent_and_preserves_other_roles():
    User = get_user_model()
    legacy = User.objects.create(email="legacy@example.com", display_name="Legacy")
    legacy.roles.add(Role.objects.get(name="tutor"))
    existing = User.objects.create_user(email="existing@example.com", display_name="Existing")
    deleted = User.objects.create(
        email="deleted-1@deleted.invalid", display_name="Deleted user", status="deleted"
    )
    migration = import_module("apps.accounts.migrations.0006_backfill_student_role")
    historical_apps = (
        MigrationLoader(connection)
        .project_state([("accounts", "0005_merge_0002_user_intra_id_0004_alter_role_options")])
        .apps
    )
    schema_editor = SimpleNamespace(connection=connection)
    migration.backfill_student_role(historical_apps, schema_editor)
    migration.backfill_student_role(historical_apps, schema_editor)
    assert list(legacy.roles.values_list("name", flat=True)) == ["student", "tutor"]
    assert list(existing.roles.values_list("name", flat=True)) == ["student"]
    assert UserRole.objects.filter(user=existing).count() == 1
    assert not deleted.roles.exists()
