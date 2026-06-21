"""
CDSS (Clinical Decision Support System) bounded context domain models.
Hospital-wide system. All clinical roles.
"""

import uuid
from django.db import models
from django.conf import settings
from core.models import TimeStampedModel

class CDSSSourceModule(models.TextChoices):
    DOCTOR = "doctor", "Doctor"
    NURSING = "nursing", "Nursing"
    LAB = "lab", "Lab"
    PHARMACY = "pharmacy", "Pharmacy"
    RADIOLOGY = "radiology", "Radiology"
    EMERGENCY = "emergency", "Emergency"
    SURGERY = "surgery", "Surgery"
    SYSTEM = "system", "System"

class CDSSRecommendationType(models.TextChoices):
    DRUG_INTERACTION = "drug_interaction", "Drug Interaction"
    ALLERGY = "allergy", "Allergy"
    DOSAGE_WARNING = "dosage_warning", "Dosage Warning"
    DUPLICATE_THERAPY = "duplicate_therapy", "Duplicate Therapy"
    CONTRAINDICATION = "contraindication", "Contraindication"
    GUIDELINE = "guideline", "Guideline"
    ORDER_SET = "order_set", "Order Set"
    APPROPRIATENESS_CHECK = "appropriateness_check", "Appropriateness Check"
    DIAGNOSTIC = "diagnostic", "Diagnostic"
    ABNORMAL_RESULT = "abnormal_result", "Abnormal Result"
    PANIC_VALUE = "panic_value", "Panic Value"
    DELTA_CHECK = "delta_check", "Delta Check"
    CRITICAL_RESULT = "critical_result", "Critical Result"
    PREVENTIVE = "preventive", "Preventive"
    CARE_GAP = "care_gap", "Care Gap"
    FOLLOW_UP_REMINDER = "follow_up_reminder", "Follow-up Reminder"
    DETERIORATION_ALERT = "deterioration_alert", "Deterioration Alert"
    OVERDUE_TASK = "overdue_task", "Overdue Task"
    RISK_SCORE = "risk_score", "Risk Score"
    URGENT_FINDING = "urgent_finding", "Urgent Finding"
    TRIAGE_SUPPORT = "triage_support", "Triage Support"
    SEPSIS_ALERT = "sepsis_alert", "Sepsis Alert"
    TRAUMA_ALERT = "trauma_alert", "Trauma Alert"
    PERIOPERATIVE_WARNING = "perioperative_warning", "Perioperative Warning"
    CHECKLIST_GAP = "checklist_gap", "Checklist Gap"
    CARE_PLAN_DEVIATION = "care_plan_deviation", "Care Plan Deviation"

class CDSSSeverity(models.TextChoices):
    CRITICAL = "critical", "Critical"
    WARNING = "warning", "Warning"
    INFO = "info", "Info"

class CDSSOutputKind(models.TextChoices):
    ALERT = "alert", "Alert"
    RECOMMENDATION = "recommendation", "Recommendation"

class CDSSStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    ACKNOWLEDGED = "acknowledged", "Acknowledged"
    OVERRIDDEN = "overridden", "Overridden"
    DISMISSED = "dismissed", "Dismissed"
    EXPIRED = "expired", "Expired"
    FOLLOWED = "followed", "Followed"

class CDSSConsultRequestStatus(models.TextChoices):
    OPEN = "open", "Open"
    ANSWERED = "answered", "Answered"
    CANCELLED = "cancelled", "Cancelled"

class OntologyCodeSystem(models.TextChoices):
    ICD10 = "icd10", "ICD-10"
    SNOMED_CT = "snomed_ct", "SNOMED CT"
    RXNORM = "rxnorm", "RxNorm"
    LOINC = "loinc", "LOINC"

class OntologyDomain(models.TextChoices):
    CONDITION = "condition", "Condition"
    SYMPTOM = "symptom", "Symptom"
    MEDICATION = "medication", "Medication"
    LAB_TEST = "lab_test", "Lab Test"
    PROCEDURE = "procedure", "Procedure"
    ALLERGY = "allergy", "Allergy"

class MedicalOntologyConcept(TimeStampedModel):
    """
    Canonical terminology row used across modules.
    Keeps ICD-10 / SNOMED / RxNorm / LOINC concepts in one place.
    """

    id = models.BigAutoField(primary_key=True)
    code_system = models.CharField(max_length=20, choices=OntologyCodeSystem.choices)
    code = models.CharField(max_length=64)
    display = models.CharField(max_length=300)
    domain = models.CharField(max_length=30, choices=OntologyDomain.choices)
    normalized_display = models.CharField(max_length=300, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "medical_ontology_concepts"
        indexes = [
            models.Index(fields=["code_system", "domain"]),
            models.Index(fields=["domain", "display"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["code_system", "code"],
                name="uniq_medical_ontology_code_system_code",
            )
        ]

    def __str__(self):
        return f"{self.get_code_system_display()} {self.code} - {self.display}"

    def save(self, *args, **kwargs):
        if self.display:
            self.normalized_display = self.display.strip().lower()
        super().save(*args, **kwargs)

class MedicalOntologyMapping(TimeStampedModel):
    """
    Bridges local app data and canonical concepts.
    Example:
    - doctors diagnosis code/display -> SNOMED + ICD-10 concept rows
    - prescription medication name -> RxNorm concept row
    """

    id = models.BigAutoField(primary_key=True)
    source_module = models.CharField(max_length=30, choices=CDSSSourceModule.choices)
    domain = models.CharField(max_length=30, choices=OntologyDomain.choices)
    local_code = models.CharField(max_length=64, blank=True, null=True)
    local_display = models.CharField(max_length=300)
    normalized_local_display = models.CharField(max_length=300, blank=True)
    concept = models.ForeignKey(
        "cdss.MedicalOntologyConcept",
        on_delete=models.CASCADE,
        related_name="mappings",
    )
    is_primary = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "medical_ontology_mappings"
        indexes = [
            models.Index(fields=["source_module", "domain"]),
            models.Index(fields=["domain", "local_code"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["source_module", "domain", "local_code", "concept"],
                name="uniq_ontology_mapping_local_code_concept",
            )
        ]

    def __str__(self):
        return f"{self.local_display} -> {self.concept}"

    def save(self, *args, **kwargs):
        if self.local_display:
            self.normalized_local_display = self.local_display.strip().lower()
        super().save(*args, **kwargs)

class CDSSConsultRequest(TimeStampedModel):
    """Doctor-initiated question/request sent to the CDSS engine."""

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="cdss_consult_requests"
    )
    encounter = models.ForeignKey(
        "doctors.Encounter", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cdss_consult_requests",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cdss_consult_requests",
    )
    clinical_question = models.TextField()
    context_notes = models.TextField(blank=True, null=True)
    status = models.CharField(
        max_length=20, choices=CDSSConsultRequestStatus.choices, default=CDSSConsultRequestStatus.OPEN
    )
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "cdss_consult_requests"
        verbose_name = "CDSS Support Request"
        verbose_name_plural = "CDSS Support Requests"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self):
        return f"CDSS request for {self.patient.full_name}"

class CDSSRecommendation(TimeStampedModel):
    """
    CDSS recommendation / alert aggregate.
    targetRoles is a Postgres array of role strings.
    """

    patient = models.ForeignKey(
        "patients.Patient", on_delete=models.CASCADE, related_name="cdss_recommendations"
    )
    encounter = models.ForeignKey(
        "doctors.Encounter", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="cdss_recommendations",
    )
    consult_request = models.ForeignKey(
        "cdss.CDSSConsultRequest", on_delete=models.SET_NULL, null=True, blank=True,
        related_name="generated_recommendations",
    )
    source_module = models.CharField(max_length=30, choices=CDSSSourceModule.choices)
    target_roles = models.JSONField(default=list)
    output_kind = models.CharField(
        max_length=20, choices=CDSSOutputKind.choices, default=CDSSOutputKind.ALERT
    )
    type = models.CharField(max_length=50, choices=CDSSRecommendationType.choices)
    severity = models.CharField(max_length=20, choices=CDSSSeverity.choices)
    status = models.CharField(max_length=20, choices=CDSSStatus.choices, default=CDSSStatus.ACTIVE)
    title = models.CharField(max_length=300)
    summary = models.TextField()
    triggered_by = models.CharField(max_length=200)
    snomed_code = models.CharField(max_length=20, blank=True, null=True)
    snomed_display = models.CharField(max_length=300, blank=True, null=True)
    affected_medications = models.JSONField(default=list)
    suggested_actions = models.JSONField(default=list)

    explanation = models.JSONField(default=dict)

    evidence_sources = models.JSONField(default=list)

    generated_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True)

    override_reason = models.TextField(blank=True, null=True)
    override_reason_category = models.CharField(max_length=100, blank=True, null=True)
    overridden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="overridden_recommendations",
    )
    overridden_at = models.DateTimeField(null=True, blank=True)

    acknowledged_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
        related_name="acknowledged_recommendations",
    )
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    feedback_rating = models.PositiveIntegerField(null=True, blank=True)
    feedback_comment = models.TextField(blank=True, null=True)

    class Meta:
        db_table = "cdss_recommendations"
        verbose_name = "CDSS Insight"
        verbose_name_plural = "CDSS Insights"
        indexes = [
            models.Index(fields=["patient", "status"]),
            models.Index(fields=["severity", "status"]),
            models.Index(fields=["type"]),
            models.Index(fields=["output_kind"]),
        ]

    def __str__(self):
        return f"{self.title} - {self.patient.full_name}"

class CDSSResponseAction(models.TextChoices):
    OVERRIDE = "override", "Override"
    ACKNOWLEDGE = "acknowledge", "Acknowledge"
    DISMISS = "dismiss", "Dismiss"
    FOLLOW = "follow", "Follow"

class CDSSOverrideRecord(TimeStampedModel):
    """Immutable — records every CDSS response action."""

    recommendation = models.ForeignKey(
        CDSSRecommendation, on_delete=models.CASCADE, related_name="override_records"
    )
    action = models.CharField(max_length=20, choices=CDSSResponseAction.choices)
    reason_category = models.CharField(max_length=100, blank=True)
    reason = models.TextField()
    notes = models.TextField(blank=True, null=True)
    clinician_name = models.CharField(max_length=200)
    clinician_role = models.CharField(max_length=30)
    source_module = models.CharField(max_length=30, blank=True, null=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "cdss_override_records"
        verbose_name = "CDSS Alert Response"
        verbose_name_plural = "CDSS Alert Responses"

    def __str__(self):
        return f"{self.action} - {self.recommendation.title}"

    def delete(self, *args, **kwargs):
        raise PermissionError("CDSS override records are immutable.")

    def save(self, *args, **kwargs):
        if self.pk and CDSSOverrideRecord.objects.filter(pk=self.pk).exists():
            raise PermissionError("CDSS override records are immutable.")
        super().save(*args, **kwargs)
