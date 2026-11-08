"""Who may see an evaluation request (api-plan §8.7), shared by views and notifications."""

from django.db.models import Q

from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.evaluations.models import EvaluationRequest, TutorEligibility
from apps.evaluations.permissions import OVERRIDE_ROLES


def visible_evaluation_requests(user):
    """Requests this user may see. Anyone else gets 404."""
    queryset = EvaluationRequest.objects.select_related(
        "student", "project", "picked_by", "cancelled_by"
    )
    if user.roles.filter(name__in=OVERRIDE_ROLES).exists():
        return queryset
    visible = Q(student=user) | Q(picked_by=user)
    if user.roles.filter(name__in=HITCHHIKER_ROLES).exists():
        visible |= Q(
            status=EvaluationRequest.Status.PENDING,
            project_id__in=TutorEligibility.objects.filter(tutor=user).values("project_id"),
        )
    return queryset.filter(visible)
