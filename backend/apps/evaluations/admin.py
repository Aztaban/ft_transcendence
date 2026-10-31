"""Django admin for evaluations.

Projects are maintained here (there is no API for them), and the team enters
evaluation results here after an evaluation (api-plan §7.1).
"""

from django import forms
from django.contrib import admin, messages
from django.core.exceptions import ValidationError
from django.db import transaction
from django.http import HttpResponseRedirect
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.accounts.services.locking import lock_users

from .events import publish_updated_event
from .models import EvaluationRequest, Project, TutorEligibility, TutorEligibilityRequest
from .notifications import notify_evaluation_result_recorded

RESULT_ENTRY_ERROR = _(
    "Results can only be entered for confirmed evaluations whose end time has passed."
)


class _ResultSaveConflict(ValidationError):
    """The evaluation no longer meets the admin form's result-entry conditions."""


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
            raise ValidationError({field: RESULT_ENTRY_ERROR for field in populated_fields})
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

    def has_add_permission(self, request):
        # Evaluation creation belongs to the API; this form only records results.
        return False

    def changeform_view(self, request, object_id=None, form_url="", extra_context=None):
        try:
            return super().changeform_view(request, object_id, form_url, extra_context)
        except _ResultSaveConflict:
            # ModelAdmin's outer transaction has rolled back. Avoid a success
            # message or admin log entry for a result that was never persisted.
            self.message_user(request, RESULT_ENTRY_ERROR, level=messages.ERROR)
            return HttpResponseRedirect(request.path)

    @transaction.atomic
    def save_model(self, request, obj, form, change):
        if not change:
            raise _ResultSaveConflict(RESULT_ENTRY_ERROR)
        updates = {
            field: getattr(obj, field)
            for field in EvaluationRequestAdminForm.Meta.fields
            if field in form.changed_data
        }
        if not updates:
            obj.refresh_from_db()
            return
        # Match API transition lock order, including the actor referenced by the
        # admin log entry and recipients referenced by notification inserts.
        lock_users(obj.student_id, obj.picked_by_id, request.user.pk if request else None)
        previous_result = (
            EvaluationRequest.objects.select_for_update()
            .filter(pk=obj.pk)
            .values_list("result", flat=True)
            .first()
        )
        updated = EvaluationRequest.objects.filter(
            pk=obj.pk,
            status=EvaluationRequest.Status.CONFIRMED,
            ends_at__lt=timezone.now(),
        ).update(**updates)
        if updated != 1:
            raise _ResultSaveConflict(RESULT_ENTRY_ERROR)
        obj.refresh_from_db()
        publish_updated_event(obj)
        if "result" in updates and previous_result is None and obj.result is not None:
            notify_evaluation_result_recorded(obj)
