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


from .models import Specimen, Accession, LabPanel, LabTestResult, LabReport, CriticalValue

@admin.register(Specimen)
class SpecimenAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.LAB_TECH
    view_roles = (UserRole.LAB_TECH, UserRole.ADMIN)
    list_display = ["patient", "type", "status", "collected_at"]
    list_filter = ["type", "status"]
    search_fields = ["patient__mrn"]
    readonly_fields = ["barcode", "created_at", "updated_at"]
    autocomplete_fields = ["patient", "order", "collected_by", "received_by"]

    def save_model(self, request, obj, form, change):
        if obj.order_id and not obj.patient_id:
            obj.patient = obj.order.patient
        if not obj.collected_by_id and getattr(request.user, "role", None) == UserRole.LAB_TECH:
            obj.collected_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(LabPanel)
class LabPanelAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.LAB_TECH
    view_roles = (UserRole.LAB_TECH, UserRole.ADMIN)
    list_display = ["patient", "name", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["patient__mrn", "name"]
    autocomplete_fields = ["patient", "order", "specimen", "verified_by"]

    def save_model(self, request, obj, form, change):
        if obj.specimen_id and not obj.patient_id:
            obj.patient = obj.specimen.patient
        if obj.order_id and not obj.patient_id:
            obj.patient = obj.order.patient
        super().save_model(request, obj, form, change)

@admin.register(LabTestResult)
class LabTestResultAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.LAB_TECH
    view_roles = (UserRole.LAB_TECH, UserRole.ADMIN)
    list_display = ["panel", "test_name", "value", "unit", "flag", "status"]
    list_filter = ["flag", "status"]
    search_fields = ["panel__patient__mrn", "test_name", "test_code"]
    autocomplete_fields = ["panel", "specimen", "verified_by"]

@admin.register(CriticalValue)
class CriticalValueAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.LAB_TECH
    view_roles = (UserRole.LAB_TECH, UserRole.ADMIN)
    list_display = ["patient", "result", "status", "notified_to", "created_at"]
    list_filter = ["status"]
    search_fields = ["patient__mrn"]
    autocomplete_fields = ["result", "patient", "acknowledged_by"]

    def save_model(self, request, obj, form, change):
        if obj.result_id and not obj.patient_id:
            obj.patient = obj.result.panel.patient
        super().save_model(request, obj, form, change)

@admin.register(Accession)
class AccessionAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.LAB_TECH
    view_roles = (UserRole.LAB_TECH, UserRole.ADMIN)
    list_display = ["accession_number", "specimen", "condition", "created_at"]
    search_fields = ["accession_number", "specimen__patient__mrn"]
    readonly_fields = ["accession_number", "created_at", "updated_at"]
    autocomplete_fields = ["specimen", "received_by"]

    def save_model(self, request, obj, form, change):
        if not obj.received_by_id and getattr(request.user, "role", None) == UserRole.LAB_TECH:
            obj.received_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(LabReport)
class LabReportAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.LAB_TECH
    view_roles = (UserRole.LAB_TECH, UserRole.ADMIN)
    list_display = ["panel", "patient", "status", "released_at"]
    list_filter = ["status"]
    readonly_fields = ["released_by", "released_at", "created_at", "updated_at"]
    autocomplete_fields = ["panel", "patient", "released_by"]

    def save_model(self, request, obj, form, change):
        if obj.panel_id and not obj.patient_id:
            obj.patient = obj.panel.patient
        super().save_model(request, obj, form, change)




