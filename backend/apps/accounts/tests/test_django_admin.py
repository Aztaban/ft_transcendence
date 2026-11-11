"""Account lifecycle rules apply through real, CSRF-protected admin views too."""

import pytest
from django.test import Client
from django.urls import reverse

from apps.accounts.models import Role, User, UserRole

pytestmark = pytest.mark.django_db
PASSWORD = "AdminLifecyclePassword123!"


@pytest.fixture
def browser():
    User.objects.create_superuser(
        email="staff@example.com", password=PASSWORD, display_name="Staff"
    )
    client = Client(enforce_csrf_checks=True)
    url = reverse("admin:login")
    client.get(url)
    response = client.post(
        url,
        {"username": "staff@example.com", "password": PASSWORD},
        HTTP_X_CSRFTOKEN=client.cookies["csrftoken"].value,
    )
    assert response.status_code == 302
    return client


def post(browser, url, data):
    return browser.post(url, data, HTTP_X_CSRFTOKEN=browser.cookies["csrftoken"].value)


def user_data(user=None, rows=()):
    data = {
        "email": user.email if user else "new@example.com",
        "display_name": "Updated" if user else "New user",
        "language": "en",
        "user_roles-TOTAL_FORMS": str(len(rows)),
        "user_roles-INITIAL_FORMS": str(len(rows) if user else 0),
        "user_roles-MIN_NUM_FORMS": "0",
        "user_roles-MAX_NUM_FORMS": "1000",
        "_save": "Save",
    }
    if user is None:
        data.update(password1=PASSWORD, password2=PASSWORD, usable_password="true")
    for index, row in enumerate(rows):
        for field, value in row.items():
            data[f"user_roles-{index}-{field}"] = str(value)
    return data


@pytest.mark.parametrize("inline_role", [None, "student", "admin"])
def test_add_user_grants_student_after_inlines(browser, inline_role):
    rows = [] if inline_role is None else [{"role": Role.objects.get(name=inline_role).pk}]
    response = post(browser, reverse("admin:accounts_user_add"), user_data(rows=rows))
    assert response.status_code == 302
    user = User.objects.get(email="new@example.com")
    assert list(user.roles.order_by("name").values_list("name", flat=True)) == (
        ["admin", "student"] if inline_role == "admin" else ["student"]
    )
    assert user.check_password(PASSWORD)
    assert user.status == "active"


@pytest.mark.parametrize("status", ["suspended", "deleted"])
def test_status_is_readonly_and_forged_post_is_ignored(browser, make_user, status):
    user = make_user("target@example.com")
    url = reverse("admin:accounts_user_change", args=[user.pk])
    page = browser.get(url)
    assert "status" in page.context["adminform"].readonly_fields
    assert "status" not in page.context["adminform"].form.fields
    row = user.user_roles.get()
    data = user_data(user, [{"id": row.pk, "role": row.role_id}])
    data["status"] = status
    assert post(browser, url, data).status_code == 302
    user.refresh_from_db()
    assert (user.status, user.email, user.display_name) == (
        "active",
        "target@example.com",
        "Updated",
    )


@pytest.mark.parametrize("model", ["user", "role"])
def test_hard_delete_and_bulk_delete_are_unavailable(browser, make_user, model):
    obj = make_user("target@example.com") if model == "user" else Role.objects.get(name="tutor")
    model_class = type(obj)
    before = model_class.objects.values().get(pk=obj.pk)
    url = reverse(f"admin:accounts_{model}_delete", args=[obj.pk])
    assert browser.get(url).status_code == 403
    assert post(browser, url, {"post": "yes"}).status_code == 403
    url = reverse(f"admin:accounts_{model}_changelist")
    page = browser.get(url)
    action_form = page.context["action_form"]
    if action_form:
        assert "delete_selected" not in dict(action_form.fields["action"].choices)
    post(browser, url, {"action": "delete_selected", "_selected_action": obj.pk, "post": "yes"})
    assert model_class.objects.values().get(pk=obj.pk) == before


def test_seeded_roles_cannot_be_added_or_renamed(browser):
    url = reverse("admin:accounts_role_add")
    assert browser.get(url).status_code == 403
    assert post(browser, url, {"name": "invented"}).status_code == 403
    role = Role.objects.get(name="student")
    url = reverse("admin:accounts_role_change", args=[role.pk])
    assert post(browser, url, {"name": "renamed", "_save": "Save"}).status_code == 302
    role.refresh_from_db()
    assert role.name == "student"


@pytest.mark.parametrize("mutation", ["delete", "replace"])
def test_student_inline_cannot_be_removed(browser, make_user, mutation):
    user = make_user("target@example.com")
    row = user.user_roles.get()
    data = {"id": row.pk, "role": row.role_id}
    if mutation == "delete":
        data["DELETE"] = "on"
    else:
        data["role"] = Role.objects.get(name="admin").pk
    response = post(
        browser, reverse("admin:accounts_user_change", args=[user.pk]), user_data(user, [data])
    )
    assert response.status_code == 200
    assert list(response.context["inline_admin_formsets"][0].formset.non_form_errors()) == [
        "The student role cannot be revoked."
    ]
    user.refresh_from_db()
    assert user.display_name == "target"
    assert list(user.roles.values_list("name", flat=True)) == ["student"]


@pytest.mark.parametrize("role_name", ["tutor", "head_tutor", "sc_member", "admin"])
def test_other_inline_roles_can_be_changed_and_removed(browser, make_user, role_name):
    user = make_user("target@example.com", roles=("student", "tutor"))
    student = user.user_roles.get(role__name="student")
    other = user.user_roles.get(role__name="tutor")
    rows = [
        {"id": student.pk, "role": student.role_id},
        {"id": other.pk, "role": Role.objects.get(name=role_name).pk},
    ]
    url = reverse("admin:accounts_user_change", args=[user.pk])
    assert post(browser, url, user_data(user, rows)).status_code == 302
    assert sorted(user.roles.values_list("name", flat=True)) == sorted(["student", role_name])
    rows[1]["DELETE"] = "on"
    assert post(browser, url, user_data(user, rows)).status_code == 302
    assert list(user.roles.values_list("name", flat=True)) == ["student"]


def test_standalone_student_role_is_protected(browser, make_user):
    user = make_user("target@example.com")
    other = make_user("other@example.com")
    row = user.user_roles.get()
    before = {"user_id": user.pk, "role_id": row.role_id}
    url = reverse("admin:accounts_userrole_change", args=[row.pk])
    assert (
        post(
            browser, url, {"role": Role.objects.get(name="admin").pk, "user": other.pk}
        ).status_code
        == 302
    )
    assert UserRole.objects.values("user_id", "role_id").get(pk=row.pk) == before
    url = reverse("admin:accounts_userrole_delete", args=[row.pk])
    assert post(browser, url, {"post": "yes"}).status_code == 403
    url = reverse("admin:accounts_userrole_changelist")
    assert (
        post(
            browser, url, {"action": "delete_selected", "_selected_action": row.pk, "post": "yes"}
        ).status_code
        == 403
    )
    assert UserRole.objects.values("user_id", "role_id").get(pk=row.pk) == before
