"""Project, eligibility and evaluation request routes, included under /api/v1/."""

from django.urls import path

from .views import eligibility, projects, requests

urlpatterns = [
    path("projects/", projects.ProjectListView.as_view(), name="project-list"),
    path("projects/<slug:slug>/", projects.ProjectDetailView.as_view(), name="project-detail"),
    path(
        "projects/<slug:slug>/eligibility/<int:tutor_id>/",
        eligibility.revoke_tutor_eligibility,
        name="project-eligibility-revoke",
    ),
    path(
        "evaluation-requests/",
        requests.EvaluationRequestListCreateView.as_view(),
        name="evaluation-request-list",
    ),
    path(
        "evaluation-requests/<int:pk>/",
        requests.EvaluationRequestDetailView.as_view(),
        name="evaluation-request-detail",
    ),
    path(
        "evaluation-requests/<int:pk>/confirm/",
        requests.EvaluationRequestConfirmView.as_view(),
        name="evaluation-request-confirm",
    ),
    path(
        "evaluation-requests/<int:pk>/decline/",
        requests.EvaluationRequestDeclineView.as_view(),
        name="evaluation-request-decline",
    ),
    path(
        "evaluation-requests/<int:pk>/cancel/",
        requests.EvaluationRequestCancelView.as_view(),
        name="evaluation-request-cancel",
    ),
    path(
        "evaluation-requests/<int:pk>/release/",
        requests.EvaluationRequestReleaseView.as_view(),
        name="evaluation-request-release",
    ),
    path(
        "evaluation-requests/<int:pk>/pick-slot/",
        requests.EvaluationRequestPickSlotView.as_view(),
        name="evaluation-request-pick-slot",
    ),
    path(
        "tutors/<int:user_id>/eligibility/",
        eligibility.tutor_eligibility,
        name="tutors-eligibility",
    ),
    path(
        "tutor-eligibility-requests/",
        eligibility.tutor_eligibility_request_list,
        name="tutor-eligibility-requests-list",
    ),
    path(
        "tutor-eligibility-requests/<int:request_id>/review/",
        eligibility.tutor_eligibility_request_review,
        name="tutor-eligibility-requests-review",
    ),
]
