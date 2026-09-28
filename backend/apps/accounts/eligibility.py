"""Tutor project eligibility lookups.

Approved eligibility lives in tutor_eligibility (schema YES). Until that
model exists, list endpoints return an empty project list with the agreed
API shape so clients can integrate against a stable contract.
"""


def list_approved_projects_for_tutor(tutor) -> list[dict]:
    """Return projects this hitchhiker is approved to evaluate.

    Each item matches api-plan Project: {id, slug, name}.
    Returns [] until Project / TutorEligibility models are available.
    """
    _ = tutor
    return []
