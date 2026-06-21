import datetime

from rest_framework import status
from rest_framework.test import APITestCase

from apps.authentication.models import User, UserRole, UserStatus
from apps.patients.models import Appointment, AppointmentStatus, Gender, Patient

class FrontDeskCheckInSmokeTest(APITestCase):
    def setUp(self):
        self.front_desk = User.objects.create_user(
            email="frontdesk@example.com",
            password="test1234",
            first_name="Front",
            last_name="Desk",
            role=UserRole.FRONT_DESK,
            status=UserStatus.ACTIVE,
        )
        self.doctor = User.objects.create_user(
            email="doctor@example.com",
            password="test1234",
            first_name="Doc",
            last_name="Tor",
            role=UserRole.DOCTOR,
            status=UserStatus.ACTIVE,
        )
        self.patient = Patient.objects.create(
            mrn="MRN-FD-001",
            first_name="Ali",
            last_name="Hassan",
            date_of_birth=datetime.date(1995, 5, 5),
            gender=Gender.MALE,
            phone="+201011111111",
            email="ali@example.com",
            consent_signed=True,
        )
        self.appointment = Appointment.objects.create(
            patient=self.patient,
            doctor=self.doctor,
            date=datetime.date.today(),
            time=datetime.time(9, 0),
            duration=30,
            type="consultation",
            status=AppointmentStatus.SCHEDULED,
        )
        self.client.force_authenticate(self.front_desk)

    def test_frontdesk_checkin_marks_appointment_and_returns_summary(self):
        response = self.client.post(
            "/api/v1/patients/frontdesk/checkin/",
            {
                "patientId": str(self.patient.id),
                "appointmentId": str(self.appointment.id),
                "service": "consultation",
                "priority": "normal",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.appointment.refresh_from_db()
        self.assertEqual(self.appointment.status, AppointmentStatus.IN_PROGRESS)
        self.assertTrue(response.data["checkedIn"])
        self.assertEqual(response.data["patient"]["mrn"], "MRN-FD-001")
        self.assertEqual(response.data["queueTicket"]["service"], "consultation")
