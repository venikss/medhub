"""
Pharmacy bounded context domain models.

Fixed:
  - PharmacyIntervention: replaced `pharmacist_name` CharField with `pharmacist` ForeignKey.
    The view calls serializer.save(pharmacist=request.user) — the model must have the FK.
    Migration required: remove pharmacist_name, add pharmacist FK.
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel


class RxStatus(models.TextChoices):
    ORDERED = "ordered", "Ordered"
    PENDING_VERIFICATION = "pending-verification", "Pending Verification"
    VERIFIED = "verified", "Verified"
    DISPENSING = "dispensing", "Dispensing"
    DISPENSED = "dispensed", "Dispensed"
    ON_HOLD = "on-hold", "On Hold"
    CANCELLED = "cancelled", "Cancelled"
    RETURNED = "returned", "Returned"


class RxSetting(models.TextChoices):
    INPATIENT = "inpatient", "Inpatient"
    OUTPATIENT = "outpatient", "Outpatient"
    DISCHARGE = "discharge", "Discharge"


class PharmacyPrescription(TimeStampedModel):
    """Pharmacy view of a prescription — extends doctors.Prescription workflow."""

    original_prescription = models.OneToOneField(
        "doctors.Prescription", on_delete=models.CASCADE, related_name="pharmacy_record"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="pharmacy_prescriptions"
    )
    status = models.CharField(max_length=30, choices=RxStatus.choices, default=RxStatus.PENDING_VERIFICATION)
    setting = models.CharField(max_length=20, choices=RxSetting.choices, default=RxSetting.INPATIENT)
    priority = models.CharField(max_length=20, default="routine")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="verified_prescriptions",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    verification_notes = models.TextField(blank=True, null=True)
    dispensed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="dispensed_prescriptions",
    )
    dispensed_at = models.DateTimeField(null=True, blank=True)
    lot_number = models.CharField(max_length=100, blank=True, null=True)
    expiration_date = models.DateField(null=True, blank=True)
    quantity_dispensed = models.PositiveIntegerField(null=True, blank=True)
    hold_reason = models.TextField(blank=True, null=True)
    drug_warnings = models.JSONField(default=list)

    class Meta:
        db_table = "pharmacy_prescriptions"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        drug = getattr(self.original_prescription, "medication", "Prescription")
        return f"{drug} - {self.patient.full_name} [{self.status}]"


class DrugWarning(TimeStampedModel):
    prescription = models.ForeignKey(
        PharmacyPrescription, on_delete=models.CASCADE, related_name="warnings",
        null=True, blank=True,
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="drug_warnings"
    )
    type = models.CharField(
        max_length=30,
        choices=[
            ("interaction", "Drug Interaction"),
            ("allergy", "Allergy"),
            ("duplication", "Duplication"),
            ("dose-range", "Dose Range"),
            ("renal", "Renal"),
            ("pregnancy", "Pregnancy"),
            ("pediatric", "Pediatric"),
        ],
    )
    severity = models.CharField(
        max_length=20,
        choices=[
            ("info", "Info"),
            ("moderate", "Moderate"),
            ("severe", "Severe"),
            ("contraindicated", "Contraindicated"),
        ],
    )
    message = models.TextField()
    medications_involved = models.JSONField(default=list)
    resolved = models.BooleanField(default=False)

    class Meta:
        db_table = "drug_warnings"
        indexes = [models.Index(fields=["patient", "severity"])]

    def __str__(self):
        return f"{self.type} warning - {self.patient.full_name}"


class FormularyStatus(models.TextChoices):
    FORMULARY = "formulary", "On Formulary"
    NON_FORMULARY = "non-formulary", "Non-Formulary"
    RESTRICTED = "restricted", "Restricted"


class FormularyItem(TimeStampedModel):
    name = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True)
    drug_class = models.CharField(max_length=100)
    rxnorm_code = models.CharField(max_length=30, blank=True, null=True)
    formulary_status = models.CharField(
        max_length=20, choices=FormularyStatus.choices, default=FormularyStatus.FORMULARY
    )
    stock_level = models.PositiveIntegerField(default=0)
    reorder_level = models.PositiveIntegerField(default=10)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=50, default="tablet")
    ndc = models.CharField(max_length=50, blank=True, null=True)

    class Meta:
        db_table = "formulary"

    def __str__(self):
        return f"{self.name} ({self.generic_name or self.drug_class})"


class DispenseRecord(TimeStampedModel):
    prescription = models.ForeignKey(
        PharmacyPrescription, on_delete=models.CASCADE, related_name="dispense_records"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE
    )
    dispensed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    dispensed_at = models.DateTimeField(auto_now_add=True)
    lot_number = models.CharField(max_length=100)
    expiration_date = models.DateField()
    quantity = models.PositiveIntegerField()
    days_supply = models.PositiveIntegerField(null=True, blank=True)

    class Meta:
        db_table = "dispense_records"

    def __str__(self):
        return f"Dispense - {self.patient.full_name} - {self.quantity}"


class InterventionType(models.TextChoices):
    THERAPY_CHANGE = "therapy-change", "Therapy Change"
    DOSE_ADJUSTMENT = "dose-adjustment", "Dose Adjustment"
    DRUG_DISCONTINUATION = "drug-discontinuation", "Drug Discontinuation"
    ALLERGY_CLARIFICATION = "allergy-clarification", "Allergy Clarification"
    BRAND_TO_GENERIC = "brand-to-generic", "Brand to Generic"
    FORMULARY_SUBSTITUTION = "formulary-substitution", "Formulary Substitution"
    OTHER = "other", "Other"


class PharmacyIntervention(TimeStampedModel):
    prescription = models.ForeignKey(
        PharmacyPrescription, on_delete=models.CASCADE, related_name="interventions"
    )
    type = models.CharField(max_length=30, choices=InterventionType.choices)
    reason = models.TextField()
    recommendation = models.TextField()
    prescriber_contact = models.CharField(max_length=200)
    # Fixed: replaced pharmacist_name CharField with pharmacist ForeignKey.
    # The view calls serializer.save(pharmacist=request.user) so the FK must exist.
    # Migration: remove pharmacist_name column, add pharmacist_id FK column.
    pharmacist = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pharmacy_interventions",
    )
    outcome = models.TextField(blank=True, null=True)
    prescriber_response = models.TextField(blank=True, null=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "pharmacy_interventions"

    def __str__(self):
        return f"{self.type} - {self.prescription.patient.full_name}"


class Refill(TimeStampedModel):
    prescription = models.ForeignKey(
        PharmacyPrescription, on_delete=models.CASCADE, related_name="refills"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE
    )
    dispensed_date = models.DateField()
    quantity = models.PositiveIntegerField()
    pharmacist = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    days_supply = models.PositiveIntegerField()

    class Meta:
        db_table = "refills"

    def __str__(self):
        return f"Refill - {self.patient.full_name} - {self.quantity}"


class SubstitutionStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    APPROVED = "approved", "Approved"
    REJECTED = "rejected", "Rejected"


class Substitution(TimeStampedModel):
    prescription = models.ForeignKey(
        PharmacyPrescription, on_delete=models.CASCADE, related_name="substitutions"
    )
    substitute_medication = models.CharField(max_length=200)
    reason = models.TextField()
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="requested_substitutions",
    )
    status = models.CharField(
        max_length=20, choices=SubstitutionStatus.choices, default=SubstitutionStatus.PENDING
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="approved_substitutions",
    )

    class Meta:
        db_table = "substitutions"

    def __str__(self):
        return f"{self.substitute_medication} for {self.prescription.patient.full_name}"
