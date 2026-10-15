"""Core people-search contract tests; query controls are covered in the next PR."""

import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.evaluations.models import Project, TutorEligibility

pytestmark = pytest.mark.django_db


@pytest.fixture
def directory():
    roles = {name: Role.objects.get(name=name) for name in Role.Name.values}
    caller = get_user_model().objects.create_user(
        email="viewer@example.com", password="secret", display_name="Viewer"
    )
    client = APIClient()
    client.force_authenticate(caller)
    return client, roles, caller


def make_person(name, roles, **extra):
    person = get_user_model().objects.create_user(
        email=f"{name.lower()}@example.com", display_name=name, password="secret", **extra
    )
    person.roles.set(roles)
    return person


def test_missing_session_returns_contract_error():
    response = APIClient().get(reverse("api:search-people"))
    assert response.status_code == 401
    assert response.json() == {
        "error": {"code": "not_authenticated", "message": "Authentication required."}
    }


def test_empty_directory(directory):
    client, _, _ = directory
    response = client.get(reverse("api:search-people"))
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_results_match_contract_and_exclude_private_fields(directory):
    client, roles, _ = directory
    alice = make_person(
        "Alice", [roles["student"], roles["tutor"], roles["sc_member"]], intra_login="private42"
    )
    bob = make_person("Bob", [roles["student"], roles["head_tutor"]])
    carol = make_person("Carol", [roles["student"], roles["sc_member"]])
    project = Project.objects.create(slug="search-test", name="Search test")
    TutorEligibility.objects.create(tutor=alice, project=project)
    TutorEligibility.objects.create(tutor=bob, project=project)
    # Stale eligibility must not make a council-only member a Hitchhiker.
    TutorEligibility.objects.create(tutor=carol, project=project)
    response = client.get(reverse("api:search-people"))
    assert response.status_code == 200
    assert response.json() == {
        "count": 3,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": alice.id,
                "display_name": "Alice",
                "avatar_url": None,
                "roles": [
                    {"id": roles["sc_member"].id, "name": "sc_member"},
                    {"id": roles["student"].id, "name": "student"},
                    {"id": roles["tutor"].id, "name": "tutor"},
                ],
                "eligible_projects": [
                    {"id": project.id, "slug": "search-test", "name": "Search test"}
                ],
            },
            {
                "id": bob.id,
                "display_name": "Bob",
                "avatar_url": None,
                "roles": [
                    {"id": roles["head_tutor"].id, "name": "head_tutor"},
                    {"id": roles["student"].id, "name": "student"},
                ],
                "eligible_projects": [
                    {"id": project.id, "slug": "search-test", "name": "Search test"}
                ],
            },
            {
                "id": carol.id,
                "display_name": "Carol",
                "avatar_url": None,
                "roles": [
                    {"id": roles["sc_member"].id, "name": "sc_member"},
                    {"id": roles["student"].id, "name": "student"},
                ],
                "eligible_projects": [],
            },
        ],
    }


def test_excludes_students_admin_only_and_inactive_people(directory):
    client, roles, _ = directory
    make_person("Student", [roles["student"]])
    make_person("Admin", [roles["admin"]])
    make_person("Suspended", [roles["tutor"]], status="suspended")
    # Main does not yet declare the deleted enum, but the contract excludes these rows too.
    make_person("Deleted", [roles["sc_member"]], status="deleted")
    response = client.get(reverse("api:search-people"))
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_inactive_projects_are_hidden_without_hiding_the_tutor(directory):
    client, roles, _ = directory
    alice = make_person("Alice", [roles["student"], roles["tutor"]])
    project = Project.objects.create(slug="inactive-search-test", name="Inactive", is_active=False)
    TutorEligibility.objects.create(tutor=alice, project=project)

    response = client.get(reverse("api:search-people"))

    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": alice.id,
                "display_name": "Alice",
                "avatar_url": None,
                "roles": [
                    {"id": roles["student"].id, "name": "student"},
                    {"id": roles["tutor"].id, "name": "tutor"},
                ],
                "eligible_projects": [],
            }
        ],
    }


def test_session_authentication_allows_an_ordinary_student(directory):
    _, _, caller = directory
    client = APIClient()
    assert client.login(email=caller.email, password="secret")
    response = client.get(reverse("api:search-people"))
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_role_changes_take_effect_on_next_request(directory):
    client, roles, _ = directory
    person = make_person("Alice", [roles["tutor"]])
    assert client.get(reverse("api:search-people")).json()["count"] == 1
    person.roles.remove(roles["tutor"])
    response = client.get(reverse("api:search-people"))
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_pagination_returns_exact_envelope_and_links(directory):
    client, roles, _ = directory
    bob = make_person("Bob", [roles["tutor"]])
    alice = make_person("Alice", [roles["tutor"]])
    url = reverse("api:search-people")
    first = client.get(url, {"page_size": 1})
    assert first.status_code == 200
    assert first.json() == {
        "count": 2,
        "next": f"http://testserver{url}?page=2&page_size=1",
        "previous": None,
        "results": [
            {
                "id": alice.id,
                "display_name": "Alice",
                "avatar_url": None,
                "roles": [{"id": roles["tutor"].id, "name": "tutor"}],
                "eligible_projects": [],
            }
        ],
    }
    second = client.get(url, {"page": 2, "page_size": 1})
    assert second.status_code == 200
    assert second.json() == {
        "count": 2,
        "next": None,
        "previous": f"http://testserver{url}?page_size=1",
        "results": [
            {
                "id": bob.id,
                "display_name": "Bob",
                "avatar_url": None,
                "roles": [{"id": roles["tutor"].id, "name": "tutor"}],
                "eligible_projects": [],
            }
        ],
    }


def test_default_and_maximum_page_sizes(directory):
    client, roles, _ = directory
    for index in range(101):
        make_person(f"Person{index:03}", [roles["tutor"]])
    url = reverse("api:search-people")
    default = client.get(url).json()
    assert default["count"] == 101
    assert len(default["results"]) == 20
    maximum = client.get(url, {"page_size": 200}).json()
    assert maximum["count"] == 101
    assert len(maximum["results"]) == 100


def test_results_prefetch_roles_and_projects(directory, django_assert_num_queries):
    client, roles, _ = directory
    project = Project.objects.create(slug="search-test", name="Search test")
    for index in range(5):
        person = make_person(f"Person{index}", [roles["tutor"], roles["sc_member"]])
        TutorEligibility.objects.create(tutor=person, project=project)
    with django_assert_num_queries(4):
        response = client.get(reverse("api:search-people"))
    assert response.status_code == 200
    assert response.json()["count"] == 5


def test_search_throttles_per_user(directory):
    client, _, _ = directory
    url = reverse("api:search-people")
    for _ in range(60):
        assert client.get(url).status_code == 200
    response = client.get(url)
    assert response.status_code == 429
    assert response.json() == {
        "error": {"code": "throttled", "message": "Too many requests. Try again later."}
    }
    assert int(response["Retry-After"]) > 0
    other = make_person("Other", [])
    client.force_authenticate(other)
    assert client.get(url).status_code == 200
