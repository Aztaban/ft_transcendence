"""Role assignment and revocation follow api-plan §5.8; errors use the §5.5 envelope."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Role

pytestmark = pytest.mark.django_db
PASSWORD = "RoleRulesPassword123!"

STUDENT = Role.Name.STUDENT
TUTOR = Role.Name.TUTOR
HEAD_TUTOR = Role.Name.HEAD_TUTOR
SC_MEMBER = Role.Name.SC_MEMBER
ADMIN = Role.Name.ADMIN

ROLE_NOT_ASSIGNABLE = {
    "error": {"code": "role_not_assignable", "message": "You may not assign this role."}
}


def make_user(email, *roles):
    user = get_user_model().objects.create_user(
        email=email, password=PASSWORD, display_name=email.split("@")[0]
    )
    user.roles.set(Role.objects.filter(name__in=roles))
    return user


def client_for(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def assign(client, target, role):
    return client.post(
        reverse("api:users-assign-role", kwargs={"user_id": target.id}),
        {"role": role},
        format="json",
    )


def revoke(client, target, role_name):
    role = Role.objects.get(name=role_name)
    return client.delete(
        reverse("api:users-revoke-role", kwargs={"user_id": target.id, "role_id": role.id})
    )


# --- assignment matrix ------------------------------------------------------------------

ALLOWED = [
    (HEAD_TUTOR, TUTOR),
    (SC_MEMBER, SC_MEMBER),
    (ADMIN, TUTOR),
    (ADMIN, HEAD_TUTOR),
    (ADMIN, SC_MEMBER),
]
FORBIDDEN = [
    (HEAD_TUTOR, HEAD_TUTOR),
    (HEAD_TUTOR, SC_MEMBER),
    (SC_MEMBER, TUTOR),
    (SC_MEMBER, HEAD_TUTOR),
    (ADMIN, STUDENT),
    (ADMIN, ADMIN),
    (HEAD_TUTOR, ADMIN),
]


@pytest.mark.parametrize(("actor_role", "role"), ALLOWED)
def test_role_can_be_assigned_by(actor_role, role):
    actor = make_user("actor@example.com", actor_role)
    target = make_user("target@example.com")

    response = assign(client_for(actor), target, role)

    assert response.status_code == status.HTTP_200_OK
    assert target.has_role(role)


@pytest.mark.parametrize(("actor_role", "role"), FORBIDDEN)
def test_role_cannot_be_assigned_by(actor_role, role):
    actor = make_user("actor@example.com", actor_role)
    target = make_user("target@example.com")

    response = assign(client_for(actor), target, role)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == ROLE_NOT_ASSIGNABLE
    assert not target.has_role(role)


@pytest.mark.parametrize("actor_role", [STUDENT, TUTOR])
def test_users_who_assign_nothing_are_denied(actor_role):
    actor = make_user("actor@example.com", actor_role)
    target = make_user("target@example.com")

    response = assign(client_for(actor), target, TUTOR)

    assert response.status_code == status.HTTP_403_FORBIDDEN
    assert response.json() == {
        "error": {
            "code": "permission_denied",
            "message": "You do not have permission to perform this action.",
        }
    }


def test_assigning_a_role_the_user_already_has_is_a_no_op():
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com", TUTOR)

    response = assign(client_for(admin), target, TUTOR)

    assert response.status_code == status.HTTP_200_OK
    assert target.roles.filter(name=TUTOR).count() == 1


# --- revocation -----------------------------------------------------------------------


@pytest.mark.parametrize("role", [STUDENT, ADMIN])
def test_student_and_admin_roles_are_not_revocable(role):
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com", role)

    response = revoke(client_for(admin), target, role)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {"code": "role_not_revocable", "message": "This role cannot be revoked."}
    }
    assert target.has_role(role)


def test_admin_cannot_revoke_their_own_roles():
    admin = make_user("admin@example.com", ADMIN, TUTOR)

    response = revoke(client_for(admin), admin, TUTOR)

    assert response.status_code == status.HTTP_409_CONFLICT
    assert response.json() == {
        "error": {"code": "cannot_modify_self", "message": "You cannot change your own roles."}
    }
    assert admin.has_role(TUTOR)


def test_revoking_a_role_the_user_does_not_hold_is_204():
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com")

    response = revoke(client_for(admin), target, TUTOR)

    assert response.status_code == status.HTTP_204_NO_CONTENT


# --- error envelope -------------------------------------------------------------------


def test_unknown_role_name_is_a_validation_error():
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com")

    response = assign(client_for(admin), target, "wizard")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert list(error["fields"]) == ["role"]


def test_unknown_user_is_a_404_in_the_envelope():
    admin = make_user("admin@example.com", ADMIN)

    response = client_for(admin).post(
        reverse("api:users-assign-role", kwargs={"user_id": 999999}),
        {"role": TUTOR},
        format="json",
    )

    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert response.json() == {"error": {"code": "not_found", "message": "Not found."}}


# --- through a real browser session, with CSRF enforced -------------------------------


def logged_in_browser(user):
    client = APIClient(enforce_csrf_checks=True)
    client.get(reverse("api:session"), HTTP_HOST="localhost")
    response = client.post(
        reverse("api:login"),
        {"email": user.email, "password": PASSWORD},
        format="json",
        HTTP_HOST="localhost",
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == status.HTTP_200_OK
    return client


def csrf_header(client):
    return {"HTTP_HOST": "localhost", "HTTP_X_CSRFTOKEN": client.cookies["csrftoken"].value}


def test_assign_through_a_session_needs_the_csrf_token():
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com")
    browser = logged_in_browser(admin)
    url = reverse("api:users-assign-role", kwargs={"user_id": target.id})

    without = browser.post(url, {"role": TUTOR}, format="json", HTTP_HOST="localhost")
    with_token = browser.post(url, {"role": TUTOR}, format="json", **csrf_header(browser))

    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json()["error"]["code"] == "csrf_failed"
    assert with_token.status_code == status.HTTP_200_OK


def test_revoke_through_a_session_needs_the_csrf_token():
    admin = make_user("admin@example.com", ADMIN)
    target = make_user("target@example.com", TUTOR)
    browser = logged_in_browser(admin)
    role = Role.objects.get(name=TUTOR)
    url = reverse("api:users-revoke-role", kwargs={"user_id": target.id, "role_id": role.id})

    without = browser.delete(url, HTTP_HOST="localhost")
    with_token = browser.delete(url, **csrf_header(browser))

    assert without.status_code == status.HTTP_403_FORBIDDEN
    assert without.json()["error"]["code"] == "csrf_failed"
    assert with_token.status_code == status.HTTP_204_NO_CONTENT
    assert not target.has_role(TUTOR)
