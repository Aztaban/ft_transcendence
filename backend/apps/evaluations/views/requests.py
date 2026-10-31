"""Evaluation request endpoints and participant actions."""

from django.db.models import Q
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.generics import GenericAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, error_responses
from apps.evaluations.models import EvaluationRequest, TutorEligibility
from apps.evaluations.permissions import (
    OVERRIDE_ROLES,
    CanCancelRequest,
    CanPickSlot,
    CanReleaseSlot,
    EvaluationRequestPermission,
)
from apps.evaluations.serializers.requests import (
    EvaluationOverrideSerializer,
    EvaluationRequestCreateSerializer,
    EvaluationRequestNoteSerializer,
    EvaluationRequestPickSlotSerializer,
    EvaluationRequestQuerySerializer,
    EvaluationRequestSerializer,
)
from apps.evaluations.services import (
    cancel_request,
    confirm_request,
    create_request,
    decline_request,
    edit_note,
    history_filter,
    pick_slot,
    release_slot,
)


class EvaluationRequestBaseView(GenericAPIView):
    permission_classes = [IsAuthenticated, EvaluationRequestPermission]
    serializer_class = EvaluationRequestSerializer
    queryset = EvaluationRequest.objects.select_related(
        "student", "project", "picked_by", "cancelled_by"
    )


class EvaluationRequestListCreateView(EvaluationRequestBaseView):
    pagination_class = APIPageNumberPagination

    @extend_schema(
        parameters=[
            EvaluationRequestQuerySerializer,
            OpenApiParameter(
                "status",
                type=OpenApiTypes.STR,
                many=True,
                enum=EvaluationRequest.Status.values,
                style="form",
                explode=False,
                description="Comma-separated statuses, e.g. pending,awaiting_confirmation.",
            ),
            OpenApiParameter(
                "result",
                type=OpenApiTypes.STR,
                many=True,
                enum=[*EvaluationRequest.Result.values, "none"],
                style="form",
                explode=False,
                description="Comma-separated results; none matches requests without a result.",
            ),
        ],
        responses={
            200: EvaluationRequestSerializer(many=True),
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("not_authenticated",),
                    404: ("not_found",),
                    403: ("permission_denied",),
                }
            ),
        },
    )
    def get(self, request):
        query = EvaluationRequestQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        filters = query.validated_data
        queryset = self.get_queryset()
        scope = filters["scope"]
        if scope == "mine":
            queryset = queryset.filter(student=request.user)
        elif scope == "open":
            queryset = queryset.filter(
                status=EvaluationRequest.Status.PENDING,
                project_id__in=TutorEligibility.objects.filter(tutor=request.user).values(
                    "project_id"
                ),
            ).exclude(student=request.user)
        elif scope == "picked":
            queryset = queryset.filter(picked_by=request.user)
        if "status" in filters:
            queryset = queryset.filter(status__in=filters["status"])
        if "project" in filters:
            queryset = queryset.filter(project__slug=filters["project"])
        if "result" in filters:
            results = filters["result"]
            match = Q(result__in=[result for result in results if result != "none"])
            if "none" in results:
                match |= Q(result__isnull=True)
            queryset = queryset.filter(match)
        if "history" in filters:
            history = history_filter(timezone.now())
            queryset = (
                queryset.filter(history)
                if filters["history"] == "true"
                else queryset.exclude(history)
            )
        queryset = queryset.order_by(filters["ordering"], "pk")
        page = self.paginate_queryset(queryset)
        return self.get_paginated_response(self.get_serializer(page, many=True).data)

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=EvaluationRequestCreateSerializer,
        responses={
            201: EvaluationRequestSerializer,
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("not_authenticated",),
                    403: ("csrf_failed",),
                    415: ("unsupported_media_type",),
                    409: ("active_request_exists",),
                }
            ),
        },
    )
    def post(self, request):
        serializer = EvaluationRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation = create_request(
            student=request.user,
            project=serializer.validated_data["project_id"],
            note=serializer.validated_data["note"],
        )
        return Response(self.get_serializer(evaluation).data, status=status.HTTP_201_CREATED)


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


# One request; anyone who may not see it gets 404 (api-plan §8.7). A comment, not a docstring:
# drf-spectacular would publish a docstring as the endpoints' description.
class EvaluationRequestObjectView(EvaluationRequestBaseView):
    def get_queryset(self):
        return visible_evaluation_requests(self.request.user)


def transition_schema(*conflicts, description=None, override=False):
    """Describe participant transitions and their optional override reason bodies."""
    return extend_schema(
        description=description,
        parameters=[CSRF_HEADER],
        request=EvaluationOverrideSerializer(partial=True) if override else None,
        responses={
            200: EvaluationRequestSerializer,
            **error_responses(
                {
                    **(
                        {400: ("validation_error",), 415: ("unsupported_media_type",)}
                        if override
                        else {}
                    ),
                    401: ("not_authenticated",),
                    403: ("permission_denied", "csrf_failed"),
                    404: ("not_found",),
                    409: conflicts,
                }
            ),
        },
    )


class EvaluationRequestDetailView(EvaluationRequestObjectView):
    @extend_schema(
        responses={
            200: EvaluationRequestSerializer,
            **error_responses({401: ("not_authenticated",), 404: ("not_found",)}),
        }
    )
    def get(self, request, pk):
        return Response(self.get_serializer(self.get_object()).data)

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=EvaluationRequestNoteSerializer,
        responses={
            200: EvaluationRequestSerializer,
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("not_authenticated",),
                    403: ("permission_denied", "csrf_failed"),
                    415: ("unsupported_media_type",),
                    404: ("not_found",),
                    409: ("invalid_state_transition",),
                }
            ),
        },
    )
    def patch(self, request, pk):
        evaluation = self.get_object()
        serializer = EvaluationRequestNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation = edit_note(evaluation, serializer.validated_data)
        return Response(self.get_serializer(evaluation).data)


class EvaluationRequestConfirmView(EvaluationRequestObjectView):
    """POST /evaluation-requests/{id}/confirm/ (api-plan §10.4)."""

    @transition_schema("invalid_state_transition", "evaluation_already_started")
    def post(self, request, pk):
        evaluation = confirm_request(self.get_object())
        return Response(self.get_serializer(evaluation).data)


class EvaluationRequestDeclineView(EvaluationRequestObjectView):
    """POST /evaluation-requests/{id}/decline/."""

    @transition_schema("invalid_state_transition")
    def post(self, request, pk):
        evaluation = decline_request(self.get_object())
        return Response(self.get_serializer(evaluation).data)


class EvaluationRequestCancelView(EvaluationRequestObjectView):
    """Student cancellation or a Head Tutor/Admin override."""

    permission_classes = [IsAuthenticated, CanCancelRequest]

    @transition_schema(
        "invalid_state_transition",
        "evaluation_already_started",
        description=(
            "Students cancel before the slot starts. Head Tutors/Admins may override "
            "another student's request at any time with a required reason (1–500 "
            "characters), unless a result is recorded."
        ),
        override=True,
    )
    def post(self, request, pk):
        evaluation = self.get_object()
        if evaluation.student_id != request.user.pk:
            serializer = EvaluationOverrideSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            evaluation = cancel_request(
                evaluation, request.user, reason=serializer.validated_data["reason"]
            )
        else:
            evaluation = cancel_request(evaluation)
        return Response(self.get_serializer(evaluation).data)


class EvaluationRequestReleaseView(EvaluationRequestObjectView):
    """Participant release or a Head Tutor/Admin override."""

    permission_classes = [IsAuthenticated, CanReleaseSlot]

    @transition_schema(
        "invalid_state_transition",
        "evaluation_already_started",
        description=(
            "Release a picked slot before its start. The picking Hitchhiker sends no "
            "body. Head Tutors/Admins overriding another student's request must supply "
            "a reason (1–500 characters)."
        ),
        override=True,
    )
    def post(self, request, pk):
        evaluation = self.get_object()
        ordinary = (
            evaluation.picked_by_id == request.user.pk
            and request.user.roles.filter(name__in=HITCHHIKER_ROLES).exists()
        )
        if ordinary:
            evaluation = release_slot(evaluation, request.user)
        else:
            serializer = EvaluationOverrideSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            evaluation = release_slot(
                evaluation, request.user, reason=serializer.validated_data["reason"]
            )
        return Response(self.get_serializer(evaluation).data)


class EvaluationRequestPickSlotView(EvaluationRequestObjectView):
    """POST /evaluation-requests/{id}/pick-slot/."""

    permission_classes = [IsAuthenticated, CanPickSlot]

    @extend_schema(
        parameters=[CSRF_HEADER],
        request=EvaluationRequestPickSlotSerializer,
        responses={
            200: EvaluationRequestSerializer,
            **error_responses(
                {
                    400: ("validation_error",),
                    401: ("not_authenticated",),
                    403: ("not_eligible", "cannot_pick_own_request", "csrf_failed"),
                    415: ("unsupported_media_type",),
                    404: ("not_found",),
                    409: ("request_not_pending", "slot_overlaps", "student_unavailable"),
                }
            ),
        },
    )
    def post(self, request, pk):
        evaluation = self.get_object()
        serializer = EvaluationRequestPickSlotSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        evaluation = pick_slot(
            evaluation,
            request.user,
            serializer.validated_data["starts_at"],
            serializer.validated_data["ends_at"],
        )
        return Response(self.get_serializer(evaluation).data)
