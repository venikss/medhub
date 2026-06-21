"""
Nurses module serializers — fixed to match actual model fields.
"""

from django.utils import timezone
from rest_framework import serializers
from .models import (
    Vitals, IntakeOutput, PainAssessment, MAREntry,
    NursingNote, Task, Wound, Handoff, DischargeChecklistItem,
)

def mar_status_for_api(instance):
    if instance.status == "scheduled" and instance.scheduled_time and instance.scheduled_time < timezone.now():
        return "overdue"
    return instance.status

class VitalsSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vitals
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "recorded_by", "news2_score", "recorded_at"]

    def validate_systolic(self, value):
        if value is not None and not (20 <= value <= 400):
            raise serializers.ValidationError("Systolic BP must be between 20 and 400 mmHg.")
        return value

    def validate_diastolic(self, value):
        if value is not None and not (5 <= value <= 300):
            raise serializers.ValidationError("Diastolic BP must be between 5 and 300 mmHg.")
        return value

    def validate_heart_rate(self, value):
        if value is not None and not (5 <= value <= 400):
            raise serializers.ValidationError("Heart rate must be between 5 and 400 bpm.")
        return value

    def validate_temperature(self, value):
        if value is not None and not (20.0 <= float(value) <= 50.0):
            raise serializers.ValidationError("Temperature must be between 20°C and 50°C.")
        return value

    def validate_spo2(self, value):
        if value is not None and not (1 <= value <= 100):
            raise serializers.ValidationError("SpO₂ must be between 1% and 100%.")
        return value

    def validate_respiratory_rate(self, value):
        if value is not None and not (0 <= value <= 100):
            raise serializers.ValidationError("Respiratory rate must be between 0 and 100 breaths/min.")
        return value

    def validate_pain_score(self, value):
        if value is not None and not (0 <= value <= 10):
            raise serializers.ValidationError("Pain score must be between 0 and 10.")
        return value

    def validate_gcs(self, value):
        if value is not None and not (3 <= value <= 15):
            raise serializers.ValidationError("GCS must be between 3 and 15.")
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        systolic = attrs.get("systolic")
        diastolic = attrs.get("diastolic")
        if systolic is not None and diastolic is not None and diastolic >= systolic:
            raise serializers.ValidationError(
                {"diastolic": "Diastolic BP must be lower than systolic BP."}
            )
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "recordedById": data["recorded_by"],
            "recordedByName": instance.recorded_by.get_full_name() if instance.recorded_by_id else None,
            "systolic": data["systolic"],
            "diastolic": data["diastolic"],
            "heartRate": data["heart_rate"],
            "temperature": data["temperature"],
            "spo2": data["spo2"],
            "respiratoryRate": data["respiratory_rate"],
            "painScore": data["pain_score"],
            "gcs": data["gcs"],
            "news2Score": data["news2_score"],
            "notes": data["notes"],
            "recordedAt": data["recorded_at"],
            "createdAt": data["created_at"],
        }

class IntakeOutputSerializer(serializers.ModelSerializer):
    class Meta:
        model = IntakeOutput
        fields = "__all__"
        read_only_fields = ["id", "created_at", "recorded_by"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "recordedById": data["recorded_by"],
            "recordedByName": instance.recorded_by.get_full_name() if instance.recorded_by_id else None,
            "direction": data["direction"],
            "type": data["type"],
            "amountMl": data["amount_ml"],
            "notes": data["notes"],
            "createdAt": data["created_at"],
        }

class PainAssessmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PainAssessment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "recorded_by"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "recordedById": data["recorded_by"],
            "recordedByName": instance.recorded_by.get_full_name() if instance.recorded_by_id else None,
            "score": data["score"],
            "location": data["location"],
            "quality": data["quality"],
            "intervention": data["intervention"],
            "createdAt": data["created_at"],
        }

class MAREntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MAREntry
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "administered_by"]
        extra_kwargs = {"patient": {"required": False}}

    def validate_status(self, value):
        if value == "overdue":
            return "scheduled"
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        prescription = attrs.get("prescription", getattr(self.instance, "prescription", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if prescription and not patient:
            attrs["patient"] = prescription.patient
            patient = prescription.patient
        if prescription and patient and prescription.patient_id != patient.id:
            raise serializers.ValidationError({"patient": "MAR patient must match the selected prescription patient."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "prescriptionId": data["prescription"],
            "medication": instance.prescription.medication if instance.prescription_id else None,
            "dosage": instance.prescription.dosage if instance.prescription_id else None,
            "route": instance.prescription.route if instance.prescription_id else None,
            "administeredById": data["administered_by"],
            "administeredByName": instance.administered_by.get_full_name() if instance.administered_by_id else None,
            "administeredBy": instance.administered_by.get_full_name() if instance.administered_by_id else None,
            "scheduledTime": data["scheduled_time"],
            "administeredTime": data["administered_time"],
            "status": mar_status_for_api(instance),
            "backendStatus": data["status"],
            "barcode": data["barcode"],
            "notes": data["notes"],
            "createdAt": data["created_at"],
        }

class NursingNoteSerializer(serializers.ModelSerializer):
    is_editable = serializers.SerializerMethodField()

    class Meta:
        model = NursingNote
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "nurse", "edit_deadline"]

    def get_is_editable(self, obj):
        return timezone.now() < obj.edit_deadline

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "nurseId": data["nurse"],
            "nurseName": instance.nurse.get_full_name() if hasattr(instance, "nurse") else None,
            "category": data["category"],
            "content": data["content"],
            "isEditable": data["is_editable"],
            "editDeadline": data["edit_deadline"],
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }

class TaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = Task
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "completed_by", "completed_time"]
        extra_kwargs = {"room": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if patient and not attrs.get("room") and not getattr(self.instance, "room", None):
            attrs["room"] = patient.room_number or "TBD"
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "assignedToId": data["assigned_to"],
            "assignedToName": instance.assigned_to.get_full_name() if instance.assigned_to_id else None,
            "room": data["room"],
            "type": data["type"],
            "description": data["description"],
            "priority": data["priority"],
            "status": data["status"],
            "dueTime": data["due_time"],
            "shift": data["shift"],
            "completedById": data["completed_by"],
            "completedTime": data["completed_time"],
            "completionNotes": data["completion_notes"],
            "createdAt": data["created_at"],
        }

class WoundSerializer(serializers.ModelSerializer):
    class Meta:
        model = Wound
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "recorded_by"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "recordedById": data["recorded_by"],
            "recordedByName": instance.recorded_by.get_full_name() if instance.recorded_by_id else None,
            "type": data["type"],
            "location": data["location"],
            "stage": data["stage"],
            "size": data["size"],
            "description": data["description"],
            "care": data["care"],
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }

class HandoffSerializer(serializers.ModelSerializer):
    class Meta:
        model = Handoff
        fields = "__all__"
        read_only_fields = ["id", "created_at", "from_nurse"]
        extra_kwargs = {"room": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if patient:
            if not attrs.get("ward") and not getattr(self.instance, "ward", None) and patient.ward_id:
                attrs["ward"] = patient.ward
            if not attrs.get("room") and not getattr(self.instance, "room", None):
                attrs["room"] = patient.room_number or "TBD"
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "wardId": data["ward"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "wardName": instance.ward.name if instance.ward_id else None,
            "room": data["room"],
            "fromNurseId": data["from_nurse"],
            "toNurseId": data["to_nurse"],
            "fromNurseName": instance.from_nurse.get_full_name() if instance.from_nurse_id else None,
            "toNurseName": instance.to_nurse.get_full_name() if instance.to_nurse_id else None,
            "shiftDate": data["shift_date"],
            "shiftType": data["shift_type"],
            "situation": data["situation"],
            "background": data["background"],
            "assessment": data["assessment"],
            "recommendation": data["recommendation"],
            "createdAt": data["created_at"],
        }

class DischargeChecklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = DischargeChecklistItem
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "completed_by", "completed_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "item": data["item"],
            "category": data["category"],
            "completed": data["completed"],
            "completedById": data["completed_by"],
            "completedByName": instance.completed_by.get_full_name() if instance.completed_by_id else None,
            "completedAt": data["completed_at"],
            "notes": data["notes"],
            "createdAt": data["created_at"],
        }
