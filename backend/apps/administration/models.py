"""
Administration domain models.
Bounded context: departments, wards, beds, catalogs, audit, settings, users admin.
"""

import uuid
from django.db import models
from django.conf import settings


class DepartmentType(models.TextChoices):
    CLINICAL = "clinical", "Clinical"
    DIAGNOSTIC = "diagnostic", "Diagnostic"
    SURGICAL = "surgical", "Surgical"
    EMERGENCY = "emergency", "Emergency"
    ADMINISTRATIVE = "administrative", "Administrative"
    SUPPORT = "support", "Support"
    PHARMACY = "pharmacy", "Pharmacy"


class DepartmentStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"


class Department(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    type = models.CharField(max_length=20, choices=DepartmentType.choices)
    status = models.CharField(max_length=20, choices=DepartmentStatus.choices, default=DepartmentStatus.ACTIVE)
    head = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="headed_departments",
    )
    floor_number = models.IntegerField(null=True, blank=True)
    building = models.CharField(max_length=100, blank=True, null=True)
    phone = models.CharField(max_length=30, blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "departments"
        ordering = ["name"]

    def __str__(self):
        return self.name


class WardType(models.TextChoices):
    GENERAL = "general", "General"
    ICU = "icu", "ICU"
    NICU = "nicu", "NICU"
    PICU = "picu", "PICU"
    ICU_CARDIAC = "icu-cardiac", "ICU Cardiac"
    PEDIATRIC = "pediatric", "Pediatric"
    MATERNITY = "maternity", "Maternity"
    SURGERY = "surgery", "Surgery"
    EMERGENCY = "emergency", "Emergency"
    STEP_DOWN = "step-down", "Step Down"
    OBSERVATION = "observation", "Observation"
    ISOLATION = "isolation", "Isolation"


class WardStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    INACTIVE = "inactive", "Inactive"
    MAINTENANCE = "maintenance", "Maintenance"


class Ward(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, unique=True)
    department = models.ForeignKey(
        Department, on_delete=models.CASCADE, related_name="wards"
    )
    type = models.CharField(max_length=20, choices=WardType.choices)
    status = models.CharField(max_length=20, choices=WardStatus.choices, default=WardStatus.ACTIVE)
    floor_number = models.IntegerField()
    building = models.CharField(max_length=100, blank=True, null=True)
    total_beds = models.PositiveIntegerField(default=0)
    head_nurse = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True,
        on_delete=models.SET_NULL, related_name="headed_wards",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "wards"
        ordering = ["name"]

    def __str__(self):
        return self.name


class BedType(models.TextChoices):
    STANDARD = "standard", "Standard"
    GENERAL = "general", "General"
    ICU = "icu", "ICU"
    NICU = "nicu", "NICU"
    ISOLATION = "isolation", "Isolation"
    BARIATRIC = "bariatric", "Bariatric"
    PEDIATRIC = "pediatric", "Pediatric"
    LABOR_DELIVERY = "labor_delivery", "Labor & Delivery"
    SEMI_PRIVATE = "semi-private", "Semi Private"
    PRIVATE = "private", "Private"
    DAY_SURGERY = "day-surgery", "Day Surgery"
    RECOVERY = "recovery", "Recovery"


class BedStatus(models.TextChoices):
    AVAILABLE = "available", "Available"
    OCCUPIED = "occupied", "Occupied"
    RESERVED = "reserved", "Reserved"
    MAINTENANCE = "maintenance", "Maintenance"
    CLEANING = "cleaning", "Cleaning"


class Bed(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ward = models.ForeignKey(Ward, on_delete=models.CASCADE, related_name="beds")
    number = models.CharField(max_length=20)
    type = models.CharField(max_length=20, choices=BedType.choices, default=BedType.STANDARD)
    room_number = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=20, choices=BedStatus.choices, default=BedStatus.AVAILABLE)
    features = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "beds"
        unique_together = [("ward", "number")]
        indexes = [
            models.Index(fields=["status"]),
            models.Index(fields=["ward", "status"]),
        ]

    def __str__(self):
        return f"Bed {self.number} ({self.ward.name})"


# ─── Catalogs ─────────────────────────────────────────────────────────────────

class LabCatalogItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    specimen = models.CharField(max_length=100)
    turnaround_hours = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    requires_auth = models.BooleanField(default=False)
    cpt_code = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lab_catalog"

    def __str__(self):
        return f"{self.code} - {self.name}"


class RadiologyCatalogItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    modality = models.CharField(max_length=20)
    body_part = models.CharField(max_length=100)
    with_contrast = models.BooleanField(default=False)
    duration_minutes = models.PositiveIntegerField()
    price = models.DecimalField(max_digits=10, decimal_places=2)
    requires_auth = models.BooleanField(default=False)
    cpt_code = models.CharField(max_length=20, blank=True, null=True)
    preparation = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "radiology_catalog"

    def __str__(self):
        return f"{self.code} - {self.name}"


class ServiceCatalogItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=200)
    category = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    department = models.ForeignKey(
        Department, null=True, blank=True, on_delete=models.SET_NULL
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "service_catalog"

    def __str__(self):
        return f"{self.code} - {self.name}"


# ─── Audit Log (immutable) ────────────────────────────────────────────────────

class AuditLog(models.Model):
    """Immutable HIPAA audit trail. Retained >= 6 years."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    timestamp = models.DateTimeField(db_index=True)
    user_id = models.CharField(max_length=36, db_index=True, null=True, blank=True)
    user_name = models.CharField(max_length=200)
    user_role = models.CharField(max_length=30, null=True, blank=True)
    action = models.CharField(max_length=50, db_index=True)
    resource = models.CharField(max_length=100, db_index=True)
    resource_id = models.CharField(max_length=36, null=True, blank=True, db_index=True)
    details = models.JSONField(default=dict)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    session_id = models.CharField(max_length=255, null=True, blank=True)
    severity = models.CharField(
        max_length=20,
        choices=[("info", "Info"), ("warning", "Warning"), ("critical", "Critical")],
        default="info",
    )
    outcome = models.CharField(
        max_length=20,
        choices=[("success", "Success"), ("failure", "Failure")],
        default="success",
    )

    class Meta:
        db_table = "audit_logs"
        indexes = [
            models.Index(fields=["user_id", "timestamp"]),
            models.Index(fields=["resource", "timestamp"]),
            models.Index(fields=["action"]),
        ]
        # Prevent updates and deletes at the model level (enforced by service layer)

    def save(self, *args, **kwargs):
        if self.pk and AuditLog.objects.filter(pk=self.pk).exists():
            raise PermissionError("Audit log entries are immutable.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise PermissionError("Audit log entries cannot be deleted.")

    def __str__(self):
        return f"{self.action} - {self.resource} - {self.timestamp:%Y-%m-%d %H:%M}"


# ─── System Settings ──────────────────────────────────────────────────────────

class SystemSetting(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=100, unique=True, db_index=True)
    value = models.JSONField()
    category = models.CharField(max_length=100, default="general")
    description = models.TextField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL
    )

    class Meta:
        db_table = "system_settings"

    def __str__(self):
        return self.key


# ─── Role Permissions ─────────────────────────────────────────────────────────

class RolePermission(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    role = models.CharField(max_length=30, db_index=True)
    resource = models.CharField(max_length=100)
    action = models.CharField(max_length=50)
    allowed = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "role_permissions"
        unique_together = [("role", "resource", "action")]

    def __str__(self):
        return f"{self.role} - {self.resource} - {self.action}"
