"""
Role-Based Access Control (RBAC) permission classes.
Hexagonal Architecture: Port adapters for authorization.
"""

from rest_framework.permissions import BasePermission


class UserRole:
    ADMIN = "admin"
    DOCTOR = "doctor"
    NURSE = "nurse"
    LAB_TECH = "lab_tech"
    RADIOLOGIST = "radiologist"
    PHARMACIST = "pharmacist"
    BILLING_STAFF = "billing_staff"
    FRONT_DESK = "front_desk"
    PATIENT = "patient"

    ALL_ROLES = [
        ADMIN, DOCTOR, NURSE, LAB_TECH, RADIOLOGIST,
        PHARMACIST, BILLING_STAFF, FRONT_DESK, PATIENT,
    ]

    CLINICAL_ROLES = [DOCTOR, NURSE, LAB_TECH, RADIOLOGIST, PHARMACIST]
    STAFF_ROLES = [ADMIN, DOCTOR, NURSE, LAB_TECH, RADIOLOGIST,
                   PHARMACIST, BILLING_STAFF, FRONT_DESK]


def has_role(user, *roles):
    return hasattr(user, "role") and user.role in roles


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.ADMIN)


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.DOCTOR)


class IsNurse(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.NURSE)


class IsLabTech(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.LAB_TECH)


class IsRadiologist(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.RADIOLOGIST)


class IsPharmacist(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.PHARMACIST)


class IsBillingStaff(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.BILLING_STAFF)


class IsFrontDesk(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.FRONT_DESK)


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(request.user, UserRole.PATIENT)


class IsClinicalStaff(BasePermission):
    """Allows any clinical role: doctor, nurse, lab_tech, radiologist, pharmacist."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, *UserRole.CLINICAL_ROLES
        )


class IsStaff(BasePermission):
    """Allows any non-patient staff role."""

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, *UserRole.STAFF_ROLES
        )


class IsAdminOrDoctor(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, UserRole.ADMIN, UserRole.DOCTOR
        )


class IsAdminOrFrontDesk(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, UserRole.ADMIN, UserRole.FRONT_DESK
        )


class IsAdminOrNurse(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, UserRole.ADMIN, UserRole.NURSE
        )


class IsDoctorOrNurse(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, UserRole.DOCTOR, UserRole.NURSE
        )


class ReadWriteRolePermission(BasePermission):
    """Dynamic read/write permission factory. Safe methods use read_roles, others use write_roles."""

    read_roles: list = []
    write_roles: list = []

    def has_permission(self, request, view):
        roles = self.read_roles if request.method in ("GET", "HEAD", "OPTIONS") else self.write_roles
        return request.user.is_authenticated and has_role(request.user, *roles)

    @classmethod
    def for_roles(cls, read_roles: list, write_roles: list):
        return type(
            "DynamicReadWriteRolePermission",
            (cls,),
            {"read_roles": read_roles, "write_roles": write_roles},
        )


class RolePermission(BasePermission):
    """
    Dynamic role permission factory.
    Usage: RolePermission.for_roles([UserRole.ADMIN, UserRole.DOCTOR])
    """

    allowed_roles: list = []

    def has_permission(self, request, view):
        return request.user.is_authenticated and has_role(
            request.user, *self.allowed_roles
        )

    @classmethod
    def for_roles(cls, roles: list):
        return type("DynamicRolePermission", (cls,), {"allowed_roles": roles})
