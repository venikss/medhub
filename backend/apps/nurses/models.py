"""
Nurses bounded context domain models.
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel


class Vitals(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="vitals"
    )
    systolic = models.PositiveIntegerField(null=True, blank=True)
    diastolic = models.PositiveIntegerField(null=True, blank=True)
    heart_rate = models.PositiveIntegerField(null=True, blank=True)
    temperature = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    spo2 = models.PositiveIntegerField(null=True, blank=True)
    respiratory_rate = models.PositiveIntegerField(null=True, blank=True)
    pain_score = models.PositiveIntegerField(null=True, blank=True)  # 0-10
    gcs = models.PositiveIntegerField(null=True, blank=True)  # Glasgow Coma Scale
    news2_score = models.PositiveIntegerField(null=True, blank=True)
    is_admission_vitals = models.BooleanField(
        default=False,
        help_text="True when this is the baseline vitals recorded at the time of admission.",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    notes = models.TextField(blank=True, null=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vitals"
        indexes = [
            models.Index(fields=["patient", "recorded_at"]),
        ]
        ordering = ["-recorded_at"]

    def __str__(self):
        return f"Vitals - {self.patient.full_name} - {self.recorded_at:%Y-%m-%d %H:%M}"


class IODirection(models.TextChoices):
    INTAKE = "intake", "Intake"
    OUTPUT = "output", "Output"


class IOType(models.TextChoices):
    ORAL = "oral", "Oral"
    IV = "iv", "IV"
    NG = "ng", "NG"
    BLOOD_PRODUCT = "blood-product", "Blood Product"
    IRRIGATION = "irrigation", "Irrigation"
    URINE = "urine", "Urine"
    EMESIS = "emesis", "Emesis"
    DRAIN = "drain", "Drain"
    STOOL = "stool", "Stool"
    BLOOD_LOSS = "blood-loss", "Blood Loss"


class IntakeOutput(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="io_records"
    )
    direction = models.CharField(max_length=10, choices=IODirection.choices)
    type = models.CharField(max_length=20, choices=IOType.choices)
    amount_ml = models.DecimalField(max_digits=8, decimal_places=2)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "intake_output"
        indexes = [models.Index(fields=["patient", "created_at"])]

    def __str__(self):
        return f"{self.direction.title()} - {self.patient.full_name} - {self.amount_ml} mL"


class PainAssessment(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="pain_assessments"
    )
    score = models.PositiveIntegerField()  # 0-10
    location = models.CharField(max_length=200)
    quality = models.CharField(max_length=200)
    intervention = models.TextField(blank=True, null=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        db_table = "pain_assessments"
        indexes = [models.Index(fields=["patient", "created_at"])]

    def __str__(self):
        return f"Pain {self.score}/10 - {self.patient.full_name}"


class MARStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    GIVEN = "given", "Given"
    HELD = "held", "Held"
    REFUSED = "refused", "Refused"
    MISSED = "missed", "Missed"
    NOT_APPLICABLE = "not-applicable", "Not Applicable"


class MAREntry(TimeStampedModel):
    """Medication Administration Record entry."""

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="mar_entries"
    )
    prescription = models.ForeignKey(
        "doctors.Prescription", on_delete=models.CASCADE, related_name="mar_entries"
    )
    scheduled_time = models.DateTimeField()
    status = models.CharField(max_length=20, choices=MARStatus.choices, default=MARStatus.SCHEDULED)
    administered_time = models.DateTimeField(null=True, blank=True)
    administered_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="mar_administered",
    )
    barcode = models.CharField(max_length=100, blank=True, null=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "mar_entries"
        indexes = [models.Index(fields=["patient", "scheduled_time"])]

    def __str__(self):
        return f"MAR - {self.patient.full_name} - {self.prescription.medication}"


class NoteCategory(models.TextChoices):
    ASSESSMENT = "assessment", "Assessment"
    INTERVENTION = "intervention", "Intervention"
    EDUCATION = "education", "Education"
    COMMUNICATION = "communication", "Communication"
    GENERAL = "general", "General"


class NursingNote(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="nursing_notes"
    )
    nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="nursing_notes"
    )
    category = models.CharField(max_length=30, choices=NoteCategory.choices)
    content = models.TextField()
    edit_deadline = models.DateTimeField()  # created_at + 4 hours

    class Meta:
        db_table = "nursing_notes"
        indexes = [models.Index(fields=["patient", "created_at"])]

    def __str__(self):
        return f"{self.category.title()} note - {self.patient.full_name}"


class TaskStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    IN_PROGRESS = "in-progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    OVERDUE = "overdue", "Overdue"


class Task(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="tasks"
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="assigned_tasks",
    )
    room = models.CharField(max_length=20)
    type = models.CharField(max_length=100)
    description = models.TextField()
    priority = models.CharField(max_length=20, default="normal")
    status = models.CharField(max_length=20, choices=TaskStatus.choices, default=TaskStatus.PENDING)
    due_time = models.DateTimeField()
    shift = models.CharField(max_length=20, blank=True, null=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="completed_tasks",
    )
    completed_time = models.DateTimeField(null=True, blank=True)
    completion_notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "tasks"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["assigned_to", "status"]),
            models.Index(fields=["due_time"]),
        ]

    def __str__(self):
        return f"{self.type} - {self.patient.full_name}"


class WoundType(models.TextChoices):
    PRESSURE_INJURY = "pressure-injury", "Pressure Injury"
    SURGICAL = "surgical", "Surgical"
    TRAUMATIC = "traumatic", "Traumatic"
    DIABETIC = "diabetic", "Diabetic"
    VASCULAR = "vascular", "Vascular"
    MOISTURE_ASSOCIATED = "moisture-associated", "Moisture Associated"
    OTHER = "other", "Other"


class Wound(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="wounds"
    )
    type = models.CharField(max_length=30, choices=WoundType.choices)
    location = models.CharField(max_length=200)
    stage = models.CharField(max_length=50, blank=True, null=True)
    size = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField()
    care = models.TextField()
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True
    )

    class Meta:
        db_table = "wounds"
        indexes = [models.Index(fields=["patient"])]

    def __str__(self):
        return f"{self.type} - {self.patient.full_name}"


class ShiftType(models.TextChoices):
    DAY = "day", "Day"
    EVENING = "evening", "Evening"
    NIGHT = "night", "Night"


class Handoff(TimeStampedModel):
    """SBAR handoff report."""

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="handoffs"
    )
    ward = models.ForeignKey(
        "administration.Ward", on_delete=models.SET_NULL, null=True,
    )
    room = models.CharField(max_length=20)
    situation = models.TextField()
    background = models.TextField()
    assessment = models.TextField()
    recommendation = models.TextField()
    from_nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="handoffs_given",
    )
    to_nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="handoffs_received",
    )
    shift_date = models.DateField()
    shift_type = models.CharField(max_length=10, choices=ShiftType.choices)

    class Meta:
        db_table = "handoffs"
        indexes = [models.Index(fields=["ward", "shift_date", "shift_type"])]

    def __str__(self):
        return f"Handoff - {self.patient.full_name} - {self.shift_date}"


class DischargeChecklistItem(TimeStampedModel):
    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="discharge_checklist"
    )
    item = models.CharField(max_length=200)
    category = models.CharField(max_length=100, blank=True)
    completed = models.BooleanField(default=False)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "discharge_checklist"
        indexes = [models.Index(fields=["patient"])]

    def __str__(self):
        return f"{self.item} - {self.patient.full_name}"
