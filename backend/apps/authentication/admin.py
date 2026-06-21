from django.contrib import admin

from .forms import UserAdminChangeForm, UserAdminCreationForm
from .models import RefreshTokenRecord, User

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    form = UserAdminChangeForm
    add_form = UserAdminCreationForm
    list_display = [
        "email",
        "first_name",
        "last_name",
        "role",
        "employee_id",
        "status",
        "is_staff",
        "created_at",
    ]
    list_filter = ["role", "status", "is_staff", "is_active", "is_superuser"]
    search_fields = ["email", "first_name", "last_name", "employee_id"]
    ordering = ["-created_at"]
    autocomplete_fields = ["department"]
    readonly_fields = ["employee_id", "last_login", "created_at", "updated_at", "deleted_at"]
    fieldsets = (
        ("Account", {"fields": ("email", "password", "new_password", "role", "status", "department")}),
        ("Personal", {"fields": ("first_name", "last_name", "avatar")}),
        ("Professional", {"fields": ("employee_id", "specialization", "license_number")}),
        ("Access", {"fields": ("is_staff", "is_active", "is_superuser")}),
        ("Timestamps", {"fields": ("last_login", "created_at", "updated_at", "deleted_at")}),
    )
    add_fieldsets = (
        ("Account", {"fields": ("email", "password1", "password2", "role", "status", "department")}),
        ("Personal", {"fields": ("first_name", "last_name", "avatar")}),
        ("Professional", {"fields": ("specialization", "license_number")}),
        ("Access", {"fields": ("is_staff", "is_active", "is_superuser")}),
    )

    def get_form(self, request, obj=None, **kwargs):
        kwargs["form"] = self.add_form if obj is None else self.form
        return super().get_form(request, obj, **kwargs)

    def get_fieldsets(self, request, obj=None):
        return self.add_fieldsets if obj is None else self.fieldsets

@admin.register(RefreshTokenRecord)
class RefreshTokenRecordAdmin(admin.ModelAdmin):
    list_display = ["user", "jti", "created_at", "expires_at", "revoked", "revoked_at"]
    list_filter = ["revoked"]
    search_fields = ["user__email", "jti"]
    ordering = ["-created_at"]
    autocomplete_fields = ["user"]
    readonly_fields = ["user", "jti", "created_at", "expires_at", "revoked", "revoked_at"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
