"""Tests for Role / UserRole models and has_role."""

import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from apps.accounts.models import Role, UserRole

pytestmark = pytest.mark.django_db


@pytest.fixture
def user_model():
    return get_user_model()


@pytest.fixture
def student_role():
    return Role.objects.get(name=Role.Name.STUDENT)


@pytest.fixture
def tutor_role():
    return Role.objects.get(name=Role.Name.TUTOR)


def test_roles_are_seeded():
    names = set(Role.objects.values_list("name", flat=True))
    assert names == {
        Role.Name.STUDENT,
        Role.Name.TUTOR,
        Role.Name.HEAD_TUTOR,
        Role.Name.SC_MEMBER,
        Role.Name.ADMIN,
    }


def test_assign_role_and_has_role(user_model, student_role, tutor_role):
    user = user_model.objects.create_user("roles@example.com", "secret", display_name="Roles")
    assert user.has_role(Role.Name.STUDENT) is False

    user.roles.add(student_role)
    assert user.has_role(Role.Name.STUDENT) is True
    assert user.has_role(Role.Name.TUTOR) is False

    user.roles.add(tutor_role)
    assert user.has_role(Role.Name.TUTOR) is True
    assert set(user.roles.values_list("name", flat=True)) == {
        Role.Name.STUDENT,
        Role.Name.TUTOR,
    }


def test_user_role_unique_constraint(user_model, student_role):
    user = user_model.objects.create_user(
        "unique-role@example.com", "secret", display_name="Unique"
    )
    UserRole.objects.create(user=user, role=student_role)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            UserRole.objects.create(user=user, role=student_role)


def test_revoke_role(user_model, tutor_role):
    user = user_model.objects.create_user("revoke@example.com", "secret", display_name="Revoke")
    user.roles.add(tutor_role)
    assert user.has_role(Role.Name.TUTOR) is True

    user.roles.remove(tutor_role)
    assert user.has_role(Role.Name.TUTOR) is False
