"""Tutor project eligibility lookups (api-plan §10.3, schema §3.4)."""

from apps.accounts.models import Role
from apps.evaluations.models import TutorEligibility

_HITCHHIKER_ROLES = (Role.Name.TUTOR, Role.Name.HEAD_TUTOR)


def list_approved_projects_for_tutor(tutor) -> list[dict]:
    """Return active projects this hitchhiker is approved to evaluate.

    Each item matches api-plan ProjectRef: {id, slug, name}, sorted by name.
    Empty for non-Hitchhikers and for Hitchhikers with no eligibility rows.
    """
    if not tutor.roles.filter(name__in=_HITCHHIKER_ROLES).exists():
        return []

    rows = (
        TutorEligibility.objects.filter(tutor=tutor, project__is_active=True)
        .order_by("project__name")
        .values_list("project__id", "project__slug", "project__name")
    )
    return [{"id": project_id, "slug": slug, "name": name} for project_id, slug, name in rows]
