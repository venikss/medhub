"""
Authentication domain models.
Custom User entity - the identity aggregate root.
"""

import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models

from core.utils import generate_employee_id


class UserRole(models.TextChoices):
    ADMIN = "admin", "Admin"
    DOCTOR = "doctor", "Doctor"
    NURSE = "nurse", "Nurse"
    LAB_TECH = "lab_tech", "Lab Technician"
    RADIOLOGIST = "radiologist", "Radiologist"
    PHARMACIST = "pharmacist", "Pharmacist"
    BILLING_STAFF = "billing_staff", "Billing Staff"
    FRONT_DESK = "front_desk", "Front Desk"
    PATIENT = "patient", "Patient"


class UserStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    SUSPENDED = "suspended", "Suspended"
    PENDING = "pending", "Pending"


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        if password:
            user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("role", UserRole.ADMIN)
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("status", UserStatus.ACTIVE)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    System user entity.
    JWT payload: { sub: userId, role: UserRole, departmentId?, iat, exp }
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    role = models.CharField(max_length=20, choices=UserRole.choices)
    status = models.CharField(max_length=20, choices=UserStatus.choices, default=UserStatus.PENDING)

    department = models.ForeignKey(
        "administration.Department",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="staff_members",
    )

    employee_id = models.CharField(max_length=50, blank=True, null=True, unique=True)
    specialization = models.CharField(max_length=200, blank=True, null=True)
    license_number = models.CharField(max_length=100, blank=True, null=True)
    avatar = models.URLField(blank=True, null=True)

    last_login = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["first_name", "last_name", "role"]

    objects = UserManager()

    class Meta:
        db_table = "auth_users"
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["status"]),
            models.Index(fields=["department"]),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.role})"

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_full_name(self):
        return self.full_name

    def get_short_name(self):
        return self.first_name or self.email

    def save(self, *args, **kwargs):
        if not self.employee_id and self.role != UserRole.PATIENT:
            self.employee_id = generate_employee_id(self.role)
        super().save(*args, **kwargs)


class RefreshTokenRecord(models.Model):
    """Track issued refresh tokens for invalidation and rotation."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="refresh_tokens")
    jti = models.CharField(max_length=255, unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "auth_refresh_tokens"
        verbose_name = "Refresh token record"
        verbose_name_plural = "Refresh token records"

    def __str__(self):
        status = "revoked" if self.revoked else "active"
        return f"{self.user.email} refresh token ({status})"
