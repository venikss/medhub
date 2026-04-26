"""
Patients application services.
"""

from django.db import transaction
from django.utils import timezone
from rapidfuzz import fuzz

from core.exceptions import NotFoundError, ConflictError
from core.utils import generate_mrn
from .models import Patient, Admission, PatientStatus, AdmissionStatus


class PatientService:
    @staticmethod
    def create_patient(data: dict) -> Patient:
        # Prevent duplication
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")
        date_of_birth = data.get("date_of_birth")
        
        if Patient.objects.filter(
            first_name__iexact=first_name,
            last_name__iexact=last_name,
            date_of_birth=date_of_birth,
            deleted_at__isnull=True
        ).exists():
            raise ConflictError(f"A patient named {first_name} {last_name} with DOB {date_of_birth} already exists.")

        mrn = generate_mrn()
        while Patient.objects.filter(mrn=mrn).exists():
            mrn = generate_mrn()

        patient = Patient.objects.create(
            mrn=mrn,
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            date_of_birth=data.get("date_of_birth"),
            gender=data.get("gender"),
            phone=data.get("phone"),
            email=data.get("email"),
            address=data.get("address", {}),
            blood_type=data.get("blood_type"),
            allergies=data.get("allergies", []),
            insurance_provider=data.get("insurance_provider"),
            insurance_id=data.get("insurance_id"),
            nationality=data.get("nationality"),
            marital_status=data.get("marital_status"),
            preferred_language=data.get("preferred_language"),
            consent_signed=data.get("consent_signed", False),
            emergency_contact=data.get("emergency_contact", {}),
            insurance_details=data.get("insurance_details", {}),
        )

        # Integration: Create default consents
        from .models import Consent, ConsentStatus
        Consent.objects.create(patient=patient, type="general", status=ConsentStatus.PENDING)
        Consent.objects.create(patient=patient, type="financial", status=ConsentStatus.PENDING)
        
        return patient

    @staticmethod
    def find_duplicates(patient: Patient) -> list:
        """Fuzzy match against first/last name to detect potential duplicates."""
        candidates = Patient.objects.exclude(id=patient.id).filter(deleted_at__isnull=True)[:1000]
        results = []
        for c in candidates:
            score = fuzz.token_sort_ratio(
                f"{patient.first_name} {patient.last_name}",
                f"{c.first_name} {c.last_name}",
            )
            if score >= 80:
                results.append({
                    "id": str(c.id),
                    "mrn": c.mrn,
                    "firstName": c.first_name,
                    "lastName": c.last_name,
                    "dateOfBirth": c.date_of_birth.isoformat(),
                    "phone": c.phone,
                    "matchScore": score,
                })
        return sorted(results, key=lambda x: x["matchScore"], reverse=True)[:10]

    @staticmethod
    def merge_patients(keep_id: str, merge_id: str, user) -> Patient:
        """Merge merge_id into keep_id, re-parent all records, soft-delete merge_id."""
        try:
            keep = Patient.objects.get(id=keep_id, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError(f"Patient {keep_id} not found.")
        try:
            merge = Patient.objects.get(id=merge_id, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError(f"Patient {merge_id} not found.")

        if str(keep_id) == str(merge_id):
            raise ConflictError("Cannot merge a patient with themselves.")

        with transaction.atomic():
            from apps.billing.models import Claim, Denial, Invoice, Payment
            from apps.cdss.models import CDSSConsultRequest, CDSSRecommendation
            from apps.doctors.models import Encounter, Diagnosis, Order, Prescription, Referral
            from apps.laboratory.models import CriticalValue, LabPanel, LabReport, Specimen
            from apps.nurses.models import (
                DischargeChecklistItem,
                Handoff,
                IntakeOutput,
                MAREntry,
                NursingNote,
                PainAssessment,
                Task,
                Vitals,
                Wound,
            )
            from apps.pharmacy.models import DispenseRecord, DrugWarning, PharmacyPrescription, Refill
            from apps.radiology.models import (
                ImagingOrder,
                ImagingStudy,
                ModalitySchedule,
                RadCriticalFinding,
                RadiologyReport,
            )
            from .models import Appointment, Consent, Queue

            Encounter.objects.filter(patient=merge).update(patient=keep)
            Diagnosis.objects.filter(patient=merge).update(patient=keep)
            Order.objects.filter(patient=merge).update(patient=keep)
            Prescription.objects.filter(patient=merge).update(patient=keep)
            Referral.objects.filter(patient=merge).update(patient=keep)

            Admission.objects.filter(patient=merge).update(patient=keep)
            Queue.objects.filter(patient=merge).update(patient=keep)
            Consent.objects.filter(patient=merge).update(patient=keep)
            Appointment.objects.filter(patient=merge).update(patient=keep)

            Vitals.objects.filter(patient=merge).update(patient=keep)
            IntakeOutput.objects.filter(patient=merge).update(patient=keep)
            PainAssessment.objects.filter(patient=merge).update(patient=keep)
            MAREntry.objects.filter(patient=merge).update(patient=keep)
            NursingNote.objects.filter(patient=merge).update(patient=keep)
            Task.objects.filter(patient=merge).update(patient=keep)
            Wound.objects.filter(patient=merge).update(patient=keep)
            Handoff.objects.filter(patient=merge).update(patient=keep)
            DischargeChecklistItem.objects.filter(patient=merge).update(patient=keep)

            Specimen.objects.filter(patient=merge).update(patient=keep)
            LabPanel.objects.filter(patient=merge).update(patient=keep)
            LabReport.objects.filter(patient=merge).update(patient=keep)
            CriticalValue.objects.filter(patient=merge).update(patient=keep)

            ImagingOrder.objects.filter(patient=merge).update(patient=keep)
            ImagingStudy.objects.filter(patient=merge).update(patient=keep)
            RadiologyReport.objects.filter(patient=merge).update(patient=keep)
            RadCriticalFinding.objects.filter(patient=merge).update(patient=keep)
            ModalitySchedule.objects.filter(patient=merge).update(patient=keep)

            PharmacyPrescription.objects.filter(patient=merge).update(patient=keep)
            DrugWarning.objects.filter(patient=merge).update(patient=keep)
            DispenseRecord.objects.filter(patient=merge).update(patient=keep)
            Refill.objects.filter(patient=merge).update(patient=keep)

            Invoice.objects.filter(patient=merge).update(patient=keep)
            Claim.objects.filter(patient=merge).update(patient=keep)
            Payment.objects.filter(patient=merge).update(patient=keep)
            Denial.objects.filter(patient=merge).update(patient=keep)

            CDSSConsultRequest.objects.filter(patient=merge).update(patient=keep)
            CDSSRecommendation.objects.filter(patient=merge).update(patient=keep)

            merge.deleted_at = timezone.now()
            merge.save(update_fields=["deleted_at"])
        return keep


class AdmissionService:
    @staticmethod
    def discharge(admission: Admission, data: dict, user) -> Admission:
        with transaction.atomic():
            admission.status = AdmissionStatus.DISCHARGED
            admission.discharged_at = timezone.now()
            admission.discharge_type = data.get("dischargeType")
            admission.discharge_summary = data.get("summary")
            admission.follow_up_date = data.get("followUpDate")
            admission.discharged_by_id = user.id
            admission.save()

            if admission.bed_id:
                from apps.administration.models import Bed

                Bed.objects.filter(id=admission.bed_id).update(status="available")

            admission.patient.status = PatientStatus.DISCHARGED
            admission.patient.admission_date = None
            admission.patient.ward_id = None
            admission.patient.room_number = None
            admission.patient.save(update_fields=["status", "admission_date", "ward_id", "room_number"])

        return admission

    @staticmethod
    def transfer(admission: Admission, data: dict, user):
        # AdmissionTransfer lives in patients.models, not nurses
        from .models import AdmissionTransfer
        from apps.administration.models import Bed

        to_bed_id = data.get("toBed")
        from_bed_id = data.get("fromBed") or admission.bed_id

        with transaction.atomic():
            destination_bed = None
            if to_bed_id:
                try:
                    destination_bed = Bed.objects.select_related("ward").get(id=to_bed_id)
                except Bed.DoesNotExist:
                    raise NotFoundError("Destination bed not found.")
                if destination_bed.status != "available":
                    raise ConflictError("Destination bed is not available.")

            transfer = AdmissionTransfer.objects.create(
                admission=admission,
                from_ward_id=data.get("fromWard") or admission.ward_id,
                from_bed_id=from_bed_id,
                to_ward_id=data.get("toWard"),
                to_bed_id=to_bed_id,
                reason=data.get("reason", ""),
                approved_by_id=data.get("approvedBy") or user.id,
            )

            admission.ward_id = data.get("toWard")
            admission.bed_id = to_bed_id
            admission.save(update_fields=["ward_id", "bed_id"])

            if from_bed_id:
                Bed.objects.filter(id=from_bed_id).update(status="available")
            if destination_bed:
                destination_bed.status = "occupied"
                destination_bed.save(update_fields=["status"])

            admission.patient.status = PatientStatus.ADMITTED
            admission.patient.ward_id = admission.ward_id
            admission.patient.room_number = (
                (destination_bed.room_number or destination_bed.number) if destination_bed else None
            )
            admission.patient.save(update_fields=["status", "ward_id", "room_number"])

        return transfer
