"""
CDSS module serializers.
Fixed: patientName and patientMRN denormalized into recommendation output (spec requirement).
"""

from rest_framework import serializers
from .models import CDSSConsultRequest, CDSSOutputKind, CDSSRecommendation, CDSSOverrideRecord


class CDSSRecommendationSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        consult_request = attrs.get("consult_request")
        patient = attrs.get("patient")
        encounter = attrs.get("encounter")

        if consult_request:
            if patient and consult_request.patient_id != patient.id:
                raise serializers.ValidationError(
                    {"patient": "Recommendation patient must match the linked CDSS support request patient."}
                )
            if encounter and consult_request.encounter_id and consult_request.encounter_id != encounter.id:
                raise serializers.ValidationError(
                    {"encounter": "Recommendation encounter must match the linked CDSS support request encounter."}
                )
            attrs.setdefault("output_kind", CDSSOutputKind.RECOMMENDATION)

        return attrs

    class Meta:
        model = CDSSRecommendation
        fields = "__all__"
        read_only_fields = [
            "id", "created_at", "updated_at",
            "acknowledged_by", "acknowledged_at",
            "overridden_by", "overridden_at",
            "generated_at",
        ]

    def to_representation(self, instance):
        data = super().to_representation(instance)

        # Denormalized patient info required by spec
        patient_name = ""
        patient_mrn = ""
        if instance.patient_id:
            try:
                p = instance.patient
                patient_name = f"{p.first_name} {p.last_name}".strip()
                patient_mrn = getattr(p, "mrn", "") or ""
            except Exception:
                pass

        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": patient_name,
            "patientMRN": patient_mrn,
            "encounterId": data["encounter"],
            "acknowledgedByName": instance.acknowledged_by.get_full_name() if instance.acknowledged_by_id else None,
            "overriddenByName": instance.overridden_by.get_full_name() if instance.overridden_by_id else None,
            "sourceModule": data["source_module"],
            "outputKind": data["output_kind"],
            "type": data["type"],
            "severity": data["severity"],
            "status": data["status"],
            "title": data["title"],
            "summary": data["summary"],
            "consultRequestId": data["consult_request"],
            "triggeredBy": data["triggered_by"],
            "targetRoles": data["target_roles"],
            "affectedMedications": data["affected_medications"],
            "suggestedActions": data["suggested_actions"],
            "explanation": data["explanation"],
            "evidenceSources": data["evidence_sources"],
            "generatedAt": data["generated_at"],
            "expiresAt": data["expires_at"],
            "overrideReason": data["override_reason"],
            "overrideReasonCategory": data["override_reason_category"],
            "overriddenById": data["overridden_by"],
            "overriddenAt": data["overridden_at"],
            "acknowledgedById": data["acknowledged_by"],
            "acknowledgedAt": data["acknowledged_at"],
            "feedbackRating": data["feedback_rating"],
            "feedbackComment": data["feedback_comment"],
            "snomedCode": data.get("snomed_code"),
            "snomedDisplay": data.get("snomed_display"),
            "createdAt": data["created_at"],
        }


class CDSSConsultRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = CDSSConsultRequest
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "answered_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        patient_name = ""
        patient_mrn = ""
        requested_by_name = None
        if instance.patient_id:
            try:
                p = instance.patient
                patient_name = f"{p.first_name} {p.last_name}".strip()
                patient_mrn = getattr(p, "mrn", "") or ""
            except Exception:
                pass
        if instance.requested_by_id:
            try:
                requested_by_name = instance.requested_by.get_full_name() or instance.requested_by.username
            except Exception:
                requested_by_name = None

        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": patient_name,
            "patientMRN": patient_mrn,
            "encounterId": data["encounter"],
            "requestedById": data["requested_by"],
            "requestedByName": requested_by_name,
            "clinicalQuestion": data["clinical_question"],
            "contextNotes": data["context_notes"],
            "status": data["status"],
            "answeredAt": data["answered_at"],
            "createdAt": data["created_at"],
        }


class CDSSOverrideRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = CDSSOverrideRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "recorded_at"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "recommendationId": data["recommendation"],
            "action": data["action"],
            "reasonCategory": data["reason_category"],
            "reason": data["reason"],
            "notes": data["notes"],
            "clinicianName": data["clinician_name"],
            "clinicianRole": data["clinician_role"],
            "sourceModule": data["source_module"],
            "recordedAt": data["recorded_at"],
            "createdAt": data["created_at"],
        }
