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

from .forms import (
    PharmacyPrescriptionAdminForm,
    DispenseRecordAdminForm,
    PharmacyInterventionAdminForm,
    RefillAdminForm,
    SubstitutionAdminForm,
)
from .models import PharmacyPrescription, DrugWarning, FormularyItem, DispenseRecord, PharmacyIntervention, Refill, Substitution

@admin.register(PharmacyPrescription)
class PharmacyPrescriptionAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    form = PharmacyPrescriptionAdminForm
    list_display = ["patient", "status", "setting", "priority", "verified_by", "created_at"]
    list_filter = ["status", "setting", "priority"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name"]
    readonly_fields = ["verified_by", "verified_at", "dispensed_by", "dispensed_at", "created_at", "updated_at"]
    autocomplete_fields = ["original_prescription", "patient", "verified_by", "dispensed_by"]
    fieldsets = (
        ("Core", {"fields": ("original_prescription", "patient", "status", "setting", "priority")} ),
        ("Verification", {"fields": ("verified_by", "verified_at", "verification_notes")} ),
        ("Dispensing", {"fields": ("dispensed_by", "dispensed_at", "lot_number", "expiration_date", "quantity_dispensed")} ),
        ("Alerts", {"fields": ("hold_reason", "drug_warnings")} ),
        ("Audit", {"fields": ("created_at", "updated_at")} ),
    )

    def save_model(self, request, obj, form, change):
        if obj.original_prescription_id and not obj.patient_id:
            obj.patient = obj.original_prescription.patient
        super().save_model(request, obj, form, change)

    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        if obj:
            readonly.extend(["original_prescription", "patient"])
            if obj.status in ("verified", "dispensed", "cancelled"):
                readonly.extend(["status", "setting", "priority", "verification_notes"])
        return readonly

@admin.register(DrugWarning)
class DrugWarningAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["patient", "type", "severity", "resolved", "created_at"]
    list_filter = ["type", "severity", "resolved"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["patient", "prescription"]
    readonly_fields = ["created_at"]

    def has_add_permission(self, request):
        return False

@admin.register(FormularyItem)
class FormularyItemAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["name", "generic_name", "drug_class", "formulary_status", "stock_level"]
    list_filter = ["formulary_status", "drug_class"]
    search_fields = ["name", "generic_name", "ndc"]
    readonly_fields = ["created_at", "updated_at"]

@admin.register(DispenseRecord)
class DispenseRecordAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    form = DispenseRecordAdminForm
    list_display = ["prescription", "patient", "quantity", "dispensed_by", "dispensed_at"]
    list_filter = ["dispensed_at"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name", "lot_number"]
    readonly_fields = ["dispensed_by", "dispensed_at", "created_at", "updated_at"]
    autocomplete_fields = ["prescription", "patient", "dispensed_by"]

    def save_model(self, request, obj, form, change):
        if obj.prescription_id and not obj.patient_id:
            obj.patient = obj.prescription.patient
        if not obj.dispensed_by_id and getattr(request.user, "role", None) == UserRole.PHARMACIST:
            obj.dispensed_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(PharmacyIntervention)
class PharmacyInterventionAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    form = PharmacyInterventionAdminForm
    list_display = ["prescription", "type", "pharmacist", "created_at", "resolved_at"]
    list_filter = ["type"]
    search_fields = ["prescription__patient__mrn", "prescriber_contact"]
    autocomplete_fields = ["prescription", "pharmacist"]

    def save_model(self, request, obj, form, change):
        if not obj.pharmacist_id and getattr(request.user, "role", None) == UserRole.PHARMACIST:
            obj.pharmacist = request.user
        super().save_model(request, obj, form, change)

@admin.register(Refill)
class RefillAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    form = RefillAdminForm
    list_display = ["prescription", "patient", "dispensed_date", "quantity", "pharmacist"]
    list_filter = ["dispensed_date"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["prescription", "patient", "pharmacist"]

    def save_model(self, request, obj, form, change):
        if obj.prescription_id and not obj.patient_id:
            obj.patient = obj.prescription.patient
        if not obj.pharmacist_id and getattr(request.user, "role", None) == UserRole.PHARMACIST:
            obj.pharmacist = request.user
        super().save_model(request, obj, form, change)

@admin.register(Substitution)
class SubstitutionAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.PHARMACIST
    view_roles = (UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN)
    form = SubstitutionAdminForm
    list_display = ["prescription", "substitute_medication", "status"]
    list_filter = ["status"]
    search_fields = ["prescription__patient__mrn", "substitute_medication"]
    autocomplete_fields = ["prescription"]

    def save_model(self, request, obj, form, change):
        obj.requested_by = None
        obj.approved_by = None
        super().save_model(request, obj, form, change)

