"""
Pharmacy module serializers - fixed to match actual model fields.
"""

import datetime

from rest_framework import serializers
from core.standards import is_valid_ndc, is_valid_rxnorm
from apps.cdss.models import MedicalOntologyConcept, OntologyCodeSystem, OntologyDomain
from .models import (
    PharmacyPrescription, DrugWarning, FormularyItem,
    DispenseRecord, PharmacyIntervention, Refill, Substitution,
)


PRIORITY_CHOICES = [
    ("routine", "Routine"),
    ("urgent", "Urgent"),
    ("stat", "STAT"),
]


def resolve_canonical_medication_name(*, local_name: str | None, generic_name: str | None, rxnorm_code: str | None) -> str | None:
    if rxnorm_code:
        concept = MedicalOntologyConcept.objects.filter(
            code_system=OntologyCodeSystem.RXNORM,
            domain=OntologyDomain.MEDICATION,
            code=str(rxnorm_code).strip(),
            is_active=True,
        ).first()
        if concept and concept.display:
            return concept.display
    return generic_name or local_name


class PharmacyPrescriptionSerializer(serializers.ModelSerializer):
    priority = serializers.ChoiceField(choices=PRIORITY_CHOICES, required=False)

    class Meta:
        model = PharmacyPrescription
        fields = "__all__"
        read_only_fields = [
            "id", "created_at", "updated_at",
            "verified_by", "verified_at",
            "dispensed_by", "dispensed_at",
        ]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        original_prescription = attrs.get("original_prescription", getattr(self.instance, "original_prescription", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if original_prescription and not patient:
            attrs["patient"] = original_prescription.patient
        if original_prescription and not attrs.get("priority") and not getattr(self.instance, "priority", None):
            attrs["priority"] = getattr(original_prescription, "priority", "routine") or "routine"
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        original = getattr(instance, "original_prescription", None)
        warnings = instance.warnings.all() if hasattr(instance, "warnings") else []
        refill_count = instance.refills.count() if hasattr(instance, "refills") else 0
        local_medication = original.medication if original else None
        original_generic = getattr(original, "generic_name", None) if original else None
        original_rxnorm = getattr(original, "rxnorm_code", None) if original else None
        canonical_name = resolve_canonical_medication_name(
            local_name=local_medication,
            generic_name=original_generic,
            rxnorm_code=original_rxnorm,
        )
        return {
            "id": data["id"],
            "originalPrescriptionId": data["original_prescription"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "mrn": instance.patient.mrn if hasattr(instance, "patient") else None,
            "medication": local_medication,
            "medicationName": canonical_name,
            "displayMedicationName": local_medication,
            "genericName": canonical_name,
            "rxnormCode": original_rxnorm,
            "dosage": original.dosage if original else None,
            "frequency": original.frequency if original else None,
            "route": original.route if original else None,
            "quantity": original.quantity if original else None,
            "refills": original.refills if original else None,
            "refillsAllowed": original.refills if original else None,
            "refillsRemaining": max((original.refills if original else 0) - refill_count, 0),
            "sig": original.sig if original else None,
            "prescribedBy": original.prescribed_by.get_full_name() if original and original.prescribed_by_id else None,
            "prescribedAt": original.created_at.isoformat() if original and original.created_at else None,
            "allergies": instance.patient.allergies if hasattr(instance, "patient") else [],
            "status": data["status"],
            "setting": data["setting"],
            "priority": data["priority"],
            "verifiedById": data["verified_by"],
            "verifiedByName": instance.verified_by.get_full_name() if instance.verified_by_id else None,
            "verifiedAt": data["verified_at"],
            "verificationNotes": data["verification_notes"],
            "dispensedById": data["dispensed_by"],
            "dispensedByName": instance.dispensed_by.get_full_name() if instance.dispensed_by_id else None,
            "dispensedAt": data["dispensed_at"],
            "lotNumber": data["lot_number"],
            "expirationDate": data["expiration_date"],
            "quantityDispensed": data["quantity_dispensed"],
            "holdReason": data["hold_reason"],
            "drugWarnings": data["drug_warnings"],
            "warnings": DrugWarningSerializer(warnings, many=True, context=self.context).data,
            "notes": data["verification_notes"] or (original.sig if original else None),
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }

class DrugWarningSerializer(serializers.ModelSerializer):
    class Meta:
        model = DrugWarning
        fields = "__all__"
        read_only_fields = ["id", "created_at", "resolved"]

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "prescriptionId": data["prescription"],
            "type": data["type"],
            "severity": data["severity"],
            "title": instance.get_type_display(),
            "description": data["message"],
            "message": data["message"],
            "interactingDrug": data["medications_involved"][1] if len(data["medications_involved"]) > 1 else None,
            "overridable": data["severity"] not in {"severe", "contraindicated"},
            "medicationsInvolved": data["medications_involved"],
            "resolved": data["resolved"],
            "createdAt": data["created_at"],
        }


class FormularyItemSerializer(serializers.ModelSerializer):
    ndc = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    rxnorm_code = serializers.CharField(required=False, allow_null=True, allow_blank=True)

    class Meta:
        model = FormularyItem
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_ndc(self, value):
        if value in (None, ""):
            return value
        code = value.strip()
        if not is_valid_ndc(code):
            raise serializers.ValidationError("ndc must be a valid 10-digit or 11-digit NDC code.")
        return code

    def validate_rxnorm_code(self, value):
        if value in (None, ""):
            return value
        code = value.strip()
        if not is_valid_rxnorm(code):
            raise serializers.ValidationError("rxnorm_code must be a valid RxNorm RxCUI.")
        return code

    def validate(self, attrs):
        attrs = super().validate(attrs)
        stock_level = attrs.get("stock_level", getattr(self.instance, "stock_level", None))
        reorder_level = attrs.get("reorder_level", getattr(self.instance, "reorder_level", None))
        if stock_level is not None and reorder_level is not None and reorder_level > stock_level and stock_level > 0:
            pass
        if stock_level is not None and stock_level < 0:
            raise serializers.ValidationError({"stock_level": "Stock level cannot be negative."})
        if reorder_level is not None and reorder_level < 0:
            raise serializers.ValidationError({"reorder_level": "Reorder level cannot be negative."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        canonical_name = resolve_canonical_medication_name(
            local_name=data["name"],
            generic_name=data["generic_name"],
            rxnorm_code=data.get("rxnorm_code"),
        )
        return {
            "id": data["id"],
            "name": data["name"],
            "displayName": data["name"],
            "genericName": data["generic_name"],
            "canonicalName": canonical_name,
            "drugClass": data["drug_class"],
            "formularyStatus": data["formulary_status"],
            "stockLevel": data["stock_level"],
            "reorderLevel": data["reorder_level"],
            "unitCost": float(data["unit_cost"]) if data.get("unit_cost") is not None else 0.0,
            "unit": data["unit"],
            "ndc": data["ndc"],
            "rxnormCode": data.get("rxnorm_code"),
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }


class DispenseRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = DispenseRecord
        fields = "__all__"
        read_only_fields = ["id", "created_at", "dispensed_by", "dispensed_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        prescription = attrs.get("prescription", getattr(self.instance, "prescription", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if prescription and not patient:
            attrs["patient"] = prescription.patient
            patient = prescription.patient
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        expiration_date = attrs.get("expiration_date", getattr(self.instance, "expiration_date", None))
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than 0."})
        if expiration_date and expiration_date < datetime.date.today():
            raise serializers.ValidationError({"expiration_date": "Expiration date cannot be in the past."})
        if prescription and patient and prescription.patient_id != patient.id:
            raise serializers.ValidationError({"patient": "Dispense record patient must match the selected prescription patient."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        original = getattr(getattr(instance, "prescription", None), "original_prescription", None)
        return {
            "id": data["id"],
            "prescriptionId": data["prescription"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "medication": original.medication if original else None,
            "medicationName": original.medication if original else None,
            "dosage": original.dosage if original else None,
            "setting": instance.prescription.setting if getattr(instance, "prescription", None) else None,
            "dispensedById": data["dispensed_by"],
            "dispensedBy": instance.dispensed_by.get_full_name() if instance.dispensed_by_id else None,
            "dispensedAt": data["dispensed_at"],
            "verifiedBy": instance.prescription.verified_by.get_full_name() if getattr(instance, "prescription", None) and instance.prescription.verified_by_id else None,
            "quantity": data["quantity"],
            "quantityDispensed": data["quantity"],
            "daysSupply": data["days_supply"],
            "lotNumber": data["lot_number"],
            "expirationDate": data["expiration_date"],
            "labelPrinted": False,
            "barcodeScan": False,
            "createdAt": data["created_at"],
        }


class PharmacyInterventionSerializer(serializers.ModelSerializer):
    # prescriber_contact is auto-filled from the prescription's doctor — not required from the caller.
    prescriber_contact = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = PharmacyIntervention
        fields = "__all__"
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        prescription = attrs.get("prescription", getattr(self.instance, "prescription", None))
        if prescription and not attrs.get("prescriber_contact"):
            doctor = getattr(getattr(prescription, "original_prescription", None), "prescribed_by", None)
            attrs["prescriber_contact"] = doctor.get_full_name() if doctor else "Prescribing Physician"
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "prescriptionId": data["prescription"],
            "patientId": str(instance.prescription.patient_id) if hasattr(instance, "prescription") else None,
            "patientName": instance.prescription.patient.full_name if hasattr(instance, "prescription") else None,
            "medication": getattr(getattr(getattr(instance, "prescription", None), "original_prescription", None), "medication", None),
            "type": data["type"],
            "reason": data["reason"],
            "recommendation": data["recommendation"],
            "prescriberContact": data["prescriber_contact"],
            "pharmacistId": data.get("pharmacist"),
            "pharmacistName": instance.pharmacist.get_full_name() if instance.pharmacist_id else None,
            "outcome": data["outcome"],
            "prescriberResponse": data["prescriber_response"],
            "resolvedAt": data["resolved_at"],
            "createdAt": data["created_at"],
        }


class RefillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Refill
        fields = "__all__"
        read_only_fields = ["id", "created_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        prescription = attrs.get("prescription", getattr(self.instance, "prescription", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if prescription and not patient:
            attrs["patient"] = prescription.patient
            patient = prescription.patient
        quantity = attrs.get("quantity", getattr(self.instance, "quantity", None))
        days_supply = attrs.get("days_supply", getattr(self.instance, "days_supply", None))
        if quantity is not None and quantity <= 0:
            raise serializers.ValidationError({"quantity": "Quantity must be greater than 0."})
        if days_supply is not None and days_supply <= 0:
            raise serializers.ValidationError({"days_supply": "Days supply must be greater than 0."})
        if prescription and patient and prescription.patient_id != patient.id:
            raise serializers.ValidationError({"patient": "Refill patient must match the selected prescription patient."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "prescriptionId": data["prescription"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "dispensedDate": data["dispensed_date"],
            "quantity": data["quantity"],
            "pharmacistId": data["pharmacist"],
            "pharmacistName": instance.pharmacist.get_full_name() if instance.pharmacist_id else None,
            "daysSupply": data["days_supply"],
            "createdAt": data["created_at"],
        }


class SubstitutionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Substitution
        fields = "__all__"
        read_only_fields = ["id", "created_at", "approved_by"]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        # On updates, don't overwrite the original requester
        if self.instance:
            attrs.pop("requested_by", None)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "prescriptionId": data["prescription"],
            "patientId": str(instance.prescription.patient_id) if hasattr(instance, "prescription") else None,
            "patientName": instance.prescription.patient.full_name if hasattr(instance, "prescription") else None,
            "substituteMedication": data["substitute_medication"],
            "reason": data["reason"],
            "status": data["status"],
            "createdAt": data["created_at"],
        }
