"""Tutor eligibility endpoints."""

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.models import Role
from apps.accounts.permissions import HITCHHIKER_ROLES
from apps.core.exceptions import error_response
from apps.core.pagination import APIPageNumberPagination
from apps.core.schema import CSRF_HEADER, error_responses
from apps.evaluations.eligibility import list_approved_projects_for_tutor
from apps.evaluations.models import Project, TutorEligibility, TutorEligibilityRequest
from apps.evaluations.notifications import (
    notify_eligibility_decided,
    notify_eligibility_requested,
    notify_eligibility_revoked,
)
from apps.evaluations.references import ProjectRefSerializer
from apps.evaluations.serializers.eligibility import (
    EligibilityRequestCreateSerializer,
    EligibilityRequestPageSerializer,
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
    tutor = get_object_or_404(User, pk=user_id)
    projects = list_approved_projects_for_tutor(tutor)
    return Response(ProjectRefSerializer(projects, many=True).data)


_ELIGIBILITY_REQUEST_ORDERINGS = frozenset({"created_at", "-created_at"})

_ELIGIBILITY_REQUEST_STATUSES = frozenset(TutorEligibilityRequest.Status.values)

_ELIGIBILITY_REQUEST_SEE_ALL = frozenset({Role.Name.HEAD_TUTOR, Role.Name.ADMIN})


def _list_eligibility_requests(request):
    projects = Prefetch("projects", queryset=Project.objects.order_by("name"))
    qs = TutorEligibilityRequest.objects.select_related(
        "requester", "reviewed_by"
    ).prefetch_related(projects)

    if not request.user.roles.filter(name__in=_ELIGIBILITY_REQUEST_SEE_ALL).exists():
        qs = qs.filter(requester=request.user)

    status_param = request.query_params.get("status")
    if status_param is not None:
        statuses = [part.strip() for part in status_param.split(",") if part.strip()]
        if not statuses:
            raise ValidationError({"status": [_("This field may not be blank.")]})
        unknown = sorted(
            {value for value in statuses if value not in _ELIGIBILITY_REQUEST_STATUSES}
        )
        if unknown:
            raise ValidationError(
                {"status": [_("Unknown status: %(value)s.") % {"value": ", ".join(unknown)}]}
            )
        qs = qs.filter(status__in=statuses)

    ordering = request.query_params.get("ordering", "created_at")
    if ordering not in _ELIGIBILITY_REQUEST_ORDERINGS:
        raise ValidationError(
            {"ordering": [_("Ordering must be one of: created_at, -created_at.")]}
        )
    qs = qs.order_by(ordering)

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
    project_ids = serializer.validated_data["project_ids"]

    projects = list(Project.objects.filter(pk__in=project_ids, is_active=True))
    found_ids = {project.pk for project in projects}
    missing = sorted(set(project_ids) - found_ids)
    if missing:
        raise ValidationError(
            {
                "project_ids": [
                    _("Unknown or inactive project id(s): %(ids)s.")
                    % {"ids": ", ".join(str(pk) for pk in missing)}
                ]
            }
        )

    already_eligible = list(
        TutorEligibility.objects.filter(tutor=request.user, project_id__in=project_ids)
        .select_related("project")
        .order_by("project__name")
    )
    if already_eligible:
        names = ", ".join(row.project.name for row in already_eligible)
        raise ValidationError(
            {"project_ids": [_("Already eligible for: %(names)s.") % {"names": names}]}
        )

    with transaction.atomic():
        # Schema §3.2: lock the requester row, then check pending in the same transaction.
        User.objects.select_for_update().get(pk=request.user.pk)
        if TutorEligibilityRequest.objects.filter(
            requester=request.user,
            status=TutorEligibilityRequest.Status.PENDING,
        ).exists():
            return error_response(
                "eligibility_request_pending",
                _("You already have a pending eligibility request."),
                status.HTTP_409_CONFLICT,
            )
        eligibility_request = TutorEligibilityRequest.objects.create(requester=request.user)
        eligibility_request.projects.set(projects)
        notify_eligibility_requested(eligibility_request)

    return Response(
        EligibilityRequestSerializer(eligibility_request).data,
        status=status.HTTP_201_CREATED,
    )


@extend_schema(
    methods=["GET"],
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
    if not request.user.roles.filter(name__in=_ELIGIBILITY_REQUEST_SEE_ALL).exists():
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
    decision = serializer.validated_data["decision"]
    review_note = serializer.validated_data["review_note"]
    reviewed_at = timezone.now()

    with transaction.atomic():
        updated = TutorEligibilityRequest.objects.filter(
            pk=request_id,
            status=TutorEligibilityRequest.Status.PENDING,
        ).update(
            status=decision,
            reviewed_by=request.user,
            reviewed_at=reviewed_at,
            review_note=review_note,
        )
        if updated != 1:
            return error_response(
                "eligibility_request_already_reviewed",
                _("This eligibility request has already been reviewed."),
                status.HTTP_409_CONFLICT,
            )

        if decision == TutorEligibilityRequest.Status.APPROVED:
            projects = list(eligibility_request.projects.all())
            TutorEligibility.objects.bulk_create(
                [
                    TutorEligibility(
                        tutor_id=eligibility_request.requester_id,
                        project=project,
                        granted_by_request_id=eligibility_request.pk,
                    )
                    for project in projects
                ],
                ignore_conflicts=True,
            )

        eligibility_request.refresh_from_db()
        notify_eligibility_decided(eligibility_request)

    # TODO(audit): eligibility.reviewed.
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
    if not request.user.roles.filter(name__in=_ELIGIBILITY_REQUEST_SEE_ALL).exists():
        raise PermissionDenied(
            _("You do not have permission to perform this action."),
            code="permission_denied",
        )

    serializer = EligibilityRevokeSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    # TODO(audit): eligibility.revoked (#343). The audit log model is not on this
    # branch (issue #53).
    # After it exists, write target_type tutor_eligibility, target_id of the deleted row,
    # actor request.user and serializer.validated_data["reason"] in this transaction.
    # The reason is validated and then discarded.

    with transaction.atomic():
        # The notification insert locks the tutor. Pick already holds that user
        # before it locks the grant, so revocation takes the same order (schema §4.2).
        if User.objects.select_for_update().filter(pk=tutor_id).first() is None:
            return error_response("not_found", _("Not found."), status.HTTP_404_NOT_FOUND)
        eligibility = (
            TutorEligibility.objects.select_for_update()
            .select_related("project")
            .filter(project__slug=slug, tutor_id=tutor_id)
            .first()
        )
        if eligibility is None:
            return error_response("not_found", _("Not found."), status.HTTP_404_NOT_FOUND)
        project = eligibility.project
        eligibility.delete()
        notify_eligibility_revoked(project, tutor_id)

    return Response(status=status.HTTP_204_NO_CONTENT)
