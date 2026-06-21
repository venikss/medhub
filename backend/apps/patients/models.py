"""
Patients bounded context domain models.
"""

import uuid
from django.db import models
from django.conf import settings
from django.core.validators import RegexValidator
from core.models import SoftDeleteModel, TimeStampedModel
from core.utils import generate_mrn, generate_queue_ticket

class Gender(models.TextChoices):
    MALE = "male", "Male"
    FEMALE = "female", "Female"
    OTHER = "other", "Other"
    PREFER_NOT_TO_SAY = "prefer_not_to_say", "Prefer not to say"

class BloodType(models.TextChoices):
    A_POS = "A+", "A+"
    A_NEG = "A-", "A-"
    B_POS = "B+", "B+"
    B_NEG = "B-", "B-"
    AB_POS = "AB+", "AB+"
    AB_NEG = "AB-", "AB-"
    O_POS = "O+", "O+"
    O_NEG = "O-", "O-"

class PatientStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ADMITTED = "admitted", "Admitted"
    DISCHARGED = "discharged", "Discharged"
    CRITICAL = "critical", "Critical"
    STABLE = "stable", "Stable"

class MaritalStatus(models.TextChoices):
    SINGLE = "single", "Single"
    MARRIED = "married", "Married"
    DIVORCED = "divorced", "Divorced"
    WIDOWED = "widowed", "Widowed"

class PreferredLanguage(models.TextChoices):
    ARABIC = "arabic", "Arabic"
    ENGLISH = "english", "English"
    FRENCH = "french", "French"
    OTHER = "other", "Other"

class Patient(SoftDeleteModel):
    """Patient aggregate root with ADT fields."""

    mrn = models.CharField(max_length=30, unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=20, choices=Gender.choices)
    phone = models.CharField(
        max_length=30,
        validators=[RegexValidator(r"^[0-9+\-\s()]{7,20}$", "Enter a valid phone number.")],
    )
    email = models.EmailField(blank=True, null=True)
    address = models.JSONField(default=dict, blank=True)
    blood_type = models.CharField(max_length=5, choices=BloodType.choices, blank=True, null=True)
    allergies = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=PatientStatus.choices, default=PatientStatus.ACTIVE)
    avatar = models.URLField(blank=True, null=True)

    insurance_provider = models.CharField(max_length=200, blank=True, null=True)
    insurance_id = models.CharField(max_length=100, blank=True, null=True)

    admission_date = models.DateTimeField(null=True, blank=True)
    assigned_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="assigned_patients",
    )
    ward = models.ForeignKey(
        "administration.Ward", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="current_patients",
    )
    room_number = models.CharField(max_length=20, blank=True, null=True)

    nationality = models.CharField(max_length=100, blank=True, null=True)
    marital_status = models.CharField(max_length=30, choices=MaritalStatus.choices, blank=True, null=True)
    preferred_language = models.CharField(max_length=50, choices=PreferredLanguage.choices, blank=True, null=True)
    consent_signed = models.BooleanField(default=False)
    registered_at = models.DateTimeField(auto_now_add=True)

    emergency_contact = models.JSONField(default=dict, blank=True)
    insurance_details = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "patients"
        indexes = [
            models.Index(fields=["mrn"]),
            models.Index(fields=["last_name", "first_name"]),
            models.Index(fields=["status"]),
            models.Index(fields=["date_of_birth"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.mrn})"

    def save(self, *args, **kwargs):
        if not self.mrn:
            mrn = generate_mrn()
            while Patient.objects.filter(mrn=mrn).exclude(pk=self.pk).exists():
                mrn = generate_mrn()
            self.mrn = mrn
        super().save(*args, **kwargs)

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

class AdmissionType(models.TextChoices):
    INPATIENT = "inpatient", "Inpatient"
    OUTPATIENT = "outpatient", "Outpatient"
    EMERGENCY = "emergency", "Emergency"
    OBSERVATION = "observation", "Observation"

class AdmissionStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    DISCHARGED = "discharged", "Discharged"
    TRANSFERRED = "transferred", "Transferred"
    CANCELLED = "cancelled", "Cancelled"

class Admission(TimeStampedModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="admissions")
    type = models.CharField(max_length=20, choices=AdmissionType.choices)
    status = models.CharField(max_length=20, choices=AdmissionStatus.choices, default=AdmissionStatus.ACTIVE)
    admitting_doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
        related_name="admitted_patients",
    )
    department = models.ForeignKey(
        "administration.Department", on_delete=models.SET_NULL, null=True,
    )
    ward = models.ForeignKey(
        "administration.Ward", on_delete=models.SET_NULL, null=True, blank=True,
    )
    bed = models.ForeignKey(
        "administration.Bed", on_delete=models.SET_NULL, null=True, blank=True,
    )
    reason_for_admission = models.TextField()
    expected_discharge = models.DateTimeField(null=True, blank=True)
    admitted_at = models.DateTimeField(auto_now_add=True)
    discharged_at = models.DateTimeField(null=True, blank=True)
    discharge_type = models.CharField(max_length=50, blank=True, null=True)
    discharge_summary = models.TextField(blank=True, null=True)
    follow_up_date = models.DateField(null=True, blank=True)
    discharged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="discharged_admissions",
    )

    class Meta:
        db_table = "admissions"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["admitted_at"]),
        ]

    def __str__(self):
        return f"Admission - {self.patient.full_name} [{self.status}]"

class AdmissionTransfer(TimeStampedModel):
    admission = models.ForeignKey(Admission, on_delete=models.CASCADE, related_name="transfers")
    from_ward = models.ForeignKey(
        "administration.Ward", on_delete=models.SET_NULL, null=True,
        related_name="transfers_from",
    )
    from_bed = models.ForeignKey(
        "administration.Bed", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="transfers_from_bed",
    )
    to_ward = models.ForeignKey(
        "administration.Ward", on_delete=models.SET_NULL, null=True,
        related_name="transfers_to",
    )
    to_bed = models.ForeignKey(
        "administration.Bed", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="transfers_to_bed",
    )
    reason = models.TextField()
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True,
    )
    transferred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admission_transfers"

    def __str__(self):
        return f"Transfer - {self.admission.patient.full_name}"

class QueueStatus(models.TextChoices):
    WAITING = "waiting", "Waiting"
    CALLED = "called", "Called"
    SERVING = "serving", "Serving"
    COMPLETED = "completed", "Completed"
    NO_SHOW = "no-show", "No Show"

class QueuePriority(models.TextChoices):
    NORMAL = "normal", "Normal"
    URGENT = "urgent", "Urgent"
    EMERGENCY = "emergency", "Emergency"

class Queue(TimeStampedModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="queue_tickets")
    service = models.CharField(max_length=100)
    priority = models.CharField(max_length=20, choices=QueuePriority.choices, default=QueuePriority.NORMAL)
    status = models.CharField(max_length=20, choices=QueueStatus.choices, default=QueueStatus.WAITING)
    ticket_number = models.CharField(max_length=20)
    window = models.CharField(max_length=20, blank=True, null=True)
    queue_date = models.DateField(auto_now_add=True)
    called_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "queue"
        indexes = [
            models.Index(fields=["queue_date", "status"]),
            models.Index(fields=["service"]),
        ]

    def save(self, *args, **kwargs):
        if not self.ticket_number:
            ticket = generate_queue_ticket()
            while Queue.objects.filter(ticket_number=ticket, queue_date=self.queue_date).exclude(pk=self.pk).exists():
                ticket = generate_queue_ticket()
            self.ticket_number = ticket
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.ticket_number} - {self.patient.full_name}"

class AppointmentStatus(models.TextChoices):
    SCHEDULED = "scheduled", "Scheduled"
    IN_PROGRESS = "in-progress", "In Progress"
    COMPLETED = "completed", "Completed"
    CANCELLED = "cancelled", "Cancelled"
    NO_SHOW = "no-show", "No Show"

class Appointment(SoftDeleteModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="appointments")
    doctor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="appointments",
    )
    department = models.ForeignKey(
        "administration.Department", on_delete=models.SET_NULL, null=True,
    )
    date = models.DateField()
    time = models.TimeField()
    duration = models.PositiveIntegerField(default=30)
    type = models.CharField(max_length=50)
    status = models.CharField(
        max_length=20, choices=AppointmentStatus.choices, default=AppointmentStatus.SCHEDULED
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "appointments"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["doctor", "date"]),
            models.Index(fields=["date", "status"]),
        ]

    def __str__(self):
        return f"Appointment - {self.patient.full_name} - {self.date}"

class ConsentStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    SIGNED = "signed", "Signed"
    DECLINED = "declined", "Declined"

class Consent(TimeStampedModel):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="consents")
    type = models.CharField(max_length=100)
    status = models.CharField(max_length=20, choices=ConsentStatus.choices, default=ConsentStatus.PENDING)
    signed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    )
    signed_at = models.DateTimeField(null=True, blank=True)
    file_url = models.URLField(blank=True, null=True)
    file_id = models.CharField(max_length=100, blank=True, null=True)

    class Meta:
        db_table = "consents"
        indexes = [models.Index(fields=["patient", "status"])]

    def __str__(self):
        return f"{self.type} - {self.patient.full_name}"
