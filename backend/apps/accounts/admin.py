"""Django admin configuration for accounts."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet
from django.utils.translation import gettext_lazy as _

from .models import Role, User, UserRole


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at")
    search_fields = ("name",)
    readonly_fields = ("name",)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class UserRoleInlineFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()
        for form in self.initial_forms:
            if not form.instance.pk:
                continue
            original = UserRole.objects.get(pk=form.instance.pk)
            if original.role.name == Role.Name.STUDENT and (
                form.cleaned_data.get("DELETE") or form.cleaned_data.get("role") != original.role
            ):
                raise ValidationError(_("The student role cannot be revoked."))


class UserRoleInline(admin.TabularInline):
    model = UserRole
    formset = UserRoleInlineFormSet
    extra = 0


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "created_at")
    search_fields = ("user__email", "role__name")

    def get_readonly_fields(self, request, obj=None):
        if obj is not None and obj.role.name == Role.Name.STUDENT:
            return ("user", "role")
        return ()

    def has_delete_permission(self, request, obj=None):
        if obj is not None and obj.role.name == Role.Name.STUDENT:
            return False
        return super().has_delete_permission(request, obj)


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    readonly_fields = ("status",)
    ordering = ("email",)
    list_display = ("email", "display_name", "status", "is_staff")
    search_fields = ("email", "display_name", "intra_login")
    list_filter = ("status", "is_staff", "is_superuser")
    filter_horizontal = ("groups", "user_permissions")
    inlines = (UserRoleInline,)
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (
            "Profile",
            {"fields": ("display_name", "intra_login", "language", "status")},
        ),
        (
            "Permissions",
            {"fields": ("is_staff", "is_superuser", "groups", "user_permissions")},
        ),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("email", "display_name", "password1", "password2"),
            },
        ),
    )

    def has_delete_permission(self, request, obj=None):
        return False

    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        if not change:
            # Admin bypasses create_user; wait until optional inline roles are saved.
            student = Role.objects.get(name=Role.Name.STUDENT)
            UserRole.objects.get_or_create(user=form.instance, role=student)
