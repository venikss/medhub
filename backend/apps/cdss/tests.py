from datetime import date
from types import SimpleNamespace

from django.test import TestCase

from apps.authentication.models import User, UserRole, UserStatus
from apps.cdss.models import MedicalOntologyConcept, OntologyCodeSystem, OntologyDomain
from apps.cdss.services.rule_engine_service import GraphRuleEngineService
from apps.cdss.services.graph_service import GraphService
from apps.doctors.models import Prescription
from apps.doctors.serializers import PrescriptionSerializer
from apps.patients.models import Gender, Patient, PatientStatus
from apps.pharmacy.models import FormularyItem
from apps.pharmacy.serializers import FormularyItemSerializer


class OntologyMedicationSerializationTests(TestCase):
    def setUp(self):
        MedicalOntologyConcept.objects.create(
            code_system=OntologyCodeSystem.RXNORM,
            code="161",
            display="Paracetamol 500 mg Oral Tablet",
            domain=OntologyDomain.MEDICATION,
        )
        self.doctor = User.objects.create(
            email="doctor.demo@example.com",
            first_name="Demo",
            last_name="Doctor",
            role=UserRole.DOCTOR,
            status=UserStatus.ACTIVE,
        )
        self.patient = Patient.objects.create(
            mrn="TEST-RX-001",
            first_name="Demo",
            last_name="Patient",
            date_of_birth=date(1990, 1, 1),
            gender=Gender.MALE,
            phone="+201000000001",
            status=PatientStatus.ACTIVE,
            consent_signed=True,
        )

    def test_formulary_serializer_prefers_canonical_rxnorm_name(self):
        item = FormularyItem.objects.create(
            name="Paracetamol 500 mg Tablet",
            generic_name="Acetaminophen",
            drug_class="Analgesic",
            rxnorm_code="161",
            formulary_status="formulary",
            stock_level=50,
            reorder_level=10,
            unit="tablet",
        )
        data = FormularyItemSerializer(item).data
        self.assertEqual(data["canonicalName"], "Paracetamol 500 mg Oral Tablet")
        self.assertEqual(data["displayName"], "Paracetamol 500 mg Tablet")

    def test_doctor_prescription_serializer_keeps_generic_and_local_labels(self):
        prescription = Prescription.objects.create(
            patient=self.patient,
            prescribed_by=self.doctor,
            medication="Paracetamol 500 mg Tablet",
            generic_name="Acetaminophen",
            rxnorm_code="161",
            dosage="500 mg",
            route="oral",
            frequency="BID",
            quantity=20,
            refills=0,
            sig="Take one tablet twice daily.",
            start_date="2026-04-01",
            status="active",
        )
        data = PrescriptionSerializer(prescription).data
        self.assertEqual(data["genericName"], "Acetaminophen")
        self.assertEqual(data["displayMedicationName"], "Paracetamol 500 mg Tablet")


class GraphSummaryFormattingTests(TestCase):
    def test_patient_module_graph_summary_includes_codes_in_strings(self):
        original = GraphService.get_patient_structured_snapshot
        GraphService.get_patient_structured_snapshot = staticmethod(
            lambda patient_uuid: {
                "patientUid": patient_uuid,
                "diagnoses": [{"name": "Type 2 diabetes mellitus", "icd10": "E11.22", "snomed": "44054006"}],
                "medications": [{"name": "Metformin", "dosage": "500 mg BID", "rxnorm": "860975", "activeIngredient": "Metformin"}],
                "allergies": [],
                "labs": [{"testName": "Potassium", "value": "6.1", "unit": "mmol/L", "testCode": "2823-3", "flag": "critical-high"}],
                "radiologyReports": [{"examName": "CT Chest", "modality": "CT", "examCode": "CT_CHEST", "impression": "Right lower lobe pneumonia"}],
            }
        )
        try:
            summary = GraphService.get_patient_module_graph_summary("demo-patient", "doctor")
        finally:
            GraphService.get_patient_structured_snapshot = original

        joined = " ".join(item for section in summary["sections"] for item in section["items"])
        self.assertIn("ICD-10 E11.22", joined)
        self.assertIn("SNOMED 44054006", joined)
        self.assertIn("RxNorm 860975", joined)
        self.assertIn("LOINC 2823-3", joined)


class GraphRuleEngineMedicationSafetyTests(TestCase):
    def _snapshot(self, *, diagnoses: list[str], meds: list[str], labs: list[tuple[str, str]]):
        return {
            "patient": SimpleNamespace(allergies=[]),
            "graph": {
                "diagnoses": [{"name": diagnosis} for diagnosis in diagnoses],
                "medications": [{"name": med} for med in meds],
            },
            "diagnoses": [SimpleNamespace(description=diagnosis) for diagnosis in diagnoses],
            "active_prescriptions": [SimpleNamespace(medication=med) for med in meds],
            "pharmacy_prescriptions": [],
            "latest_vitals": None,
            "overdue_tasks": [],
            "critical_values": [],
            "recent_results": [SimpleNamespace(test_name=name, value=value, flag=None) for name, value in labs],
            "urgent_findings": [],
            "recent_reports": [],
        }

    def test_doctor_rules_flag_ckd_with_active_nsaid(self):
        snapshot = self._snapshot(
            diagnoses=["Chronic kidney disease stage 3"],
            meds=["Ibuprofen 400 mg Tablet"],
            labs=[("eGFR", "42")],
        )

        results = GraphRuleEngineService._doctor_rules(snapshot)

        self.assertTrue(any(result.title == "CKD with active NSAID exposure requires review" for result in results))

    def test_pharmacy_rules_flag_hyperkalemia_with_ace_inhibitor(self):
        snapshot = self._snapshot(
            diagnoses=["Hypertension"],
            meds=["Lisinopril 10 mg Tablet"],
            labs=[("Potassium", "5.8")],
        )

        results = GraphRuleEngineService._pharmacy_rules(snapshot)

        self.assertTrue(any(result.title == "Hyperkalemia medication review required" for result in results))

    def test_pharmacy_rules_flag_warfarin_with_nsaid_interaction(self):
        snapshot = self._snapshot(
            diagnoses=["Atrial fibrillation"],
            meds=["Warfarin 5 mg Tablet", "Ibuprofen 400 mg Tablet"],
            labs=[],
        )

        results = GraphRuleEngineService._pharmacy_rules(snapshot)

        self.assertTrue(any(result.title == "Major bleeding interaction risk detected" for result in results))

    def test_pharmacy_rules_flag_ace_arb_with_spironolactone_interaction(self):
        snapshot = self._snapshot(
            diagnoses=["Heart failure"],
            meds=["Lisinopril 10 mg Tablet", "Spironolactone 25 mg Tablet"],
            labs=[],
        )

        results = GraphRuleEngineService._pharmacy_rules(snapshot)

        self.assertTrue(any(result.title == "Potassium-raising drug interaction risk detected" for result in results))
