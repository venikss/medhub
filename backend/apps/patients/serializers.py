"""
Patients serializers.
"""

import datetime
import re
from rest_framework import serializers
from .models import Patient, Admission, AdmissionTransfer, Queue, Appointment, Consent

ALLOWED_MARITAL_STATUSES = {"single", "married", "divorced", "widowed"}
PHONE_RE = re.compile(r"^[0-9+\-\s()]{7,20}$")

ADMISSION_STATUS_TO_API = {
    "active": "admitted",
    "transferred": "transferred",
    "discharged": "discharged",
    "cancelled": "pending",
}
ADMISSION_STATUS_FROM_API = {
    "admitted": "active",
    "transferred": "transferred",
    "discharged": "discharged",
    "pending": "active",
}

class PatientSerializer(serializers.ModelSerializer):
    firstName = serializers.CharField(source="first_name")
    lastName = serializers.CharField(source="last_name")
    dateOfBirth = serializers.DateField(source="date_of_birth")
    bloodType = serializers.CharField(source="blood_type", required=False, allow_null=True)
    insuranceProvider = serializers.CharField(source="insurance_provider", required=False, allow_null=True)
    insuranceId = serializers.CharField(source="insurance_id", required=False, allow_null=True)
    admissionDate = serializers.DateTimeField(source="admission_date", required=False, allow_null=True)
    emergencyContact = serializers.JSONField(source="emergency_contact", required=False)
    insuranceDetails = serializers.JSONField(source="insurance_details", required=False)
    maritalStatus = serializers.CharField(source="marital_status", required=False, allow_null=True)
    preferredLanguage = serializers.CharField(source="preferred_language", required=False, allow_null=True)
    consentSigned = serializers.BooleanField(source="consent_signed", required=False)
    registeredAt = serializers.DateTimeField(source="registered_at", read_only=True)
    roomNumber = serializers.CharField(source="room_number", required=False, allow_null=True)

    class Meta:
        model = Patient
        fields = [
            "id", "mrn", "firstName", "lastName", "dateOfBirth", "gender",
            "phone", "email", "address", "bloodType", "allergies", "status",
            "insuranceProvider", "insuranceId", "admissionDate",
            "nationality", "maritalStatus", "preferredLanguage",
            "consentSigned", "registeredAt", "emergencyContact", "insuranceDetails",
            "avatar", "roomNumber",
        ]
        read_only_fields = ["id", "mrn", "registered_at", "created_at"]

    def validate_email(self, value):
        if self.instance is None and not value:
            raise serializers.ValidationError("Email is required.")
        return value

    def validate_dateOfBirth(self, value):
        if value >= datetime.date.today():
            raise serializers.ValidationError("Date of birth must be in the past.")
        return value

    def validate_address(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Address must be an object.")
        allowed = {"street", "line1", "line2", "city", "state", "postalCode", "zipCode", "country"}
        if not any(value.get(key) for key in ("street", "line1", "city", "country")):
            raise serializers.ValidationError("Address should include at least street/line1, city, or country.")
        unexpected = sorted(set(value.keys()) - allowed)
        if unexpected:
            raise serializers.ValidationError(f"Unsupported address fields: {unexpected}")
        return value

    def validate_allergies(self, value):
        if value in (None, ""):
            return []
        if not isinstance(value, list):
            raise serializers.ValidationError("Allergies must be a list of strings.")
        cleaned = []
        for item in value:
            if not isinstance(item, str) or not item.strip():
                raise serializers.ValidationError("Each allergy must be a non-empty string.")
            cleaned.append(item.strip())
        return cleaned

    def validate_avatar(self, value):
        if value in (None, ""):
            return value
        if not isinstance(value, str) or not value.startswith(("http://", "https://", "/media/", "/")):
            raise serializers.ValidationError("Avatar must be a valid URL or stored media path.")
        return value

    def validate_nationality(self, value):
        if value in (None, ""):
            return value
        if not isinstance(value, str) or len(value.strip()) < 2:
            raise serializers.ValidationError("Nationality must be a readable text value.")
        return value.strip()

    def validate_maritalStatus(self, value):
        if value in (None, ""):
            return value
        normalized = value.strip().lower()
        if normalized not in ALLOWED_MARITAL_STATUSES:
            raise serializers.ValidationError(f"Marital status must be one of: {sorted(ALLOWED_MARITAL_STATUSES)}")
        return normalized

    def validate_preferredLanguage(self, value):
        if value in (None, ""):
            return value
        normalized = value.strip().lower()
        allowed = {choice[0] for choice in Patient._meta.get_field("preferred_language").choices}
        if normalized not in allowed:
            raise serializers.ValidationError(f"Preferred language must be one of: {sorted(allowed)}")
        return normalized

    def validate_emergencyContact(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Emergency contact must be an object.")
        required = {"name", "relationship", "phone"}
        missing = [field for field in required if not value.get(field)]
        if missing:
            raise serializers.ValidationError(f"Emergency contact is missing: {missing}")
        if not PHONE_RE.match(str(value.get("phone")).strip()):
            raise serializers.ValidationError("Emergency contact phone format is invalid.")
        return {
            "name": str(value.get("name")).strip(),
            "relationship": str(value.get("relationship")).strip(),
            "phone": str(value.get("phone")).strip(),
        }

    def validate_insuranceDetails(self, value):
        if value in (None, ""):
            return {}
        if not isinstance(value, dict):
            raise serializers.ValidationError("Insurance details must be an object.")
        required = {"provider", "policyNumber"}
        missing = [field for field in required if not value.get(field)]
        if missing:
            raise serializers.ValidationError(f"Insurance details are missing: {missing}")
        cleaned = dict(value)
        cleaned["provider"] = str(cleaned["provider"]).strip()
        cleaned["policyNumber"] = str(cleaned["policyNumber"]).strip()
        valid_from = cleaned.get("validFrom")
        valid_to = cleaned.get("validTo")
        if valid_from and valid_to and str(valid_to) < str(valid_from):
            raise serializers.ValidationError("Insurance validTo cannot be before validFrom.")
        return cleaned

    def to_representation(self, instance):
        insurance_details = instance.insurance_details or {}
        insurance = None
        if insurance_details or instance.insurance_provider or instance.insurance_id:
            insurance = {
                "provider": insurance_details.get("provider") or instance.insurance_provider,
                "policyNumber": insurance_details.get("policyNumber") or instance.insurance_id,
                "copay": insurance_details.get("copay"),
                "coverageType": insurance_details.get("coverageType"),
            }
        return {
            "id": str(instance.id),
            "mrn": instance.mrn,
            "firstName": instance.first_name,
            "lastName": instance.last_name,
            "fullName": instance.full_name,
            "dateOfBirth": instance.date_of_birth.isoformat() if hasattr(instance.date_of_birth, "isoformat") else instance.date_of_birth,
            "gender": instance.gender,
            "phone": instance.phone,
            "email": instance.email,
            "address": instance.address,
            "bloodType": instance.blood_type,
            "allergies": instance.allergies,
            "status": instance.status,
            "insuranceId": instance.insurance_id,
            "admissionDate": instance.admission_date.isoformat() if hasattr(instance.admission_date, "isoformat") else instance.admission_date,
            "assignedDoctor": str(instance.assigned_doctor_id) if instance.assigned_doctor_id else None,
            "assignedDoctorName": instance.assigned_doctor.get_full_name() if instance.assigned_doctor else None,
            "ward": str(instance.ward_id) if instance.ward_id else None,
            "wardName": instance.ward.name if instance.ward else None,
            "roomNumber": instance.room_number,
            "nationality": instance.nationality,
            "maritalStatus": instance.marital_status,
            "preferredLanguage": instance.preferred_language,
            "consentSigned": instance.consent_signed,
            "registeredAt": instance.registered_at.isoformat() if hasattr(instance.registered_at, "isoformat") else instance.registered_at,
            "emergencyContact": instance.emergency_contact,
            "insuranceDetails": instance.insurance_details,
            "insurance": insurance,
            "avatar": instance.avatar,
            "createdAt": instance.created_at.isoformat() if hasattr(instance.created_at, "isoformat") else instance.created_at,
        }

class AdmissionSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id")
    admittingDoctor = serializers.UUIDField(source="admitting_doctor_id", required=False, allow_null=True)
    departmentId = serializers.UUIDField(source="department_id", required=False, allow_null=True)
    wardId = serializers.UUIDField(source="ward_id", required=False, allow_null=True)
    bedId = serializers.UUIDField(source="bed_id", required=False, allow_null=True)
    reasonForAdmission = serializers.CharField(source="reason_for_admission")
    expectedDischarge = serializers.DateTimeField(source="expected_discharge", required=False, allow_null=True)
    admittedAt = serializers.DateTimeField(source="admitted_at", read_only=True)
    dischargeType = serializers.CharField(source="discharge_type", required=False, allow_null=True)
    dischargeSummary = serializers.CharField(source="discharge_summary", required=False, allow_null=True)
    followUpDate = serializers.DateField(source="follow_up_date", required=False, allow_null=True)

    class Meta:
        model = Admission
        fields = [
            "id", "patientId", "type", "status", "admittingDoctor", "departmentId",
            "wardId", "bedId", "reasonForAdmission", "expectedDischarge",
            "admittedAt", "dischargeType", "dischargeSummary", "followUpDate",
        ]

    def validate_status(self, value):
        return ADMISSION_STATUS_FROM_API.get(value, value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        ward_id = attrs.get("ward_id", getattr(self.instance, "ward_id", None))
        bed_id = attrs.get("bed_id", getattr(self.instance, "bed_id", None))
        expected_discharge = attrs.get("expected_discharge", getattr(self.instance, "expected_discharge", None))
        if expected_discharge and self.instance and self.instance.admitted_at and expected_discharge < self.instance.admitted_at:
            raise serializers.ValidationError({"expectedDischarge": "Expected discharge must be after admission time."})
        if ward_id and bed_id:
            from apps.administration.models import Bed
            try:
                bed = Bed.objects.get(id=bed_id)
            except Bed.DoesNotExist:
                raise serializers.ValidationError({"bedId": "Selected bed does not exist."})
            if str(bed.ward_id) != str(ward_id):
                raise serializers.ValidationError({"bedId": "Selected bed does not belong to the selected ward."})
            current_bed_id = getattr(self.instance, "bed_id", None)
            if bed.status != "available" and str(bed_id) != str(current_bed_id):
                raise serializers.ValidationError({"bedId": "Selected bed is not available."})
        patient_id = attrs.get("patient_id", getattr(self.instance, "patient_id", None))
        if patient_id and self.instance is None:
            active_qs = Admission.objects.filter(patient_id=patient_id, status="active")
            if active_qs.exists():
                raise serializers.ValidationError({"patientId": "Patient already has an active admission."})
        return attrs

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name,
            "mrn": instance.patient.mrn,
            "type": instance.type,
            "status": ADMISSION_STATUS_TO_API.get(instance.status, instance.status),
            "backendStatus": instance.status,
            "admittingDoctor": instance.admitting_doctor.get_full_name() if instance.admitting_doctor else None,
            "admittingDoctorId": str(instance.admitting_doctor_id) if instance.admitting_doctor_id else None,
            "admittingDoctorName": instance.admitting_doctor.get_full_name() if instance.admitting_doctor else None,
            "assignedDoctorId": str(instance.patient.assigned_doctor_id) if instance.patient.assigned_doctor_id else None,
            "assignedDoctorName": instance.patient.assigned_doctor.get_full_name() if instance.patient.assigned_doctor else None,
            "departmentId": str(instance.department_id) if instance.department_id else None,
            "department": instance.department.name if instance.department else None,
            "departmentName": instance.department.name if instance.department else None,
            "wardId": str(instance.ward_id) if instance.ward_id else None,
            "ward": instance.ward.name if instance.ward else None,
            "wardName": instance.ward.name if instance.ward else None,
            "bedId": str(instance.bed_id) if instance.bed_id else None,
            "bed": instance.bed.number if instance.bed else None,
            "bedNumber": instance.bed.number if instance.bed else None,
            "reasonForAdmission": instance.reason_for_admission,
            "expectedDischarge": instance.expected_discharge.isoformat() if instance.expected_discharge else None,
            "admittedAt": instance.admitted_at.isoformat() if instance.admitted_at else None,
            "dischargedAt": instance.discharged_at.isoformat() if instance.discharged_at else None,
            "dischargeType": instance.discharge_type,
            "dischargeSummary": instance.discharge_summary,
            "followUpDate": instance.follow_up_date.isoformat() if instance.follow_up_date else None,
            "createdAt": instance.created_at.isoformat(),
        }

class QueueSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id")
    ticketNumber = serializers.CharField(source="ticket_number", read_only=True)
    queueDate = serializers.DateField(source="queue_date", read_only=True)
    calledAt = serializers.DateTimeField(source="called_at", read_only=True)
    completedAt = serializers.DateTimeField(source="completed_at", read_only=True)

    class Meta:
        model = Queue
        fields = [
            "id", "patientId", "service", "priority", "status",
            "ticketNumber", "window", "queueDate", "calledAt", "completedAt",
        ]

    def to_representation(self, instance):
        waiting_since = instance.created_at
        return {
            "id": str(instance.id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "service": instance.service,
            "priority": instance.priority,
            "status": instance.status,
            "ticketNo": instance.ticket_number,
            "ticketNumber": instance.ticket_number,
            "window": instance.window,
            "waitingSince": waiting_since.isoformat() if waiting_since else None,
            "estimatedWait": None,
            "queuePosition": None,
            "queueDate": instance.queue_date.isoformat() if instance.queue_date else None,
            "calledAt": instance.called_at.isoformat() if instance.called_at else None,
            "completedAt": instance.completed_at.isoformat() if instance.completed_at else None,
            "createdAt": instance.created_at.isoformat(),
        }

class AppointmentSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id")
    doctorId = serializers.UUIDField(source="doctor_id")
    departmentId = serializers.UUIDField(source="department_id", required=False, allow_null=True)

    class Meta:
        model = Appointment
        fields = [
            "id", "patientId", "doctorId", "departmentId",
            "date", "time", "duration", "type", "status", "notes",
        ]

    def validate(self, attrs):
        attrs = super().validate(attrs)
        date_value = attrs.get("date", getattr(self.instance, "date", None))
        duration = attrs.get("duration", getattr(self.instance, "duration", None))
        if date_value and date_value < datetime.date.today():
            raise serializers.ValidationError({"date": "Appointment date cannot be in the past."})
        if duration is not None and duration <= 0:
            raise serializers.ValidationError({"duration": "Duration must be greater than 0."})
        return attrs

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "doctorId": str(instance.doctor_id),
            "doctorName": instance.doctor.get_full_name() if instance.doctor else None,
            "departmentId": str(instance.department_id) if instance.department_id else None,
            "department": instance.department.name if instance.department else None,
            "departmentName": instance.department.name if instance.department else None,
            "date": instance.date.isoformat() if hasattr(instance.date, "isoformat") else instance.date,
            "time": instance.time.isoformat() if hasattr(instance.time, "isoformat") else instance.time,
            "duration": instance.duration,
            "type": instance.type,
            "status": instance.status,
            "notes": instance.notes,
            "createdAt": instance.created_at.isoformat(),
        }

class ConsentSerializer(serializers.ModelSerializer):
    patientId = serializers.UUIDField(source="patient_id", read_only=True)
    signedBy = serializers.UUIDField(source="signed_by_id", read_only=True)
    signedAt = serializers.DateTimeField(source="signed_at", read_only=True)
    fileUrl = serializers.URLField(source="file_url", read_only=True)

    class Meta:
        model = Consent
        fields = ["id", "patientId", "type", "status", "signedBy", "signedAt", "fileUrl"]

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "type": instance.type,
            "status": instance.status,
            "signedBy": str(instance.signed_by_id) if instance.signed_by_id else None,
            "signedByName": instance.signed_by.get_full_name() if instance.signed_by else None,
            "signedAt": instance.signed_at.isoformat() if instance.signed_at else None,
            "fileUrl": instance.file_url,
            "createdAt": instance.created_at.isoformat(),
        }
