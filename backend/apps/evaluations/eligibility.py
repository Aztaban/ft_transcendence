"""Tutor project eligibility lookups (api-plan §10.3, schema §3.4)."""

from django.db.models import Prefetch

from apps.accounts.models import User
from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest
from apps.evaluations.permissions import OVERRIDE_ROLES


def list_approved_projects_for_tutor(tutor) -> list[dict]:
    """Return active projects this hitchhiker is approved to evaluate.

    Each item matches api-plan ProjectRef: {id, slug, name}, sorted by name.
    Empty for non-Hitchhikers and for Hitchhikers with no eligibility rows.
    """
    if not tutor.roles.filter(name__in=HITCHHIKER_ROLES).exists():
        return []

    rows = (
        TutorEligibility.objects.filter(tutor=tutor, project__is_active=True)
        .order_by("project__name")
        .values_list("project__id", "project__slug", "project__name")
    )
    return [{"id": project_id, "slug": slug, "name": name} for project_id, slug, name in rows]


def eligible_hitchhiker_ids(project_id: int):
    """Eligibility rows are inert without an active account and Hitchhiker role."""
    return (
        TutorEligibility.objects.filter(
            project_id=project_id,
            tutor__status=User.Status.ACTIVE,
            tutor__roles__name__in=HITCHHIKER_ROLES,
        )
        .values_list("tutor_id", flat=True)
        .distinct()
    )


def visible_eligibility_requests(user):
    """Requests this user may see. Anyone else gets 404 on detail (api-plan §10.3)."""
    projects = Prefetch("projects", queryset=Project.objects.order_by("name"))
    qs = TutorEligibilityRequest.objects.select_related(
        "requester", "reviewed_by"
    ).prefetch_related(projects)
    if not user.roles.filter(name__in=OVERRIDE_ROLES).exists():
        qs = qs.filter(requester=user)
    return qs
