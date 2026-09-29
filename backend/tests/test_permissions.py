"""Tests for DRF role permission classes and restricted endpoint protection."""

import pytest
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APIRequestFactory

from apps.accounts.models import Role
from apps.accounts.permissions import (
    CanAssignRoles,
    IsAdminRole,
    IsHeadTutorRole,
    IsSCMemberRole,
    IsStudentRole,
    IsTutorRole,
)

pytestmark = pytest.mark.django_db

factory = APIRequestFactory()


@pytest.fixture
def user_model():
    return get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def make_user(user_model):
    def _make(email, roles=(), **extra):
        user = user_model.objects.create_user(
            email=email,
            password="secret",
            display_name=email.split("@")[0],
            **extra,
        )
        if roles:
            user.roles.set(Role.objects.filter(name__in=roles))
        return user

    return _make


def _allowed(permission, user) -> bool:
    request = factory.get("/")
    request.user = user
    return permission.has_permission(request, view=None)


@pytest.mark.parametrize(
    "permission_cls",
    [
        IsStudentRole,
        IsTutorRole,
        IsHeadTutorRole,
        IsSCMemberRole,
        IsAdminRole,
        CanAssignRoles,
    ],
)
def test_permission_rejects_anonymous(permission_cls):
    assert _allowed(permission_cls(), AnonymousUser()) is False


def test_role_permissions_match_assigned_role(make_user):
    student = make_user("student@example.com", roles=(Role.Name.STUDENT,))
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    sc = make_user("sc@example.com", roles=(Role.Name.SC_MEMBER,))
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))

    assert _allowed(IsStudentRole(), student) is True
    assert _allowed(IsStudentRole(), tutor) is False

    assert _allowed(IsTutorRole(), tutor) is True
    assert _allowed(IsTutorRole(), student) is False

    assert _allowed(IsHeadTutorRole(), head) is True
    assert _allowed(IsHeadTutorRole(), tutor) is False

    assert _allowed(IsSCMemberRole(), sc) is True
    assert _allowed(IsSCMemberRole(), student) is False

    assert _allowed(IsAdminRole(), admin) is True
    assert _allowed(IsAdminRole(), student) is False


def test_can_assign_roles_allows_admin_and_head_tutor_only(make_user):
    student = make_user("student@example.com", roles=(Role.Name.STUDENT,))
    tutor = make_user("tutor@example.com", roles=(Role.Name.TUTOR,))
    head = make_user("head@example.com", roles=(Role.Name.HEAD_TUTOR,))
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))

    assert _allowed(CanAssignRoles(), student) is False
    assert _allowed(CanAssignRoles(), tutor) is False
    assert _allowed(CanAssignRoles(), head) is True
    assert _allowed(CanAssignRoles(), admin) is True


# --- Restricted endpoints: unauthorized callers are blocked ---


def test_assign_role_rejects_unauthenticated(api_client, make_user):
    target = make_user("target@example.com")

    response = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.TUTOR},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is False


@pytest.mark.parametrize(
    "roles",
    [
        (Role.Name.STUDENT,),
        (Role.Name.TUTOR,),
        (Role.Name.SC_MEMBER,),
    ],
)
def test_assign_role_rejects_roles_without_assign_permission(api_client, make_user, roles):
    actor = make_user(f"{roles[0]}@example.com", roles=roles)
    target = make_user("target@example.com")

    api_client.force_authenticate(user=actor)
    response = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.TUTOR},
        format="json",
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is False


def test_head_tutor_may_assign_tutor_but_not_admin(api_client, make_user):
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


def test_admin_may_assign_and_revoke(api_client, make_user):
    admin = make_user("admin@example.com", roles=(Role.Name.ADMIN,))
    target = make_user("target@example.com", roles=(Role.Name.STUDENT,))
    tutor_role = Role.objects.get(name=Role.Name.TUTOR)

    api_client.force_authenticate(user=admin)

    assigned = api_client.post(
        reverse("users-assign-role", kwargs={"user_id": target.id}),
        {"role": Role.Name.TUTOR},
        format="json",
    )
    assert assigned.status_code == status.HTTP_200_OK
    assert target.has_role(Role.Name.TUTOR) is True

    revoked = api_client.delete(
        reverse(
            "users-revoke-role",
            kwargs={"user_id": target.id, "role_id": tutor_role.id},
        )
    )
    assert revoked.status_code == status.HTTP_204_NO_CONTENT
    assert target.has_role(Role.Name.TUTOR) is False


def test_revoke_role_rejects_unauthenticated(api_client, make_user):
    target = make_user("target@example.com", roles=(Role.Name.TUTOR,))
    tutor_role = Role.objects.get(name=Role.Name.TUTOR)

    response = api_client.delete(
        reverse(
            "users-revoke-role",
            kwargs={"user_id": target.id, "role_id": tutor_role.id},
        )
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is True


@pytest.mark.parametrize(
    "roles",
    [
        (Role.Name.STUDENT,),
        (Role.Name.TUTOR,),
        (Role.Name.HEAD_TUTOR,),
        (Role.Name.SC_MEMBER,),
    ],
)
def test_revoke_role_allows_admin_only(api_client, make_user, roles):
    actor = make_user(f"revoke-{roles[0]}@example.com", roles=roles)
    target = make_user("target@example.com", roles=(Role.Name.TUTOR,))
    tutor_role = Role.objects.get(name=Role.Name.TUTOR)

    api_client.force_authenticate(user=actor)
    response = api_client.delete(
        reverse(
            "users-revoke-role",
            kwargs={"user_id": target.id, "role_id": tutor_role.id},
        )
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert target.has_role(Role.Name.TUTOR) is True
