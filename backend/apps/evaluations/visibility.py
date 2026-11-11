"""Evaluation request querysets and who may see them (api-plan §8.7).

Shared by views and notifications.
"""

from django.db.models import Q

from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.evaluations.models import EvaluationRequest, TutorEligibility
from apps.evaluations.permissions import OVERRIDE_ROLES


def evaluation_requests():
    """Requests with every relation EvaluationRequestSerializer reads."""
    return EvaluationRequest.objects.select_related(
        "student", "project", "picked_by", "cancelled_by"
    )


def open_queue(user):
    """Pending requests for the projects this user holds eligibility for."""
    return Q(
        status=EvaluationRequest.Status.PENDING,
        project_id__in=TutorEligibility.objects.filter(tutor=user).values("project_id"),
    )


def visible_evaluation_requests(user):
    """Requests this user may see. Anyone else gets 404."""
    queryset = evaluation_requests()
    if user.roles.filter(name__in=OVERRIDE_ROLES).exists():
        return queryset
    visible = Q(student=user) | Q(picked_by=user)
    if user.roles.filter(name__in=HITCHHIKER_ROLES).exists():
        visible |= open_queue(user)
    return queryset.filter(visible)
