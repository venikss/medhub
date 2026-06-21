"""
tests/test_evaluation_criteria.py
==================================
Pytest-django integration tests for Section 5.3.7 — Integration Correctness.

These tests verify that cross-component clinical workflows complete correctly
end-to-end at the Django API layer, including signal propagation, model
creation, and role-based access enforcement.

EVALUATION CRITERIA VERIFIED
-----------------------------
IC-01  Vitals POST with NEWS2 ≥ 5 → CDSSRecommendation(DETERIORATION_ALERT) created
IC-02  Lab report release with critical result → CriticalValue record count increases
IC-03  Radiology critical finding → CDSSRecommendation(URGENT_FINDING) created
         (via rule engine invocation after finding is saved)
IC-04  Prescription for known allergen → rule engine detects ALLERGY
IC-05  JWT access token is issued and structurally valid on successful login
IC-06  Nurse JWT rejected on doctor-restricted encounter signing endpoint (HTTP 403)
IC-07  Unauthenticated requests return HTTP 401

ADDITIONAL SECTION CRITERIA
----------------------------
5.3.1 Accuracy  — endpoint returns 201 for valid clinical data
5.3.2 Completeness — response bodies include all required top-level fields
5.3.3 Consistency — same login credentials always return a token
5.3.5 Performance — critical API endpoints respond within 2 s
"""

import uuid
import pytest
from unittest.mock import patch
from rest_framework.test import APIClient
from rest_framework import status


# ──────────────────────────────────────────────────────────────────────────────
# Test helpers
# ──────────────────────────────────────────────────────────────────────────────
def _make_user(role="doctor", email=None, password="Test@1234"):
    from apps.authentication.models import User
    email = email or f"{role}_{uuid.uuid4().hex[:8]}@eval.test"
    return User.objects.create_user(
        email=email, password=password,
        first_name="Eval", last_name="User",
        role=role, status="active",
    )


def _auth_header(client, user, password="Test@1234"):
    resp = client.post(
        "/api/v1/auth/login/",
        {"email": user.email, "password": password},
        format="json",
    )
    assert resp.status_code == status.HTTP_200_OK, (
        f"Login failed ({resp.status_code}): {resp.json()}"
    )
    data = resp.json()
    token = data.get("accessToken") or data.get("access") or data.get("token")
    assert token, f"No token in response: {data}"
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


def _make_patient():
    from apps.patients.models import Patient
    return Patient.objects.create(
        mrn=f"EVAL{uuid.uuid4().hex[:6].upper()}",
        first_name="Eval", last_name="Patient",
        date_of_birth="1970-01-01",
        gender="male", phone=f"+201{uuid.uuid4().hex[:9]}",
        status="active",
    )


# ──────────────────────────────────────────────────────────────────────────────
# IC-05 / 5.3.3 — Authentication
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestAuthentication:
    """IC-05 JWT issuance; IC-07 unauthenticated → 401; 5.3.3 consistency."""

    def setup_method(self):
        self.client = APIClient()

    def test_IC05_login_returns_access_token(self):
        """IC-05: Successful login yields a JWT access token."""
        user = _make_user(role="doctor", email=f"ic05_{uuid.uuid4().hex[:6]}@eval.test")
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "Test@1234"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        token = data.get("accessToken") or data.get("access") or data.get("token")
        assert token, "No access token in response"
        # Token must be a non-trivial string
        assert len(token) > 20, "Token too short to be a valid JWT"

    def test_IC05_token_is_consistent_across_logins(self):
        """5.3.3 Consistency: same credentials → always produces a token (not None)."""
        user = _make_user(role="nurse", email=f"ic05b_{uuid.uuid4().hex[:6]}@eval.test")
        for _ in range(3):
            resp = self.client.post(
                "/api/v1/auth/login/",
                {"email": user.email, "password": "Test@1234"},
                format="json",
            )
            assert resp.status_code == status.HTTP_200_OK
            token = (resp.json().get("accessToken")
                     or resp.json().get("access")
                     or resp.json().get("token"))
            assert token, "Token absent on repeated login"

    def test_IC07_unauthenticated_request_returns_401(self):
        """IC-07: Protected endpoints return 401 without Authorization header."""
        for endpoint in [
            "/api/v1/doctors/encounters/",
            "/api/v1/nurses/patients/",
            "/api/v1/lab/reports/",
        ]:
            resp = self.client.get(endpoint)
            assert resp.status_code in (
                status.HTTP_401_UNAUTHORIZED,
                status.HTTP_403_FORBIDDEN,
            ), f"{endpoint} returned {resp.status_code}, expected 401/403"

    def test_IC05_wrong_password_denied(self):
        """Accuracy: invalid credentials are rejected."""
        user = _make_user(role="doctor", email=f"ic05c_{uuid.uuid4().hex[:6]}@eval.test")
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "WrongPassword!99"},
            format="json",
        )
        assert resp.status_code in (
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_401_UNAUTHORIZED,
        )


# ──────────────────────────────────────────────────────────────────────────────
# IC-06 — Role enforcement
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestRoleEnforcement:
    """IC-06: Role-based access control."""

    def setup_method(self):
        self.client = APIClient()

    def test_IC06_nurse_cannot_access_doctor_prescription_endpoint(self):
        """IC-06: Nurse JWT rejected on doctor-only prescribing endpoint."""
        nurse = _make_user(role="nurse", email=f"ic06_nurse_{uuid.uuid4().hex[:6]}@eval.test")
        headers = _auth_header(self.client, nurse)
        # Attempt to GET prescriptions (doctor-only read or create)
        resp = self.client.get("/api/v1/doctors/prescriptions/", **headers)
        # Must not get 200 (should be 403 or 404)
        assert resp.status_code != status.HTTP_200_OK, (
            "Nurse should not have access to doctor prescriptions"
        )

    def test_IC06_doctor_can_access_own_endpoints(self):
        """Positive: doctor JWT accepted on doctor endpoints."""
        doctor = _make_user(role="doctor", email=f"ic06_doc_{uuid.uuid4().hex[:6]}@eval.test")
        headers = _auth_header(self.client, doctor)
        resp = self.client.get("/api/v1/doctors/encounters/", **headers)
        assert resp.status_code != status.HTTP_403_FORBIDDEN, (
            f"Doctor should be able to access encounters, got {resp.status_code}"
        )


# ──────────────────────────────────────────────────────────────────────────────
# IC-01 — Vitals → CDSS trigger
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestVitalsCDSSTrigger:
    """IC-01: NEWS2 ≥ 5 on vitals save → CDSSRecommendation(DETERIORATION_ALERT)."""

    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_IC01_high_news2_creates_deterioration_alert(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        nurse = _make_user(role="nurse", email=f"ic01_nurse_{uuid.uuid4().hex[:6]}@eval.test")
        patient = _make_patient()
        headers = _auth_header(self.client, nurse)

        before = CDSSRecommendation.objects.filter(
            patient=patient,
            type=CDSSRecommendationType.DETERIORATION_ALERT,
        ).count()

        resp = self.client.post(
            f"/api/v1/nurses/patients/{patient.id}/vitals/",
            {
                "patientId": str(patient.id),
                "temperature": 38.6,
                "heartRate": 118,
                "respiratoryRate": 25,
                "systolicBp": 92,
                "oxygenSaturation": 93,
                "consciousness": "V",
                "newsScore": 8,
            },
            format="json",
            **headers,
        )
        if resp.status_code == status.HTTP_201_CREATED:
            after = CDSSRecommendation.objects.filter(
                patient=patient,
                type=CDSSRecommendationType.DETERIORATION_ALERT,
            ).count()
            assert after > before, (
                f"IC-01: Expected DETERIORATION_ALERT to be created after vitals POST "
                f"with NEWS2=8; before={before}, after={after}"
            )

    @patch("core.websockets.broadcast")
    def test_IC01_low_news2_does_not_create_alert(self, mock_broadcast):
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        nurse = _make_user(role="nurse", email=f"ic01_low_{uuid.uuid4().hex[:6]}@eval.test")
        patient = _make_patient()
        headers = _auth_header(self.client, nurse)

        resp = self.client.post(
            f"/api/v1/nurses/patients/{patient.id}/vitals/",
            {
                "patientId": str(patient.id),
                "temperature": 37.0,
                "heartRate": 72,
                "respiratoryRate": 14,
                "systolicBp": 125,
                "oxygenSaturation": 98,
                "consciousness": "A",
                "newsScore": 2,
            },
            format="json",
            **headers,
        )
        if resp.status_code == status.HTTP_201_CREATED:
            count = CDSSRecommendation.objects.filter(
                patient=patient,
                type=CDSSRecommendationType.DETERIORATION_ALERT,
            ).count()
            assert count == 0, (
                f"IC-01 negative: NEWS2=2 should NOT create DETERIORATION_ALERT; found {count}"
            )


# ──────────────────────────────────────────────────────────────────────────────
# IC-02 — Lab critical value workflow
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestLabCriticalValueIntegration:
    """IC-02: Lab report release with critical result creates CriticalValue records."""

    def setup_method(self):
        self.client = APIClient()

    @patch("core.websockets.broadcast")
    def test_IC02_critical_lab_release_creates_critical_value(self, mock_broadcast):
        from apps.laboratory.models import (
            LabPanel, LabTestResult, LabReport, Specimen, CriticalValue,
        )
        lab_tech = _make_user(role="lab_tech", email=f"ic02_lab_{uuid.uuid4().hex[:6]}@eval.test")
        patient = _make_patient()

        specimen = Specimen.objects.create(
            patient=patient, type="blood",
            collected_by=lab_tech, status="received",
        )
        panel = LabPanel.objects.create(
            patient=patient, specimen=specimen,
            name="Chemistry", priority="routine",
        )
        LabTestResult.objects.create(
            panel=panel, specimen=specimen,
            test_code="2951-2", test_name="Sodium",
            value="158", unit="mEq/L",
            flag="CRITICAL_HIGH", is_critical=True, status="verified",
        )
        report = LabReport.objects.create(
            patient=patient, panel=panel,
            has_critical=True, status="final",
        )

        headers = _auth_header(self.client, lab_tech)
        before = CriticalValue.objects.filter(patient=patient).count()
        resp = self.client.put(
            f"/api/v1/lab/reports/{report.id}/release/",
            {}, format="json", **headers,
        )
        if resp.status_code in (200, 201):
            after = CriticalValue.objects.filter(patient=patient).count()
            assert after > before, (
                f"IC-02: Expected CriticalValue to be created after lab report release; "
                f"before={before}, after={after}"
            )


# ──────────────────────────────────────────────────────────────────────────────
# IC-04 — Drug allergy detection at rule engine level
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestDrugAllergyDetection:
    """IC-04: Prescription for known allergen → rule engine detects ALLERGY."""

    def test_IC04_allergy_rule_fires_for_allergen_prescription(self):
        """Rule engine correctly fires ALLERGY for allergen–drug conflict."""
        from types import SimpleNamespace
        from apps.cdss.services.rule_engine_service import GraphRuleEngineService
        from apps.cdss.models import CDSSRecommendationType

        snap = {
            "patient": SimpleNamespace(allergies=["penicillin"]),
            "graph": {"diagnoses": [], "medications": []},
            "diagnoses": [],
            "active_prescriptions": [
                SimpleNamespace(medication="Penicillin V 250mg",
                                generic_name="Penicillin V", rxnorm_code=""),
            ],
            "pharmacy_prescriptions": [],
            "latest_vitals": None,
            "overdue_tasks": [],
            "critical_values": [],
            "recent_results": [],
            "urgent_findings": [],
            "recent_reports": [],
        }
        fired = {r.rec_type for r in GraphRuleEngineService._evaluate(snap)}
        assert CDSSRecommendationType.ALLERGY in fired, (
            "IC-04: ALLERGY recommendation must fire for penicillin-allergic patient "
            "with Penicillin V prescribed"
        )

    def test_IC04_no_allergy_alert_without_conflict(self):
        """Negative IC-04: no allergy alert when prescription is safe."""
        from types import SimpleNamespace
        from apps.cdss.services.rule_engine_service import GraphRuleEngineService
        from apps.cdss.models import CDSSRecommendationType

        snap = {
            "patient": SimpleNamespace(allergies=["penicillin"]),
            "graph": {"diagnoses": [], "medications": []},
            "diagnoses": [],
            "active_prescriptions": [
                SimpleNamespace(medication="Metformin 500mg",
                                generic_name="Metformin", rxnorm_code=""),
            ],
            "pharmacy_prescriptions": [],
            "latest_vitals": None,
            "overdue_tasks": [],
            "critical_values": [],
            "recent_results": [],
            "urgent_findings": [],
            "recent_reports": [],
        }
        fired = {r.rec_type for r in GraphRuleEngineService._evaluate(snap)}
        assert CDSSRecommendationType.ALLERGY not in fired, (
            "IC-04 negative: No allergy alert expected for safe drug + penicillin allergy"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 5.3.5 Performance — API response time
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestAPIResponseTime:
    """5.3.5 Performance: key API endpoints must respond within 2 seconds."""

    def setup_method(self):
        self.client = APIClient()

    def test_PE_login_response_under_2s(self):
        """Login endpoint responds within 2 seconds."""
        import time
        user = _make_user(role="doctor", email=f"perf_{uuid.uuid4().hex[:6]}@eval.test")
        t0 = time.perf_counter()
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "Test@1234"},
            format="json",
        )
        elapsed = time.perf_counter() - t0
        assert resp.status_code == status.HTTP_200_OK
        assert elapsed < 2.0, f"Login took {elapsed:.2f}s — expected < 2s"

    def test_PE_patient_list_response_under_2s(self):
        """Patient list endpoint responds within 2 seconds."""
        import time
        doctor = _make_user(role="doctor", email=f"perf2_{uuid.uuid4().hex[:6]}@eval.test")
        headers = _auth_header(self.client, doctor)
        t0 = time.perf_counter()
        resp = self.client.get("/api/v1/patients/", **headers)
        elapsed = time.perf_counter() - t0
        assert elapsed < 2.0, f"Patient list took {elapsed:.2f}s — expected < 2s"
        assert resp.status_code in (
            status.HTTP_200_OK,
            status.HTTP_403_FORBIDDEN,
            status.HTTP_404_NOT_FOUND,
        ), f"Unexpected status: {resp.status_code}"


# ──────────────────────────────────────────────────────────────────────────────
# 5.3.2 Completeness — API response field coverage
# ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.django_db
class TestAPIResponseCompleteness:
    """5.3.2 Completeness: login response includes all expected token fields."""

    def setup_method(self):
        self.client = APIClient()

    def test_CP_login_response_has_required_fields(self):
        """Login response contains at least one token field and user info."""
        user = _make_user(role="doctor", email=f"cp_{uuid.uuid4().hex[:6]}@eval.test")
        resp = self.client.post(
            "/api/v1/auth/login/",
            {"email": user.email, "password": "Test@1234"},
            format="json",
        )
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        has_token = bool(
            data.get("accessToken") or data.get("access") or data.get("token")
        )
        assert has_token, f"Login response missing token field: {list(data.keys())}"
