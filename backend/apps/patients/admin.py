from django.contrib import admin
from .models import Patient, Admission, AdmissionTransfer, Queue, Appointment, Consent
from .forms import PatientAdminForm

@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    form = PatientAdminForm
    list_display = ["mrn", "first_name", "last_name", "gender", "date_of_birth", "phone", "status", "created_at"]
    list_filter = ["gender", "status", "blood_type"]
    search_fields = ["mrn", "first_name", "last_name", "phone", "email"]
    ordering = ["-created_at"]
    readonly_fields = ["mrn", "registered_at", "created_at", "updated_at", "deleted_at"]
    autocomplete_fields = ["assigned_doctor", "ward"]
    fieldsets = (
        ("Identity", {"fields": ("mrn", "first_name", "last_name", "date_of_birth", "gender", "status")}),
        ("Contact", {"fields": ("phone", "email", "nationality", "preferred_language", "marital_status", "avatar")}),
        ("Address", {"fields": ("address_line1", "address_line2", "city", "state", "postal_code", "country")}),
        ("Clinical", {"fields": ("blood_type", "allergies_text", "consent_signed")}),
        ("Admission", {"fields": ("admission_date", "assigned_doctor", "ward", "room_number")}),
        ("Emergency Contact", {"fields": ("emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone")}),
        ("Insurance", {"fields": ("insurance_provider", "insurance_id", "insurance_policy_number", "insurance_group_number", "insurance_valid_from", "insurance_valid_to", "insurance_copay", "insurance_coverage_type")}),
        ("Audit", {"fields": ("registered_at", "created_at", "updated_at", "deleted_at")}),
    )

@admin.register(Admission)
class AdmissionAdmin(admin.ModelAdmin):
    list_display = ["patient", "type", "status", "admitted_at", "ward", "bed"]
    list_filter = ["status", "type"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name"]
    autocomplete_fields = ["patient", "admitting_doctor", "department", "ward", "bed", "discharged_by"]

@admin.register(Queue)
class QueueAdmin(admin.ModelAdmin):
    list_display = ["patient", "status", "priority", "created_at"]
    list_filter = ["status", "priority"]
    readonly_fields = ["ticket_number", "queue_date", "called_at", "completed_at", "created_at", "updated_at"]
    autocomplete_fields = ["patient"]

@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display = ["patient", "doctor", "status", "date", "time"]
    list_filter = ["status"]
    search_fields = ["patient__mrn", "patient__first_name"]
    autocomplete_fields = ["patient", "doctor", "department"]

@admin.register(AdmissionTransfer)
class AdmissionTransferAdmin(admin.ModelAdmin):
    list_display = ["admission", "from_ward", "to_ward", "transferred_at"]
    autocomplete_fields = ["admission", "from_ward", "from_bed", "to_ward", "to_bed", "approved_by"]
    readonly_fields = ["transferred_at", "created_at", "updated_at"]


@admin.register(Consent)
class ConsentAdmin(admin.ModelAdmin):
    list_display = ["patient", "type", "status", "signed_at"]
    list_filter = ["status", "type"]
    search_fields = ["patient__mrn", "patient__first_name", "patient__last_name", "type"]
    autocomplete_fields = ["patient", "signed_by"]
    readonly_fields = ["signed_at", "created_at", "updated_at"]
