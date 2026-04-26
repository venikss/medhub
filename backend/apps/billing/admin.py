from django.contrib import admin
from .models import Invoice, Claim, Payment, Denial
from .forms import InvoiceAdminForm

@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    form = InvoiceAdminForm
    list_display = ["patient", "status", "total_amount", "balance", "created_at"]
    list_filter = ["status"]
    search_fields = ["patient__mrn"]
    readonly_fields = ["created_at", "updated_at"]
    autocomplete_fields = ["patient", "void_by"]
    fieldsets = (
        ("Core", {"fields": ("patient", "encounter_type", "status", "primary_diagnosis")}),
        (
            "Insurance",
            {
                "fields": (
                    "insurance_provider",
                    "insurance_plan_name",
                    "insurance_policy_number",
                    "insurance_member_id",
                    "insurance_group_number",
                    "insurance_coverage_type",
                )
            },
        ),
        ("Charges", {"fields": ("charge_items_text", "total_amount", "insurance_paid", "patient_paid", "adjustments", "balance")}),
        ("Lifecycle", {"fields": ("sent_at", "void_at", "void_by")}),
        ("Audit", {"fields": ("created_at", "updated_at")}),
    )

@admin.register(Claim)
class ClaimAdmin(admin.ModelAdmin):
    list_display = ["patient", "payer_id", "claim_type", "status", "submitted_at"]
    list_filter = ["status", "claim_type"]
    search_fields = ["patient__mrn", "payer_id"]
    autocomplete_fields = ["invoice", "patient"]

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ["patient", "amount", "method", "payer", "posted_at", "voided"]
    list_filter = ["method", "voided"]
    search_fields = ["patient__mrn", "reference_number"]
    autocomplete_fields = ["invoice", "claim", "patient", "posted_by"]

@admin.register(Denial)
class DenialAdmin(admin.ModelAdmin):
    list_display = ["claim", "reason_code", "status", "created_at"]
    list_filter = ["status", "reason_code"]
    search_fields = ["claim__patient__mrn", "reason_description"]
    autocomplete_fields = ["claim", "patient"]
