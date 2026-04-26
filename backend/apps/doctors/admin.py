from django.contrib import admin
from apps.authentication.models import UserRole
from django.http import HttpResponseRedirect
from django.urls import reverse
from urllib.parse import urlencode


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



from .forms import OrderAdminForm, PrescriptionAdminForm
from .views import _sync_pharmacy_prescription_from_doctor_rx, _sync_radiology_order_from_doctor_order
from .models import Encounter, Diagnosis, Order, Prescription, Referral


@admin.register(Encounter)
class EncounterAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.DOCTOR
    view_roles = (UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["patient", "doctor", "status", "visit_type", "signed_at"]
    list_filter = ["status", "visit_type"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name", "doctor__email"]
    autocomplete_fields = ["patient", "doctor", "signed_by"]

    def get_exclude(self, request, obj=None):
        exclude = list(super().get_exclude(request, obj) or [])
        if getattr(request.user, "role", None) == UserRole.DOCTOR and "doctor" not in exclude:
            exclude.append("doctor")
        return exclude

    def save_model(self, request, obj, form, change):
        if not obj.doctor_id and getattr(request.user, "role", None) == UserRole.DOCTOR:
            obj.doctor = request.user
        super().save_model(request, obj, form, change)


@admin.register(Diagnosis)
class DiagnosisAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.DOCTOR
    view_roles = (UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["encounter", "code", "description", "type", "status"]
    list_filter = ["type", "status"]
    search_fields = ["code", "description"]
    autocomplete_fields = ["patient", "encounter", "diagnosed_by"]

    def get_exclude(self, request, obj=None):
        exclude = list(super().get_exclude(request, obj) or [])
        if getattr(request.user, "role", None) == UserRole.DOCTOR and "diagnosed_by" not in exclude:
            exclude.append("diagnosed_by")
        return exclude

    def save_model(self, request, obj, form, change):
        if obj.encounter_id and not obj.patient_id:
            obj.patient = obj.encounter.patient
        if not obj.diagnosed_by_id and getattr(request.user, "role", None) == UserRole.DOCTOR:
            obj.diagnosed_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(Order)
class OrderAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.DOCTOR
    view_roles = (UserRole.DOCTOR, UserRole.ADMIN)
    form = OrderAdminForm
    list_display = ["encounter", "category", "name", "status", "priority", "created_at"]
    list_filter = ["category", "status", "priority"]
    search_fields = ["name", "patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["encounter", "ordered_by"]
    fieldsets = (
        ("Core", {"fields": ("encounter", "encounter_patient_name", "ordered_by", "category", "name", "indication", "priority", "status")}),
        ("Imaging", {"fields": ("exam_code", "body_part", "laterality", "contrast_required", "clinical_history")}),
        ("Laboratory", {"fields": ("specimen_type", "fasting_required")}),
        ("Additional", {"fields": ("notes", "results", "completed_at")}),
    )

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        adjusted = []
        for title, options in fieldsets:
            fields = options.get("fields", ())
            filtered = tuple(field for field in fields if field != "patient")
            if getattr(request.user, "role", None) == UserRole.DOCTOR:
                filtered = tuple(field for field in filtered if field != "ordered_by")
            adjusted.append((title, {**options, "fields": filtered}))
        return adjusted

    def save_model(self, request, obj, form, change):
        if obj.encounter_id and not obj.patient_id:
            obj.patient = obj.encounter.patient
        if not obj.ordered_by_id and getattr(request.user, "role", None) == UserRole.DOCTOR:
            obj.ordered_by = request.user
        super().save_model(request, obj, form, change)
        _sync_radiology_order_from_doctor_order(obj)

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        encounter_id = request.GET.get("encounter")
        if encounter_id:
            initial["encounter"] = encounter_id
        return initial

    def response_add(self, request, obj, post_url_continue=None):
        if "_addanother" in request.POST and obj.encounter_id:
            url = reverse("admin:doctors_order_add")
            return HttpResponseRedirect(f"{url}?{urlencode({'encounter': str(obj.encounter_id)})}")
        return super().response_add(request, obj, post_url_continue)


@admin.register(Prescription)
class PrescriptionAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.DOCTOR
    view_roles = (UserRole.DOCTOR, UserRole.ADMIN)
    form = PrescriptionAdminForm
    list_display = ["encounter", "medication", "status", "created_at"]
    list_filter = ["status", "route"]
    search_fields = ["medication", "patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["encounter", "prescribed_by"]
    fieldsets = (
        ("Context", {"fields": ("encounter", "encounter_patient_name", "prescribed_by", "status")}),
        ("Medication", {"fields": ("medication", "generic_name", "dosage", "route", "frequency")}),
        ("Dispensing", {"fields": ("quantity", "refills", "start_date", "end_date")}),
        ("Instructions", {"fields": ("sig",)}),
    )

    def get_exclude(self, request, obj=None):
        exclude = list(super().get_exclude(request, obj) or [])
        if getattr(request.user, "role", None) == UserRole.DOCTOR and "prescribed_by" not in exclude:
            exclude.append("prescribed_by")
        return exclude

    def get_fieldsets(self, request, obj=None):
        fieldsets = super().get_fieldsets(request, obj)
        if getattr(request.user, "role", None) != UserRole.DOCTOR:
            return fieldsets
        adjusted = []
        for title, options in fieldsets:
            fields = options.get("fields", ())
            filtered = tuple(field for field in fields if field != "prescribed_by")
            adjusted.append((title, {**options, "fields": filtered}))
        return adjusted

    def get_changeform_initial_data(self, request):
        initial = super().get_changeform_initial_data(request)
        encounter_id = request.GET.get("encounter")
        if encounter_id:
            initial["encounter"] = encounter_id
        return initial

    def response_add(self, request, obj, post_url_continue=None):
        if "_addanother" in request.POST and obj.encounter_id:
            url = reverse("admin:doctors_prescription_add")
            return HttpResponseRedirect(f"{url}?{urlencode({'encounter': str(obj.encounter_id)})}")
        return super().response_add(request, obj, post_url_continue)

    def save_model(self, request, obj, form, change):
        if obj.encounter_id and not obj.patient_id:
            obj.patient = obj.encounter.patient
        if not obj.prescribed_by_id and getattr(request.user, "role", None) == UserRole.DOCTOR:
            obj.prescribed_by = request.user
        super().save_model(request, obj, form, change)
        _sync_pharmacy_prescription_from_doctor_rx(obj)


@admin.register(Referral)
class ReferralAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.DOCTOR
    view_roles = (UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["patient", "referring_doctor", "to_department", "status", "urgency", "created_at"]
    list_filter = ["status", "urgency"]
    search_fields = ["patient__mrn", "reason"]
    autocomplete_fields = ["patient", "referring_doctor", "to_doctor", "to_department"]

    def get_exclude(self, request, obj=None):
        exclude = list(super().get_exclude(request, obj) or [])
        if getattr(request.user, "role", None) == UserRole.DOCTOR and "referring_doctor" not in exclude:
            exclude.append("referring_doctor")
        return exclude

    def save_model(self, request, obj, form, change):
        if not obj.referring_doctor_id and getattr(request.user, "role", None) == UserRole.DOCTOR:
            obj.referring_doctor = request.user
        super().save_model(request, obj, form, change)












