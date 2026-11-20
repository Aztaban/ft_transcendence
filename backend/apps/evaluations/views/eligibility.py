"""Tutor eligibility endpoints."""

from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, error_responses
from apps.evaluations.eligibility import (
    list_approved_projects_for_tutor,
    visible_eligibility_requests,
)
from apps.evaluations.eligibility_services import (
    review_eligibility_request,
    revoke_eligibility,
    submit_eligibility_request,
)
from apps.evaluations.models import TutorEligibilityRequest
from apps.evaluations.permissions import OVERRIDE_ROLES
from apps.evaluations.references import ProjectRefSerializer
from apps.evaluations.serializers.eligibility import (
    EligibilityRequestCreateSerializer,
    EligibilityRequestPageSerializer,
    EligibilityRequestQuerySerializer,
    EligibilityRequestReviewSerializer,
    EligibilityRequestSerializer,
    EligibilityRevokeSerializer,
)

User = get_user_model()


@extend_schema(
    summary="List projects a Hitchhiker is eligible to evaluate",
    responses={
        200: ProjectRefSerializer(many=True),
        **error_responses({401: ("not_authenticated",), 404: ("not_found",)}),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tutor_eligibility(request, user_id):
    """Return projects this hitchhiker is approved to evaluate (public listing)."""
    _ = request
    tutor = get_object_or_404(User.objects.exclude(status=User.Status.DELETED), pk=user_id)
    projects = list_approved_projects_for_tutor(tutor)
    return Response(ProjectRefSerializer(projects, many=True).data)


def _list_eligibility_requests(request):
    qs = visible_eligibility_requests(request.user)

    query = EligibilityRequestQuerySerializer(data=dict(request.query_params.items()))
    query.is_valid(raise_exception=True)
    filters = query.validated_data
    if "status" in filters:
        qs = qs.filter(status__in=filters["status"])
    qs = qs.order_by(filters["ordering"])

    paginator = APIPageNumberPagination()
    page = paginator.paginate_queryset(qs, request)
    serializer = EligibilityRequestSerializer(page, many=True)
    return paginator.get_paginated_response(serializer.data)


def _create_eligibility_request(request):
    """Submit one eligibility request (api-plan §10.3)."""
    if not request.user.roles.filter(name__in=HITCHHIKER_ROLES).exists():
        raise PermissionDenied(
            _("You do not have permission to perform this action."),
            code="permission_denied",
        )

    serializer = EligibilityRequestCreateSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    eligibility_request = submit_eligibility_request(
        requester=request.user, project_ids=serializer.validated_data["project_ids"]
    )

    return Response(
        EligibilityRequestSerializer(eligibility_request).data,
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    methods=["GET"],
    operation_id="v1_tutor_eligibility_requests_list",
    summary="List eligibility requests",
    parameters=[
        OpenApiParameter(
            name="status",
            type=OpenApiTypes.STR,
            many=True,
            enum=TutorEligibilityRequest.Status.values,
            style="form",
            explode=False,
            location=OpenApiParameter.QUERY,
            required=False,
            description="Comma-separated statuses: pending, approved, declined.",
        ),
        OpenApiParameter(
            name="ordering",
            type=OpenApiTypes.STR,
            location=OpenApiParameter.QUERY,
            required=False,
            enum=["created_at", "-created_at"],
            description="Default is created_at.",
        ),
        OpenApiParameter(
            name="page",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
        ),
        OpenApiParameter(
            name="page_size",
            type=OpenApiTypes.INT,
            location=OpenApiParameter.QUERY,
            required=False,
        ),
    ],
    responses={
        200: EligibilityRequestPageSerializer,
        **error_responses(
            {400: ("validation_error",), 401: ("not_authenticated",), 404: ("not_found",)}
        ),
    },
)
@extend_schema(
    parameters=[CSRF_HEADER],
    methods=["POST"],
    summary="Submit an eligibility request",
    request=EligibilityRequestCreateSerializer,
    responses={
        201: EligibilityRequestSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied", "csrf_failed"),
                415: ("unsupported_media_type",),
                409: ("eligibility_request_pending",),
            }
        ),
    },
)
@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def tutor_eligibility_request_list(request):
    """List or submit eligibility requests (api-plan §10.3)."""
    if request.method == "POST":
        return _create_eligibility_request(request)
    return _list_eligibility_requests(request)


@extend_schema(
    summary="Retrieve an eligibility request",
    responses={
        200: EligibilityRequestSerializer,
        **error_responses({401: ("not_authenticated",), 404: ("not_found",)}),
    },
)
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def tutor_eligibility_request_detail(request, request_id):
    """One eligibility request (api-plan §10.3). Hidden from anyone who may not see it."""
    eligibility_request = get_object_or_404(
        visible_eligibility_requests(request.user), pk=request_id
    )
    return Response(EligibilityRequestSerializer(eligibility_request).data)


@extend_schema(
    parameters=[CSRF_HEADER],
    summary="Approve or decline an eligibility request",
    request=EligibilityRequestReviewSerializer,
    responses={
        200: EligibilityRequestSerializer,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied", "cannot_review_own_request", "csrf_failed"),
                415: ("unsupported_media_type",),
                404: ("not_found",),
                409: ("eligibility_request_already_reviewed",),
            }
        ),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def tutor_eligibility_request_review(request, request_id):
    """Approve or decline one eligibility request (api-plan §10.3, #176/#177)."""
    if not request.user.roles.filter(name__in=OVERRIDE_ROLES).exists():
        raise PermissionDenied(
            _("You do not have permission to perform this action."),
            code="permission_denied",
        )

    eligibility_request = get_object_or_404(TutorEligibilityRequest, pk=request_id)
    if eligibility_request.requester_id == request.user.pk:
        raise PermissionDenied(
            _("You cannot review your own eligibility request."),
            code="cannot_review_own_request",
        )

    serializer = EligibilityRequestReviewSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    eligibility_request = review_eligibility_request(
        reviewer=request.user,
        eligibility_request=eligibility_request,
        **serializer.validated_data,
    )

    return Response(EligibilityRequestSerializer(eligibility_request).data)


@extend_schema(
    parameters=[CSRF_HEADER],
    summary="Revoke one project's eligibility",
    request=EligibilityRevokeSerializer,
    responses={
        204: None,
        **error_responses(
            {
                400: ("validation_error",),
                401: ("not_authenticated",),
                403: ("permission_denied", "csrf_failed"),
                404: ("not_found",),
                415: ("unsupported_media_type",),
            }
        ),
    },
)
@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def revoke_tutor_eligibility(request, slug, tutor_id):
    """Delete one Hitchhiker's eligibility for a project (api-plan §10.3)."""
    if not request.user.roles.filter(name__in=OVERRIDE_ROLES).exists():
        raise PermissionDenied(
            _("You do not have permission to perform this action."),
            code="permission_denied",
        )

    serializer = EligibilityRevokeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)

    revoke_eligibility(
        actor=request.user, slug=slug, tutor_id=tutor_id, reason=serializer.validated_data["reason"]
    )

    return Response(status=status.HTTP_204_NO_CONTENT)
