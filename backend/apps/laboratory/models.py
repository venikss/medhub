"""
Laboratory (LIS) bounded context domain models.
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel
from core.utils import generate_barcode, generate_accession_number

class SpecimenType(models.TextChoices):
    BLOOD = "blood", "Blood"
    SERUM = "serum", "Serum"
    PLASMA = "plasma", "Plasma"
    URINE = "urine", "Urine"
    CSF = "csf", "CSF"
    STOOL = "stool", "Stool"
    SWAB = "swab", "Swab"
    TISSUE = "tissue", "Tissue"
    OTHER = "other", "Other"

class SpecimenStatus(models.TextChoices):
    ORDERED = "ordered", "Ordered"
    COLLECTED = "collected", "Collected"
    IN_TRANSIT = "in-transit", "In Transit"
    RECEIVED = "received", "Received"
    PROCESSING = "processing", "Processing"
    ANALYZED = "analyzed", "Analyzed"
    RESULTED = "resulted", "Resulted"
    REJECTED = "rejected", "Rejected"
    RECOLLECT = "recollect", "Recollect Required"

class SpecimenCondition(models.TextChoices):
    ACCEPTABLE = "acceptable", "Acceptable"
    HEMOLYZED = "hemolyzed", "Hemolyzed"
    LIPEMIC = "lipemic", "Lipemic"
    ICTERIC = "icteric", "Icteric"
    CLOTTED = "clotted", "Clotted"
    INSUFFICIENT = "insufficient", "Insufficient"
    WRONG_TUBE = "wrong-tube", "Wrong Tube"

class Specimen(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="specimens"
    )
    order = models.ForeignKey(
        "doctors.Order", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="specimens",
    )
    collected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="collected_specimens",
    )
    type = models.CharField(max_length=20, choices=SpecimenType.choices)
    tube_type = models.CharField(max_length=100, blank=True, null=True)
    volume = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True)
    storage_location = models.CharField(max_length=200, blank=True, null=True)
    status = models.CharField(max_length=20, choices=SpecimenStatus.choices, default=SpecimenStatus.ORDERED)
    condition = models.CharField(max_length=20, choices=SpecimenCondition.choices, blank=True, null=True)
    collected_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="received_specimens",
    )
    rejection_reason = models.TextField(blank=True, null=True)
    recollect_reason = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "specimens"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status"]),
        ]

    def save(self, *args, **kwargs):
        if not self.barcode:
            barcode = generate_barcode("SPC")
            while Specimen.objects.filter(barcode=barcode).exclude(pk=self.pk).exists():
                barcode = generate_barcode("SPC")
            self.barcode = barcode
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.type} specimen - {self.patient.full_name}"

class Accession(TimeStampedModel):
    accession_number = models.CharField(max_length=30, unique=True, db_index=True)
    specimen = models.OneToOneField(Specimen, on_delete=models.CASCADE, related_name="accession")
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="accessioned_specimens",
    )
    condition = models.CharField(max_length=20, choices=SpecimenCondition.choices)
    test_names = models.JSONField(default=list)

    class Meta:
        db_table = "accessions"

    def save(self, *args, **kwargs):
        if not self.accession_number:
            accession = generate_accession_number("LAB")
            while Accession.objects.filter(accession_number=accession).exclude(pk=self.pk).exists():
                accession = generate_accession_number("LAB")
            self.accession_number = accession
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.accession_number} - {self.specimen.patient.full_name}"

class AnalyzerQueueStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in-progress", "In Progress"
    COMPLETED = "completed", "Completed"
    ERROR = "error", "Error"

class AnalyzerQueue(TimeStampedModel):
    specimen = models.ForeignKey(Specimen, on_delete=models.CASCADE, related_name="analyzer_queue_entries")
    instrument = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20, choices=AnalyzerQueueStatus.choices, default=AnalyzerQueueStatus.PENDING
    )
    estimated_minutes = models.PositiveIntegerField(default=30)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    error_message = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "analyzer_queue"
        indexes = [models.Index(fields=["status"])]

    def __str__(self):
        return f"{self.instrument} - {self.specimen.patient.full_name}"

class LabResultFlag(models.TextChoices):
    NORMAL = "normal", "Normal"
    HIGH = "high", "High"
    LOW = "low", "Low"
    CRITICAL_HIGH = "critical-high", "Critical High"
    CRITICAL_LOW = "critical-low", "Critical Low"

class LabResultStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PRELIMINARY = "preliminary", "Preliminary"
    FINAL = "final", "Final"
    VERIFIED = "verified", "Verified"
    CORRECTED = "corrected", "Corrected"
    CANCELLED = "cancelled", "Cancelled"

class LabPanelStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in-progress", "In Progress"
    RESULTED = "resulted", "Resulted"
    VERIFIED = "verified", "Verified"
    RELEASED = "released", "Released"

class LabPanel(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="lab_panels"
    )
    order = models.ForeignKey(
        "doctors.Order", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="lab_panels",
    )
    specimen = models.ForeignKey(Specimen, on_delete=models.CASCADE, related_name="panels")
    name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=LabPanelStatus.choices, default=LabPanelStatus.PENDING)
    priority = models.CharField(max_length=20, default="routine")
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="verified_panels",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    has_critical = models.BooleanField(default=False)

    class Meta:
        db_table = "lab_panels"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"{self.name} - {self.patient.full_name}"

class LabTestResult(TimeStampedModel):
    panel = models.ForeignKey(LabPanel, on_delete=models.CASCADE, related_name="results")
    specimen = models.ForeignKey(Specimen, on_delete=models.SET_NULL, null=True, blank=True)
    test_code = models.CharField(max_length=50)
    test_name = models.CharField(max_length=200)
    value = models.CharField(max_length=200)
    unit = models.CharField(max_length=50, blank=True)
    reference_range = models.CharField(max_length=100, blank=True)
    flag = models.CharField(max_length=20, choices=LabResultFlag.choices, blank=True, null=True)
    is_critical = models.BooleanField(default=False)
    previous_value = models.CharField(max_length=200, blank=True, null=True)
    delta = models.CharField(max_length=100, blank=True, null=True)
    delta_flag = models.CharField(max_length=20, blank=True, null=True)
    method = models.CharField(max_length=100, blank=True, null=True)
    comment = models.TextField(blank=True, null=True)
    analyzed_at = models.DateTimeField(null=True, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="verified_results",
    )
    verified_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(
        max_length=20, choices=LabResultStatus.choices, default=LabResultStatus.PENDING
    )

    class Meta:
        db_table = "lab_test_results"
        indexes = [
            models.Index(fields=["panel", "flag"]),
            models.Index(fields=["is_critical"]),
        ]

    def save(self, *args, **kwargs):
        if self.flag in (LabResultFlag.CRITICAL_HIGH, LabResultFlag.CRITICAL_LOW):
            self.is_critical = True
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.test_name} - {self.panel.patient.full_name}"

class LabReportStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    PRELIMINARY = "preliminary", "Preliminary"
    FINAL = "final", "Final"
    RELEASED = "released", "Released"
    CORRECTED = "corrected", "Corrected"
    AMENDED = "amended", "Amended"

class LabReport(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="lab_reports"
    )
    panel = models.OneToOneField(LabPanel, on_delete=models.CASCADE, related_name="report")
    has_critical = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20, choices=LabReportStatus.choices, default=LabReportStatus.PENDING
    )
    notes = models.TextField(blank=True, null=True)
    released_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="released_lab_reports",
    )
    released_at = models.DateTimeField(null=True, blank=True)
    corrected_at = models.DateTimeField(null=True, blank=True)
    correction_note = models.TextField(blank=True, null=True)
    attachment_url = models.URLField(blank=True, null=True)
    attachment_id = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "lab_reports"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"Lab report - {self.patient.full_name}"

class CriticalValueStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    NOTIFIED = "notified", "Notified"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"

class CriticalValue(TimeStampedModel):
    result = models.OneToOneField(
        LabTestResult, on_delete=models.CASCADE, related_name="critical_value"
    )
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="critical_values"
    )
    test_name = models.CharField(max_length=200)
    value = models.CharField(max_length=200)
    unit = models.CharField(max_length=50, blank=True)
    status = models.CharField(
        max_length=20, choices=CriticalValueStatus.choices, default=CriticalValueStatus.PENDING
    )
    notified_to = models.CharField(max_length=200, blank=True, null=True)
    notified_at = models.DateTimeField(null=True, blank=True)
    notification_method = models.CharField(max_length=50, blank=True, null=True)
    callback_time = models.DateTimeField(null=True, blank=True)
    readback_provided = models.BooleanField(default=False)
    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="acknowledged_critical_values",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "critical_values"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"Critical {self.test_name} - {self.patient.full_name}"
