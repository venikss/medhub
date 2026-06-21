"""
Billing module serializers.

Fixed:
  - InvoiceSerializer: renamed `totalAmount` → `totalCharges` to match spec
  - InvoiceSerializer: added `primaryDiagnosis` field output
  - PaymentSerializer: orders by `posted_at` (views were using `paid_at` which doesn't exist)
"""

import datetime

from rest_framework import serializers
from .models import Invoice, Claim, Payment, Denial
from core.standards import is_valid_cpt_or_local, is_valid_icd10

CLAIM_STATUS_TO_API = {
    "draft": "draft",
    "submitted": "submitted",
    "acknowledged": "acknowledged",
    "under-review": "pending",
    "paid": "paid",
    "partially-paid": "partially_paid",
    "denied": "denied",
    "appealed": "appealed",
    "closed": "paid",
}
CLAIM_STATUS_FROM_API = {
    "draft": "draft",
    "submitted": "submitted",
    "acknowledged": "acknowledged",
    "pending": "under-review",
    "partially_paid": "partially-paid",
    "paid": "paid",
    "denied": "denied",
    "appealed": "appealed",
    "void": "closed",
}
DENIAL_STATUS_TO_API = {
    "open": "pending_appeal",
    "in-review": "pending_appeal",
    "appealed": "appealed",
    "overturned": "overturned",
    "upheld": "upheld",
    "write-off": "written_off",
}
DENIAL_STATUS_FROM_API = {
    "pending_appeal": "open",
    "appealed": "appealed",
    "upheld": "upheld",
    "overturned": "overturned",
    "resubmitted": "appealed",
    "written_off": "write-off",
}
PAYMENT_METHOD_TO_API = {
    "cash": "cash",
    "check": "check",
    "credit-card": "credit_card",
    "debit-card": "debit_card",
    "ach": "eft",
    "insurance": "insurance_eft",
    "write-off": "wire",
    "adjustment": "wire",
}
PAYMENT_METHOD_FROM_API = {
    "cash": "cash",
    "check": "check",
    "credit_card": "credit-card",
    "debit_card": "debit-card",
    "eft": "ach",
    "insurance_eft": "insurance",
    "wire": "adjustment",
}
DENIAL_REASON_TO_API = {
    "missing-info": "CO-4",
    "medical-necessity": "CO-50",
    "auth-required": "CO-15",
    "timely-filing": "CO-29",
    "duplicate": "CO-18",
    "eligibility": "CO-22",
    "coding-error": "CO-11",
    "out-of-network": "CO-45",
    "other": "CO-97",
}

class InvoiceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_insurance_plan(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("insurancePlan must be an object.")
        if value and not value.get("provider"):
            raise serializers.ValidationError("insurancePlan.provider is required when insurancePlan is provided.")
        return value

    def validate_charge_items(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("chargeItems must be a list.")
        for idx, item in enumerate(value):
            if not isinstance(item, dict):
                raise serializers.ValidationError(f"chargeItems[{idx}] must be an object.")
            if not item.get("description") and not item.get("name"):
                raise serializers.ValidationError(f"chargeItems[{idx}] must include description or name.")
            cpt_code = item.get("cptCode") or item.get("cpt_code") or item.get("cpt")
            if cpt_code:
                if not is_valid_cpt_or_local(str(cpt_code).strip()):
                    raise serializers.ValidationError({f"chargeItems[{idx}].cptCode": "Invalid CPT/local code."})
            dx_codes = item.get("diagnosisCodes") or item.get("diagnosis_codes") or []
            if dx_codes:
                if not isinstance(dx_codes, list):
                    raise serializers.ValidationError({f"chargeItems[{idx}].diagnosisCodes": "Must be a list."})
                for code in dx_codes:
                    if code in (None, ""):
                        continue
                    if not is_valid_icd10(str(code).strip()):
                        raise serializers.ValidationError({f"chargeItems[{idx}].diagnosisCodes": "Invalid ICD-10 code."})
        return value

    def validate(self, attrs):
        attrs = super().validate(attrs)
        for field in ("total_amount", "insurance_paid", "patient_paid", "adjustments", "balance"):
            value = attrs.get(field, getattr(self.instance, field, None) if self.instance else None)
            if value is not None and value < 0:
                raise serializers.ValidationError({field: "Amounts cannot be negative."})
        charge_items = attrs.get("charge_items", getattr(self.instance, "charge_items", []) if self.instance else [])
        total_amount = attrs.get("total_amount", getattr(self.instance, "total_amount", None))
        if total_amount in (None, 0) and charge_items:
            computed_total = 0
            for item in charge_items:
                amount = item.get("amount")
                if amount in (None, ""):
                    unit_price = item.get("unitPrice", item.get("unit_price", 0)) or 0
                    quantity = item.get("quantity", 1) or 1
                    amount = float(unit_price) * float(quantity)
                computed_total += float(amount)
            attrs["total_amount"] = computed_total
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if patient and not attrs.get("primary_diagnosis") and not getattr(self.instance, "primary_diagnosis", None):
            diagnosis = patient.diagnoses.order_by("-created_at").first()
            if diagnosis:
                attrs["primary_diagnosis"] = diagnosis.description
        insurance_paid = attrs.get("insurance_paid", getattr(self.instance, "insurance_paid", 0) if self.instance else 0) or 0
        patient_paid = attrs.get("patient_paid", getattr(self.instance, "patient_paid", 0) if self.instance else 0) or 0
        adjustments = attrs.get("adjustments", getattr(self.instance, "adjustments", 0) if self.instance else 0) or 0
        total_amount = attrs.get("total_amount", getattr(self.instance, "total_amount", 0) if self.instance else 0) or 0
        attrs["balance"] = max(0, float(total_amount) - float(insurance_paid) - float(patient_paid) - float(adjustments))
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        insurance_plan = data["insurance_plan"] or {}
        charge_items = data["charge_items"] or []
        patient = getattr(instance, "patient", None)
        latest_admission = patient.admissions.order_by("-admitted_at").first() if patient else None
        assigned_doctor = getattr(patient, "assigned_doctor", None) if patient else None
        return {
            "id": data["id"],
            "patientId": data["patient"],
            "patientName": patient.full_name if patient else None,
            "mrn": patient.mrn if patient else None,
            "dateOfBirth": patient.date_of_birth.isoformat() if patient and patient.date_of_birth else None,
            "admissionDate": patient.admission_date.isoformat() if patient and patient.admission_date else None,
            "dischargeDate": latest_admission.discharged_at.isoformat() if latest_admission and latest_admission.discharged_at else None,
            "encounterType": data["encounter_type"],
            "status": data["status"],
            "department": latest_admission.department.name if latest_admission and latest_admission.department_id else None,
            "attendingPhysician": assigned_doctor.get_full_name() if assigned_doctor else (latest_admission.admitting_doctor.get_full_name() if latest_admission and latest_admission.admitting_doctor_id else None),
            "insurancePlan": insurance_plan,
            "chargeItems": charge_items,
            "totalCharges": float(data["total_amount"]) if data["total_amount"] else 0,
            "totalAmount": float(data["total_amount"]) if data["total_amount"] else 0,
            "primaryDiagnosis": data["primary_diagnosis"],
            "primaryDiagnosisCode": insurance_plan.get("primaryDiagnosisCode") or (charge_items[0].get("diagnosisCodes", [None])[0] if charge_items else None),
            "insuranceBilled": float(data["total_amount"]) if data["total_amount"] else 0,
            "insurancePaid": float(data["insurance_paid"]) if data["insurance_paid"] else 0,
            "patientPaid": float(data["patient_paid"]) if data["patient_paid"] else 0,
            "adjustments": float(data["adjustments"]) if data["adjustments"] else 0,
            "balance": float(data["balance"]) if data["balance"] else 0,
            "patientBalance": float(data["balance"]) if data["balance"] else 0,
            "claimIds": [str(claim.id) for claim in instance.claims.all()],
            "sentAt": data["sent_at"],
            "dueDate": insurance_plan.get("dueDate"),
            "notes": insurance_plan.get("notes"),
            "voidAt": data["void_at"],
            "voidById": data["void_by"],
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }

class ClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model = Claim
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate_status(self, value):
        return CLAIM_STATUS_FROM_API.get(value, value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        invoice = attrs.get("invoice", getattr(self.instance, "invoice", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if invoice and not patient:
            attrs["patient"] = invoice.patient
            patient = invoice.patient
        submitted_at = attrs.get("submitted_at", getattr(self.instance, "submitted_at", None))
        eob_date = attrs.get("eob_date", getattr(self.instance, "eob_date", None))
        if invoice and patient and invoice.patient_id != patient.id:
            raise serializers.ValidationError("Claim patient must match invoice patient.")
        if submitted_at and eob_date and eob_date < submitted_at.date():
            raise serializers.ValidationError({"eob_date": "EOB date cannot be before claim submission date."})
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        insurance_plan = instance.invoice.insurance_plan if getattr(instance, "invoice", None) else {}
        return {
            "id": data["id"],
            "invoiceId": data["invoice"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "mrn": instance.patient.mrn if hasattr(instance, "patient") else None,
            "payerId": data["payer_id"],
            "payerName": insurance_plan.get("payerName") or insurance_plan.get("provider") or data["payer_id"],
            "memberId": insurance_plan.get("memberId") or insurance_plan.get("policyNumber"),
            "groupNumber": insurance_plan.get("groupNumber"),
            "claimType": data["claim_type"],
            "status": CLAIM_STATUS_TO_API.get(data["status"], data["status"]),
            "backendStatus": data["status"],
            "totalBilled": float(instance.invoice.total_amount) if getattr(instance, "invoice", None) and instance.invoice.total_amount else 0,
            "allowedAmount": float(data["allowed_amount"]) if data["allowed_amount"] else None,
            "paidAmount": float(data["paid_amount"]) if data["paid_amount"] else None,
            "adjustmentAmount": float(instance.invoice.adjustments) if getattr(instance, "invoice", None) and instance.invoice.adjustments else 0,
            "patientResponsibility": float(data["patient_responsibility"]) if data["patient_responsibility"] else None,
            "eobDate": data["eob_date"],
            "submittedAt": data["submitted_at"],
            "acknowledgedAt": data["created_at"] if data["status"] == "acknowledged" else None,
            "processedAt": data["eob_date"],
            "eobReceivedAt": data["eob_date"],
            "denialIds": [str(denial.id) for denial in instance.denials.all()],
            "paymentIds": [str(payment.id) for payment in instance.payments.all()],
            "notes": insurance_plan.get("claimNotes"),
            "resubmittedAt": data["resubmitted_at"],
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = "__all__"
        read_only_fields = ["id", "created_at", "posted_by", "posted_at"]
        extra_kwargs = {"patient": {"required": False}, "invoice": {"required": False}}

    def validate_method(self, value):
        return PAYMENT_METHOD_FROM_API.get(value, value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        amount = attrs.get("amount", getattr(self.instance, "amount", None))
        invoice = attrs.get("invoice", getattr(self.instance, "invoice", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        claim = attrs.get("claim", getattr(self.instance, "claim", None))
        if claim and not invoice:
            attrs["invoice"] = claim.invoice
            invoice = claim.invoice
        if invoice and not patient:
            attrs["patient"] = invoice.patient
            patient = invoice.patient
        if amount is not None and amount <= 0:
            raise serializers.ValidationError({"amount": "Amount must be greater than 0."})
        if invoice and patient and invoice.patient_id != patient.id:
            raise serializers.ValidationError("Payment patient must match invoice patient.")
        if claim and invoice and claim.invoice_id != invoice.id:
            raise serializers.ValidationError("Payment claim must belong to the selected invoice.")
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "invoiceId": data["invoice"],
            "claimId": data["claim"],
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "postedBy": instance.posted_by.get_full_name() if instance.posted_by_id else None,
            "postedById": data["posted_by"],
            "amount": float(data["amount"]) if data["amount"] else 0,
            "method": PAYMENT_METHOD_TO_API.get(data["method"], data["method"]),
            "backendMethod": data["method"],
            "payer": data["payer"],
            "referenceNumber": data["reference_number"],
            "checkNumber": data["reference_number"] if data["method"] == "check" else None,
            "eobDate": instance.claim.eob_date.isoformat() if instance.claim_id and instance.claim.eob_date else None,
            "isVoid": data["voided"],
            "postedAt": data["posted_at"],
            "voided": data["voided"],
            "voidReason": data["void_reason"],
            "voidedAt": data["voided_at"],
            "createdAt": data["created_at"],
        }

class DenialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Denial
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate_status(self, value):
        return DENIAL_STATUS_FROM_API.get(value, value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        claim = attrs.get("claim", getattr(self.instance, "claim", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if claim and not patient:
            attrs["patient"] = claim.patient
            patient = claim.patient
        if claim and patient and claim.patient_id != patient.id:
            raise serializers.ValidationError("Denial patient must match claim patient.")
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        return {
            "id": data["id"],
            "claimId": data["claim"],
            "invoiceId": str(instance.claim.invoice_id) if hasattr(instance, "claim") else None,
            "patientId": data["patient"],
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "payerName": instance.claim.invoice.insurance_plan.get("payerName") if hasattr(instance, "claim") and instance.claim.invoice and instance.claim.invoice.insurance_plan else None,
            "reasonCode": DENIAL_REASON_TO_API.get(data["reason_code"], data["reason_code"]),
            "backendReasonCode": data["reason_code"],
            "reasonDescription": data["reason_description"],
            "deniedAmount": float(instance.claim.allowed_amount or instance.claim.invoice.total_amount or 0) if hasattr(instance, "claim") else 0,
            "serviceDate": instance.claim.invoice.created_at.date().isoformat() if hasattr(instance, "claim") and instance.claim.invoice else None,
            "receivedAt": data["created_at"],
            "status": DENIAL_STATUS_TO_API.get(data["status"], data["status"]),
            "backendStatus": data["status"],
            "appealDeadline": (instance.created_at.date() + datetime.timedelta(days=30)).isoformat() if instance.created_at else None,
            "appealNotes": data["appeal_notes"],
            "appealSubmittedAt": data["appeal_submitted_at"],
            "resolutionNotes": data["resolution_notes"],
            "assignedTo": None,
            "resolvedAt": data["resolved_at"],
            "createdAt": data["created_at"],
            "updatedAt": data["updated_at"],
        }
