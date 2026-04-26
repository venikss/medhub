"""
Doctors module serializers.
"""

from rest_framework import serializers
import simple_icd_10 as icd

from .models import Encounter, Diagnosis, Order, Prescription, Referral
from core.standards import is_valid_cpt_or_local, is_valid_rxnorm, is_valid_snomed

MEDICATION_ROUTE_CHOICES = [
    ("oral", "Oral"),
    ("iv", "IV"),
    ("im", "IM"),
    ("subcutaneous", "Subcutaneous"),
    ("topical", "Topical"),
    ("inhalation", "Inhalation"),
    ("ophthalmic", "Ophthalmic"),
    ("otic", "Otic"),
    ("rectal", "Rectal"),
    ("other", "Other"),
]


class EncounterSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id")
    doctorId = serializers.UUIDField(source="doctor_id", read_only=True)
    type = serializers.CharField(source="visit_type")
    signedAt = serializers.DateTimeField(source="signed_at", read_only=True, allow_null=True)
    signedById = serializers.UUIDField(source="signed_by_id", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)

    class Meta:
        model = Encounter
        fields = [
            "id", "patientId", "doctorId", "type", "status",
            "subjective", "objective", "assessment", "plan",
            "signedAt", "signedById", "amendments", "createdAt", "updatedAt",
        ]
        read_only_fields = ["id", "doctorId", "signedAt", "signedById", "createdAt", "updatedAt"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["isSigned"] = instance.status == "signed"
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["doctorName"] = instance.doctor.get_full_name() if hasattr(instance, "doctor") else None
        return data


class DiagnosisSerializer(serializers.ModelSerializer):
    encounterId = serializers.UUIDField(source="encounter_id", required=False, allow_null=True)
    patientId = serializers.UUIDField(source="patient_id", required=False, allow_null=True)
    icdCode = serializers.CharField(source="code")
    snomedCode = serializers.CharField(source="snomed_code", required=False, allow_null=True, allow_blank=True)
    snomedDisplay = serializers.CharField(source="snomed_display", required=False, allow_null=True, allow_blank=True)
    diagnosisType = serializers.CharField(source="type")
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Diagnosis
        fields = [
            "id", "encounterId", "patientId", "icdCode", "snomedCode", "snomedDisplay",
            "description", "diagnosisType", "status", "createdAt",
        ]
        read_only_fields = ["id", "createdAt"]

    def validate_icdCode(self, value):
        code = value.strip().upper()
        if not icd.is_valid_item(code):
            raise serializers.ValidationError("Invalid ICD-10 code.")
        return code

    def validate_snomedCode(self, value):
        if value in (None, ""):
            return value
        code = value.strip()
        if not is_valid_snomed(code):
            raise serializers.ValidationError("snomedCode must be a valid SNOMED CT concept identifier (6–18 digits).")
        return code

    def validate(self, attrs):
        attrs = super().validate(attrs)
        encounter_id = attrs.get("encounter_id", getattr(self.instance, "encounter_id", None))
        patient_id = attrs.get("patient_id", getattr(self.instance, "patient_id", None))
        if encounter_id:
            from apps.doctors.models import Encounter
            try:
                encounter = Encounter.objects.select_related("patient").get(id=encounter_id)
            except Encounter.DoesNotExist:
                raise serializers.ValidationError({"encounterId": "Encounter not found."})
            if patient_id and str(patient_id) != str(encounter.patient_id):
                raise serializers.ValidationError({"patientId": "Diagnosis patient must match the selected encounter patient."})
            attrs["patient_id"] = encounter.patient_id
        elif not patient_id:
            raise serializers.ValidationError({"patientId": "patientId is required when encounterId is not provided."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["encounterType"] = instance.encounter.visit_type if instance.encounter_id else None
        data["diagnosedById"] = str(instance.diagnosed_by_id) if instance.diagnosed_by_id else None
        data["diagnosedByName"] = instance.diagnosed_by.get_full_name() if instance.diagnosed_by_id else None
        return data


class OrderSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id", required=False, allow_null=True)
    encounterId = serializers.UUIDField(source="encounter_id", required=False, allow_null=True)
    orderedById = serializers.UUIDField(source="ordered_by_id", read_only=True)
    orderableName = serializers.CharField(source="name", required=False, allow_null=True, allow_blank=True)
    indication = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    examCode = serializers.CharField(source="exam_code", required=False, allow_null=True, allow_blank=True)
    bodyPart = serializers.CharField(source="body_part", required=False, allow_null=True, allow_blank=True)
    laterality = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    contrastRequired = serializers.BooleanField(source="contrast_required", required=False)
    clinicalHistory = serializers.CharField(source="clinical_history", required=False, allow_null=True, allow_blank=True)
    specimenType = serializers.CharField(source="specimen_type", required=False, allow_null=True, allow_blank=True)
    fastingRequired = serializers.BooleanField(source="fasting_required", required=False)
    instructions = serializers.CharField(source="notes", required=False, allow_null=True, allow_blank=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id", "patientId", "encounterId", "orderedById", "category",
            "orderableName", "indication", "examCode", "bodyPart", "laterality",
            "contrastRequired", "clinicalHistory", "specimenType", "fastingRequired",
            "priority", "status", "instructions",
            "results", "completedAt", "createdAt",
        ]
        read_only_fields = ["id", "orderedById", "completedAt", "createdAt"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        encounter_id = attrs.get("encounter_id", getattr(self.instance, "encounter_id", None))
        encounter = attrs.get("encounter", getattr(self.instance, "encounter", None))
        patient_id = attrs.get("patient_id", getattr(self.instance, "patient_id", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if encounter or encounter_id:
            pass  # encounter provides implicit patient; FK integrity enforced by DB
        elif not patient and not patient_id:
            raise serializers.ValidationError({"patientId": "patientId is required when encounterId is not provided."})
        category = attrs.get("category", getattr(self.instance, "category", None))
        exam_code = attrs.get("exam_code", getattr(self.instance, "exam_code", None))
        order_name = attrs.get("name", getattr(self.instance, "name", None))
        body_part = attrs.get("body_part", getattr(self.instance, "body_part", None))
        if category == "imaging" and exam_code:
            from apps.administration.models import RadiologyCatalogItem

            catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, code__iexact=exam_code).first()
            if not catalog_item:
                catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, cpt_code__iexact=exam_code).first()
            if catalog_item:
                attrs.setdefault("name", catalog_item.name)
                attrs.setdefault("body_part", catalog_item.body_part)
                attrs.setdefault("contrast_required", catalog_item.with_contrast)
                order_name = attrs.get("name", order_name)
                body_part = attrs.get("body_part", body_part)
        if category == "imaging" and not (exam_code or order_name):
            raise serializers.ValidationError(
                {"examCode": "examCode is required for imaging orders when no orderableName is provided."}
            )
        if category == "lab" and not order_name:
            raise serializers.ValidationError(
                {"orderableName": "orderableName is required for laboratory orders."}
            )
        if category == "imaging" and not body_part:
            raise serializers.ValidationError({"bodyPart": "Body part is required for imaging orders."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["orderedByName"] = instance.ordered_by.get_full_name() if hasattr(instance, "ordered_by") else None
        return data


class PrescriptionSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id", required=False, allow_null=True)
    encounterId = serializers.UUIDField(source="encounter_id", required=False, allow_null=True)
    prescribedById = serializers.UUIDField(source="prescribed_by_id", read_only=True)
    medicationName = serializers.CharField(source="medication")
    rxnormCode = serializers.CharField(source="rxnorm_code", required=False, allow_null=True, allow_blank=True)
    dose = serializers.CharField(source="dosage")
    route = serializers.ChoiceField(choices=MEDICATION_ROUTE_CHOICES)
    quantity = serializers.IntegerField()
    refillsAllowed = serializers.IntegerField(source="refills")
    instructions = serializers.CharField(source="sig")
    startDate = serializers.DateField(source="start_date")
    endDate = serializers.DateField(source="end_date", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Prescription
        fields = [
            "id", "patientId", "encounterId", "prescribedById", "medicationName",
            "generic_name", "rxnormCode", "dose", "route", "frequency", "quantity", "refillsAllowed",
            "instructions", "startDate", "endDate", "status", "createdAt",
        ]
        read_only_fields = ["id", "prescribedById", "createdAt"]

    def validate_rxnormCode(self, value):
        if value in (None, ""):
            return value
        code = value.strip()
        if not is_valid_rxnorm(code):
            raise serializers.ValidationError("Invalid RxNorm code.")
        return code

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # UUIDField with source="encounter_id"/"patient_id" stores values under those keys,
        # not under "encounter"/"patient" (which would require PrimaryKeyRelatedField).
        encounter_id = attrs.get("encounter_id", getattr(self.instance, "encounter_id", None))
        encounter = attrs.get("encounter", getattr(self.instance, "encounter", None))
        patient_id = attrs.get("patient_id", getattr(self.instance, "patient_id", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if encounter or encounter_id:
            pass  # encounter provides implicit patient; FK integrity enforced by DB
        elif not patient and not patient_id:
            raise serializers.ValidationError({"patientId": "patientId is required when encounterId is not provided."})
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than 0."})
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"endDate": "End date cannot be before start date."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["prescribedByName"] = instance.prescribed_by.get_full_name() if hasattr(instance, "prescribed_by") else None
        data["genericName"] = instance.generic_name or None
        data["displayMedicationName"] = instance.medication
        return data


class ReferralSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id")
    referringDoctorId = serializers.UUIDField(source="referring_doctor_id", read_only=True)
    referredToId = serializers.UUIDField(source="to_doctor_id", required=False, allow_null=True)
    referredToDepartmentId = serializers.UUIDField(source="to_department_id", required=False, allow_null=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = Referral
        fields = [
            "id", "patientId", "referringDoctorId", "referredToId",
            "referredToDepartmentId", "reason", "urgency", "status", "createdAt",
        ]
        read_only_fields = ["id", "referringDoctorId", "createdAt"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["patientName"] = instance.patient.full_name if hasattr(instance, "patient") else None
        data["referringDoctorName"] = instance.referring_doctor.get_full_name() if hasattr(instance, "referring_doctor") else None
        data["referredToName"] = instance.to_doctor.get_full_name() if instance.to_doctor_id else None
        data["referredToDepartmentName"] = instance.to_department.name if instance.to_department_id else None
        return data
