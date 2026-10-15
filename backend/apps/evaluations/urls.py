"""Evaluation request routes."""

from django.urls import path

from . import views

urlpatterns = [
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
]
