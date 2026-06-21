from django.contrib import admin
from apps.authentication.models import UserRole

class RoleRestrictedAdminMixin:
    required_role = None
    view_roles = ()

    def _can_view(self, request):
        user_role = getattr(request.user, "role", None)
        return bool(request.user.is_authenticated and user_role in self.view_roles)

    def _can_edit(self, request):
        return self._can_view(request)

    def has_module_permission(self, request):
        return self._can_view(request)

    def has_view_permission(self, request, obj=None):
        return self._can_view(request)

    def has_add_permission(self, request):
        return self._can_edit(request)

    def has_change_permission(self, request, obj=None):
        return self._can_edit(request)

    def has_delete_permission(self, request, obj=None):
        return self._can_edit(request)

from .models import Vitals, IntakeOutput, PainAssessment, MAREntry, NursingNote, Task, Wound, Handoff, DischargeChecklistItem

@admin.register(Vitals)
class VitalsAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "recorded_by", "temperature", "heart_rate", "systolic", "diastolic", "recorded_at"]
    list_filter = ["recorded_at"]
    search_fields = ["patient__mrn"]
    autocomplete_fields = ["patient", "recorded_by"]
    readonly_fields = ["recorded_at", "created_at", "updated_at"]

@admin.register(MAREntry)
class MAREntryAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "prescription", "status", "scheduled_time", "administered_time"]
    list_filter = ["status"]
    search_fields = ["patient__mrn"]
    autocomplete_fields = ["patient", "prescription", "administered_by"]

@admin.register(NursingNote)
class NursingNoteAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "nurse", "category", "created_at"]
    list_filter = ["category"]
    search_fields = ["patient__mrn"]
    autocomplete_fields = ["patient", "nurse"]
    readonly_fields = ["edit_deadline", "created_at", "updated_at"]

@admin.register(Task)
class TaskAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "type", "status", "due_time", "assigned_to"]
    list_filter = ["status"]
    search_fields = ["patient__mrn", "type", "description"]
    autocomplete_fields = ["patient", "assigned_to", "completed_by"]

@admin.register(IntakeOutput)
class IntakeOutputAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "direction", "type", "amount_ml", "created_at"]
    list_filter = ["direction", "type"]
    search_fields = ["patient__mrn"]
    autocomplete_fields = ["patient", "recorded_by"]

@admin.register(PainAssessment)
class PainAssessmentAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "score", "location", "created_at"]
    list_filter = ["score"]
    search_fields = ["patient__mrn", "location"]
    autocomplete_fields = ["patient", "recorded_by"]

@admin.register(Wound)
class WoundAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "type", "location", "created_at"]
    list_filter = ["type"]
    search_fields = ["patient__mrn", "location"]
    autocomplete_fields = ["patient", "recorded_by"]

@admin.register(Handoff)
class HandoffAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "ward", "room", "shift_date", "shift_type"]
    list_filter = ["shift_type", "shift_date"]
    search_fields = ["patient__mrn", "room"]
    autocomplete_fields = ["patient", "ward", "from_nurse", "to_nurse"]

@admin.register(DischargeChecklistItem)
class DischargeChecklistItemAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.NURSE
    view_roles = (UserRole.NURSE, UserRole.ADMIN)
    list_display = ["patient", "item", "completed", "completed_at"]
    list_filter = ["completed", "category"]
    search_fields = ["patient__mrn", "item"]
    autocomplete_fields = ["patient", "completed_by"]

