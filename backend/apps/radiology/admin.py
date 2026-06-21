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

from .forms import ImagingOrderAdminForm
from .models import ImagingOrder, ImagingStudy, RadiologyReport, RadCriticalFinding, ModalitySchedule

@admin.register(ImagingOrder)
class ImagingOrderAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.RADIOLOGIST
    view_roles = (UserRole.RADIOLOGIST, UserRole.DOCTOR, UserRole.ADMIN)
    form = ImagingOrderAdminForm
    list_display = ["patient", "modality", "body_part", "status", "priority", "created_at"]
    list_filter = ["modality", "status", "priority"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name", "exam_name", "body_part", "accession_number"]
    readonly_fields = ["accession_number", "created_at", "updated_at"]
    autocomplete_fields = ["patient", "protocoled_by", "technologist", "assigned_radiologist", "cancelled_by"]
    fieldsets = (
        ("Core", {"fields": ("doctor_order", "patient", "ordered_by", "modality", "exam_code", "exam_name", "body_part", "indication")} ),
        ("Clinical", {"fields": ("clinical_history", "laterality", "contrast_required", "priority", "status")} ),
        ("Workflow", {"fields": ("accession_number", "protocoled_by", "protocol_notes", "scheduled_at", "scheduled_room", "technologist", "assigned_radiologist")} ),
        ("Cancellation", {"fields": ("cancelled_at", "cancelled_by")} ),
        ("Audit", {"fields": ("created_at", "updated_at")} ),
    )

    def get_readonly_fields(self, request, obj=None):
        fields = list(super().get_readonly_fields(request, obj))
        if obj:
            fields.extend(["ordered_by", "modality", "exam_code", "exam_name", "body_part"])
        return fields

    def save_model(self, request, obj, form, change):
        if not obj.ordered_by_id and getattr(request.user, "role", None) == UserRole.DOCTOR:
            obj.ordered_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(ImagingStudy)
class ImagingStudyAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.RADIOLOGIST
    view_roles = (UserRole.RADIOLOGIST, UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["order", "patient", "status", "exam_date"]
    list_filter = ["status"]
    readonly_fields = ["created_at", "updated_at"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name", "order__accession_number", "order__exam_name"]
    autocomplete_fields = ["order", "patient"]

    def save_model(self, request, obj, form, change):
        if obj.order_id and not obj.patient_id:
            obj.patient = obj.order.patient
        super().save_model(request, obj, form, change)

@admin.register(RadiologyReport)
class RadiologyReportAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.RADIOLOGIST
    view_roles = (UserRole.RADIOLOGIST, UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["study", "patient", "status", "signed_at"]
    list_filter = ["status"]
    readonly_fields = ["signed_at", "addendum_at", "created_at", "updated_at"]
    autocomplete_fields = ["study", "patient", "signed_by", "addendum_by"]

    def save_model(self, request, obj, form, change):
        if obj.study_id and not obj.patient_id:
            obj.patient = obj.study.patient
        if obj.status in ("final", "addendum") and not obj.signed_by_id and getattr(request.user, "role", None) == UserRole.RADIOLOGIST:
            obj.signed_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(RadCriticalFinding)
class RadCriticalFindingAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.RADIOLOGIST
    view_roles = (UserRole.RADIOLOGIST, UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["patient", "finding", "status", "created_at"]
    list_filter = ["status"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["study", "patient", "identified_by", "acknowledged_by"]

    def save_model(self, request, obj, form, change):
        if obj.study_id and not obj.patient_id:
            obj.patient = obj.study.patient
        if not obj.identified_by_id and getattr(request.user, "role", None) == UserRole.RADIOLOGIST:
            obj.identified_by = request.user
        if obj.status == "acknowledged" and not obj.acknowledged_by_id and getattr(request.user, "role", None) == UserRole.RADIOLOGIST:
            obj.acknowledged_by = request.user
        super().save_model(request, obj, form, change)

@admin.register(ModalitySchedule)
class ModalityScheduleAdmin(RoleRestrictedAdminMixin, admin.ModelAdmin):
    required_role = UserRole.RADIOLOGIST
    view_roles = (UserRole.RADIOLOGIST, UserRole.DOCTOR, UserRole.ADMIN)
    list_display = ["modality", "room", "date", "start_time", "end_time", "status", "patient"]
    list_filter = ["modality", "status", "date"]
    search_fields = ["room", "exam_name", "patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["patient"]

