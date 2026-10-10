"""Django admin for evaluations.

Projects are maintained here (there is no API for them), and the team enters
evaluation results here after an evaluation (api-plan §7.1).
"""

from django.contrib import admin

from .models import EvaluationRequest, Project, TutorEligibility, TutorEligibilityRequest


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    prepopulated_fields = {"slug": ("name",)}


class EligibilityRequestProjectInline(admin.TabularInline):
    model = TutorEligibilityRequest.projects.through
    extra = 0


@admin.register(TutorEligibilityRequest)
class TutorEligibilityRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "requester", "status", "reviewed_by", "reviewed_at", "created_at")
    list_filter = ("status",)
    search_fields = ("requester__email", "requester__display_name")
    inlines = (EligibilityRequestProjectInline,)


@admin.register(TutorEligibility)
class TutorEligibilityAdmin(admin.ModelAdmin):
    list_display = ("tutor", "project", "granted_by_request", "created_at")
    list_filter = ("project",)
    search_fields = ("tutor__email", "tutor__display_name", "project__name")


@admin.register(EvaluationRequest)
class EvaluationRequestAdmin(admin.ModelAdmin):
    list_display = ("id", "student", "project", "status", "picked_by", "starts_at", "result")
    list_filter = ("status", "result", "project")
    search_fields = ("student__email", "picked_by__email", "project__name")
    # Lifecycle fields change only through the API's conditional updates (schema §4.2);
    # the admin edits the manually entered result.
    readonly_fields = (
        "student",
        "project",
        "note",
        "status",
        "picked_by",
        "starts_at",
        "ends_at",
        "cancelled_by",
        "cancelled_at",
        "expired_at",
        "created_at",
        "updated_at",
    )
    fields = readonly_fields[:-2] + ("result", "feedback", "completed_at") + readonly_fields[-2:]
