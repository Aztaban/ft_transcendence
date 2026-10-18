"""Project and evaluation request routes, included under /api/v1/."""

from django.urls import path

from . import views

urlpatterns = [
    path("projects/", views.ProjectListView.as_view(), name="project-list"),
    path("projects/<slug:slug>/", views.ProjectDetailView.as_view(), name="project-detail"),
    path(
        "evaluation-requests/",
        views.EvaluationRequestListCreateView.as_view(),
        name="evaluation-request-list",
    ),
    path(
        "evaluation-requests/<int:pk>/",
        views.EvaluationRequestDetailView.as_view(),
        name="evaluation-request-detail",
    ),
    path(
        "evaluation-requests/<int:pk>/pick-slot/",
        views.EvaluationRequestPickSlotView.as_view(),
        name="evaluation-request-pick-slot",
    ),
]
