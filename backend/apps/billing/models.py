"""
Billing / Revenue Cycle bounded context domain models.

Fixed:
  - Invoice: added `primary_diagnosis` field (spec requirement)
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel

class BillingInvoiceStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SENT = "sent", "Sent"
    BILLED_INSURANCE = "billed_insurance", "Billed Insurance"
    PARTIAL = "partial", "Partial"
    UNPAID = "unpaid", "Unpaid"
    OVERDUE = "overdue", "Overdue"
    CLEARED = "cleared", "Cleared"
    VOID = "void", "Void"

class Invoice(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="invoices"
    )
    encounter_type = models.CharField(max_length=50, blank=True)
    status = models.CharField(
        max_length=30, choices=BillingInvoiceStatus.choices, default=BillingInvoiceStatus.DRAFT
    )
    insurance_plan = models.JSONField(default=dict, blank=True)
    charge_items = models.JSONField(default=list)
    primary_diagnosis = models.CharField(max_length=500, blank=True, null=True)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    insurance_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    patient_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    adjustments = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    balance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    sent_at = models.DateTimeField(null=True, blank=True)
    void_at = models.DateTimeField(null=True, blank=True)
    void_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="voided_invoices",
    )

    class Meta:
        db_table = "invoices"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"Invoice - {self.patient.full_name} [{self.status}]"

class ClaimStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    SUBMITTED = "submitted", "Submitted"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    UNDER_REVIEW = "under-review", "Under Review"
    PAID = "paid", "Paid"
    PARTIALLY_PAID = "partially-paid", "Partially Paid"
    DENIED = "denied", "Denied"
    APPEALED = "appealed", "Appealed"
    CLOSED = "closed", "Closed"

class Claim(TimeStampedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="claims")
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="claims"
    )
    payer_id = models.CharField(max_length=100)
    claim_type = models.CharField(max_length=50)
    status = models.CharField(max_length=30, choices=ClaimStatus.choices, default=ClaimStatus.DRAFT)
    allowed_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    patient_responsibility = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    eob_date = models.DateField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    resubmitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "claims"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"Claim {self.payer_id} - {self.patient.full_name}"

class PaymentMethod(models.TextChoices):
    CASH = "cash", "Cash"
    CHECK = "check", "Check"
    CREDIT_CARD = "credit-card", "Credit Card"
    DEBIT_CARD = "debit-card", "Debit Card"
    ACH = "ach", "ACH"
    INSURANCE = "insurance", "Insurance"
    WRITE_OFF = "write-off", "Write-Off"
    ADJUSTMENT = "adjustment", "Adjustment"

class Payment(TimeStampedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="payments")
    claim = models.ForeignKey(
        Claim, on_delete=models.SET_NULL, null=True, blank=True, related_name="payments"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=20, choices=PaymentMethod.choices)
    payer = models.CharField(max_length=200)
    reference_number = models.CharField(max_length=100, blank=True, null=True)
    posted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    posted_at = models.DateTimeField(auto_now_add=True)
    voided = models.BooleanField(default=False)
    void_reason = models.TextField(blank=True, null=True)
    voided_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "payments"
        indexes = [models.Index(fields=["invoice", "posted_at"])]

    def __str__(self):
        return f"{self.amount} {self.method} - {self.patient.full_name}"

class DenialStatus(models.TextChoices):
    OPEN = "open", "Open"
    IN_REVIEW = "in-review", "In Review"
    APPEALED = "appealed", "Appealed"
    OVERTURNED = "overturned", "Overturned"
    UPHELD = "upheld", "Upheld"
    WRITE_OFF = "write-off", "Write-Off"

class DenialReasonCode(models.TextChoices):
    MISSING_INFO = "missing-info", "Missing Info"
    MEDICAL_NECESSITY = "medical-necessity", "Medical Necessity"
    AUTH_REQUIRED = "auth-required", "Auth Required"
    TIMELY_FILING = "timely-filing", "Timely Filing"
    DUPLICATE = "duplicate", "Duplicate"
    ELIGIBILITY = "eligibility", "Eligibility"
    CODING_ERROR = "coding-error", "Coding Error"
    OUT_OF_NETWORK = "out-of-network", "Out of Network"
    OTHER = "other", "Other"

class Denial(TimeStampedModel):
    claim = models.ForeignKey(Claim, on_delete=models.CASCADE, related_name="denials")
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="denials"
    )
    reason_code = models.CharField(max_length=30, choices=DenialReasonCode.choices)
    reason_description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=DenialStatus.choices, default=DenialStatus.OPEN)
    appeal_notes = models.TextField(blank=True, null=True)
    appeal_submitted_at = models.DateTimeField(null=True, blank=True)
    resolution_notes = models.TextField(blank=True, null=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "denials"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"{self.reason_code} - {self.patient.full_name}"
