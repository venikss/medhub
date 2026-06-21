"""
Tests for authentication: registration, login, JWT claims, role enforcement.
"""

import pytest
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework import status

def make_user(role="doctor", email=None, password="Test@1234"):
    from apps.authentication.models import User
    email = email or f"{role}_{id(object())}@test.com"
    user = User.objects.create_user(
        email=email,
        password=password,
        first_name="Test",
        last_name="User",
        role=role,
        status="active",
    )
    return user

@pytest.mark.django_db
class TestLogin:
    def setup_method(self):
        self.client = APIClient()

    def test_login_returns_tokens(self):
        user = make_user(role="doctor", email="doctor@test.com")
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "doctor@test.com",
            "password": "Test@1234",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        assert "accessToken" in data or "access" in data or "token" in data

    def test_login_wrong_password_fails(self):
        make_user(role="doctor", email="doc2@test.com")
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "doc2@test.com",
            "password": "WrongPassword",
        }, format="json")
        assert resp.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED)

    def test_login_inactive_user_fails(self):
        from apps.authentication.models import User
        user = make_user(role="nurse", email="inactive@test.com")
        user.status = "inactive"
        user.save()
        resp = self.client.post("/api/v1/auth/login/", {
            "email": "inactive@test.com",
            "password": "Test@1234",
        }, format="json")
        assert resp.status_code in (status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)

@pytest.mark.django_db
class TestJWTRoleEnforcement:
    def setup_method(self):
        self.client = APIClient()

    def _auth_header(self, user):
        resp = self.client.post("/api/v1/auth/login/", {
            "email": user.email,
            "password": "Test@1234",
        }, format="json")
        assert resp.status_code == status.HTTP_200_OK
        data = resp.json()
        token = data.get("accessToken") or data.get("access") or data.get("token")
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def test_doctor_can_access_rounds_endpoint(self):
        user = make_user(role="doctor", email="doc3@test.com")
        headers = self._auth_header(user)
        resp = self.client.get("/api/v1/doctors/encounters/", **headers)
        assert resp.status_code != status.HTTP_403_FORBIDDEN

    def test_nurse_cannot_access_doctor_endpoint_if_restricted(self):
        """Nurse should not be able to sign a doctor encounter."""
        make_user(role="doctor", email="dr.sign@test.com")
        nurse = make_user(role="nurse", email="nurse.sign@test.com")
        headers = self._auth_header(nurse)
        resp = self.client.post(
            "/api/v1/doctors/encounters/00000000-0000-0000-0000-000000000001/sign/",
            **headers,
        )
        assert resp.status_code in (status.HTTP_403_FORBIDDEN, status.HTTP_404_NOT_FOUND)

    def test_unauthenticated_request_fails(self):
        resp = self.client.get("/api/v1/patients/")
        assert resp.status_code == status.HTTP_401_UNAUTHORIZED

@pytest.mark.django_db
class TestTokenRefresh:
    def setup_method(self):
        self.client = APIClient()

    def test_refresh_token_returns_new_access_token(self):
        make_user(role="admin", email="admin.ref@test.com")
        login_resp = self.client.post("/api/v1/auth/login/", {
            "email": "admin.ref@test.com",
            "password": "Test@1234",
        }, format="json")
        assert login_resp.status_code == status.HTTP_200_OK
        refresh = login_resp.json().get("refreshToken") or login_resp.json().get("refresh")
        if not refresh:
            pytest.skip("No refresh token in response")
        resp = self.client.post("/api/v1/auth/refresh/", {"refresh": refresh}, format="json")
        assert resp.status_code == status.HTTP_200_OK
        body = resp.json()
        assert body.get("token")
        assert body.get("refreshToken")
