"""
Doctors bounded context domain models.
Aggregates: Encounter, Diagnosis, Order, Prescription, Referral.
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel

class EncounterStatus(models.TextChoices):
    IN_PROGRESS = "in-progress", "In Progress"
    COMPLETED = "completed", "Completed"
    SIGNED = "signed", "Signed"
    AMENDED = "amended", "Amended"

class VisitType(models.TextChoices):
    INPATIENT = "inpatient", "Inpatient"
    OUTPATIENT = "outpatient", "Outpatient"

class Encounter(TimeStampedModel):
    """SOAP note aggregate."""

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="encounters"
    )
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="encounters"
    )
    visit_type = models.CharField(max_length=20, choices=VisitType.choices)
    status = models.CharField(
        max_length=20, choices=EncounterStatus.choices, default=EncounterStatus.IN_PROGRESS
    )
    subjective = models.TextField(blank=True)
    objective = models.TextField(blank=True)
    assessment = models.TextField(blank=True)
    plan = models.TextField(blank=True)
    signed_at = models.DateTimeField(null=True, blank=True)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="signed_encounters",
    )
    amendments = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "encounters"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["doctor"]),
        ]

    def __str__(self):
        return f"Encounter - {self.patient.full_name} with {self.doctor.get_full_name() or self.doctor.email}"

class DiagnosisType(models.TextChoices):
    PRIMARY = "primary", "Primary"
    SECONDARY = "secondary", "Secondary"
    DIFFERENTIAL = "differential", "Differential"
    ADMITTING = "admitting", "Admitting"

class DiagnosisStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    RESOLVED = "resolved", "Resolved"
    CHRONIC = "chronic", "Chronic"
    SUSPECTED = "suspected", "Suspected"

class Diagnosis(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="diagnoses"
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True, related_name="diagnoses"
    )
    code = models.CharField(max_length=20)
    description = models.TextField()
    snomed_code = models.CharField(max_length=20, blank=True, null=True)
    snomed_display = models.CharField(max_length=300, blank=True, null=True)
    type = models.CharField(max_length=20, choices=DiagnosisType.choices)
    status = models.CharField(max_length=20, choices=DiagnosisStatus.choices, default=DiagnosisStatus.ACTIVE)
    diagnosed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
    )

    class Meta:
        db_table = "diagnoses"
        indexes = [models.Index(fields=["patient", "status"]), models.Index(fields=["code"])]

    def __str__(self):
        return f"{self.code} - {self.patient.full_name}"

class OrderCategory(models.TextChoices):
    LAB = "lab", "Laboratory"
    IMAGING = "imaging", "Imaging"
    CONSULT = "consult", "Consultation"
    PROCEDURE = "procedure", "Procedure"

class Priority(models.TextChoices):
    ROUTINE = "routine", "Routine"
    URGENT = "urgent", "Urgent"
    STAT = "stat", "STAT"
    ASAP = "asap", "ASAP"

class OrderStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in-progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    RESULTED = "resulted", "Resulted"

class ImagingBodyPart(models.TextChoices):
    HEAD = "head", "Head"
    NECK = "neck", "Neck"
    CHEST = "chest", "Chest"
    ABDOMEN = "abdomen", "Abdomen"
    PELVIS = "pelvis", "Pelvis"
    SPINE = "spine", "Spine"
    UPPER_EXTREMITY = "upper-extremity", "Upper Extremity"
    LOWER_EXTREMITY = "lower-extremity", "Lower Extremity"
    BREAST = "breast", "Breast"
    WHOLE_BODY = "whole-body", "Whole Body"
    OTHER = "other", "Other"

class Laterality(models.TextChoices):
    LEFT = "left", "Left"
    RIGHT = "right", "Right"
    BILATERAL = "bilateral", "Bilateral"

class SpecimenType(models.TextChoices):
    BLOOD = "blood", "Blood"
    URINE = "urine", "Urine"
    STOOL = "stool", "Stool"
    SPUTUM = "sputum", "Sputum"
    SWAB = "swab", "Swab"
    TISSUE = "tissue", "Tissue"
    SALIVA = "saliva", "Saliva"
    OTHER = "other", "Other"

class Order(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="orders"
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True, related_name="orders"
    )
    ordered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="placed_orders"
    )
    category = models.CharField(max_length=20, choices=OrderCategory.choices)
    name = models.CharField(max_length=200)
    indication = models.TextField(blank=True, null=True)
    exam_code = models.CharField(max_length=50, blank=True, null=True)
    body_part = models.CharField(max_length=30, choices=ImagingBodyPart.choices, blank=True, null=True)
    laterality = models.CharField(max_length=20, choices=Laterality.choices, blank=True, null=True)
    contrast_required = models.BooleanField(default=False)
    clinical_history = models.TextField(blank=True, null=True)
    specimen_type = models.CharField(max_length=30, choices=SpecimenType.choices, blank=True, null=True)
    fasting_required = models.BooleanField(default=False)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.ROUTINE)
    status = models.CharField(max_length=20, choices=OrderStatus.choices, default=OrderStatus.PENDING)
    notes = models.TextField(blank=True, null=True)
    results = models.JSONField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "orders"
        indexes = [models.Index(fields=["patient", "status", "category"])]

    def __str__(self):
        return f"{self.name} - {self.patient.full_name}"

class PrescriptionStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    DISCONTINUED = "discontinued", "Discontinued"
    ON_HOLD = "on-hold", "On Hold"
    EXPIRED = "expired", "Expired"

class Prescription(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="prescriptions"
    )
    encounter = models.ForeignKey(
        Encounter, on_delete=models.SET_NULL, null=True, blank=True, related_name="prescriptions"
    )
    prescribed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="prescriptions"
    )
    medication = models.CharField(max_length=200)
    generic_name = models.CharField(max_length=200, blank=True, null=True)
    rxnorm_code = models.CharField(max_length=30, blank=True, null=True)
    dosage = models.CharField(max_length=100)
    route = models.CharField(max_length=50)
    frequency = models.CharField(max_length=100)
    quantity = models.PositiveIntegerField()
    refills = models.PositiveIntegerField(default=0)
    sig = models.TextField()
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=PrescriptionStatus.choices, default=PrescriptionStatus.ACTIVE
    )

    class Meta:
        db_table = "prescriptions"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"{self.medication} - {self.patient.full_name}"

class ReferralUrgency(models.TextChoices):
    ROUTINE = "routine", "Routine"
    URGENT = "urgent", "Urgent"
    EMERGENT = "emergent", "Emergent"

class ReferralStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    ACCEPTED = "accepted", "Accepted"
    COMPLETED = "completed", "Completed"
    DECLINED = "declined", "Declined"

class Referral(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="referrals"
    )
    referring_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="sent_referrals"
    )
    to_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_referrals",
    )
    to_department = models.ForeignKey(
        "administration.Department", on_delete=models.SET_NULL, null=True,
    )
    reason = models.TextField()
    urgency = models.CharField(max_length=20, choices=ReferralUrgency.choices)
    status = models.CharField(
        max_length=20, choices=ReferralStatus.choices, default=ReferralStatus.PENDING
    )

    class Meta:
        db_table = "referrals"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"Referral - {self.patient.full_name}"
