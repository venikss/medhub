"""
Radiology (RIS-PACS) bounded context domain models.
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel
from core.utils import generate_accession_number


class ImagingModality(models.TextChoices):
    XR = "XR", "X-Ray"
    CT = "CT", "CT Scan"
    MRI = "MRI", "MRI"
    US = "US", "Ultrasound"
    NM = "NM", "Nuclear Medicine"
    PET = "PET", "PET Scan"
    DEXA = "DEXA", "DEXA"
    FLUORO = "FLUORO", "Fluoroscopy"
    MAMMO = "MAMMO", "Mammography"


class ImagingStudyStatus(models.TextChoices):
    ORDERED = "ordered", "Ordered"
    PROTOCOLED = "protocoled", "Protocoled"
    SCHEDULED = "scheduled", "Scheduled"
    ARRIVED = "arrived", "Arrived"
    IN_PROGRESS = "in-progress", "In Progress"
    ACQUIRED = "acquired", "Acquired"
    READING = "reading", "Reading"
    REPORTED = "reported", "Reported"
    SIGNED = "signed", "Signed"
    CANCELLED = "cancelled", "Cancelled"


class ImagingOrder(TimeStampedModel):
    doctor_order = models.OneToOneField(
        "doctors.Order", on_delete=models.SET_NULL, null=True, blank=True, related_name="radiology_order"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="imaging_orders"
    )
    ordered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="imaging_orders"
    )
    modality = models.CharField(max_length=10, choices=ImagingModality.choices)
    exam_code = models.CharField(max_length=50, blank=True, null=True)
    exam_name = models.CharField(max_length=200, blank=True, null=True)
    body_part = models.CharField(max_length=200)
    indication = models.TextField(blank=True, null=True)
    clinical_history = models.TextField(blank=True, null=True)
    laterality = models.CharField(max_length=30, blank=True, null=True)
    contrast_required = models.BooleanField(default=False)
    priority = models.CharField(max_length=20, default="routine")
    status = models.CharField(
        max_length=20, choices=ImagingStudyStatus.choices, default=ImagingStudyStatus.ORDERED
    )
    accession_number = models.CharField(max_length=30, unique=True, db_index=True)
    protocoled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="protocoled_orders",
    )
    protocol_notes = models.TextField(blank=True, null=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    scheduled_room = models.CharField(max_length=50, blank=True, null=True)
    technologist = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_imaging_orders",
    )
    assigned_radiologist = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="radiology_orders",
    )
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cancelled_rad_orders",
    )

    class Meta:
        db_table = "imaging_orders"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["modality"]),
        ]

    def __str__(self):
        exam = self.exam_name or self.body_part or self.modality
        return f"{exam} - {self.patient.full_name}"

    def save(self, *args, **kwargs):
        if not self.accession_number:
            accession = generate_accession_number(self.modality or "IMG")
            while ImagingOrder.objects.filter(accession_number=accession).exclude(pk=self.pk).exists():
                accession = generate_accession_number(self.modality or "IMG")
            self.accession_number = accession
        super().save(*args, **kwargs)


class ImagingStudy(TimeStampedModel):
    order = models.OneToOneField(ImagingOrder, on_delete=models.CASCADE, related_name="study")
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="imaging_studies"
    )
    exam_date = models.DateTimeField()
    room = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=ImagingStudyStatus.choices, default=ImagingStudyStatus.ORDERED
    )
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    images_count = models.PositiveIntegerField(null=True, blank=True)
    series_count = models.PositiveIntegerField(null=True, blank=True)
    pacs_url = models.URLField(blank=True, null=True)

    class Meta:
        db_table = "imaging_studies"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        exam = self.order.exam_name if self.order_id and self.order.exam_name else "Imaging Study"
        return f"{exam} - {self.patient.full_name}"


class RadReportStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PRELIMINARY = "preliminary", "Preliminary"
    FINAL = "final", "Final"
    ADDENDUM = "addendum", "Addendum"
    VOID = "void", "Void"


class RadiologyReport(TimeStampedModel):
    study = models.OneToOneField(ImagingStudy, on_delete=models.CASCADE, related_name="report")
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="radiology_reports"
    )
    indication = models.TextField()
    technique = models.TextField(blank=True)
    comparison = models.TextField(blank=True, null=True)
    findings = models.TextField()
    impression = models.TextField()
    recommendations = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=RadReportStatus.choices, default=RadReportStatus.DRAFT)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="signed_rad_reports",
    )
    signed_at = models.DateTimeField(null=True, blank=True)
    addendum = models.TextField(blank=True, null=True)
    addendum_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="rad_report_addendums",
    )
    addendum_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "radiology_reports"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        exam = self.study.order.exam_name if self.study_id and self.study.order_id and self.study.order.exam_name else "Radiology Report"
        return f"{exam} - {self.patient.full_name}"


class RadCriticalFindingStatus(models.TextChoices):
    IDENTIFIED = "identified", "Identified"
    NOTIFIED = "notified", "Notified"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"


class RadCriticalFinding(TimeStampedModel):
    study = models.ForeignKey(ImagingStudy, on_delete=models.CASCADE, related_name="critical_findings")
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="rad_critical_findings"
    )
    finding = models.TextField()
    severity = models.CharField(max_length=30)
    identified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="identified_rad_criticals",
    )
    status = models.CharField(
        max_length=20, choices=RadCriticalFindingStatus.choices, default=RadCriticalFindingStatus.IDENTIFIED
    )
    notified_to = models.CharField(max_length=200, blank=True, null=True)
    callback_number = models.CharField(max_length=30, blank=True, null=True)
    notified_at = models.DateTimeField(null=True, blank=True)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="acknowledged_rad_criticals",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "rad_critical_findings"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"Critical finding - {self.patient.full_name}"


class ModalitySlotStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    BOOKED = "booked", "Booked"
    BLOCKED = "blocked", "Blocked"


class ModalitySchedule(TimeStampedModel):
    modality = models.CharField(max_length=10, choices=ImagingModality.choices)
    room = models.CharField(max_length=50)
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    duration_minutes = models.PositiveIntegerField()
    status = models.CharField(
        max_length=20, choices=ModalitySlotStatus.choices, default=ModalitySlotStatus.AVAILABLE
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.SET_NULL, null=True, blank=True,
    )
    exam_name = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        db_table = "modality_schedule"
        indexes = [models.Index(fields=["date", "modality", "room"])]

    def __str__(self):
        return f"{self.modality} - {self.room} - {self.date}"

