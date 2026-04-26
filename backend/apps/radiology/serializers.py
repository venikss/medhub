"""
Radiology module serializers.
"""

from rest_framework import serializers
from apps.administration.models import RadiologyCatalogItem
from core.standards import is_valid_cpt_or_local

from .models import (
    ImagingOrder,
    ImagingStudy,
    RadiologyReport,
    RadCriticalFinding,
    ModalitySchedule,
)


BODY_PART_CHOICES = [
    ("head", "Head"),
    ("neck", "Neck"),
    ("chest", "Chest"),
    ("abdomen", "Abdomen"),
    ("pelvis", "Pelvis"),
    ("spine", "Spine"),
    ("upper-extremity", "Upper Extremity"),
    ("lower-extremity", "Lower Extremity"),
    ("breast", "Breast"),
    ("whole-body", "Whole Body"),
    ("other", "Other"),
]

PRIORITY_CHOICES = [
    ("routine", "Routine"),
    ("urgent", "Urgent"),
    ("stat", "STAT"),
]

LATERALITY_CHOICES = [
    ("", "---------"),
    ("left", "Left"),
    ("right", "Right"),
    ("bilateral", "Bilateral"),
]


def get_exam_code_choices():
    catalog_items = RadiologyCatalogItem.objects.filter(is_active=True).order_by("modality", "name")
    choices = []
    for item in catalog_items:
        label = f"{item.code} - {item.name}"
        choices.append((item.code, label))
        if item.cpt_code and item.cpt_code.upper() != item.code.upper():
            choices.append((item.cpt_code, f"{item.cpt_code} - {item.name}"))
    return choices


class ImagingOrderSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id")
    orderedById = serializers.UUIDField(source="ordered_by_id", read_only=True)
    accessionNumber = serializers.CharField(source="accession_number", read_only=True)
    examCode = serializers.ChoiceField(choices=[], source="exam_code", required=False, allow_null=True, allow_blank=True)
    examName = serializers.CharField(source="exam_name", required=False, allow_null=True, allow_blank=True, read_only=True)
    bodyPart = serializers.ChoiceField(source="body_part", choices=BODY_PART_CHOICES, required=False, allow_blank=True)
    clinicalHistory = serializers.CharField(source="clinical_history", required=False, allow_null=True, allow_blank=True)
    laterality = serializers.ChoiceField(choices=LATERALITY_CHOICES, required=False, allow_blank=True)
    contrastRequired = serializers.BooleanField(source="contrast_required", required=False)
    priority = serializers.ChoiceField(choices=PRIORITY_CHOICES, required=False)
    protocolNotes = serializers.CharField(source="protocol_notes", required=False, allow_null=True, allow_blank=True)
    scheduledAt = serializers.DateTimeField(source="scheduled_at", required=False, allow_null=True)
    scheduledRoom = serializers.CharField(source="scheduled_room", required=False, allow_null=True, allow_blank=True)
    technologistId = serializers.UUIDField(source="technologist_id", required=False, allow_null=True)
    assignedRadiologistId = serializers.UUIDField(source="assigned_radiologist_id", required=False, allow_null=True)
    protocoledById = serializers.UUIDField(source="protocoled_by_id", read_only=True, allow_null=True)
    cancelledAt = serializers.DateTimeField(source="cancelled_at", read_only=True, allow_null=True)
    cancelledById = serializers.UUIDField(source="cancelled_by_id", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["examCode"].choices = get_exam_code_choices()

    class Meta:
        model = ImagingOrder
        fields = [
            "id", "patientId", "orderedById", "modality", "examCode", "examName",
            "bodyPart", "indication", "clinicalHistory", "laterality", "contrastRequired",
            "priority", "status", "accessionNumber", "protocoledById", "protocolNotes",
            "scheduledAt", "scheduledRoom", "technologistId", "assignedRadiologistId",
            "cancelledAt", "cancelledById", "createdAt", "updatedAt",
        ]
        read_only_fields = [
            "id", "orderedById", "accessionNumber", "protocoledById",
            "cancelledAt", "cancelledById", "createdAt", "updatedAt",
        ]
        extra_kwargs = {"indication": {"required": False}}

    def validate_examCode(self, value):
        if value in (None, ""):
            return value
        code = value.strip().upper()
        if not is_valid_cpt_or_local(code):
            raise serializers.ValidationError("examCode must be a valid CPT code or local exam code.")
        return code

    def validate(self, attrs):
        attrs = super().validate(attrs)
        exam_code = attrs.get("exam_code", getattr(self.instance, "exam_code", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if exam_code:
            catalog_item = RadiologyCatalogItem.objects.filter(is_active=True).filter(code__iexact=exam_code).first()
            if not catalog_item:
                catalog_item = RadiologyCatalogItem.objects.filter(is_active=True).filter(cpt_code__iexact=exam_code).first()
            if catalog_item:
                attrs.setdefault("exam_name", catalog_item.name)
                attrs.setdefault("body_part", catalog_item.body_part)
                attrs.setdefault("contrast_required", catalog_item.with_contrast)
                attrs.setdefault("modality", catalog_item.modality)
        if patient:
            summary_parts = []
            latest_encounter = patient.encounters.order_by("-created_at").first()
            if latest_encounter:
                if latest_encounter.assessment:
                    summary_parts.append(latest_encounter.assessment.strip())
                elif latest_encounter.subjective:
                    summary_parts.append(latest_encounter.subjective.strip())
            diagnoses = list(patient.diagnoses.order_by("-created_at").values_list("description", flat=True)[:3])
            if diagnoses:
                summary_parts.append("Diagnoses: " + ", ".join([d for d in diagnoses if d]))
            summary = " | ".join([part for part in summary_parts if part])
            if summary:
                attrs.setdefault("clinical_history", summary)
                attrs.setdefault("indication", summary[:500])
        if not attrs.get("body_part") and not getattr(self.instance, "body_part", None):
            raise serializers.ValidationError({"bodyPart": "bodyPart is required unless it can be derived from the selected exam code."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["orderedByName"] = instance.ordered_by.get_full_name() if hasattr(instance, "ordered_by") else None
        data["technologistName"] = instance.technologist.get_full_name() if instance.technologist_id else None
        data["assignedRadiologistName"] = instance.assigned_radiologist.get_full_name() if instance.assigned_radiologist_id else None
        data["protocoledByName"] = instance.protocoled_by.get_full_name() if instance.protocoled_by_id else None
        data["cancelledByName"] = instance.cancelled_by.get_full_name() if instance.cancelled_by_id else None
        data["mrn"] = instance.patient.mrn if hasattr(instance, "patient") else None
        data["requestedBy"] = data["orderedByName"]
        data["requestedAt"] = data.get("createdAt")
        data["bodyRegion"] = data.get("bodyPart")
        data["assignedTechnologist"] = data["technologistName"]
        data["assignedRadiologist"] = data["assignedRadiologistName"]
        data["dateOfBirth"] = instance.patient.date_of_birth.isoformat() if hasattr(instance, "patient") and instance.patient.date_of_birth else None
        data["gender"] = instance.patient.gender if hasattr(instance, "patient") else None
        data["studyId"] = str(instance.study.id) if hasattr(instance, "study") else None
        data["reportId"] = str(instance.study.report.id) if hasattr(instance, "study") and hasattr(instance.study, "report") else None
        data["department"] = getattr(getattr(instance.ordered_by, "department", None), "name", None) if hasattr(instance, "ordered_by") else None
        return data

class ImagingStudySerializer(serializers.ModelSerializer):
    orderId = serializers.UUIDField(source="order_id")
    patientId = serializers.UUIDField(source="patient_id", required=False)
    examDate = serializers.DateTimeField(source="exam_date")
    startedAt = serializers.DateTimeField(source="started_at", required=False, allow_null=True)
    completedAt = serializers.DateTimeField(source="completed_at", required=False, allow_null=True)
    imagesCount = serializers.IntegerField(source="images_count", required=False, allow_null=True)
    seriesCount = serializers.IntegerField(source="series_count", required=False, allow_null=True)
    pacsUrl = serializers.URLField(source="pacs_url", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = ImagingStudy
        fields = [
            "id", "orderId", "patientId", "examDate", "room", "status",
            "startedAt", "completedAt", "imagesCount", "seriesCount",
            "pacsUrl", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "createdAt", "updatedAt"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        order = attrs.get("order", getattr(self.instance, "order", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if order and not patient:
            attrs["patient"] = order.patient
            patient = order.patient
        if order and patient and order.patient_id != patient.id:
            raise serializers.ValidationError({"patientId": "Imaging study patient must match the selected order patient."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["accessionNumber"] = instance.order.accession_number if hasattr(instance, "order") else None
        data["examName"] = instance.order.exam_name if hasattr(instance, "order") else None
        data["mrn"] = instance.patient.mrn if hasattr(instance, "patient") else None
        data["modality"] = instance.order.modality if hasattr(instance, "order") else None
        data["priority"] = instance.order.priority if hasattr(instance, "order") else None
        data["clinicalHistory"] = instance.order.clinical_history if hasattr(instance, "order") else None
        data["reportId"] = str(instance.report.id) if hasattr(instance, "report") else None
        # examTime for frontend StudyCard
        data["examTime"] = instance.exam_date.strftime("%H:%M") if instance.exam_date else None
        # technologist / radiologist come from the linked order
        data["technologist"] = instance.order.technologist.get_full_name() if hasattr(instance, "order") and instance.order.technologist_id else None
        data["radiologist"] = instance.order.assigned_radiologist.get_full_name() if hasattr(instance, "order") and instance.order.assigned_radiologist_id else None
        data["hasCritical"] = instance.critical_findings.exists()
        return data


class RadiologyReportSerializer(serializers.ModelSerializer):
    studyId = serializers.UUIDField(source="study_id")
    patientId = serializers.UUIDField(source="patient_id", required=False)
    signedById = serializers.UUIDField(source="signed_by_id", read_only=True, allow_null=True)
    signedAt = serializers.DateTimeField(source="signed_at", read_only=True, allow_null=True)
    addendumById = serializers.UUIDField(source="addendum_by_id", read_only=True, allow_null=True)
    addendumAt = serializers.DateTimeField(source="addendum_at", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = RadiologyReport
        fields = [
            "id", "studyId", "patientId", "indication", "technique", "comparison",
            "findings", "impression", "recommendations", "status", "addendum",
            "signedById", "signedAt", "addendumById", "addendumAt", "createdAt", "updatedAt",
        ]
        read_only_fields = [
            "id", "signedById", "signedAt", "addendumById", "addendumAt", "createdAt", "updatedAt",
        ]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        study = attrs.get("study", getattr(self.instance, "study", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if study and not patient:
            attrs["patient"] = study.patient
            patient = study.patient
        if study and patient and study.patient_id != patient.id:
            raise serializers.ValidationError({"patientId": "Radiology report patient must match the selected study patient."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["isSigned"] = instance.status in ("final", "addendum")
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["mrn"] = instance.patient.mrn if hasattr(instance, "patient") else None
        data["modality"] = instance.study.order.modality if instance.study_id and instance.study.order_id else None
        data["examName"] = instance.study.order.exam_name if instance.study_id and instance.study.order_id else None
        data["orderId"] = str(instance.study.order_id) if instance.study_id and instance.study.order_id else None
        data["accessionNumber"] = instance.study.order.accession_number if instance.study_id and instance.study.order_id else None
        data["examDate"] = instance.study.exam_date.isoformat() if instance.study_id and instance.study.exam_date else None
        data["radiologist"] = instance.signed_by.get_full_name() if instance.signed_by_id else None
        data["hasCritical"] = instance.study.critical_findings.exists() if instance.study_id else False
        data["signedByName"] = instance.signed_by.get_full_name() if instance.signed_by_id else None
        data["addendumByName"] = instance.addendum_by.get_full_name() if instance.addendum_by_id else None
        return data


class RadCriticalFindingSerializer(serializers.ModelSerializer):
    studyId = serializers.UUIDField(source="study_id")
    patientId = serializers.UUIDField(source="patient_id", required=False)
    identifiedById = serializers.UUIDField(source="identified_by_id", read_only=True, allow_null=True)
    notifiedTo = serializers.CharField(source="notified_to", required=False, allow_null=True, allow_blank=True)
    callbackNumber = serializers.CharField(source="callback_number", required=False, allow_null=True, allow_blank=True)
    notifiedAt = serializers.DateTimeField(source="notified_at", read_only=True, allow_null=True)
    acknowledgedById = serializers.UUIDField(source="acknowledged_by_id", read_only=True, allow_null=True)
    acknowledgedAt = serializers.DateTimeField(source="acknowledged_at", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = RadCriticalFinding
        fields = [
            "id", "studyId", "patientId", "finding", "severity", "identifiedById",
            "status", "notifiedTo", "callbackNumber", "notifiedAt",
            "acknowledgedById", "acknowledgedAt", "createdAt",
        ]
        read_only_fields = [
            "id", "identifiedById", "notifiedAt", "acknowledgedById", "acknowledgedAt", "createdAt",
        ]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        study = attrs.get("study", getattr(self.instance, "study", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if study and not patient:
            attrs["patient"] = study.patient
            patient = study.patient
        if study and patient and study.patient_id != patient.id:
            raise serializers.ValidationError({"patientId": "Critical finding patient must match the selected study patient."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["mrn"] = instance.patient.mrn if hasattr(instance, "patient") else None
        data["status"] = "pending" if instance.status == "identified" else instance.status
        data["backendStatus"] = instance.status
        data["reportId"] = str(instance.study.report.id) if hasattr(instance, "study") and hasattr(instance.study, "report") else None
        data["identifiedAt"] = instance.created_at.isoformat() if instance.created_at else None
        data["modality"] = instance.study.order.modality if hasattr(instance, "study") and instance.study.order_id else None
        data["examName"] = instance.study.order.exam_name if hasattr(instance, "study") and instance.study.order_id else None
        data["identifiedByName"] = instance.identified_by.get_full_name() if instance.identified_by_id else None
        data["acknowledgedByName"] = instance.acknowledged_by.get_full_name() if instance.acknowledged_by_id else None
        return data


class ModalityScheduleSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id", required=False, allow_null=True)
    examName = serializers.CharField(source="exam_name", required=False, allow_null=True, allow_blank=True)
    startTime = serializers.TimeField(source="start_time")
    endTime = serializers.TimeField(source="end_time")
    durationMinutes = serializers.IntegerField(source="duration_minutes")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = ModalitySchedule
        fields = [
            "id", "modality", "room", "date", "startTime", "endTime",
            "durationMinutes", "status", "patientId", "examName", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "createdAt", "updatedAt"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if instance.patient_id else None
        # Frontend expects: available | scheduled | in-progress | completed | blocked | cancelled
        # Backend stores: available | booked | blocked
        if data["status"] == "booked":
            data["status"] = "scheduled"
        return data

