"""
Authentication serializers — Interface layer adapters.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate

from .models import User, UserRole


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Adds role and departmentId to JWT payload."""

    username_field = "email"

    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        refresh = RefreshToken.for_user(user)

        # Inject custom claims
        refresh["role"] = user.role
        if user.department_id:
            refresh["departmentId"] = str(user.department_id)

        data["token"] = str(refresh.access_token)
        data["refreshToken"] = str(refresh)
        data["user"] = UserProfileSerializer(user).data
        # Remove default keys
        data.pop("access", None)
        data.pop("refresh", None)
        return data

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["role"] = user.role
        token["sub"] = str(user.id)
        if user.department_id:
            token["departmentId"] = str(user.department_id)
        return token


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.ChoiceField(choices=UserRole.choices, required=False)


class RefreshTokenSerializer(serializers.Serializer):
    refreshToken = serializers.CharField(required=False)
    refresh = serializers.CharField(required=False, write_only=True)

    def validate(self, attrs):
        token = attrs.get("refreshToken") or attrs.get("refresh")
        if not token:
            raise serializers.ValidationError("refreshToken is required.")
        attrs["refreshToken"] = token
        return attrs


class ChangePasswordSerializer(serializers.Serializer):
    currentPassword = serializers.CharField(write_only=True)
    newPassword = serializers.CharField(write_only=True, min_length=8)


class AuthTokenResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    refreshToken = serializers.CharField()
    user = serializers.DictField()


class AccessTokenResponseSerializer(serializers.Serializer):
    token = serializers.CharField()
    refreshToken = serializers.CharField()


class MessageResponseSerializer(serializers.Serializer):
    message = serializers.CharField()


class UserProfileSerializer(serializers.ModelSerializer):
    departmentId = serializers.UUIDField(source="department_id", read_only=True, allow_null=True)
    department = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "firstName", "lastName", "role", "departmentId",
            "department", "avatar", "status", "lastLogin", "employeeId",
            "specialization", "licenseNumber", "createdAt",
        ]
        extra_kwargs = {
            "firstName": {"source": "first_name"},
            "lastName": {"source": "last_name"},
            "lastLogin": {"source": "last_login"},
            "employeeId": {"source": "employee_id"},
            "licenseNumber": {"source": "license_number"},
            "createdAt": {"source": "created_at"},
        }

    def get_department(self, obj):
        if obj.department:
            return {"id": str(obj.department.id), "name": obj.department.name}
        return None

    def to_representation(self, instance):
        data = {}
        data["id"] = str(instance.id)
        data["email"] = instance.email
        data["firstName"] = instance.first_name
        data["lastName"] = instance.last_name
        data["role"] = instance.role
        data["departmentId"] = str(instance.department_id) if instance.department_id else None
        data["department"] = self.get_department(instance)
        data["avatar"] = instance.avatar
        data["status"] = instance.status
        data["lastLogin"] = instance.last_login.isoformat() if instance.last_login else None
        data["employeeId"] = instance.employee_id
        data["specialization"] = instance.specialization
        data["licenseNumber"] = instance.license_number
        data["createdAt"] = instance.created_at.isoformat()
        # Add patient count if annotated from view
        if hasattr(instance, "active_patient_count"):
            data["activePatientCount"] = instance.active_patient_count
        return data
