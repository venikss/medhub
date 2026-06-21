"""
Administration serializers.
"""

from rest_framework import serializers
from core.standards import is_valid_cpt_or_local
from .models import Department, Ward, Bed, AuditLog, SystemSetting, RolePermission, LabCatalogItem, RadiologyCatalogItem, ServiceCatalogItem

class DepartmentSerializer(serializers.ModelSerializer):
    headId = serializers.UUIDField(source="head_id", required=False, allow_null=True)
    floorNumber = serializers.IntegerField(source="floor_number", required=False, allow_null=True)
    staffCount = serializers.SerializerMethodField()
    activePatients = serializers.SerializerMethodField()
    bedCount = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = [
            "id", "name", "code", "type", "status", "headId",
            "floorNumber", "building", "phone", "description",
            "staffCount", "activePatients", "bedCount", "createdAt",
        ]
        extra_kwargs = {"createdAt": {"source": "created_at", "read_only": True}}

    def validate_name(self, value):
        v = str(value or "").strip()
        if not v:
            raise serializers.ValidationError("name is required.")
        if len(v) > 200:
            raise serializers.ValidationError("name must not exceed 200 characters.")
        return v

    def validate_code(self, value):
        import re
        v = str(value or "").strip().upper()
        if not v:
            raise serializers.ValidationError("code is required.")
        if not re.match(r'^[A-Z0-9\-_]{1,20}$', v):
            raise serializers.ValidationError("code must be 1–20 uppercase letters, digits, hyphens, or underscores.")
        return v

    def validate_phone(self, value):
        import re
        if value in (None, ""):
            return value
        if not re.match(r'^[0-9+\-\s()]{7,20}$', str(value).strip()):
            raise serializers.ValidationError("phone format is invalid.")
        return str(value).strip()

    def validate_description(self, value):
        if value and len(value) > 1000:
            raise serializers.ValidationError("description must not exceed 1000 characters.")
        return value

    def get_staffCount(self, obj):
        return obj.staff_members.filter(deleted_at__isnull=True).count()

    def get_activePatients(self, obj):
        from apps.patients.models import Patient, PatientStatus
        return Patient.objects.filter(ward__department=obj, status__in=[PatientStatus.ADMITTED, PatientStatus.CRITICAL]).count()

    def get_bedCount(self, obj):
        return Bed.objects.filter(ward__department=obj).count()

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data["id"] = str(instance.id)
        data["head"] = instance.head.get_full_name() if instance.head_id else None
        data["headName"] = instance.head.get_full_name() if instance.head_id else None
        data["createdAt"] = instance.created_at.isoformat()
        return data

class WardSerializer(serializers.ModelSerializer):
    departmentId = serializers.UUIDField(source="department_id")
    headNurseId = serializers.UUIDField(source="head_nurse_id", required=False, allow_null=True)
    floorNumber = serializers.IntegerField(source="floor_number")
    totalBeds = serializers.IntegerField(source="total_beds")

    class Meta:
        model = Ward
        fields = [
            "id", "name", "code", "departmentId", "type", "status",
            "floorNumber", "building", "totalBeds", "headNurseId",
        ]

    def validate_name(self, value):
        v = str(value or "").strip()
        if not v or len(v) > 200:
            raise serializers.ValidationError("name must be 1–200 characters.")
        return v

    def validate_code(self, value):
        import re
        v = str(value or "").strip().upper()
        if not re.match(r'^[A-Z0-9\-_]{1,20}$', v):
            raise serializers.ValidationError("code must be 1–20 uppercase letters, digits, hyphens, or underscores.")
        return v

    def validate_totalBeds(self, value):
        if value is not None and not (1 <= value <= 500):
            raise serializers.ValidationError("totalBeds must be between 1 and 500.")
        return value

    def validate_status(self, value):
        if value == "under_maintenance":
            return "maintenance"
        return value

    def to_representation(self, instance):
        occupied_beds = instance.beds.filter(status="occupied").count()
        data = {}
        data["id"] = str(instance.id)
        data["name"] = instance.name
        data["code"] = instance.code
        data["departmentId"] = str(instance.department_id)
        data["type"] = instance.type
        data["status"] = "under_maintenance" if instance.status == "maintenance" else instance.status
        data["backendStatus"] = instance.status
        data["floorNumber"] = instance.floor_number
        data["building"] = instance.building
        data["totalBeds"] = instance.total_beds
        data["occupiedBeds"] = occupied_beds
        data["headNurseId"] = str(instance.head_nurse_id) if instance.head_nurse_id else None
        data["headNurseName"] = instance.head_nurse.get_full_name() if instance.head_nurse_id else None
        data["departmentName"] = instance.department.name if instance.department_id else None
        return data

class BedSerializer(serializers.ModelSerializer):
    wardId = serializers.UUIDField(source="ward_id")
    roomNumber = serializers.CharField(source="room_number", required=False, allow_null=True)
    bedType = serializers.CharField(source="type")

    class Meta:
        model = Bed
        fields = ["id", "wardId", "number", "bedType", "roomNumber", "status", "features"]

    def validate_number(self, value):
        import re
        v = str(value or "").strip()
        if not v:
            raise serializers.ValidationError("Bed number is required.")
        if len(v) > 20:
            raise serializers.ValidationError("Bed number must not exceed 20 characters.")
        if not re.match(r'^[A-Za-z0-9\-_\.]+$', v):
            raise serializers.ValidationError("Bed number may only contain letters, digits, hyphens, underscores, or dots.")
        return v

    def validate_roomNumber(self, value):
        if value in (None, ""):
            return value
        v = str(value).strip()
        if len(v) > 20:
            raise serializers.ValidationError("roomNumber must not exceed 20 characters.")
        return v
        return {
            "general": "standard",
            "semi-private": "semi-private",
            "private": "private",
            "labor_delivery": "labor_delivery",
        }.get(value, value)

    def to_representation(self, instance):
        frontend_type = {
            "standard": "general",
        }.get(instance.type, instance.type)
        return {
            "id": str(instance.id),
            "bedId": str(instance.id),
            "wardId": str(instance.ward_id),
            "ward": instance.ward.name if hasattr(instance, "ward") else None,
            "wardName": instance.ward.name if hasattr(instance, "ward") else None,
            "bedNumber": instance.number,
            "number": instance.number,
            "type": frontend_type,
            "backendType": instance.type,
            "roomNumber": instance.room_number,
            "status": instance.status,
            "features": instance.features,
        }

class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditLog
        fields = [
            "id", "timestamp", "userId", "userName", "userRole",
            "action", "resource", "resourceId", "details",
            "ipAddress", "sessionId", "severity", "outcome",
        ]
        extra_kwargs = {
            "userId": {"source": "user_id"},
            "userName": {"source": "user_name"},
            "userRole": {"source": "user_role"},
            "resourceId": {"source": "resource_id"},
            "ipAddress": {"source": "ip_address"},
            "sessionId": {"source": "session_id"},
        }

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "timestamp": instance.timestamp.isoformat(),
            "userId": instance.user_id,
            "userName": instance.user_name,
            "userRole": instance.user_role,
            "action": instance.action,
            "resource": instance.resource,
            "resourceId": instance.resource_id,
            "details": instance.details,
            "ipAddress": str(instance.ip_address) if instance.ip_address else None,
            "sessionId": instance.session_id,
            "severity": instance.severity,
            "outcome": instance.outcome,
        }

class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ["id", "key", "value", "category", "description", "updatedAt"]
        extra_kwargs = {"updatedAt": {"source": "updated_at", "read_only": True}}

class RolePermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RolePermission
        fields = ["id", "role", "resource", "action", "allowed"]

class LabCatalogSerializer(serializers.ModelSerializer):
    turnaroundHours = serializers.IntegerField(source="turnaround_hours")
    requiresAuth = serializers.BooleanField(source="requires_auth")
    cptCode = serializers.CharField(source="cpt_code", required=False, allow_null=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = LabCatalogItem
        fields = ["id", "code", "name", "category", "specimen", "turnaroundHours", "price", "requiresAuth", "cptCode", "isActive"]

    def validate_cptCode(self, value):
        if value in (None, ""):
            return value
        code = value.strip().upper()
        if not is_valid_cpt_or_local(code):
            raise serializers.ValidationError("cptCode must be a valid CPT code or local catalog code.")
        return code

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "code": instance.code,
            "name": instance.name,
            "category": instance.category,
            "specimen": instance.specimen,
            "turnaroundHours": instance.turnaround_hours,
            "price": float(instance.price),
            "requiresAuth": instance.requires_auth,
            "cptCode": instance.cpt_code,
            "isActive": instance.is_active,
        }

class RadiologyCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = RadiologyCatalogItem
        fields = "__all__"

    def validate_cpt_code(self, value):
        if value in (None, ""):
            return value
        code = value.strip().upper()
        if not is_valid_cpt_or_local(code):
            raise serializers.ValidationError("cptCode must be a valid CPT code or local catalog code.")
        return code

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "code": instance.code,
            "name": instance.name,
            "modality": instance.modality,
            "bodyPart": instance.body_part,
            "withContrast": instance.with_contrast,
            "durationMinutes": instance.duration_minutes,
            "price": float(instance.price),
            "requiresAuth": instance.requires_auth,
            "cptCode": instance.cpt_code,
            "preparation": instance.preparation,
            "isActive": instance.is_active,
        }

class ServiceCatalogSerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCatalogItem
        fields = "__all__"

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "code": instance.code,
            "name": instance.name,
            "category": instance.category,
            "price": float(instance.price),
            "departmentId": str(instance.department_id) if instance.department_id else None,
            "departmentName": instance.department.name if instance.department_id else None,
            "isActive": instance.is_active,
        }
