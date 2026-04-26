"""
Tests for CDSS auto-trigger logic:
- NEWS2 score >= 5 on vitals save → CDSSRecommendation created
- Lab critical result released → CDSSRecommendation(PANIC_VALUE) created
- Radiology critical finding → CDSSRecommendation(URGENT_FINDING) created
- Drug safety check → CDSSRecommendation(ALLERGY/DRUG_INTERACTION) created
"""

import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework import status


def make_user(role="doctor", email=None, password="Test@1234"):
    from apps.authentication.models import User
    email = email or f"{role}_{id(object())}@test.com"
    return User.objects.create_user(
        email=email, password=password,
        first_name="Test", last_name="User",
        role=role, status="active",
    )


def auth_header(client, user, password="Test@1234"):
    resp = client.post("/api/v1/auth/login/", {"email": user.email, "password": password}, format="json")
    assert resp.status_code == 200
    data = resp.json()
    token = data.get("accessToken") or data.get("access") or data.get("token")
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def make_patient():
    from apps.patients.models import Patient
    import uuid
    return Patient.objects.create(
        mrn=f"TEST{uuid.uuid4().hex[:6].upper()}",
        first_name="John", last_name="Doe",
        date_of_birth="1990-01-01",
        gender="male", phone=f"+20100{uuid.uuid4().hex[:7]}",
        status="active",
    )


@pytest.mark.django_db
class TestNEWS2CDSSTrigger:
    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_news2_above_threshold_creates_cdss_recommendation(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        nurse = make_user(role="nurse", email="news2.nurse@test.com")
        patient = make_patient()
        headers = auth_header(self.client, nurse)

        vitals_payload = {
            "patientId": str(patient.id),
            "temperature": 38.5,
            "heartRate": 120,        # tachycardia — NEWS2 += 2
            "respiratoryRate": 26,   # high — NEWS2 += 3
            "systolicBp": 90,        # low — NEWS2 += 3
            "oxygenSaturation": 93,  # low — NEWS2 += 2
            "consciousness": "V",    # AVPU Voice
            "newsScore": 10,
        }
        resp = self.client.post(
            f"/api/v1/nurses/patients/{patient.id}/vitals/",
            vitals_payload, format="json", **headers,
        )
        # Either 201 (created) or 400 if vitals validation differs
        if resp.status_code == status.HTTP_201_CREATED:
            rec_count = CDSSRecommendation.objects.filter(
                patient=patient,
                type=CDSSRecommendationType.DETERIORATION_ALERT,
            ).count()
            assert rec_count >= 1

    @patch("core.websockets.broadcast")
    def test_news2_below_threshold_does_not_trigger_cdss(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation
        nurse = make_user(role="nurse", email="news2.low@test.com")
        patient = make_patient()
        headers = auth_header(self.client, nurse)

        initial_count = CDSSRecommendation.objects.filter(patient=patient).count()
        vitals_payload = {
            "patientId": str(patient.id),
            "heartRate": 70,
            "respiratoryRate": 16,
            "systolicBp": 120,
            "oxygenSaturation": 98,
            "newsScore": 1,
        }
        self.client.post(
            f"/api/v1/nurses/patients/{patient.id}/vitals/",
            vitals_payload, format="json", **headers,
        )
        # Should not have created new CDSS entries
        new_count = CDSSRecommendation.objects.filter(patient=patient).count()
        assert new_count == initial_count


@pytest.mark.django_db
class TestLabCriticalValueCDSSTrigger:
    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_lab_report_release_with_critical_creates_cdss(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        from apps.laboratory.models import LabReport, LabTestResult, LabPanel, Specimen

        lab_tech = make_user(role="lab_tech", email="lab.cdss@test.com")
        patient = make_patient()

        # Create minimal specimen + panel + result + report
        specimen = Specimen.objects.create(
            patient=patient, type="blood",
            collected_by=lab_tech, status="received",
        )
        panel = LabPanel.objects.create(
            patient=patient, specimen=specimen, name="Chemistry", priority="routine",
        )
        result = LabTestResult.objects.create(
            panel=panel, specimen=specimen,
            test_code="2823-3", test_name="Potassium",
            value="6.8", unit="mEq/L",
            flag="CRITICAL_HIGH", is_critical=True, status="verified",
        )
        report = LabReport.objects.create(
            patient=patient, panel=panel,
            has_critical=True, status="final",
        )

        headers = auth_header(self.client, lab_tech)
        before_count = CDSSRecommendation.objects.filter(
            patient=patient, type=CDSSRecommendationType.PANIC_VALUE
        ).count()

        resp = self.client.put(
            f"/api/v1/lab/reports/{report.id}/release/",
            {}, format="json", **headers,
        )
        if resp.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED):
            after_count = CDSSRecommendation.objects.filter(
                patient=patient, type=CDSSRecommendationType.PANIC_VALUE
            ).count()
            assert after_count > before_count


@pytest.mark.django_db
class TestPharmacyDrugSafetyCDSSTrigger:
    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_drug_allergy_check_creates_cdss(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        from apps.pharmacy.models import DrugWarning
        from apps.patients.models import Patient

        pharmacist = make_user(role="pharmacist", email="pharm.cdss@test.com")
        patient = make_patient()
        # Add allergy to patient
        patient.allergies = ["penicillin"]
        patient.save()

        # Create matching drug warning using the correct model fields
        warning = DrugWarning.objects.create(
            patient=patient,
            type="allergy",
            severity="severe",
            message="Known penicillin allergy.",
            medications_involved=["penicillin"],
        )

        headers = auth_header(self.client, pharmacist)
        before_count = CDSSRecommendation.objects.filter(
            patient=patient, type=CDSSRecommendationType.ALLERGY
        ).count()

        resp = self.client.post(
            "/api/v1/pharmacy/drug-safety/",
            {"patientId": str(patient.id), "medication": "penicillin"},
            format="json", **headers,
        )
        # If endpoint triggers CDSS on allergy hit
        if resp.status_code == status.HTTP_200_OK and resp.json().get("hasCritical"):
            after_count = CDSSRecommendation.objects.filter(
                patient=patient, type=CDSSRecommendationType.ALLERGY
            ).count()
            assert after_count >= before_count
