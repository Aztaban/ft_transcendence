"""Django admin for evaluations.

Projects are maintained here (there is no API for them), and the team enters
evaluation results here after an evaluation (api-plan §7.1).
"""

from django import forms
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from .events import publish_updated_event
from .models import EvaluationRequest, Project, TutorEligibility, TutorEligibilityRequest
from .notifications import notify_evaluation_result_recorded


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


class EvaluationRequestAdminForm(forms.ModelForm):
    class Meta:
        model = EvaluationRequest
        fields = ("result", "feedback", "completed_at")

    def clean(self):
        cleaned_data = super().clean()
        populated_fields = [
            field for field in self.Meta.fields if cleaned_data.get(field) not in (None, "")
        ]
        if populated_fields and (
            self.instance.status != EvaluationRequest.Status.CONFIRMED
            or self.instance.ends_at is None
            or self.instance.ends_at >= timezone.now()
        ):
            message = _(
                "Results can only be entered for confirmed evaluations whose end time has passed."
            )
            raise ValidationError({field: message for field in populated_fields})
        return cleaned_data


@admin.register(EvaluationRequest)
class EvaluationRequestAdmin(admin.ModelAdmin):
    form = EvaluationRequestAdminForm
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

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        result_recorded = False
        if change and "result" in form.changed_data and obj.result is not None:
            previous_result = (
                EvaluationRequest.objects.select_for_update()
                .values_list("result", flat=True)
                .get(pk=obj.pk)
            )
            result_recorded = previous_result is None
        super().save_model(request, obj, form, change)
        if change and form.changed_data:
            publish_updated_event(obj)
        if result_recorded:
            notify_evaluation_result_recorded(obj)
