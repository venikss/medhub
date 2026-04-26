from __future__ import annotations

from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.administration.models import Bed, Department, Ward
from apps.authentication.models import User, UserRole, UserStatus
from apps.doctors.models import (
    Diagnosis,
    DiagnosisStatus,
    DiagnosisType,
    Encounter,
    EncounterStatus,
    Order,
    OrderCategory,
    OrderStatus,
    Prescription,
    PrescriptionStatus,
    Priority,
    VisitType,
)
from apps.laboratory.models import (
    CriticalValue,
    CriticalValueStatus,
    LabPanel,
    LabPanelStatus,
    LabResultFlag,
    LabResultStatus,
    LabTestResult,
    Specimen,
    SpecimenCondition,
    SpecimenStatus,
    SpecimenType,
)
from apps.nurses.models import Task, TaskStatus, Vitals
from apps.patients.models import Admission, AdmissionStatus, AdmissionType, Gender, Patient, PatientStatus
from apps.pharmacy.models import DrugWarning, PharmacyPrescription, RxSetting, RxStatus
from apps.radiology.models import (
    ImagingModality,
    ImagingOrder,
    ImagingStudy,
    ImagingStudyStatus,
    RadCriticalFinding,
    RadCriticalFindingStatus,
    RadReportStatus,
    RadiologyReport,
)


class Command(BaseCommand):
    help = "Seed a few realistic demo patients so KG and CDSS screens are easier to understand."

    def handle(self, *args, **options):
        with transaction.atomic():
            clinician_pool = self._resolve_users()
            location = self._resolve_location()

            created = []
            created.append(self._seed_patient_one(clinician_pool, location))
            created.append(self._seed_patient_two(clinician_pool, location))
            created.append(self._seed_patient_three(clinician_pool, location))
            created.append(self._seed_patient_four(clinician_pool, location))

        self.stdout.write(self.style.SUCCESS(f"Seeded or refreshed {len(created)} demo CDSS patients."))
        for patient in created:
            self.stdout.write(f"- {patient.full_name} [{patient.mrn}]")

    def _resolve_users(self) -> dict[str, User | None]:
        active_users = User.objects.filter(status=UserStatus.ACTIVE)

        def pick(role: str) -> User | None:
            return active_users.filter(role=role).order_by("created_at").first()

        any_clinical = active_users.exclude(role=UserRole.PATIENT).order_by("created_at").first()
        doctor = pick(UserRole.DOCTOR) or any_clinical

        return {
            "doctor": doctor,
            "nurse": pick(UserRole.NURSE) or doctor,
            "lab": pick(UserRole.LAB_TECH) or doctor,
            "radiologist": pick(UserRole.RADIOLOGIST) or doctor,
            "pharmacist": pick(UserRole.PHARMACIST) or doctor,
        }

    def _resolve_location(self) -> dict[str, object | None]:
        ward = Ward.objects.filter(status="active").select_related("department").order_by("name").first()
        department = ward.department if ward else Department.objects.filter(status="active").order_by("name").first()
        bed = (
            Bed.objects.filter(ward=ward, status="available").order_by("room_number", "number").first()
            if ward
            else None
        )
        return {"department": department, "ward": ward, "bed": bed}

    def _base_patient(
        self,
        *,
        mrn: str,
        first_name: str,
        last_name: str,
        date_of_birth: date,
        gender: str,
        phone: str,
        allergies: list[str],
        assigned_doctor: User | None,
        ward: Ward | None,
    ) -> Patient:
        patient, _ = Patient.objects.update_or_create(
            mrn=mrn,
            defaults={
                "first_name": first_name,
                "last_name": last_name,
                "date_of_birth": date_of_birth,
                "gender": gender,
                "phone": phone,
                "email": f"{first_name.lower()}.{last_name.lower()}@demo.local",
                "blood_type": "O+" if gender == Gender.MALE else "A+",
                "allergies": allergies,
                "status": PatientStatus.ADMITTED,
                "consent_signed": True,
                "assigned_doctor": assigned_doctor,
                "ward": ward,
                "room_number": getattr(getattr(ward, "beds", None), "first", lambda: None)() and None,
                "admission_date": timezone.now() - timedelta(days=2),
                "preferred_language": "arabic",
                "nationality": "Egyptian",
                "marital_status": "married",
                "address": {
                    "city": "Cairo",
                    "district": "Nasr City",
                    "line1": "Demo Address",
                },
                "emergency_contact": {
                    "name": "Demo Relative",
                    "relationship": "Spouse",
                    "phone": "+201000000000",
                },
            },
        )
        return patient

    def _seed_patient_four(self, users: dict[str, User | None], location: dict[str, object | None]) -> Patient:
        patient = self._base_patient(
            mrn="DEMO-CDSS-004",
            first_name="Omar",
            last_name="Farid",
            date_of_birth=date(1964, 6, 21),
            gender=Gender.MALE,
            phone="+201200000004",
            allergies=["Shellfish"],
            assigned_doctor=users["doctor"],
            ward=location["ward"],
        )
        self._ensure_admission(patient, users["doctor"], location, "Acute decompensated heart failure with volume overload")
        encounter = self._ensure_encounter(patient, users["doctor"], "Optimize heart failure therapy, monitor volume status, and coordinate follow-up imaging.")

        self._ensure_diagnosis(patient, encounter, users["doctor"], code="I50.23", description="Acute on chronic systolic heart failure", snomed_code="10633002", snomed_display="Congestive heart failure", diagnosis_type=DiagnosisType.PRIMARY, status=DiagnosisStatus.ACTIVE)
        self._ensure_diagnosis(patient, encounter, users["doctor"], code="E87.1", description="Hyponatremia", snomed_code="89627008", snomed_display="Hyponatremia", diagnosis_type=DiagnosisType.SECONDARY, status=DiagnosisStatus.ACTIVE)

        self._ensure_prescription(patient, encounter, users["doctor"], medication="Furosemide 40 mg Tablet", generic_name="Furosemide", rxnorm_code="4603", dosage="40 mg", route="PO", frequency="BID", quantity=30, sig="Take one tablet twice daily.")
        self._ensure_prescription(patient, encounter, users["doctor"], medication="Bisoprolol 5 mg Tablet", generic_name="Bisoprolol", rxnorm_code="19484", dosage="5 mg", route="PO", frequency="Daily", quantity=30, sig="Take one tablet daily.")

        self._ensure_lab_bundle(
            patient,
            encounter,
            users["doctor"],
            users["lab"],
            panel_name="Heart Failure Monitoring",
            order_name="BMP and BNP",
            results=[
                {
                    "test_code": "2951-2",
                    "test_name": "Sodium",
                    "value": "128",
                    "unit": "mmol/L",
                    "reference_range": "136-145",
                    "flag": LabResultFlag.LOW,
                    "previous_value": "132",
                    "delta": "-4",
                    "status": LabResultStatus.FINAL,
                },
                {
                    "test_code": "30934-4",
                    "test_name": "NT-proBNP",
                    "value": "4200",
                    "unit": "pg/mL",
                    "reference_range": "<125",
                    "flag": LabResultFlag.HIGH,
                    "status": LabResultStatus.FINAL,
                },
            ],
        )

        self._ensure_radiology_bundle(
            patient,
            encounter,
            users["doctor"],
            users["radiologist"],
            modality=ImagingModality.XR,
            exam_name="Chest X-Ray",
            body_part="chest",
            indication="Progressive dyspnea and volume overload.",
            findings="Mild pulmonary vascular congestion with small bilateral pleural effusions.",
            impression="Findings are consistent with congestive heart failure exacerbation.",
            recommendations="Repeat chest imaging only if respiratory status worsens or fails to improve.",
        )

        self._ensure_vitals_and_tasks(
            patient,
            users["nurse"],
            vitals={
                "systolic": 98,
                "diastolic": 60,
                "heart_rate": 108,
                "temperature": "36.7",
                "spo2": 91,
                "respiratory_rate": 24,
                "pain_score": 1,
                "news2_score": 6,
                "notes": "Orthopnea and increased work of breathing overnight.",
            },
            task={
                "type": "fluid balance review",
                "description": "Reassess fluid balance, daily weight, and response to diuresis.",
                "priority": "high",
                "status": TaskStatus.OVERDUE,
                "due_time": timezone.now() - timedelta(hours=1, minutes=45),
                "shift": "night",
            },
        )
        return patient

    def _ensure_admission(self, patient: Patient, doctor: User | None, location: dict[str, object | None], reason: str) -> None:
        admission, _ = Admission.objects.update_or_create(
            patient=patient,
            status=AdmissionStatus.ACTIVE,
            defaults={
                "type": AdmissionType.INPATIENT,
                "admitting_doctor": doctor,
                "department": location["department"],
                "ward": location["ward"],
                "bed": location["bed"],
                "reason_for_admission": reason,
                "expected_discharge": timezone.now() + timedelta(days=3),
            },
        )
        if location["bed"] and admission.bed_id != location["bed"].id:
            admission.bed = location["bed"]
            admission.save(update_fields=["bed"])

    def _ensure_encounter(self, patient: Patient, doctor: User | None, plan: str) -> Encounter | None:
        if not doctor:
            return None
        encounter, _ = Encounter.objects.update_or_create(
            patient=patient,
            doctor=doctor,
            status=EncounterStatus.IN_PROGRESS,
            defaults={
                "visit_type": VisitType.INPATIENT,
                "subjective": "Patient reviewed during realistic CDSS demo seeding.",
                "objective": "See linked vitals, labs, imaging, and prescriptions.",
                "assessment": plan,
                "plan": plan,
            },
        )
        return encounter

    def _ensure_diagnosis(
        self,
        patient: Patient,
        encounter: Encounter | None,
        doctor: User | None,
        *,
        code: str,
        description: str,
        snomed_code: str,
        snomed_display: str,
        diagnosis_type: str,
        status: str,
    ) -> None:
        Diagnosis.objects.update_or_create(
            patient=patient,
            code=code,
            description=description,
            defaults={
                "encounter": encounter,
                "snomed_code": snomed_code,
                "snomed_display": snomed_display,
                "type": diagnosis_type,
                "status": status,
                "diagnosed_by": doctor,
            },
        )

    def _ensure_prescription(
        self,
        patient: Patient,
        encounter: Encounter | None,
        doctor: User | None,
        *,
        medication: str,
        generic_name: str,
        rxnorm_code: str,
        dosage: str,
        route: str,
        frequency: str,
        quantity: int,
        sig: str,
        end_date: date | None = None,
        pharmacy_status: str = RxStatus.VERIFIED,
        warning: dict | None = None,
    ) -> Prescription:
        prescription, _ = Prescription.objects.update_or_create(
            patient=patient,
            medication=medication,
            status=PrescriptionStatus.ACTIVE,
            defaults={
                "encounter": encounter,
                "prescribed_by": doctor,
                "generic_name": generic_name,
                "rxnorm_code": rxnorm_code,
                "dosage": dosage,
                "route": route,
                "frequency": frequency,
                "quantity": quantity,
                "refills": 0,
                "sig": sig,
                "start_date": timezone.now().date() - timedelta(days=1),
                "end_date": end_date,
            },
        )
        pharm_rx, _ = PharmacyPrescription.objects.update_or_create(
            original_prescription=prescription,
            defaults={
                "patient": patient,
                "status": pharmacy_status,
                "setting": RxSetting.INPATIENT,
                "priority": "routine",
                "verified_by": doctor,
                "verified_at": timezone.now() - timedelta(hours=4),
                "quantity_dispensed": quantity,
            },
        )
        if warning:
            DrugWarning.objects.update_or_create(
                patient=patient,
                prescription=pharm_rx,
                type=warning["type"],
                message=warning["message"],
                defaults={
                    "severity": warning["severity"],
                    "medications_involved": warning.get("medications_involved", []),
                    "resolved": False,
                },
            )
        return prescription

    def _ensure_lab_bundle(
        self,
        patient: Patient,
        encounter: Encounter | None,
        doctor: User | None,
        lab_user: User | None,
        *,
        panel_name: str,
        order_name: str,
        results: list[dict],
    ) -> None:
        order, _ = Order.objects.update_or_create(
            patient=patient,
            name=order_name,
            category=OrderCategory.LAB,
            defaults={
                "encounter": encounter,
                "ordered_by": doctor,
                "priority": Priority.ROUTINE,
                "status": OrderStatus.RESULTED,
                "indication": "Demo CDSS laboratory context",
                "clinical_history": "Seeded realistic laboratory panel for KG/CDSS review.",
                "specimen_type": "blood",
            },
        )
        specimen, _ = Specimen.objects.update_or_create(
            patient=patient,
            order=order,
            type=SpecimenType.BLOOD,
            defaults={
                "collected_by": lab_user,
                "status": SpecimenStatus.RESULTED,
                "condition": SpecimenCondition.ACCEPTABLE,
                "collected_at": timezone.now() - timedelta(hours=10),
                "received_at": timezone.now() - timedelta(hours=9),
                "received_by": lab_user,
            },
        )
        panel, _ = LabPanel.objects.update_or_create(
            patient=patient,
            order=order,
            specimen=specimen,
            name=panel_name,
            defaults={
                "status": LabPanelStatus.RELEASED,
                "priority": "routine",
                "verified_by": lab_user,
                "verified_at": timezone.now() - timedelta(hours=7),
                "has_critical": any(item.get("is_critical") for item in results),
            },
        )
        for item in results:
            result, _ = LabTestResult.objects.update_or_create(
                panel=panel,
                test_code=item["test_code"],
                defaults={
                    "specimen": specimen,
                    "test_name": item["test_name"],
                    "value": item["value"],
                    "unit": item.get("unit", ""),
                    "reference_range": item.get("reference_range", ""),
                    "flag": item.get("flag"),
                    "is_critical": item.get("is_critical", False),
                    "previous_value": item.get("previous_value"),
                    "delta": item.get("delta"),
                    "delta_flag": item.get("delta_flag"),
                    "comment": item.get("comment"),
                    "analyzed_at": timezone.now() - timedelta(hours=8),
                    "verified_by": lab_user,
                    "verified_at": timezone.now() - timedelta(hours=7),
                    "status": item.get("status", LabResultStatus.FINAL),
                },
            )
            if item.get("critical_value"):
                CriticalValue.objects.update_or_create(
                    result=result,
                    patient=patient,
                    defaults={
                        "test_name": item["test_name"],
                        "value": item["value"],
                        "unit": item.get("unit", ""),
                        "status": item["critical_value"].get("status", CriticalValueStatus.PENDING),
                        "notified_to": item["critical_value"].get("notified_to"),
                        "notified_at": item["critical_value"].get("notified_at"),
                        "notification_method": item["critical_value"].get("notification_method"),
                        "readback_provided": item["critical_value"].get("readback_provided", False),
                    },
                )

    def _ensure_radiology_bundle(
        self,
        patient: Patient,
        encounter: Encounter | None,
        doctor: User | None,
        radiologist: User | None,
        *,
        modality: str,
        exam_name: str,
        body_part: str,
        indication: str,
        findings: str,
        impression: str,
        recommendations: str,
        critical_finding: dict | None = None,
    ) -> None:
        doctor_order, _ = Order.objects.update_or_create(
            patient=patient,
            name=exam_name,
            category=OrderCategory.IMAGING,
            defaults={
                "encounter": encounter,
                "ordered_by": doctor,
                "priority": Priority.URGENT if critical_finding else Priority.ROUTINE,
                "status": OrderStatus.RESULTED,
                "indication": indication,
                "exam_code": exam_name.upper().replace(" ", "_")[:48],
                "body_part": body_part,
                "clinical_history": indication,
            },
        )
        imaging_order, _ = ImagingOrder.objects.update_or_create(
            patient=patient,
            doctor_order=doctor_order,
            defaults={
                "ordered_by": doctor,
                "modality": modality,
                "exam_code": doctor_order.exam_code,
                "exam_name": exam_name,
                "body_part": body_part,
                "indication": indication,
                "clinical_history": indication,
                "priority": "urgent" if critical_finding else "routine",
                "status": ImagingStudyStatus.REPORTED,
                "assigned_radiologist": radiologist,
            },
        )
        study, _ = ImagingStudy.objects.update_or_create(
            order=imaging_order,
            defaults={
                "patient": patient,
                "exam_date": timezone.now() - timedelta(hours=14),
                "room": "CT-2" if modality == ImagingModality.CT else "XR-1",
                "status": ImagingStudyStatus.REPORTED,
                "started_at": timezone.now() - timedelta(hours=14, minutes=30),
                "completed_at": timezone.now() - timedelta(hours=14),
                "images_count": 220 if modality == ImagingModality.CT else 4,
                "series_count": 3 if modality == ImagingModality.CT else 1,
            },
        )
        RadiologyReport.objects.update_or_create(
            study=study,
            patient=patient,
            defaults={
                "indication": indication,
                "technique": f"{modality} examination performed per standard protocol.",
                "findings": findings,
                "impression": impression,
                "recommendations": recommendations,
                "status": RadReportStatus.FINAL,
                "signed_by": radiologist,
                "signed_at": timezone.now() - timedelta(hours=12),
            },
        )
        if critical_finding:
            RadCriticalFinding.objects.update_or_create(
                study=study,
                patient=patient,
                finding=critical_finding["finding"],
                defaults={
                    "severity": critical_finding["severity"],
                    "identified_by": radiologist,
                    "status": critical_finding.get("status", RadCriticalFindingStatus.NOTIFIED),
                    "notified_to": critical_finding.get("notified_to"),
                    "notified_at": critical_finding.get("notified_at"),
                },
            )

    def _ensure_vitals_and_tasks(
        self,
        patient: Patient,
        nurse: User | None,
        *,
        vitals: dict,
        task: dict | None = None,
    ) -> None:
        Vitals.objects.create(
            patient=patient,
            recorded_by=nurse,
            systolic=vitals.get("systolic"),
            diastolic=vitals.get("diastolic"),
            heart_rate=vitals.get("heart_rate"),
            temperature=Decimal(str(vitals.get("temperature"))) if vitals.get("temperature") is not None else None,
            spo2=vitals.get("spo2"),
            respiratory_rate=vitals.get("respiratory_rate"),
            pain_score=vitals.get("pain_score"),
            news2_score=vitals.get("news2_score"),
            notes=vitals.get("notes"),
        )
        if task:
            Task.objects.update_or_create(
                patient=patient,
                description=task["description"],
                defaults={
                    "assigned_to": nurse,
                    "room": patient.room_number or "Demo",
                    "type": task["type"],
                    "priority": task.get("priority", "normal"),
                    "status": task.get("status", TaskStatus.OVERDUE),
                    "due_time": task.get("due_time", timezone.now() - timedelta(hours=2)),
                    "shift": task.get("shift", "day"),
                },
            )

    def _seed_patient_one(self, users: dict[str, User | None], location: dict[str, object | None]) -> Patient:
        patient = self._base_patient(
            mrn="DEMO-CDSS-001",
            first_name="Noha",
            last_name="Kamal",
            date_of_birth=date(1967, 4, 17),
            gender=Gender.FEMALE,
            phone="+201200000001",
            allergies=["NSAIDs"],
            assigned_doctor=users["doctor"],
            ward=location["ward"],
        )
        self._ensure_admission(patient, users["doctor"], location, "Hyperkalemia and acute-on-chronic kidney disease review")
        encounter = self._ensure_encounter(patient, users["doctor"], "Review diabetic kidney disease, BP control, and medication safety.")

        self._ensure_diagnosis(patient, encounter, users["doctor"], code="E11.22", description="Type 2 diabetes mellitus with diabetic chronic kidney disease", snomed_code="44054006", snomed_display="Type 2 diabetes mellitus", diagnosis_type=DiagnosisType.PRIMARY, status=DiagnosisStatus.CHRONIC)
        self._ensure_diagnosis(patient, encounter, users["doctor"], code="I10", description="Essential hypertension", snomed_code="59621000", snomed_display="Essential hypertension", diagnosis_type=DiagnosisType.SECONDARY, status=DiagnosisStatus.CHRONIC)
        self._ensure_diagnosis(patient, encounter, users["doctor"], code="N18.4", description="Chronic kidney disease stage 4", snomed_code="431857002", snomed_display="Chronic kidney disease stage 4", diagnosis_type=DiagnosisType.SECONDARY, status=DiagnosisStatus.CHRONIC)

        self._ensure_prescription(patient, encounter, users["doctor"], medication="Metformin 500 mg Tablet", generic_name="Metformin", rxnorm_code="860975", dosage="500 mg", route="PO", frequency="BID", quantity=60, sig="Take one tablet twice daily with meals.")
        self._ensure_prescription(patient, encounter, users["doctor"], medication="Lisinopril 10 mg Tablet", generic_name="Lisinopril", rxnorm_code="29046", dosage="10 mg", route="PO", frequency="Daily", quantity=30, sig="Take one tablet daily.")
        self._ensure_prescription(patient, encounter, users["doctor"], medication="Atorvastatin 40 mg Tablet", generic_name="Atorvastatin", rxnorm_code="83367", dosage="40 mg", route="PO", frequency="Nightly", quantity=30, sig="Take one tablet at bedtime.")

        self._ensure_lab_bundle(
            patient,
            encounter,
            users["doctor"],
            users["lab"],
            panel_name="Renal Function and Electrolytes",
            order_name="BMP and Renal Profile",
            results=[
                {
                    "test_code": "33914-3",
                    "test_name": "eGFR",
                    "value": "28",
                    "unit": "mL/min/1.73m2",
                    "reference_range": ">60",
                    "flag": LabResultFlag.LOW,
                    "previous_value": "34",
                    "delta": "-6",
                    "status": LabResultStatus.FINAL,
                },
                {
                    "test_code": "2160-0",
                    "test_name": "Creatinine",
                    "value": "2.1",
                    "unit": "mg/dL",
                    "reference_range": "0.6-1.2",
                    "flag": LabResultFlag.HIGH,
                    "previous_value": "1.8",
                    "delta": "+0.3",
                    "status": LabResultStatus.FINAL,
                },
                {
                    "test_code": "2823-3",
                    "test_name": "Potassium",
                    "value": "6.1",
                    "unit": "mmol/L",
                    "reference_range": "3.5-5.1",
                    "flag": LabResultFlag.CRITICAL_HIGH,
                    "is_critical": True,
                    "status": LabResultStatus.FINAL,
                    "critical_value": {
                        "status": CriticalValueStatus.NOTIFIED,
                        "notified_to": users["doctor"].get_full_name() if users["doctor"] else "Doctor",
                        "notified_at": timezone.now() - timedelta(hours=6),
                        "notification_method": "phone",
                        "readback_provided": True,
                    },
                },
            ],
        )

        self._ensure_vitals_and_tasks(
            patient,
            users["nurse"],
            vitals={
                "systolic": 166,
                "diastolic": 94,
                "heart_rate": 92,
                "temperature": "37.1",
                "spo2": 97,
                "respiratory_rate": 18,
                "pain_score": 2,
                "news2_score": 2,
                "notes": "Stable but hypertensive.",
            },
        )
        return patient

    def _seed_patient_two(self, users: dict[str, User | None], location: dict[str, object | None]) -> Patient:
        patient = self._base_patient(
            mrn="DEMO-CDSS-002",
            first_name="Mahmoud",
            last_name="Adel",
            date_of_birth=date(1959, 9, 2),
            gender=Gender.MALE,
            phone="+201200000002",
            allergies=["Penicillin"],
            assigned_doctor=users["doctor"],
            ward=location["ward"],
        )
        self._ensure_admission(patient, users["doctor"], location, "Pneumonia with hypoxia and COPD exacerbation")
        encounter = self._ensure_encounter(patient, users["doctor"], "Treat community-acquired pneumonia, assess oxygen need, and review antibiotic safety.")

        self._ensure_diagnosis(patient, encounter, users["doctor"], code="J18.9", description="Community acquired pneumonia", snomed_code="233604007", snomed_display="Pneumonia", diagnosis_type=DiagnosisType.PRIMARY, status=DiagnosisStatus.ACTIVE)
        self._ensure_diagnosis(patient, encounter, users["doctor"], code="J44.1", description="COPD with acute exacerbation", snomed_code="195951007", snomed_display="Acute exacerbation of chronic obstructive airways disease", diagnosis_type=DiagnosisType.SECONDARY, status=DiagnosisStatus.CHRONIC)

        self._ensure_prescription(
            patient,
            encounter,
            users["doctor"],
            medication="Piperacillin-Tazobactam 4.5 g IV",
            generic_name="Piperacillin-Tazobactam",
            rxnorm_code="1659137",
            dosage="4.5 g",
            route="IV",
            frequency="Q8H",
            quantity=12,
            sig="Infuse every 8 hours for severe pneumonia coverage.",
            warning={
                "type": "allergy",
                "severity": "contraindicated",
                "message": "Patient allergy list includes Penicillin and active therapy includes piperacillin-tazobactam.",
                "medications_involved": ["Piperacillin-Tazobactam"],
            },
        )
        self._ensure_prescription(patient, encounter, users["doctor"], medication="Azithromycin 500 mg IV", generic_name="Azithromycin", rxnorm_code="18631", dosage="500 mg", route="IV", frequency="Daily", quantity=3, sig="Infuse once daily.")

        self._ensure_lab_bundle(
            patient,
            encounter,
            users["doctor"],
            users["lab"],
            panel_name="Inflammation and Chemistry",
            order_name="CBC and CMP",
            results=[
                {
                    "test_code": "6690-2",
                    "test_name": "White Blood Cell Count",
                    "value": "17.8",
                    "unit": "10^3/uL",
                    "reference_range": "4.0-11.0",
                    "flag": LabResultFlag.HIGH,
                    "previous_value": "14.2",
                    "delta": "+3.6",
                    "status": LabResultStatus.FINAL,
                },
                {
                    "test_code": "2951-2",
                    "test_name": "Sodium",
                    "value": "131",
                    "unit": "mmol/L",
                    "reference_range": "136-145",
                    "flag": LabResultFlag.LOW,
                    "status": LabResultStatus.FINAL,
                },
            ],
        )

        self._ensure_radiology_bundle(
            patient,
            encounter,
            users["doctor"],
            users["radiologist"],
            modality=ImagingModality.CT,
            exam_name="CT Chest",
            body_part="chest",
            indication="Fever, productive cough, and new hypoxia.",
            findings="Dense right lower lobe consolidation with small parapneumonic effusion. No pneumothorax.",
            impression="Right lower lobe pneumonia with small associated pleural effusion.",
            recommendations="Repeat chest imaging after treatment if symptoms or opacity persist. Pulmonary follow-up recommended.",
            critical_finding={
                "finding": "Progressive right lower lobe consolidation with increasing oxygen requirement.",
                "severity": "high",
                "status": RadCriticalFindingStatus.NOTIFIED,
                "notified_to": users["doctor"].get_full_name() if users["doctor"] else "Doctor",
                "notified_at": timezone.now() - timedelta(hours=11),
            },
        )

        self._ensure_vitals_and_tasks(
            patient,
            users["nurse"],
            vitals={
                "systolic": 132,
                "diastolic": 78,
                "heart_rate": 112,
                "temperature": "38.4",
                "spo2": 89,
                "respiratory_rate": 28,
                "pain_score": 3,
                "news2_score": 7,
                "notes": "On 2 L oxygen with persistent tachypnea.",
            },
            task={
                "type": "respiratory reassessment",
                "description": "Reassess oxygen requirement and repeat saturation check.",
                "priority": "high",
                "status": TaskStatus.OVERDUE,
                "due_time": timezone.now() - timedelta(hours=1, minutes=30),
                "shift": "day",
            },
        )
        return patient

    def _seed_patient_three(self, users: dict[str, User | None], location: dict[str, object | None]) -> Patient:
        patient = self._base_patient(
            mrn="DEMO-CDSS-003",
            first_name="Salma",
            last_name="Nabil",
            date_of_birth=date(1978, 12, 11),
            gender=Gender.FEMALE,
            phone="+201200000003",
            allergies=["Ibuprofen"],
            assigned_doctor=users["doctor"],
            ward=location["ward"],
        )
        self._ensure_admission(patient, users["doctor"], location, "Atrial fibrillation with symptomatic anemia")
        encounter = self._ensure_encounter(patient, users["doctor"], "Evaluate anemia source, anticoagulation safety, and discharge readiness.")

        self._ensure_diagnosis(patient, encounter, users["doctor"], code="I48.91", description="Atrial fibrillation", snomed_code="49436004", snomed_display="Atrial fibrillation", diagnosis_type=DiagnosisType.PRIMARY, status=DiagnosisStatus.CHRONIC)
        self._ensure_diagnosis(patient, encounter, users["doctor"], code="D50.9", description="Iron deficiency anemia", snomed_code="87522002", snomed_display="Iron deficiency anemia", diagnosis_type=DiagnosisType.SECONDARY, status=DiagnosisStatus.ACTIVE)

        self._ensure_prescription(patient, encounter, users["doctor"], medication="Warfarin 5 mg Tablet", generic_name="Warfarin", rxnorm_code="855332", dosage="5 mg", route="PO", frequency="Daily", quantity=30, sig="Take one tablet every evening.")
        self._ensure_prescription(patient, encounter, users["doctor"], medication="Ferrous Sulfate 325 mg Tablet", generic_name="Ferrous Sulfate", rxnorm_code="24947", dosage="325 mg", route="PO", frequency="TID", quantity=90, sig="Take one tablet three times daily with food.")

        self._ensure_lab_bundle(
            patient,
            encounter,
            users["doctor"],
            users["lab"],
            panel_name="Anemia and Coagulation Review",
            order_name="CBC and Coagulation",
            results=[
                {
                    "test_code": "718-7",
                    "test_name": "Hemoglobin",
                    "value": "7.8",
                    "unit": "g/dL",
                    "reference_range": "12.0-15.0",
                    "flag": LabResultFlag.CRITICAL_LOW,
                    "is_critical": True,
                    "previous_value": "9.1",
                    "delta": "-1.3",
                    "delta_flag": "significant-drop",
                    "status": LabResultStatus.FINAL,
                    "critical_value": {
                        "status": CriticalValueStatus.PENDING,
                        "notification_method": "phone",
                        "readback_provided": False,
                    },
                },
                {
                    "test_code": "6301-6",
                    "test_name": "INR",
                    "value": "3.4",
                    "unit": "",
                    "reference_range": "2.0-3.0",
                    "flag": LabResultFlag.HIGH,
                    "status": LabResultStatus.FINAL,
                },
            ],
        )

        self._ensure_vitals_and_tasks(
            patient,
            users["nurse"],
            vitals={
                "systolic": 104,
                "diastolic": 62,
                "heart_rate": 118,
                "temperature": "36.8",
                "spo2": 96,
                "respiratory_rate": 22,
                "pain_score": 1,
                "news2_score": 5,
                "notes": "Reports dizziness on ambulation.",
            },
            task={
                "type": "fall-risk reassessment",
                "description": "Repeat orthostatic vitals and document dizziness precautions.",
                "priority": "high",
                "status": TaskStatus.OVERDUE,
                "due_time": timezone.now() - timedelta(hours=2, minutes=15),
                "shift": "evening",
            },
        )
        return patient
