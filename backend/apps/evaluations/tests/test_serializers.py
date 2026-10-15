from django.contrib.auth import get_user_model

from apps.evaluations.models import Project
from apps.evaluations.serializers import ProjectRefSerializer, ProjectSerializer


def test_project_ref_has_exact_public_fields():
    project = Project(id=4, slug="push_swap", name="push_swap", is_active=True)

    assert ProjectRefSerializer(project).data == {"id": 4, "slug": "push_swap", "name": "push_swap"}


def test_project_ref_list_representation():
    projects = [
        Project(id=4, slug="push_swap", name="push_swap"),
        Project(id=7, slug="born2beroot", name="Born2beroot"),
    ]

    assert ProjectRefSerializer(projects, many=True).data == [
        {"id": 4, "slug": "push_swap", "name": "push_swap"},
        {"id": 7, "slug": "born2beroot", "name": "Born2beroot"},
    ]


def test_project_detail_includes_empty_eligible_tutors():
    project = Project(id=4, slug="push_swap", name="push_swap")
    project.eligible_tutors = []

    assert ProjectSerializer(project).data == {
        "id": 4,
        "slug": "push_swap",
        "name": "push_swap",
        "eligible_tutors": [],
    }


def test_project_detail_has_exact_nested_user_fields():
    project = Project(id=4, slug="push_swap", name="push_swap")
    project.eligible_tutors = [
        get_user_model()(id=42, display_name="Alice", email="private@example.com"),
        {"id": 43, "display_name": "Bob", "avatar_url": "/api/v1/files/9/download/"},
    ]

    assert ProjectSerializer(project).data == {
        "id": 4,
        "slug": "push_swap",
        "name": "push_swap",
        "eligible_tutors": [
            {"id": 42, "display_name": "Alice", "avatar_url": None},
            {"id": 43, "display_name": "Bob", "avatar_url": "/api/v1/files/9/download/"},
        ],
    }
