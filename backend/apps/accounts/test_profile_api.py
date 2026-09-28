"""HTTP-level tests for /api/v1/users/me/ and role assign/revoke endpoints."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role

pytestmark = pytest.mark.django_db


@pytest.fixture
def user_model():
    return get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(user_model):
    def _make(email, display_name=None, roles=(), **extra):
        user = user_model.objects.create_user(
            email=email,
            password="secret",
            display_name=display_name or email.split("@")[0],
            **extra,
        )
        if roles:
            user.roles.set(Role.objects.filter(name__in=roles))
        return user

    return _make


def test_me_requires_authentication(api_client):
    response = api_client.get(reverse("users-me"))

    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_me_returns_current_users_profile_with_roles(api_client, make_user):
    user = make_user(
        "alice@example.com",
        display_name="Alice",
        roles=(Role.Name.STUDENT, Role.Name.TUTOR),
    )
    make_user("bob@example.com", display_name="Bob")

    api_client.force_authenticate(user=user)
    response = api_client.get(reverse("users-me"))

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "id": user.id,
        "email": "alice@example.com",
        "display_name": "Alice",
        "intra_login": None,
        "language": "en",
        "status": "active",
        "roles": [Role.Name.STUDENT, Role.Name.TUTOR],
    }


def test_student_cannot_assign_roles(api_client, make_user):
    student = make_user("student@example.com", roles=(Role.Name.STUDENT,))
    target = make_user("target@example.com")

    api_client.force_authenticate(user=student)
    response = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.TUTOR},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is False


def test_head_tutor_can_only_assign_tutor(api_client, make_user):
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    target = make_user("target@example.com", roles=(Role.Name.STUDENT,))

    api_client.force_authenticate(user=head)

    ok = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.TUTOR},
        format="json",
    )
    assert ok.status_code == status.HTTP_200_OK
    assert target.has_role(Role.Name.TUTOR) is True

    denied = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.ADMIN},
        format="json",
    )
    assert denied.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.ADMIN) is False


def test_admin_can_assign_any_role(api_client, make_user):
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    target = make_user("target@example.com", roles=(Role.Name.STUDENT,))

    api_client.force_authenticate(user=admin)
    response = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.HEAD_TUTOR},
        format="json",
    )

    assert response.status_code == status.HTTP_200_OK
    assert target.has_role(Role.Name.HEAD_TUTOR) is True
    data = response.json()
    assert data == {
        "id": target.id,
        "display_name": "target",
        "roles": [Role.Name.HEAD_TUTOR, Role.Name.STUDENT],
    }
    assert "email" not in data
    assert "intra_login" not in data


def test_admin_can_revoke_role(api_client, make_user):
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    target = make_user(
        "target@example.com",
        roles=(Role.Name.STUDENT, Role.Name.TUTOR),
    )
    tutor_role = Role.objects.get(name=Role.Name.TUTOR)

    api_client.force_authenticate(user=admin)
    response = api_client.delete(
        reverse(
            "users-revoke-role",
            kwargs={"user_id": target.id, "role_id": tutor_role.id},
        )
    )

    assert response.status_code == status.HTTP_204_NO_CONTENT
    assert target.has_role(Role.Name.TUTOR) is False


def test_ordinary_user_cannot_revoke_role(api_client, make_user):
    student = make_user("student@example.com", roles=(Role.Name.STUDENT,))
    target = make_user("target@example.com", roles=(Role.Name.TUTOR,))
    tutor_role = Role.objects.get(name=Role.Name.TUTOR)

    api_client.force_authenticate(user=student)
    response = api_client.delete(
        reverse(
            "users-revoke-role",
            kwargs={"user_id": target.id, "role_id": tutor_role.id},
        )
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is True


def test_head_tutor_cannot_revoke_role(api_client, make_user):
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    target = make_user("target@example.com", roles=(Role.Name.TUTOR,))
    tutor_role = Role.objects.get(name=Role.Name.TUTOR)

    api_client.force_authenticate(user=head)
    response = api_client.delete(
        reverse(
            "users-revoke-role",
            kwargs={"user_id": target.id, "role_id": tutor_role.id},
        )
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is True
