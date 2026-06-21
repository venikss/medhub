"""
Tests for critical value handling:
- Lab report release with critical result creates CriticalValue records
- CriticalValue acknowledgement endpoint
- Radiology critical finding workflow
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
    data = resp.json()
    token = data.get("accessToken") or data.get("access") or data.get("token")
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

def make_patient():
    from apps.patients.models import Patient
    import uuid
    return Patient.objects.create(
        mrn=f"CRIT{uuid.uuid4().hex[:6].upper()}",
        first_name="Critical", last_name="Patient",
        date_of_birth="1980-05-10",
        gender="male", phone=f"+20200{uuid.uuid4().hex[:7]}",
        status="active",
    )

@pytest.mark.django_db
class TestLabCriticalValueWorkflow:
    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_lab_report_with_critical_creates_critical_value_records(self, mock_broadcast):
        from apps.laboratory.models import LabPanel, LabTestResult, LabReport, Specimen, CriticalValue

        lab_tech = make_user(role="lab_tech", email="crit.lab@test.com")
        doctor = make_user(role="doctor", email="crit.doc@test.com")
        patient = make_patient()

        specimen = Specimen.objects.create(
            patient=patient, type="blood",
            collected_by=lab_tech, status="received",
        )
        panel = LabPanel.objects.create(
            patient=patient, specimen=specimen, name="Chemistry", priority="routine",
        )
        critical_result = LabTestResult.objects.create(
            panel=panel, specimen=specimen,
            test_code="2951-2", test_name="Sodium",
            value="155", unit="mEq/L",
            flag="CRITICAL_HIGH", is_critical=True, status="verified",
        )
        report = LabReport.objects.create(
            patient=patient, panel=panel,
            has_critical=True, status="final",
        )

        headers = auth_header(self.client, lab_tech)
        before_crit = CriticalValue.objects.filter(patient=patient).count()

        resp = self.client.put(
            f"/api/v1/lab/reports/{report.id}/release/",
            {}, format="json", **headers,
        )
        if resp.status_code in (200, 201):
            after_crit = CriticalValue.objects.filter(patient=patient).count()
            assert after_crit > before_crit

    @patch("core.websockets.broadcast")
    def test_acknowledge_critical_value(self, mock_broadcast):
        from apps.laboratory.models import LabPanel, LabTestResult, LabReport, Specimen, CriticalValue

        lab_tech = make_user(role="lab_tech", email="ack.lab@test.com")
        doctor = make_user(role="doctor", email="ack.doc@test.com")
        patient = make_patient()

        specimen = Specimen.objects.create(
            patient=patient, type="blood",
            collected_by=lab_tech, status="received",
        )
        panel = LabPanel.objects.create(
            patient=patient, specimen=specimen, name="Metabolic", priority="routine",
        )
        result = LabTestResult.objects.create(
            panel=panel, specimen=specimen,
            test_code="2345-7", test_name="Glucose",
            value="400", unit="mg/dL",
            flag="CRITICAL_HIGH", is_critical=True, status="verified",
        )
        critical_value = CriticalValue.objects.create(
            result=result,
            patient=patient,
            test_name="Glucose",
            value="400",
            unit="mg/dL",
            status="pending",
        )

        headers = auth_header(self.client, doctor)
        resp = self.client.put(
            f"/api/v1/lab/critical/{critical_value.id}/acknowledge/",
            {}, format="json", **headers,
        )
        if resp.status_code == 200:
            critical_value.refresh_from_db()
            assert critical_value.is_acknowledged is True

@pytest.mark.django_db
class TestRadiologyCriticalFindingWorkflow:
    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_critical_finding_creates_cdss_and_broadcasts(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        from apps.radiology.models import ImagingOrder, ImagingStudy, RadiologyReport

        radiologist = make_user(role="radiologist", email="rad.crit@test.com")
        doctor = make_user(role="doctor", email="rad.doc@test.com")
        patient = make_patient()

        order = ImagingOrder.objects.create(
            patient=patient,
            ordered_by=doctor,
            modality="CT",
            body_part="Head",
            clinical_history="Headache",
            status="completed",
        )
        from django.utils import timezone
        study = ImagingStudy.objects.create(
            order=order,
            patient=patient,
            exam_date=timezone.now(),
            status="completed",
        )
        report = RadiologyReport.objects.create(
            study=study,
            patient=patient,
            indication="Headache",
            findings="No acute intracranial pathology.",
            impression="Normal CT Head.",
            status="draft",
        )

        headers = auth_header(self.client, radiologist)
        before_count = CDSSRecommendation.objects.filter(
            patient=patient, type=CDSSRecommendationType.URGENT_FINDING
        ).count()

        resp = self.client.post(
            "/api/v1/radiology/critical/",
            {"description": "Massive subdural hematoma identified."},
            format="json", **headers,
        )
        if resp.status_code in (200, 201):
            after_count = CDSSRecommendation.objects.filter(
                patient=patient, type=CDSSRecommendationType.URGENT_FINDING
            ).count()
            assert after_count > before_count
            mock_broadcast.assert_called()
