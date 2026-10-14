"""People-search responses, filters, sorting, pagination and permissions contract tests."""

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


@pytest.fixture
def searchable_directory(directory):
    client, roles, caller = directory
    tutor = make_person("Alice", [roles["student"], roles["tutor"]], intra_login="hidden_login")
    head = make_person("Alina", [roles["student"], roles["head_tutor"]])
    council = make_person("Alicia", [roles["student"], roles["sc_member"]])
    project = Project.objects.create(slug="search-test", name="Search test")
    other = Project.objects.create(slug="other-test", name="Other test")
    for person in (tutor, head, council):
        TutorEligibility.objects.create(tutor=person, project=project)
    TutorEligibility.objects.create(tutor=tutor, project=other)
    make_person("AliceStudent", [roles["student"]])
    make_person("AliceSuspended", [roles["tutor"]], status="suspended")
    return client, roles, tutor, head, council, project, other


@pytest.mark.parametrize("query", ["LiCe", "HIDDEN"])
def test_name_and_private_login_matching(searchable_directory, query):
    client, roles, tutor, _, _, project, other = searchable_directory
    response = client.get(reverse("api:search-people"), {"q": query})
    assert response.status_code == 200
    assert response.json() == {
        "count": 1,
        "next": None,
        "previous": None,
        "results": [
            {
                "id": tutor.id,
                "display_name": "Alice",
                "avatar_url": None,
                "roles": [
                    {"id": roles["student"].id, "name": "student"},
                    {"id": roles["tutor"].id, "name": "tutor"},
                ],
                "eligible_projects": [
                    {"id": other.id, "slug": "other-test", "name": "Other test"},
                    {"id": project.id, "slug": "search-test", "name": "Search test"},
                ],
            }
        ],
    }


@pytest.mark.parametrize(
    ("role", "names"),
    [
        ("tutor", ["Alice", "Alina"]),
        ("head_tutor", ["Alina"]),
        ("sc_member", ["Alicia"]),
        ("head_tutor,sc_member", ["Alicia", "Alina"]),
        ("tutor,head_tutor,tutor", ["Alice", "Alina"]),
    ],
)
def test_role_filters_include_head_tutors_without_duplicates(searchable_directory, role, names):
    client, *_ = searchable_directory
    response = client.get(reverse("api:search-people"), {"role": role})
    assert response.status_code == 200
    assert response.json()["count"] == len(names)
    assert [person["display_name"] for person in response.json()["results"]] == names


def test_project_filter_excludes_council_only_with_stale_eligibility(searchable_directory):
    client, _, tutor, head, _, _, _ = searchable_directory
    response = client.get(reverse("api:search-people"), {"project": "search-test"})
    assert response.status_code == 200
    assert response.json()["count"] == 2
    assert [person["id"] for person in response.json()["results"]] == [tutor.id, head.id]


def test_combined_filters_sort_and_paginate(searchable_directory):
    client, roles, tutor, head, _, project, other = searchable_directory
    tutor.roles.add(roles["head_tutor"], roles["sc_member"])
    url = reverse("api:search-people")
    params = {
        "q": "ALI",
        "role": "tutor",
        "project": "search-test",
        "ordering": "-display_name",
        "page_size": 1,
    }
    first = client.get(url, params)
    assert first.status_code == 200
    assert first.json() == {
        "count": 2,
        "next": (
            f"http://testserver{url}?ordering=-display_name&page=2&page_size=1"
            "&project=search-test&q=ALI&role=tutor"
        ),
        "previous": None,
        "results": [
            {
                "id": head.id,
                "display_name": "Alina",
                "avatar_url": None,
                "roles": [
                    {"id": roles["head_tutor"].id, "name": "head_tutor"},
                    {"id": roles["student"].id, "name": "student"},
                ],
                "eligible_projects": [
                    {"id": project.id, "slug": "search-test", "name": "Search test"}
                ],
            }
        ],
    }
    second = client.get(url, {**params, "page": 2})
    assert second.status_code == 200
    assert second.json() == {
        "count": 2,
        "next": None,
        "previous": (
            f"http://testserver{url}?ordering=-display_name&page_size=1"
            "&project=search-test&q=ALI&role=tutor"
        ),
        "results": [
            {
                "id": tutor.id,
                "display_name": "Alice",
                "avatar_url": None,
                "roles": [
                    {"id": roles["head_tutor"].id, "name": "head_tutor"},
                    {"id": roles["sc_member"].id, "name": "sc_member"},
                    {"id": roles["student"].id, "name": "student"},
                    {"id": roles["tutor"].id, "name": "tutor"},
                ],
                "eligible_projects": [
                    {"id": other.id, "slug": "other-test", "name": "Other test"},
                    {"id": project.id, "slug": "search-test", "name": "Search test"},
                ],
            }
        ],
    }


@pytest.mark.parametrize(
    ("field", "value", "message"),
    [
        ("q", "a", "Ensure this field has at least 2 characters."),
        ("q", "a" * 65, "Ensure this field has no more than 64 characters."),
        ("q", "", "This field may not be blank."),
        ("role", "student", "Choose tutor, head_tutor or sc_member."),
        ("role", "admin", "Choose tutor, head_tutor or sc_member."),
        ("role", "tutor,unknown", "Choose tutor, head_tutor or sc_member."),
        ("role", "tutor,", "Choose tutor, head_tutor or sc_member."),
        ("project", "missing-project", "Unknown project slug."),
        ("ordering", "email", '"email" is not a valid choice.'),
    ],
)
def test_invalid_parameters_use_contract_envelope(directory, field, value, message):
    client, _, _ = directory
    response = client.get(reverse("api:search-people"), {field: value})
    assert response.status_code == 400
    assert response.json() == {
        "error": {
            "code": "validation_error",
            "message": "Please correct the highlighted fields.",
            "fields": {field: [message]},
        }
    }


def test_no_matches_returns_empty_page(searchable_directory):
    client, *_ = searchable_directory
    response = client.get(reverse("api:search-people"), {"q": "no-match"})
    assert response.status_code == 200
    assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}


def test_display_name_ties_have_stable_pagination(directory):
    client, roles, _ = directory
    first = make_person("Alice", [roles["tutor"]])
    second = get_user_model().objects.create_user(
        email="another-alice@example.com", display_name="Alice", password="secret"
    )
    second.roles.add(roles["tutor"])
    url = reverse("api:search-people")
    assert client.get(url, {"page_size": 1}).json()["results"][0]["id"] == first.id
    assert client.get(url, {"page_size": 1, "page": 2}).json()["results"][0]["id"] == second.id


def test_query_length_boundaries_are_accepted(directory):
    client, _, _ = directory
    for q in ("ab", "a" * 64):
        response = client.get(reverse("api:search-people"), {"q": q})
        assert response.status_code == 200
        assert response.json() == {"count": 0, "next": None, "previous": None, "results": []}
