import datetime

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import User, UserRole, UserStatus
from apps.patients.models import Gender, Patient

from .models import BillingInvoiceStatus, ClaimStatus, Invoice, Claim, Payment, Denial, DenialStatus

class BillingDashboardSmokeTest(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            email="billing@example.com",
            password="test1234",
            first_name="Bill",
            last_name="Staff",
            role=UserRole.BILLING_STAFF,
            status=UserStatus.ACTIVE,
        )
        self.client.force_authenticate(self.user)

        self.patient = Patient.objects.create(
            mrn="MRN-BILL-001",
            first_name="Jane",
            last_name="Doe",
            date_of_birth=datetime.date(1990, 1, 1),
            gender=Gender.FEMALE,
            phone="+201000000000",
            email="jane@example.com",
            status="active",
        )
        self.invoice = Invoice.objects.create(
            patient=self.patient,
            encounter_type="outpatient",
            status=BillingInvoiceStatus.OVERDUE,
            insurance_plan={"provider": "Aetna", "payerName": "Aetna", "policyNumber": "POL-1"},
            primary_diagnosis="Hypertension",
            total_amount=1000,
            insurance_paid=200,
            patient_paid=100,
            adjustments=50,
            balance=650,
        )
        self.claim = Claim.objects.create(
            invoice=self.invoice,
            patient=self.patient,
            payer_id="AETNA",
            claim_type="professional",
            status=ClaimStatus.SUBMITTED,
            allowed_amount=800,
            paid_amount=200,
            patient_responsibility=100,
        )
        Payment.objects.create(
            invoice=self.invoice,
            claim=self.claim,
            patient=self.patient,
            amount=100,
            method="cash",
            payer="Patient",
            posted_by=self.user,
        )
        Denial.objects.create(
            claim=self.claim,
            patient=self.patient,
            reason_code="medical-necessity",
            reason_description="Medical necessity review required",
            status=DenialStatus.OPEN,
        )

    def test_billing_dashboard_returns_frontend_summary_shape(self):
        response = self.client.get("/api/v1/billing/dashboard/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("stats", response.data)
        self.assertIn("recentPayments", response.data)
        self.assertIn("activeDenials", response.data)
        self.assertIn("claimStatusSummary", response.data)
        self.assertEqual(response.data["recentPayments"][0]["patientName"], "Jane Doe")
