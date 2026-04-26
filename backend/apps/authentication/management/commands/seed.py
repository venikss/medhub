"""
Seed command: python manage.py seed

Creates one user per role plus enough demo data to exercise the main backend
modules from admin or the frontend. Safe to run multiple times.
"""

from datetime import date

from django.core.management.base import BaseCommand
from django.db import OperationalError, ProgrammingError
from django.utils import timezone


SEED_PASSWORD = "123456"


USERS = [
    {"email": "admin@medhub.io", "first_name": "Ali", "last_name": "Hassan", "role": "admin", "employee_id": "EMP001", "specialization": None},
    {"email": "doctor@medhub.io", "first_name": "Sara", "last_name": "Ahmed", "role": "doctor", "employee_id": "EMP002", "specialization": "General Medicine"},
    {"email": "doctor2@medhub.io", "first_name": "Omar", "last_name": "Mahmoud", "role": "doctor", "employee_id": "EMP011", "specialization": "Outpatient Care"},
    {"email": "nurse@medhub.io", "first_name": "Mona", "last_name": "Khalil", "role": "nurse", "employee_id": "EMP003", "specialization": "Nursery Care"},
    {"email": "nurse2@medhub.io", "first_name": "Salma", "last_name": "Youssef", "role": "nurse", "employee_id": "EMP012", "specialization": "Inpatient Nursing"},
    {"email": "labtech@medhub.io", "first_name": "Omar", "last_name": "Samy", "role": "lab_tech", "employee_id": "EMP004", "specialization": "Clinical Chemistry"},
    {"email": "labtech2@medhub.io", "first_name": "Nour", "last_name": "Adel", "role": "lab_tech", "employee_id": "EMP013", "specialization": "Hematology"},
    {"email": "radiologist@medhub.io", "first_name": "Nadia", "last_name": "Ibrahim", "role": "radiologist", "employee_id": "EMP005", "specialization": "Diagnostic Radiology"},
    {"email": "radiologist2@medhub.io", "first_name": "Tamer", "last_name": "Farouk", "role": "radiologist", "employee_id": "EMP014", "specialization": "Chest Imaging"},
    {"email": "pharmacist@medhub.io", "first_name": "Khaled", "last_name": "Mostafa", "role": "pharmacist", "employee_id": "EMP006", "specialization": "Clinical Pharmacy"},
    {"email": "pharmacist2@medhub.io", "first_name": "Reem", "last_name": "Gaber", "role": "pharmacist", "employee_id": "EMP015", "specialization": "Inpatient Pharmacy"},
    {"email": "billing@medhub.io", "first_name": "Rania", "last_name": "Fouad", "role": "billing_staff", "employee_id": "EMP007", "specialization": None},
    {"email": "billing2@medhub.io", "first_name": "Heba", "last_name": "Magdy", "role": "billing_staff", "employee_id": "EMP016", "specialization": None},
    {"email": "frontdesk@medhub.io", "first_name": "Yasmine", "last_name": "Nasser", "role": "front_desk", "employee_id": "EMP008", "specialization": None},
    {"email": "frontdesk2@medhub.io", "first_name": "Mai", "last_name": "Karam", "role": "front_desk", "employee_id": "EMP017", "specialization": None},
    {"email": "patient@medhub.io", "first_name": "Ahmed", "last_name": "Tawfik", "role": "patient", "employee_id": None, "specialization": None},
]

DEPARTMENTS = [
    {"name": "Inpatient", "code": "INP", "type": "clinical"},
    {"name": "Outpatient", "code": "OUT", "type": "clinical"},
    {"name": "Doctor", "code": "DOC", "type": "clinical"},
    {"name": "Nursery", "code": "NUR", "type": "clinical"},
    {"name": "Radiology", "code": "RAD", "type": "diagnostic"},
    {"name": "Laboratory", "code": "LAB", "type": "diagnostic"},
    {"name": "Pharmacy", "code": "PHA", "type": "support"},
    {"name": "Billing", "code": "BIL", "type": "administrative"},
    {"name": "Front Desk", "code": "FD", "type": "administrative"},
    {"name": "Administration", "code": "ADM", "type": "administrative"},
]

WARDS = [
    {"name": "Ward A - Inpatient", "code": "WA", "type": "general", "floor_number": 1, "total_beds": 20, "dept_code": "INP"},
    {"name": "Ward B - Doctor Services", "code": "WB", "type": "surgery", "floor_number": 2, "total_beds": 15, "dept_code": "DOC"},
    {"name": "Ward C - Nursery", "code": "WC", "type": "general", "floor_number": 3, "total_beds": 12, "dept_code": "NUR"},
]

PATIENTS_DATA = [
    {"first_name": "Fatima", "last_name": "Ali", "dob": date(1990, 3, 15), "gender": "female", "phone": "+201001234501", "blood_type": "A+"},
    {"first_name": "Mohamed", "last_name": "Hassan", "dob": date(1975, 7, 22), "gender": "male", "phone": "+201001234502", "blood_type": "O+"},
    {"first_name": "Hana", "last_name": "Ibrahim", "dob": date(2000, 12, 5), "gender": "female", "phone": "+201001234503", "blood_type": "B-"},
    {"first_name": "Karim", "last_name": "Sayed", "dob": date(1988, 8, 30), "gender": "male", "phone": "+201001234504", "blood_type": "AB+"},
    {"first_name": "Layla", "last_name": "Nour", "dob": date(1995, 1, 18), "gender": "female", "phone": "+201001234505", "blood_type": "O-"},
    {"first_name": "Youssef", "last_name": "Adel", "dob": date(1969, 4, 9), "gender": "male", "phone": "+201001234506", "blood_type": "A-"},
    {"first_name": "Mariam", "last_name": "Fathy", "dob": date(1983, 11, 2), "gender": "female", "phone": "+201001234507", "blood_type": "B+"},
    {"first_name": "Noha", "last_name": "Kamal", "dob": date(1998, 6, 27), "gender": "female", "phone": "+201001234508", "blood_type": "O+"},
]

USER_DEPARTMENT_CODES = {
    "admin@medhub.io": "ADM",
    "doctor@medhub.io": "DOC",
    "doctor2@medhub.io": "OUT",
    "nurse@medhub.io": "NUR",
    "nurse2@medhub.io": "INP",
    "labtech@medhub.io": "LAB",
    "labtech2@medhub.io": "LAB",
    "radiologist@medhub.io": "RAD",
    "radiologist2@medhub.io": "RAD",
    "pharmacist@medhub.io": "PHA",
    "pharmacist2@medhub.io": "PHA",
    "billing@medhub.io": "BIL",
    "billing2@medhub.io": "BIL",
    "frontdesk@medhub.io": "FD",
    "frontdesk2@medhub.io": "FD",
}


class Command(BaseCommand):
    help = "Seed the database with demo data for all roles and major modules."

    def handle(self, *args, **options):
        self._seed_departments()
        self._seed_wards()
        self._seed_beds()
        self._seed_users()
        self._seed_patients()
        self._seed_clinical_demo_data()
        self._safe_seed(self._seed_billing_demo_data, "billing")
        self._safe_seed(self._seed_pharmacy_demo_data, "pharmacy")
        self.stdout.write(self.style.SUCCESS("Database seeded successfully."))
        self.stdout.write(self.style.WARNING(f"Demo password for seeded users: {SEED_PASSWORD}"))

    def _safe_seed(self, fn, label):
        try:
            fn()
        except (ProgrammingError, OperationalError) as exc:
            self.stdout.write(
                self.style.WARNING(
                    f"Skipped {label} demo data because the current database schema is behind the code: {exc}"
                )
            )

    def _seed_departments(self):
        from apps.administration.models import Department

        for item in DEPARTMENTS:
            obj, created = Department.objects.get_or_create(
                code=item["code"],
                defaults={"name": item["name"], "type": item["type"], "status": "active"},
            )
            if created:
                self.stdout.write(f"Created department: {obj.name}")

    def _seed_wards(self):
        from apps.administration.models import Department, Ward

        for item in WARDS:
            dept = Department.objects.filter(code=item["dept_code"]).first()
            if not dept:
                continue
            obj, created = Ward.objects.get_or_create(
                code=item["code"],
                defaults={
                    "name": item["name"],
                    "type": item["type"],
                    "floor_number": item["floor_number"],
                    "total_beds": item["total_beds"],
                    "department": dept,
                    "status": "active",
                },
            )
            if created:
                self.stdout.write(f"Created ward: {obj.name}")

    def _seed_beds(self):
        from apps.administration.models import Bed, Ward

        for ward in Ward.objects.all():
            for index in range(1, 5):
                number = f"{ward.code}-{index:02d}"
                obj, created = Bed.objects.get_or_create(
                    ward=ward,
                    number=number,
                    defaults={"type": "standard", "status": "available"},
                )
                if created:
                    self.stdout.write(f"Created bed: {obj.number}")

    def _seed_users(self):
        from apps.administration.models import Department
        from apps.authentication.models import User

        departments = {dept.code: dept for dept in Department.objects.all()}
        for item in USERS:
            obj, created = User.objects.get_or_create(
                email=item["email"],
                defaults={
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "role": item["role"],
                    "status": "active",
                    "employee_id": item["employee_id"],
                    "specialization": item["specialization"],
                    "is_staff": item["role"] == "admin",
                    "is_superuser": item["role"] == "admin",
                    "department": departments.get(USER_DEPARTMENT_CODES.get(item["email"])),
                },
            )
            if created or not obj.check_password(SEED_PASSWORD):
                obj.set_password(SEED_PASSWORD)
                obj.save(update_fields=["password"])
            expected_department = departments.get(USER_DEPARTMENT_CODES.get(item["email"]))
            updates = []
            if obj.status != "active":
                obj.status = "active"
                updates.append("status")
            if expected_department and obj.department_id != expected_department.id:
                obj.department = expected_department
                updates.append("department")
            if updates:
                obj.save(update_fields=updates)
            if created:
                self.stdout.write(f"Created user: {obj.email} [{obj.role}]")

    def _seed_patients(self):
        from apps.patients.models import Patient

        for item in PATIENTS_DATA:
            obj, created = Patient.objects.get_or_create(
                phone=item["phone"],
                defaults={
                    "first_name": item["first_name"],
                    "last_name": item["last_name"],
                    "date_of_birth": item["dob"],
                    "gender": item["gender"],
                    "phone": item["phone"],
                    "blood_type": item["blood_type"],
                    "status": "active",
                    "email": f"{item['first_name'].lower()}.{item['last_name'].lower()}@example.com",
                    "address": {"city": "Cairo", "country": "Egypt"},
                    "nationality": "Egyptian",
                    "preferred_language": "arabic",
                },
            )
            if created:
                self.stdout.write(f"Created patient: {obj.first_name} {obj.last_name} [{obj.mrn}]")

    def _seed_clinical_demo_data(self):
        from apps.administration.models import Bed, Department, Ward
        from apps.authentication.models import User
        from apps.doctors.models import Diagnosis, Encounter, Order, Prescription, Referral, OrderCategory, Priority
        from apps.patients.models import Admission, AdmissionStatus, AdmissionType, Appointment, AppointmentStatus, Patient

        doctors = list(User.objects.filter(role="doctor").order_by("email")[:2])
        patients = list(Patient.objects.order_by("created_at")[:6])
        departments = {
            "IM": Department.objects.filter(code="IM").first(),
            "CARD": Department.objects.filter(code="CARD").first(),
            "RAD": Department.objects.filter(code="RAD").first(),
        }
        wards = {
            "IM": Ward.objects.filter(code="WA").first(),
            "CARD": Ward.objects.filter(code="WC").first(),
        }
        if len(doctors) < 2 or len(patients) < 4:
            return

        clinical_scenarios = [
            {
                "doctor": doctors[0],
                "patient": patients[0],
                "department": departments["IM"],
                "ward": wards["IM"],
                "visit_type": "inpatient",
                "appointment_type": "follow-up",
                "reason": "Community-acquired pneumonia with dehydration.",
                "subjective": "Patient reports productive cough, fever, and shortness of breath for three days.",
                "objective": "Febrile, bilateral basal crackles, oxygen saturation 93% on room air.",
                "assessment": "Community-acquired pneumonia with mild hypoxia.",
                "plan": "Admit for IV antibiotics, chest imaging, and close monitoring.",
                "diagnosis_code": "J18.9",
                "diagnosis_description": "Pneumonia, unspecified organism",
                "prescription": ("Azithromycin", "250 mg", "oral", "once daily", 5, "Take one tablet daily after food."),
                "order": ("CT Chest With Contrast", OrderCategory.IMAGING, "Persistent hypoxia despite treatment", "CT-CHEST", "chest"),
            },
            {
                "doctor": doctors[0],
                "patient": patients[1],
                "department": departments["IM"],
                "ward": None,
                "visit_type": "outpatient",
                "appointment_type": "consultation",
                "reason": "Uncontrolled type 2 diabetes mellitus follow-up.",
                "subjective": "Patient reports fatigue, polyuria, and poor adherence to diet control.",
                "objective": "Random glucose elevated, no acute distress, stable vitals.",
                "assessment": "Poorly controlled type 2 diabetes mellitus.",
                "plan": "Adjust therapy, order HbA1c and renal profile, reinforce lifestyle changes.",
                "diagnosis_code": "E11.65",
                "diagnosis_description": "Type 2 diabetes mellitus with hyperglycemia",
                "prescription": ("Metformin", "500 mg", "oral", "twice daily", 60, "Take one tablet twice daily with meals."),
                "order": ("HbA1c Panel", OrderCategory.LAB, "Diabetes follow-up", None, None),
            },
            {
                "doctor": doctors[1],
                "patient": patients[2],
                "department": departments["CARD"],
                "ward": wards["CARD"],
                "visit_type": "inpatient",
                "appointment_type": "follow-up",
                "reason": "Acute decompensated heart failure with reduced ejection fraction.",
                "subjective": "Patient has orthopnea, ankle swelling, and exertional dyspnea.",
                "objective": "Raised JVP, bilateral pitting edema, bibasal crepitations.",
                "assessment": "Acute decompensated heart failure.",
                "plan": "Diuresis, fluid balance charting, echo review, and telemetry monitoring.",
                "diagnosis_code": "I50.23",
                "diagnosis_description": "Acute on chronic systolic heart failure",
                "prescription": ("Furosemide", "40 mg", "iv", "twice daily", 6, "Administer 40 mg IV twice daily and reassess fluid status."),
                "order": ("Echo Follow-up", OrderCategory.CONSULT, "Cardiology imaging review", None, None),
            },
            {
                "doctor": doctors[1],
                "patient": patients[3],
                "department": departments["CARD"],
                "ward": None,
                "visit_type": "outpatient",
                "appointment_type": "consultation",
                "reason": "Chest pain workup and ischemic heart disease evaluation.",
                "subjective": "Intermittent exertional chest tightness relieved by rest.",
                "objective": "Stable examination, cardiovascular exam otherwise unremarkable.",
                "assessment": "Stable angina under evaluation.",
                "plan": "Order ECG and stress imaging, start antianginal therapy.",
                "diagnosis_code": "I20.9",
                "diagnosis_description": "Angina pectoris, unspecified",
                "prescription": ("Bisoprolol", "5 mg", "oral", "once daily", 30, "Take one tablet every morning."),
                "order": ("MRI Cardiac Stress", OrderCategory.IMAGING, "Evaluate ischemia burden", "MRI-CARD", "chest"),
            },
        ]

        last_prescription = None
        for index, scenario in enumerate(clinical_scenarios):
            doctor = scenario["doctor"]
            patient = scenario["patient"]
            department = scenario["department"]
            ward = scenario["ward"]
            bed = Bed.objects.filter(ward=ward).order_by("number").first() if ward else None

            Appointment.objects.get_or_create(
                patient=patient,
                doctor=doctor,
                date=timezone.now().date(),
                time=(timezone.now() + timezone.timedelta(minutes=30 * index)).time().replace(second=0, microsecond=0),
                defaults={
                    "department": department,
                    "duration": 30,
                    "type": scenario["appointment_type"],
                    "status": AppointmentStatus.SCHEDULED,
                    "notes": scenario["reason"],
                },
            )

            if ward:
                Admission.objects.get_or_create(
                    patient=patient,
                    status=AdmissionStatus.ACTIVE,
                    defaults={
                        "type": AdmissionType.INPATIENT,
                        "admitting_doctor": doctor,
                        "department": department,
                        "ward": ward,
                        "bed": bed,
                        "reason_for_admission": scenario["reason"],
                    },
                )

            encounter, _ = Encounter.objects.get_or_create(
                patient=patient,
                doctor=doctor,
                visit_type=scenario["visit_type"],
                defaults={
                    "subjective": scenario["subjective"],
                    "objective": scenario["objective"],
                    "assessment": scenario["assessment"],
                    "plan": scenario["plan"],
                },
            )

            Diagnosis.objects.get_or_create(
                patient=patient,
                encounter=encounter,
                code=scenario["diagnosis_code"],
                defaults={
                    "description": scenario["diagnosis_description"],
                    "type": "primary",
                    "status": "active",
                    "diagnosed_by": doctor,
                },
            )

            medication, dosage, route, frequency, quantity, sig = scenario["prescription"]
            prescription, _ = Prescription.objects.get_or_create(
                patient=patient,
                encounter=encounter,
                medication=medication,
                defaults={
                    "prescribed_by": doctor,
                    "generic_name": medication,
                    "dosage": dosage,
                    "route": route,
                    "frequency": frequency,
                    "quantity": quantity,
                    "refills": 1 if scenario["visit_type"] == "outpatient" else 0,
                    "sig": sig,
                    "start_date": timezone.now().date(),
                    "status": "active",
                },
            )
            last_prescription = prescription

            order_name, category, indication, exam_code, body_part = scenario["order"]
            Order.objects.get_or_create(
                patient=patient,
                encounter=encounter,
                ordered_by=doctor,
                category=category,
                name=order_name,
                defaults={
                    "indication": indication,
                    "exam_code": exam_code,
                    "body_part": body_part,
                    "priority": Priority.URGENT if scenario["visit_type"] == "inpatient" else Priority.ROUTINE,
                    "status": "pending",
                    "clinical_history": scenario["assessment"],
                },
            )

            Referral.objects.get_or_create(
                patient=patient,
                referring_doctor=doctor,
                to_department=departments["RAD"] if category == OrderCategory.IMAGING else department,
                reason=scenario["reason"],
                urgency="urgent" if scenario["visit_type"] == "inpatient" else "routine",
            )

        return last_prescription

    def _seed_billing_demo_data(self):
        from apps.billing.models import Claim, Invoice
        from apps.patients.models import Patient

        patient = Patient.objects.order_by("created_at").first()
        if not patient:
            return

        invoice, _ = Invoice.objects.get_or_create(
            patient=patient,
            primary_diagnosis="J06.9",
            defaults={
                "encounter_type": "inpatient",
                "status": "draft",
                "insurance_plan": {
                    "provider": "AXA",
                    "planName": "Gold",
                    "policyNumber": "AXA-10001",
                    "memberId": "MBR-10001",
                    "coverageType": "premium",
                },
                "charge_items": [
                    {"code": "ROOM", "description": "Room charge", "quantity": 1, "amount": 1500},
                    {"code": "CONSULT", "description": "Physician consult", "quantity": 1, "amount": 500},
                ],
                "total_amount": 2000,
                "balance": 2000,
            },
        )

        Claim.objects.get_or_create(
            invoice=invoice,
            patient=patient,
            payer_id="AXA",
            claim_type="medical",
            defaults={"status": "draft"},
        )

    def _seed_pharmacy_demo_data(self):
        from apps.doctors.models import Prescription
        from apps.pharmacy.models import FormularyItem, PharmacyPrescription

        prescription = Prescription.objects.order_by("created_at").first()
        if prescription:
            PharmacyPrescription.objects.get_or_create(
                original_prescription=prescription,
                defaults={
                    "patient": prescription.patient,
                    "status": "pending-verification",
                    "setting": "inpatient",
                    "priority": "routine",
                },
            )

        FormularyItem.objects.get_or_create(
            name="Paracetamol 500 mg Tablet",
            defaults={
                "generic_name": "Acetaminophen",
                "drug_class": "Analgesic",
                "formulary_status": "formulary",
                "stock_level": 250,
                "reorder_level": 50,
                "unit": "tablet",
                "ndc": "0054-0450-25",
            },
        )
