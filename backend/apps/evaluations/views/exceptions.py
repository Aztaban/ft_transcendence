"""Read-only administration exception detection."""

from datetime import timedelta

from django.conf import settings
from django.db.models import Case, CharField, Exists, OuterRef, Q, Value, When
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import User, UserRole
from apps.accounts.permissions import HITCHHIKER_ROLES, IsAdminRole, IsHeadTutorRole
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import error_responses
from apps.evaluations.models import EvaluationRequest, TutorEligibility
from apps.evaluations.serializers.requests import EvaluationExceptionSerializer


def exception_conditions(at):
    """Return database expressions; paginate after matching, without multiplying rows."""
    has_role = Exists(
        UserRole.objects.filter(user_id=OuterRef("picked_by_id"), role__name__in=HITCHHIKER_ROLES)
    )
    has_eligibility = Exists(
        TutorEligibility.objects.filter(
            tutor_id=OuterRef("picked_by_id"), project_id=OuterRef("project_id")
        )
    )
    awaiting = Q(status=EvaluationRequest.Status.AWAITING_CONFIRMATION)
    confirmed = Q(status=EvaluationRequest.Status.CONFIRMED)
    active = Q(status=EvaluationRequest.Status.PENDING) | awaiting | (confirmed & Q(ends_at__gt=at))
    return {
        "tutor_lost_eligibility": (
            (awaiting | (confirmed & Q(starts_at__gt=at))) & (~has_role | ~has_eligibility)
        ),
        "participant_inactive": active
        & (Q(student__status=User.Status.SUSPENDED) | Q(picked_by__status=User.Status.SUSPENDED)),
        "result_missing": confirmed
        & Q(
            ends_at__lt=at - timedelta(days=settings.EVALUATION_RESULT_MISSING_DAYS),
            result__isnull=True,
        ),
    }


@extend_schema(
    summary="List evaluation requests needing a human decision",
    responses={
        200: EvaluationExceptionSerializer(many=True),
        **error_responses(
            {401: ("not_authenticated",), 403: ("permission_denied",), 404: ("not_found",)}
        ),
    },
)
class EvaluationExceptionListView(ListAPIView):
    permission_classes = [IsAuthenticated, IsHeadTutorRole | IsAdminRole]
    serializer_class = EvaluationExceptionSerializer
    pagination_class = APIPageNumberPagination

    def get_queryset(self):
        conditions = exception_conditions(timezone.now())
        return (
            EvaluationRequest.objects.select_related(
                "student", "project", "picked_by", "cancelled_by"
            )
            .annotate(
                problem=Case(
                    *[
                        When(conditions[problem], then=Value(problem))
                        for problem in (
                            "participant_inactive",
                            "tutor_lost_eligibility",
                            "result_missing",
                        )
                    ],
                    default=None,
                    output_field=CharField(),
                )
            )
            .filter(problem__isnull=False)
            .order_by("-created_at", "-pk")
        )
