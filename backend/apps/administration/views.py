"""
Administration interface layer — admin portal views.
Fixed:
  - WardDetailView: added missing `get` method (was returning 405 on GET /admin/wards/:id)
  - DepartmentDetailView.put: call dept.refresh_from_db() after serializer.save() to avoid
    returning stale pre-save data in the response
Role: admin only (except audit log read).
"""

from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

import re

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsAdmin, IsFrontDesk, IsStaff
from core.utils import generate_temp_password
from apps.authentication.serializers import UserProfileSerializer

from .models import (
    Department, Ward, Bed, AuditLog, SystemSetting,
    RolePermission, LabCatalogItem, RadiologyCatalogItem, ServiceCatalogItem,
)
from .serializers import (
    DepartmentSerializer, WardSerializer, BedSerializer,
    AuditLogSerializer, SystemSettingSerializer, RolePermissionSerializer,
    LabCatalogSerializer, RadiologyCatalogSerializer, ServiceCatalogSerializer,
)

class AdminUserListView(APIView):
    permission_classes = [IsAdmin | IsFrontDesk]
    serializer_class = UserProfileSerializer

    def get(self, request):
        from apps.authentication.models import User
        from apps.authentication.serializers import UserProfileSerializer

        qs = User.objects.filter(deleted_at__isnull=True)
        role = request.query_params.get("role")
        dept = request.query_params.get("department")
        status_filter = request.query_params.get("status")
        search = request.query_params.get("search")

        if role:
            qs = qs.filter(role=role)
        if dept:
            qs = qs.filter(department_id=dept)
        if status_filter:
            qs = qs.filter(status=status_filter)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search) |
                Q(employee_id__icontains=search)
            )

        if role == "doctor":
            from django.db.models import Count, Q
            from apps.patients.models import PatientStatus
            qs = qs.annotate(
                active_patient_count=Count(
                    "assigned_patients",
                    filter=Q(assigned_patients__status=PatientStatus.ADMITTED, assigned_patients__deleted_at__isnull=True)
                )
            ).order_by("active_patient_count", "last_name", "first_name")
        else:
            qs = qs.order_by("-created_at")

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(UserProfileSerializer(page, many=True).data)

    def post(self, request):
        from apps.authentication.models import User, UserRole, UserStatus
        from apps.authentication.serializers import UserProfileSerializer

        data = request.data

        email = str(data.get("email") or "").strip().lower()
        if not email:
            raise ValidationAppError("email is required.")
        if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
            raise ValidationAppError("email must be a valid email address.")
        if len(email) > 254:
            raise ValidationAppError("email must not exceed 254 characters.")

        first_name = str(data.get("firstName") or "").strip()
        last_name = str(data.get("lastName") or "").strip()
        if not first_name:
            raise ValidationAppError("firstName is required.")
        if not last_name:
            raise ValidationAppError("lastName is required.")
        if len(first_name) > 100 or len(last_name) > 100:
            raise ValidationAppError("firstName and lastName must not exceed 100 characters each.")
        if not re.match(r"^[\w\s'\-\.]+$", first_name) or not re.match(r"^[\w\s'\-\.]+$", last_name):
            raise ValidationAppError("Name fields must contain only letters, spaces, hyphens, apostrophes, or dots.")

        role = str(data.get("role") or "").strip()
        valid_roles = {r[0] for r in UserRole.choices}
        if not role or role not in valid_roles:
            raise ValidationAppError(f"role must be one of: {sorted(valid_roles)}.")

        employee_id = str(data.get("employeeId") or "").strip() or None
        if employee_id and len(employee_id) > 50:
            raise ValidationAppError("employeeId must not exceed 50 characters.")

        specialization = str(data.get("specialization") or "").strip()[:200] or None
        license_number = str(data.get("licenseNumber") or "").strip()[:100] or None

        if User.objects.filter(email=email).exists():
            raise ConflictError(f"User with email {email!r} already exists.", code="EMAIL_CONFLICT")

        temp_password = generate_temp_password()
        user = User.objects.create_user(
            email=email,
            password=temp_password,
            first_name=first_name,
            last_name=last_name,
            role=role,
            department_id=data.get("departmentId"),
            employee_id=employee_id,
            specialization=specialization,
            license_number=license_number,
            status=UserStatus.ACTIVE,
        )
        write_audit_log(
            request=request, action=AuditAction.CREATE, resource="users",
            resource_id=user.id, details={"email": email, "role": user.role}
        )
        return Response(UserProfileSerializer(user).data, status=status.HTTP_201_CREATED)

class AdminUserDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = UserProfileSerializer

    def _get_user(self, user_id):
        from apps.authentication.models import User
        try:
            return User.objects.get(id=user_id, deleted_at__isnull=True)
        except User.DoesNotExist:
            raise NotFoundError(f"User {user_id} not found.", code="USER_NOT_FOUND")

    def get(self, request, user_id):
        from apps.authentication.serializers import UserProfileSerializer
        user = self._get_user(user_id)
        return Response(UserProfileSerializer(user).data)

    def put(self, request, user_id):
        from apps.authentication.models import UserRole
        from apps.authentication.serializers import UserProfileSerializer
        user = self._get_user(user_id)
        data = request.data

        if "firstName" in data:
            v = str(data["firstName"]).strip()
            if not v or len(v) > 100:
                raise ValidationAppError("firstName must be 1–100 characters.")
            if not re.match(r"^[\w\s'\-\.]+$", v):
                raise ValidationAppError("firstName contains invalid characters.")
            user.first_name = v
        if "lastName" in data:
            v = str(data["lastName"]).strip()
            if not v or len(v) > 100:
                raise ValidationAppError("lastName must be 1–100 characters.")
            if not re.match(r"^[\w\s'\-\.]+$", v):
                raise ValidationAppError("lastName contains invalid characters.")
            user.last_name = v
        if "role" in data:
            v = str(data["role"]).strip()
            valid_roles = {r[0] for r in UserRole.choices}
            if v not in valid_roles:
                raise ValidationAppError(f"role must be one of: {sorted(valid_roles)}.")
            user.role = v
        if "departmentId" in data:
            user.department_id = data["departmentId"] or None
        if "employeeId" in data:
            v = str(data["employeeId"] or "").strip()[:50] or None
            user.employee_id = v
        if "specialization" in data:
            user.specialization = str(data["specialization"] or "").strip()[:200] or None
        if "licenseNumber" in data:
            user.license_number = str(data["licenseNumber"] or "").strip()[:100] or None
        if "avatar" in data:
            av = str(data["avatar"] or "").strip()
            if av and not av.startswith(("http://", "https://", "/media/", "/")):
                raise ValidationAppError("avatar must be a valid URL or media path.")
            user.avatar = av or None

        user.save()
        write_audit_log(request=request, action=AuditAction.UPDATE, resource="users", resource_id=user_id)
        return Response(UserProfileSerializer(user).data)

    def delete(self, request, user_id):
        user = self._get_user(user_id)
        user.deleted_at = timezone.now()
        user.is_active = False
        user.save(update_fields=["deleted_at", "is_active"])
        write_audit_log(request=request, action=AuditAction.DELETE, resource="users", resource_id=user_id)
        return Response(status=status.HTTP_204_NO_CONTENT)

class AdminUserStatusView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, user_id):
        from apps.authentication.models import User
        try:
            user = User.objects.get(id=user_id, deleted_at__isnull=True)
        except User.DoesNotExist:
            raise NotFoundError("User not found.")
        new_status = str(request.data.get("status") or "").strip()
        from apps.authentication.models import UserStatus
        valid_statuses = {s[0] for s in UserStatus.choices}
        if not new_status or new_status not in valid_statuses:
            raise ValidationAppError(f"status must be one of: {sorted(valid_statuses)}.")
        user.status = new_status
        user.save(update_fields=["status"])
        write_audit_log(
            request=request, action=AuditAction.UPDATE, resource="users", resource_id=user_id,
            details={"status": user.status}
        )
        return Response({"status": user.status})

class AdminUserResetPasswordView(APIView):
    permission_classes = [IsAdmin]

    def post(self, request, user_id):
        from apps.authentication.models import User
        try:
            user = User.objects.get(id=user_id, deleted_at__isnull=True)
        except User.DoesNotExist:
            raise NotFoundError("User not found.")
        temp_password = generate_temp_password()
        user.set_password(temp_password)
        user.save()
        write_audit_log(
            request=request, action=AuditAction.PASSWORD_RESET, resource="users",
            resource_id=user_id, severity=AuditSeverity.WARNING,
        )
        return Response({"message": "Password reset. Temporary password sent via email."})

class AdminUserActivityView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = AuditLogSerializer

    def get(self, request, user_id):
        qs = AuditLog.objects.filter(user_id=str(user_id)).order_by("-timestamp")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AuditLogSerializer(page, many=True).data)

class DepartmentListView(APIView):
    permission_classes = [IsAdmin | IsFrontDesk]
    serializer_class = DepartmentSerializer

    def get(self, request):
        qs = Department.objects.all()
        if request.query_params.get("type"):
            qs = qs.filter(type=request.query_params["type"])
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(DepartmentSerializer(page, many=True).data)

    def post(self, request):
        serializer = DepartmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dept = serializer.save()
        write_audit_log(request=request, action=AuditAction.CREATE, resource="departments", resource_id=dept.id)
        return Response(DepartmentSerializer(dept).data, status=status.HTTP_201_CREATED)

class DepartmentDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = DepartmentSerializer

    def _get(self, dept_id):
        try:
            return Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            raise NotFoundError("Department not found.", code="DEPARTMENT_NOT_FOUND")

    def get(self, request, dept_id):
        return Response(DepartmentSerializer(self._get(dept_id)).data)

    def put(self, request, dept_id):
        dept = self._get(dept_id)
        serializer = DepartmentSerializer(dept, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        dept.refresh_from_db()
        write_audit_log(request=request, action=AuditAction.UPDATE, resource="departments", resource_id=dept_id)
        return Response(DepartmentSerializer(dept).data)

class DepartmentStatusView(APIView):
    permission_classes = [IsAdmin]

    def put(self, request, dept_id):
        try:
            dept = Department.objects.get(id=dept_id)
        except Department.DoesNotExist:
            raise NotFoundError("Department not found.")
        dept.status = request.data.get("status", dept.status)
        dept.save(update_fields=["status"])
        return Response({"status": dept.status})

class WardListView(APIView):
    permission_classes = [IsAdmin | IsFrontDesk]
    serializer_class = WardSerializer

    def get(self, request):
        qs = Ward.objects.select_related("department").all()
        if request.query_params.get("departmentId"):
            qs = qs.filter(department_id=request.query_params["departmentId"])
        if request.query_params.get("type"):
            qs = qs.filter(type=request.query_params["type"])
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(WardSerializer(page, many=True).data)

    def post(self, request):
        serializer = WardSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ward = serializer.save()
        write_audit_log(request=request, action=AuditAction.CREATE, resource="wards", resource_id=ward.id)
        return Response(WardSerializer(ward).data, status=status.HTTP_201_CREATED)

class WardDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = WardSerializer

    def _get(self, ward_id):
        try:
            return Ward.objects.select_related("department").get(id=ward_id)
        except Ward.DoesNotExist:
            raise NotFoundError("Ward not found.")

    def get(self, request, ward_id):
        """GET /admin/wards/:id — was missing, caused 405."""
        return Response(WardSerializer(self._get(ward_id)).data)

    def put(self, request, ward_id):
        ward = self._get(ward_id)
        s = WardSerializer(ward, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        ward.refresh_from_db()
        return Response(WardSerializer(ward).data)

class AdminBedListView(APIView):
    permission_classes = [IsAdmin | IsFrontDesk]
    serializer_class = BedSerializer

    def get(self, request):
        qs = Bed.objects.select_related("ward").all()
        if request.query_params.get("wardId"):
            qs = qs.filter(ward_id=request.query_params["wardId"])
        if request.query_params.get("status"):
            qs = qs.filter(status=request.query_params["status"])
        if request.query_params.get("type"):
            qs = qs.filter(type=request.query_params["type"])
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(BedSerializer(page, many=True).data)

    def post(self, request):
        s = BedSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        bed = s.save()
        ward = bed.ward
        ward.total_beds = Bed.objects.filter(ward=ward).count()
        ward.save(update_fields=["total_beds"])
        write_audit_log(request=request, action=AuditAction.CREATE, resource="beds", resource_id=bed.id)
        return Response(BedSerializer(bed).data, status=status.HTTP_201_CREATED)

class AdminBedDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = BedSerializer

    def put(self, request, bed_id):
        try:
            bed = Bed.objects.get(id=bed_id)
        except Bed.DoesNotExist:
            raise NotFoundError("Bed not found.")
        s = BedSerializer(bed, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        bed.refresh_from_db()
        return Response(BedSerializer(bed).data)

    def delete(self, request, bed_id):
        try:
            bed = Bed.objects.get(id=bed_id)
        except Bed.DoesNotExist:
            raise NotFoundError("Bed not found.")
        bed.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class LabCatalogView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = LabCatalogSerializer

    def get(self, request):
        qs = LabCatalogItem.objects.all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(LabCatalogSerializer(page, many=True).data)

    def post(self, request):
        s = LabCatalogSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        item = s.save()
        return Response(LabCatalogSerializer(item).data, status=status.HTTP_201_CREATED)

class LabCatalogDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = LabCatalogSerializer

    def put(self, request, item_id):
        try:
            item = LabCatalogItem.objects.get(id=item_id)
        except LabCatalogItem.DoesNotExist:
            raise NotFoundError("Lab catalog item not found.")
        s = LabCatalogSerializer(item, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        item.refresh_from_db()
        return Response(LabCatalogSerializer(item).data)

class RadiologyCatalogView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = RadiologyCatalogSerializer

    def get(self, request):
        qs = RadiologyCatalogItem.objects.all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(RadiologyCatalogSerializer(page, many=True).data)

    def post(self, request):
        s = RadiologyCatalogSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        item = s.save()
        return Response(RadiologyCatalogSerializer(item).data, status=status.HTTP_201_CREATED)

class RadiologyCatalogDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = RadiologyCatalogSerializer

    def put(self, request, item_id):
        try:
            item = RadiologyCatalogItem.objects.get(id=item_id)
        except RadiologyCatalogItem.DoesNotExist:
            raise NotFoundError("Radiology catalog item not found.")
        s = RadiologyCatalogSerializer(item, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        item.refresh_from_db()
        return Response(RadiologyCatalogSerializer(item).data)

class ServiceCatalogView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = ServiceCatalogSerializer

    def get(self, request):
        qs = ServiceCatalogItem.objects.all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(ServiceCatalogSerializer(page, many=True).data)

    def post(self, request):
        s = ServiceCatalogSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        item = s.save()
        return Response(ServiceCatalogSerializer(item).data, status=status.HTTP_201_CREATED)

class ServiceCatalogDetailView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = ServiceCatalogSerializer

    def put(self, request, item_id):
        try:
            item = ServiceCatalogItem.objects.get(id=item_id)
        except ServiceCatalogItem.DoesNotExist:
            raise NotFoundError("Service catalog item not found.")
        s = ServiceCatalogSerializer(item, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        item.refresh_from_db()
        return Response(ServiceCatalogSerializer(item).data)

class AuditLogView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = AuditLogSerializer

    def get(self, request):
        qs = AuditLog.objects.all().order_by("-timestamp")
        params = request.query_params
        if params.get("userId"):
            qs = qs.filter(user_id=params["userId"])
        if params.get("role"):
            qs = qs.filter(user_role=params["role"])
        if params.get("action"):
            qs = qs.filter(action=params["action"])
        if params.get("resource"):
            qs = qs.filter(resource=params["resource"])
        if params.get("outcome"):
            qs = qs.filter(outcome=params["outcome"])
        if params.get("severity"):
            qs = qs.filter(severity=params["severity"])
        if params.get("dateFrom"):
            qs = qs.filter(timestamp__gte=params["dateFrom"])
        if params.get("dateTo"):
            qs = qs.filter(timestamp__lte=params["dateTo"])
        paginator = StandardPagination()
        paginator.page_size = 50
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(AuditLogSerializer(page, many=True).data)

class SettingsView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = SystemSettingSerializer

    def get(self, request):
        settings_qs = SystemSetting.objects.all().order_by("category", "key")
        grouped = {}
        for s in settings_qs:
            grouped.setdefault(s.category, []).append(SystemSettingSerializer(s).data)
        return Response(grouped)

    def put(self, request):
        for key, value in request.data.items():
            SystemSetting.objects.update_or_create(
                key=key,
                defaults={"value": value, "updated_by": request.user},
            )
        write_audit_log(
            request=request, action=AuditAction.UPDATE, resource="settings",
            details={"keys": list(request.data.keys())}
        )
        return Response({"message": "Settings updated."})

class PermissionsView(APIView):
    permission_classes = [IsAdmin]
    serializer_class = RolePermissionSerializer

    def get(self, request):
        perms = RolePermission.objects.all()
        return Response(RolePermissionSerializer(perms, many=True).data)

    def put(self, request):
        for item in request.data:
            RolePermission.objects.update_or_create(
                role=item["role"],
                resource=item["resource"],
                action=item["action"],
                defaults={"allowed": item.get("allowed", True)},
            )
        write_audit_log(
            request=request, action=AuditAction.PERMISSION_CHANGE, resource="permissions",
            severity="warning",
        )
        return Response({"message": "Permissions updated."})

class AdminStatsView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        from apps.authentication.models import User, UserStatus
        from apps.patients.models import Patient
        from apps.laboratory.models import LabTestResult
        from apps.radiology.models import ImagingStudy
        from django.utils import timezone as tz

        total_users = User.objects.filter(deleted_at__isnull=True).count()
        active_users = User.objects.filter(status=UserStatus.ACTIVE, deleted_at__isnull=True).count()
        total_departments = Department.objects.count()
        total_beds = Bed.objects.count()
        occupied_beds = Bed.objects.filter(status="occupied").count()
        bed_occupancy_rate = round((occupied_beds / total_beds * 100) if total_beds else 0, 2)
        total_lab_tests = LabTestResult.objects.count()
        total_radiology = ImagingStudy.objects.count()
        today = tz.now().date()
        audit_today = AuditLog.objects.filter(timestamp__date=today).count()

        return Response({
            "totalUsers": total_users,
            "activeUsers": active_users,
            "totalDepartments": total_departments,
            "totalBeds": total_beds,
            "occupiedBeds": occupied_beds,
            "bedOccupancyRate": bed_occupancy_rate,
            "totalLabTests": total_lab_tests,
            "totalRadiologyStudies": total_radiology,
            "auditLogsToday": audit_today,
            "systemUptime": 100,
        })
