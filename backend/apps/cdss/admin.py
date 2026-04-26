from django.contrib import admin
from .models import (
    CDSSConsultRequest,
    CDSSRecommendation,
    CDSSOverrideRecord,
    CDSSOutputKind,
    CDSSSourceModule,
    MedicalOntologyConcept,
    MedicalOntologyMapping,
)


@admin.register(CDSSConsultRequest)
class CDSSConsultRequestAdmin(admin.ModelAdmin):
    list_display = ["patient", "requested_by", "status", "created_at", "answered_at"]
    list_filter = ["status", "created_at"]
    search_fields = [
        "patient__mrn",
        "patient__first_name",
        "patient__last_name",
        "clinical_question",
    ]
    ordering = ["-created_at"]
    autocomplete_fields = ["patient", "encounter", "requested_by"]
    readonly_fields = ["answered_at", "created_at", "updated_at"]
    fieldsets = (
        ("Request", {"fields": ("patient", "encounter", "requested_by", "status")}),
        ("Clinical Context", {"fields": ("clinical_question", "context_notes")}),
        ("Audit", {"fields": ("answered_at", "created_at", "updated_at")}),
    )

@admin.register(CDSSRecommendation)
class CDSSRecommendationAdmin(admin.ModelAdmin):
    list_display = ["patient", "output_kind", "type", "severity", "status", "created_at"]
    list_filter = ["output_kind", "type", "severity", "status"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name", "title", "summary"]
    ordering = ["-created_at"]
    autocomplete_fields = ["patient", "encounter", "consult_request", "acknowledged_by", "overridden_by"]
    readonly_fields = [
        "generated_at",
        "acknowledged_by",
        "acknowledged_at",
        "overridden_by",
        "overridden_at",
        "created_at",
        "updated_at",
    ]
    fieldsets = (
        ("Core", {"fields": ("patient", "encounter", "consult_request", "output_kind", "type", "severity", "status", "title", "summary")}),
        ("Routing", {"fields": ("source_module", "triggered_by", "target_roles")}),
        ("Clinical Output", {"fields": ("affected_medications", "suggested_actions", "explanation", "evidence_sources")}),
        ("Lifecycle", {"fields": ("generated_at", "expires_at", "acknowledged_by", "acknowledged_at", "overridden_by", "overridden_at")}),
        ("Feedback", {"fields": ("feedback_rating", "feedback_comment", "override_reason", "override_reason_category")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )

    def get_readonly_fields(self, request, obj=None):
        readonly = list(super().get_readonly_fields(request, obj))
        if obj:
            readonly.extend(["patient", "encounter", "type"])
        return readonly

    def save_model(self, request, obj, form, change):
        if obj.consult_request_id and not obj.output_kind:
            obj.output_kind = CDSSOutputKind.RECOMMENDATION
        if not obj.output_kind:
            obj.output_kind = CDSSOutputKind.ALERT
        if not obj.source_module:
            obj.source_module = CDSSSourceModule.DOCTOR
        if not obj.triggered_by:
            obj.triggered_by = "manual_admin"
        if not obj.target_roles:
            obj.target_roles = ["doctor"]
        if obj.affected_medications is None:
            obj.affected_medications = []
        if obj.suggested_actions is None:
            obj.suggested_actions = []
        if obj.explanation is None:
            obj.explanation = {}
        if obj.evidence_sources is None:
            obj.evidence_sources = []
        super().save_model(request, obj, form, change)

@admin.register(CDSSOverrideRecord)
class CDSSOverrideRecordAdmin(admin.ModelAdmin):
    list_display = ["recommendation", "action", "clinician_name", "created_at"]
    list_filter = ["action"]
    search_fields = ["clinician_name"]
    readonly_fields = ["recorded_at", "created_at", "updated_at"]
    autocomplete_fields = ["recommendation"]

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(MedicalOntologyConcept)
class MedicalOntologyConceptAdmin(admin.ModelAdmin):
    list_display = ["code_system", "code", "display", "domain", "is_active"]
    list_filter = ["code_system", "domain", "is_active"]
    search_fields = ["code", "display", "normalized_display"]
    readonly_fields = ["created_at", "updated_at"]


@admin.register(MedicalOntologyMapping)
class MedicalOntologyMappingAdmin(admin.ModelAdmin):
    list_display = ["source_module", "domain", "local_display", "local_code", "concept", "is_primary"]
    list_filter = ["source_module", "domain", "is_primary"]
    search_fields = ["local_display", "normalized_local_display", "local_code", "concept__code", "concept__display"]
    autocomplete_fields = ["concept"]
    readonly_fields = ["created_at", "updated_at"]
