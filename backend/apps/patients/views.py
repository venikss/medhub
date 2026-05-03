"""
Patients application views.
"""

import random
import string
from datetime import datetime

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsAdmin, IsFrontDesk, IsDoctor, IsNurse, IsStaff, UserRole, ReadWriteRolePermission
from core.storage import (
    upload_file,
    upload_response,
    validate_file,
    MAX_AVATAR_SIZE,
    MAX_CONSENT_SIZE,
    MAX_INSURANCE_CARD_SIZE,
)
from core.websockets import (
    emit_adt_admission, emit_adt_discharge,
    emit_adt_bed_available, emit_queue_ticket_called,
)
from core.workflows import validate_status_transition
from .models import (
    Patient, Admission, Queue, Appointment, Consent,
    PatientStatus, AdmissionStatus, QueueStatus, AppointmentStatus,
)
from .serializers import (
    PatientSerializer, AdmissionSerializer, QueueSerializer,
    AppointmentSerializer, ConsentSerializer, ADMISSION_STATUS_FROM_API,
)
from .services import PatientService, AdmissionService


def _current_shift() -> str:
    """Return the current nursing shift based on the local hour."""
    hour = timezone.localtime().hour
    if 7 <= hour < 15:
        return "day"
    if 15 <= hour < 23:
        return "evening"
    return "night"



PatientReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH, UserRole.RADIOLOGIST, UserRole.PHARMACIST, UserRole.BILLING_STAFF, UserRole.FRONT_DESK],
    [UserRole.ADMIN, UserRole.FRONT_DESK],
)

AdmissionReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.FRONT_DESK],
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.FRONT_DESK],
)

QueueReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.FRONT_DESK],
    [UserRole.ADMIN, UserRole.FRONT_DESK],
)

AppointmentReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.FRONT_DESK],
    [UserRole.ADMIN, UserRole.FRONT_DESK],
)

ConsentReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.FRONT_DESK],
    [UserRole.ADMIN, UserRole.DOCTOR, UserRole.NURSE, UserRole.FRONT_DESK],
)


# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------

class PatientListCreateView(APIView):
    permission_classes = [IsAuthenticated, PatientReadWritePermission]
    serializer_class = PatientSerializer

    def get(self, request):
        qs = Patient.objects.select_related("assigned_doctor", "ward").filter(deleted_at__isnull=True).order_by("-created_at")
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        if ward := request.query_params.get("ward"):
            # Patients currently admitted to a ward
            qs = qs.filter(
                admissions__ward_id=ward,
                admissions__status=AdmissionStatus.ACTIVE,
            ).distinct()

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            PatientSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = PatientSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        patient = PatientService.create_patient(serializer.validated_data)
        write_audit_log(request, AuditAction.CREATE, "Patient", str(patient.id))
        return Response(
            PatientSerializer(patient, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class PatientDetailView(APIView):
    permission_classes = [IsAuthenticated, PatientReadWritePermission]
    serializer_class = PatientSerializer

    def _get_patient(self, pk):
        try:
            return Patient.objects.get(id=pk, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError(f"Patient {pk} not found.")

    def get(self, request, pk):
        patient = self._get_patient(pk)
        write_audit_log(request, AuditAction.READ, "Patient", str(patient.id))
        return Response(PatientSerializer(patient, context={"request": request}).data)

    def put(self, request, pk):
        patient = self._get_patient(pk)
        serializer = PatientSerializer(patient, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        write_audit_log(request, AuditAction.UPDATE, "Patient", str(patient.id))
        return Response(PatientSerializer(patient, context={"request": request}).data)

    def delete(self, request, pk):
        patient = self._get_patient(pk)
        patient.soft_delete()
        write_audit_log(request, AuditAction.DELETE, "Patient", str(patient.id))
        return Response(status=status.HTTP_204_NO_CONTENT)


class PatientSearchView(APIView):
    permission_classes = [IsAuthenticated, PatientReadWritePermission]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"data": [], "total": 0})
        qs = Patient.objects.select_related("assigned_doctor", "ward").filter(deleted_at__isnull=True).filter(
            Q(mrn__icontains=q)
            | Q(first_name__icontains=q)
            | Q(last_name__icontains=q)
            | Q(phone__icontains=q)
            | Q(email__icontains=q)
        )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("last_name", "first_name"), request)
        return paginator.get_paginated_response(
            PatientSerializer(page, many=True, context={"request": request}).data
        )


class PatientDuplicatesView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin | IsFrontDesk]

    def get(self, request, pk):
        try:
            patient = Patient.objects.get(id=pk, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        duplicates = PatientService.find_duplicates(patient)
        return Response({"data": duplicates, "total": len(duplicates)})


class PatientMergeView(APIView):
    """
    POST /patients/merge/
    Body: { keepId, mergeId }   â† spec field names
    """
    permission_classes = [IsAuthenticated, IsAdmin | IsFrontDesk]

    def post(self, request):
        # FIXED: spec uses keepId / mergeId, not keepPatientId / mergePatientId
        keep_id = request.data.get("keepId")
        merge_id = request.data.get("mergeId")
        if not keep_id or not merge_id:
            raise ValidationAppError("keepId and mergeId are required.")
        patient = PatientService.merge_patients(keep_id, merge_id, request.user)
        write_audit_log(
            request, AuditAction.UPDATE, "Patient", str(patient.id),
            {"action": "merge", "mergedId": str(merge_id)}, AuditSeverity.HIGH,
        )
        return Response(PatientSerializer(patient, context={"request": request}).data)


class PatientAvatarView(APIView):
    permission_classes = [IsAuthenticated, AdmissionReadWritePermission]
    parser_classes = [MultiPartParser]

    def put(self, request, pk):
        try:
            patient = Patient.objects.get(id=pk, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        f = request.FILES.get("file")
        if not f:
            raise ValidationAppError("No file provided.")
        validate_file(
            f,
            allowed_types=["image/jpeg", "image/png", "image/webp"],
            max_size=MAX_AVATAR_SIZE,
        )
        result = upload_file(f, "avatars", f.name)
        patient.avatar = result["fileUrl"]
        patient.save(update_fields=["avatar"])
        return Response(upload_response(result))


class PatientInsuranceCardView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            patient = Patient.objects.get(id=pk, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        f = request.FILES.get("file")
        if not f:
            raise ValidationAppError("No file provided.")
        validate_file(
            f,
            allowed_types=["image/jpeg", "image/png", "application/pdf"],
            max_size=MAX_INSURANCE_CARD_SIZE,
        )
        result = upload_file(f, "insurance-cards", f.name)
        details = patient.insurance_details or {}
        details["cardUrl"] = result["fileUrl"]
        details["cardFileId"] = result.get("fileId")
        patient.insurance_details = details
        patient.save(update_fields=["insurance_details"])
        return Response(upload_response(result))


# ---------------------------------------------------------------------------
# Admissions / ADT
# ---------------------------------------------------------------------------

class AdmissionListCreateView(APIView):
    permission_classes = [IsAuthenticated, AdmissionReadWritePermission]
    serializer_class = AdmissionSerializer

    def get(self, request):
        qs = Admission.objects.select_related(
            "patient",
            "patient__assigned_doctor",
            "admitting_doctor",
            "department",
            "ward",
            "bed",
        ).all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=ADMISSION_STATUS_FROM_API.get(s, s))
        if ward_id := request.query_params.get("wardId"):
            qs = qs.filter(ward_id=ward_id)
        if department_id := request.query_params.get("departmentId"):
            qs = qs.filter(department_id=department_id)
        if doctor_id := request.query_params.get("doctorId"):
            qs = qs.filter(
                Q(admitting_doctor_id=doctor_id) | Q(patient__assigned_doctor_id=doctor_id)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-admitted_at"), request)
        return paginator.get_paginated_response(
            AdmissionSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = AdmissionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            # FIXED: use AdmissionStatus.ACTIVE (not non-existent ADMITTED)
            admission = serializer.save(status=AdmissionStatus.ACTIVE)

            patient_update_fields = ["status", "admission_date"]
            admission.patient.status = PatientStatus.ADMITTED
            admission.patient.admission_date = timezone.now()
            if admission.ward_id:
                admission.patient.ward_id = admission.ward_id
                patient_update_fields.append("ward_id")

            if admission.bed_id:
                from apps.administration.models import Bed

                bed = Bed.objects.select_for_update().get(id=admission.bed_id)
                if bed.status != "available":
                    raise ValidationAppError("Selected bed is no longer available.")
                admission.patient.room_number = bed.room_number or bed.number
                patient_update_fields.append("room_number")
                bed.status = "occupied"
                bed.save(update_fields=["status"])

            if admission.admitting_doctor_id:
                admission.patient.assigned_doctor_id = admission.admitting_doctor_id
                patient_update_fields.append("assigned_doctor_id")

            admission.patient.save(update_fields=patient_update_fields)

            # ── Auto-create STAT admission vitals task for nursing ──────────────
            try:
                from apps.nurses.models import Task, TaskStatus
                room = admission.patient.room_number or "TBD"
                Task.objects.create(
                    patient=admission.patient,
                    room=str(room),
                    type="admission-vitals",
                    description=(
                        f"Record baseline admission vitals for {admission.patient.full_name}. "
                        f"Admitted to ward {admission.ward.name if admission.ward_id else 'TBD'} "
                        f"(bed {room}). Includes: BP, HR, SpO2, Temp, RR, Pain score, GCS."
                    ),
                    priority="stat",
                    status=TaskStatus.PENDING,
                    due_time=timezone.now() + timezone.timedelta(minutes=30),
                    shift=_current_shift(),
                )
            except Exception:
                pass  # Never block admission creation over a task failure
            # ───────────────────────────────────────────────────────────────────

        # Targeted notification to Admitting and Assigned doctors
        admitting_doctor_id = admission.admitting_doctor_id
        assigned_doctor_id = admission.patient.assigned_doctor_id

        payload = {
            "admissionId": str(admission.id),
            "patientId": str(admission.patient_id),
            "patientName": admission.patient.full_name,
            "wardId": str(admission.ward_id) if admission.ward_id else None,
        }

        if admitting_doctor_id:
            emit_adt_admission(payload, user_id=str(admitting_doctor_id))

        if assigned_doctor_id and str(assigned_doctor_id) != str(admitting_doctor_id):
            emit_adt_admission(payload, user_id=str(assigned_doctor_id))

        if not admitting_doctor_id and not assigned_doctor_id:
            emit_adt_admission(payload)
        write_audit_log(request, AuditAction.CREATE, "Admission", str(admission.id))
        return Response(
            AdmissionSerializer(admission, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )



class AdmissionDetailView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]
    serializer_class = AdmissionSerializer

    def _get(self, pk):
        try:
            return Admission.objects.select_related(
                "patient", "admitting_doctor", "ward", "bed"
            ).get(id=pk)
        except Admission.DoesNotExist:
            raise NotFoundError("Admission not found.")

    def get(self, request, pk):
        return Response(AdmissionSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        admission = self._get(pk)
        if any(field in request.data for field in ("status", "wardId", "bedId")):
            raise ValidationAppError(
                "Admission bed, ward, and status changes must go through the dedicated transfer, discharge, or status workflow endpoints."
            )
        serializer = AdmissionSerializer(
            admission, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AdmissionSerializer(admission, context={"request": request}).data)


class AdmissionStatusView(APIView):
    """
    PUT /admissions/:id/status
    Body: { status }
    FIXED: dedicated status endpoint now exists.
    """
    permission_classes = [IsAuthenticated, IsDoctor | IsAdmin | IsNurse]

    def put(self, request, pk):
        try:
            admission = Admission.objects.select_related("patient").get(id=pk)
        except Admission.DoesNotExist:
            raise NotFoundError("Admission not found.")

        new_status = ADMISSION_STATUS_FROM_API.get(request.data.get("status"), request.data.get("status"))
        allowed = [s.value for s in AdmissionStatus]
        if new_status not in allowed:
            raise ValidationAppError(f"Invalid status. Allowed: {allowed}")
        if new_status in {AdmissionStatus.DISCHARGED, AdmissionStatus.TRANSFERRED}:
            raise ValidationAppError(
                "Use the discharge or transfer endpoints for these status changes so related patient and bed records stay synchronized."
            )
        validate_status_transition(
            admission.status,
            new_status,
            {
                AdmissionStatus.ACTIVE: {AdmissionStatus.TRANSFERRED, AdmissionStatus.DISCHARGED, AdmissionStatus.CANCELLED},
                AdmissionStatus.TRANSFERRED: {AdmissionStatus.DISCHARGED},
                AdmissionStatus.DISCHARGED: set(),
                AdmissionStatus.CANCELLED: set(),
            },
            "admission",
        )

        with transaction.atomic():
            admission.status = new_status
            admission.save(update_fields=["status"])

            if new_status == AdmissionStatus.CANCELLED:
                if admission.bed_id:
                    from apps.administration.models import Bed

                    Bed.objects.filter(id=admission.bed_id).update(status="available")
                admission.patient.status = PatientStatus.ACTIVE
                admission.patient.admission_date = None
                admission.patient.ward_id = None
                admission.patient.room_number = None
                admission.patient.save(update_fields=["status", "admission_date", "ward_id", "room_number"])
        write_audit_log(
            request, AuditAction.UPDATE, "Admission", str(admission.id),
            {"status": new_status},
        )
        return Response(AdmissionSerializer(admission, context={"request": request}).data)


class AdmissionDischargeView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor | IsAdmin | IsFrontDesk]

    def post(self, request, pk):
        try:
            admission = Admission.objects.select_related("patient", "bed").get(id=pk)
        except Admission.DoesNotExist:
            raise NotFoundError("Admission not found.")
        if admission.status != AdmissionStatus.ACTIVE:
            raise ConflictError("Only active admissions can be discharged.")
        admission = AdmissionService.discharge(admission, request.data, request.user)
        # Targeted notification to Admitting and Assigned doctors
        admitting_doctor_id = admission.admitting_doctor_id
        assigned_doctor_id = admission.patient.assigned_doctor_id
        
        payload = {
            "admissionId": str(admission.id),
            "patientId": str(admission.patient_id),
            "patientName": admission.patient.full_name,
        }
        
        if admitting_doctor_id:
            emit_adt_discharge(payload, user_id=str(admitting_doctor_id))
        
        if assigned_doctor_id and str(assigned_doctor_id) != str(admitting_doctor_id):
            emit_adt_discharge(payload, user_id=str(assigned_doctor_id))
            
        if not admitting_doctor_id and not assigned_doctor_id:
            emit_adt_discharge(payload)
        if admission.bed_id:
            emit_adt_bed_available({
                "bedId": str(admission.bed_id),
                "wardId": str(admission.ward_id) if admission.ward_id else None,
            })
        write_audit_log(
            request, AuditAction.UPDATE, "Admission", str(admission.id), {"action": "discharge"}
        )
        return Response(AdmissionSerializer(admission, context={"request": request}).data)


class AdmissionTransferView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor | IsAdmin | IsNurse | IsFrontDesk]

    def post(self, request, pk):
        try:
            admission = Admission.objects.select_related("patient").get(id=pk)
        except Admission.DoesNotExist:
            raise NotFoundError("Admission not found.")
        if admission.status != AdmissionStatus.ACTIVE:
            raise ConflictError("Only active admissions can be transferred.")
        transfer = AdmissionService.transfer(admission, request.data, request.user)
        write_audit_log(
            request, AuditAction.UPDATE, "Admission", str(admission.id), {"action": "transfer"}
        )
        return Response(
            {"message": "Transfer recorded.", "transferId": str(transfer.id)},
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Beds & Wards
# ---------------------------------------------------------------------------

class WardListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.administration.models import Ward
        from apps.administration.serializers import WardSerializer
        qs = Ward.objects.select_related("department").all().order_by("name")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            WardSerializer(page, many=True, context={"request": request}).data
        )


class BedListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.administration.models import Bed
        from apps.administration.serializers import BedSerializer
        qs = Bed.objects.select_related("ward").all()
        if ward := request.query_params.get("ward"):
            qs = qs.filter(ward_id=ward)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        # FIXED: type filter added
        if t := request.query_params.get("type"):
            qs = qs.filter(type=t)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("number"), request)
        return paginator.get_paginated_response(
            BedSerializer(page, many=True, context={"request": request}).data
        )


class BedDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        from apps.administration.models import Bed
        from apps.administration.serializers import BedSerializer

        try:
            bed = Bed.objects.select_related("ward").get(id=pk)
        except Bed.DoesNotExist:
            raise NotFoundError("Bed not found.")
        return Response(BedSerializer(bed, context={"request": request}).data)


class BedStatusView(APIView):
    permission_classes = [IsAuthenticated, IsNurse | IsAdmin]

    def put(self, request, pk):
        from apps.administration.models import Bed
        from apps.administration.serializers import BedSerializer
        try:
            bed = Bed.objects.get(id=pk)
        except Bed.DoesNotExist:
            raise NotFoundError("Bed not found.")
        new_status = request.data.get("status")
        allowed = ["available", "occupied", "cleaning", "maintenance", "reserved"]
        if new_status not in allowed:
            raise ValidationAppError(f"Invalid status. Must be one of: {allowed}")
        bed.status = new_status
        bed.save(update_fields=["status"])
        if new_status == "available":
            emit_adt_bed_available({"bedId": str(bed.id), "wardId": str(bed.ward_id)})
        return Response(BedSerializer(bed, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Front Desk Summary
# ---------------------------------------------------------------------------

class FrontDeskSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsFrontDesk | IsAdmin | IsNurse]

    def get(self, request):
        from apps.administration.models import Bed

        target_date_raw = request.query_params.get("date")
        if target_date_raw:
            try:
                target_date = datetime.fromisoformat(target_date_raw).date()
            except ValueError:
                raise ValidationAppError("date must be in YYYY-MM-DD format.")
        else:
            target_date = timezone.localdate()

        appointments = list(
            Appointment.objects.filter(
                deleted_at__isnull=True,
                date=target_date,
            )
            .select_related("patient", "doctor", "department")
            .order_by("time")
        )
        active_admissions = Admission.objects.filter(status=AdmissionStatus.ACTIVE).count()
        bed_qs = list(Bed.objects.select_related("ward").all().order_by("ward__name", "number"))
        queue_qs = list(
            Queue.objects.filter(
                status__in=[QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING]
            )
            .select_related("patient")
            .order_by("priority", "created_at")
        )

        appointment_data = AppointmentSerializer(
            appointments[:5],
            many=True,
            context={"request": request},
        ).data

        beds_by_ward = {}
        for bed in bed_qs:
            ward_name = bed.ward.name if bed.ward_id else "Unassigned"
            ward_entry = beds_by_ward.setdefault(
                ward_name,
                {"ward": ward_name, "total": 0, "occupied": 0, "available": 0, "reserved": 0},
            )
            ward_entry["total"] += 1
            if bed.status == "occupied":
                ward_entry["occupied"] += 1
            elif bed.status == "available":
                ward_entry["available"] += 1
            elif bed.status == "reserved":
                ward_entry["reserved"] += 1

        queue_data = QueueSerializer(queue_qs[:4], many=True, context={"request": request}).data
        queue_wait_minutes = []
        for idx, item in enumerate(queue_data, start=1):
            source = queue_qs[idx - 1]
            wait_minutes = max(int((timezone.now() - source.created_at).total_seconds() // 60), 0)
            if source.status == QueueStatus.WAITING:
                item["estimatedWait"] = wait_minutes
                item["queuePosition"] = idx
                queue_wait_minutes.append(wait_minutes)
            else:
                item["estimatedWait"] = 0
                item["queuePosition"] = idx

        total_available_beds = sum(1 for bed in bed_qs if bed.status == "available")

        return Response(
            {
                "date": target_date.isoformat(),
                "todayAppointments": len(appointments),
                "activeAdmissions": active_admissions,
                "availableBeds": total_available_beds,
                "avgWaitTime": round(sum(queue_wait_minutes) / len(queue_wait_minutes)) if queue_wait_minutes else 0,
                "upcomingAppointments": appointment_data,
                "queueHighlights": queue_data,
                "bedsByWard": list(beds_by_ward.values()),
            }
        )


class FrontDeskAdmissionLookupsView(APIView):
    permission_classes = [IsAuthenticated, IsFrontDesk | IsAdmin | IsNurse]

    def get(self, request):
        from apps.administration.models import Bed, Department, Ward
        from apps.administration.serializers import BedSerializer, DepartmentSerializer, WardSerializer
        from apps.authentication.models import User, UserRole, UserStatus
        from apps.authentication.serializers import UserProfileSerializer

        department_id = request.query_params.get("departmentId")
        ward_id = request.query_params.get("wardId")

        doctors = (
            User.objects.filter(
                deleted_at__isnull=True,
                role=UserRole.DOCTOR,
                status=UserStatus.ACTIVE,
            )
            .select_related("department")
            .annotate(
                active_patient_count=Count(
                    "assigned_patients",
                    filter=Q(
                        assigned_patients__status=PatientStatus.ADMITTED,
                        assigned_patients__deleted_at__isnull=True,
                    ),
                )
            )
            .order_by("active_patient_count", "last_name", "first_name")
        )

        departments = Department.objects.filter(status="active").order_by("name")
        wards = Ward.objects.select_related("department").filter(status="active").order_by("name")
        if department_id:
            wards = wards.filter(department_id=department_id)

        beds = (
            Bed.objects.select_related("ward", "ward__department")
            .filter(status="available")
            .order_by("ward__name", "room_number", "number")
        )
        if ward_id:
            beds = beds.filter(ward_id=ward_id)
        elif department_id:
            beds = beds.filter(ward__department_id=department_id)

        recommended_doctor = doctors.first()

        return Response(
            {
                "doctors": UserProfileSerializer(doctors, many=True).data,
                "departments": DepartmentSerializer(departments, many=True).data,
                "wards": WardSerializer(wards, many=True).data,
                "beds": BedSerializer(beds, many=True).data,
                "meta": {
                    "recommendedDoctorId": str(recommended_doctor.id) if recommended_doctor else None,
                    "recommendedDepartmentId": (
                        str(recommended_doctor.department_id)
                        if recommended_doctor and recommended_doctor.department_id
                        else None
                    ),
                },
            }
        )


class FrontDeskPatientSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsFrontDesk | IsAdmin | IsNurse]

    def get(self, request, pk):
        try:
            patient = Patient.objects.get(id=pk, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            return Response({"error": "Patient not found."}, status=status.HTTP_404_NOT_FOUND)

        target_date_raw = request.query_params.get("date")
        if target_date_raw:
            try:
                target_date = datetime.fromisoformat(target_date_raw).date()
            except ValueError:
                raise ValidationAppError("date must be in YYYY-MM-DD format.")
        else:
            target_date = timezone.localdate()

        today_appointments = Appointment.objects.filter(
            patient_id=patient.id,
            deleted_at__isnull=True,
            date=target_date,
        ).select_related("doctor", "department").order_by("time")
        active_admission = Admission.objects.select_related(
            "admitting_doctor", "patient__assigned_doctor", "department", "ward", "bed"
        ).filter(
            patient_id=patient.id,
            status=AdmissionStatus.ACTIVE,
        ).order_by("-admitted_at").first()
        consents = Consent.objects.filter(patient_id=patient.id).order_by("-created_at")

        return Response(
            {
                "patient": PatientSerializer(patient, context={"request": request}).data,
                "todayAppointments": AppointmentSerializer(
                    today_appointments,
                    many=True,
                    context={"request": request},
                ).data,
                "activeAdmission": AdmissionSerializer(
                    active_admission,
                    context={"request": request},
                ).data if active_admission else None,
                "consents": ConsentSerializer(consents, many=True, context={"request": request}).data,
                "pendingConsents": consents.exclude(status="signed").count(),
            }
        )


class FrontDeskCheckInView(APIView):
    permission_classes = [IsAuthenticated, IsFrontDesk | IsAdmin]

    def post(self, request):
        patient_id = request.data.get("patientId")
        appointment_id = request.data.get("appointmentId")
        service = request.data.get("service")
        priority = request.data.get("priority", "normal")
        window = request.data.get("window")

        if not patient_id:
            raise ValidationAppError("patientId is required.")

        try:
            patient = Patient.objects.get(id=patient_id, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")

        appointment = None
        if appointment_id:
            try:
                appointment = Appointment.objects.get(
                    id=appointment_id,
                    patient_id=patient.id,
                    deleted_at__isnull=True,
                )
            except Appointment.DoesNotExist:
                raise NotFoundError("Appointment not found.")
            if appointment.status == AppointmentStatus.SCHEDULED:
                appointment.status = AppointmentStatus.IN_PROGRESS
                appointment.save(update_fields=["status"])

        queue_ticket = None
        queue_statuses = [QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING]
        if service:
            queue_ticket = Queue.objects.filter(
                patient_id=patient.id,
                service=service,
                queue_date=timezone.localdate(),
                status__in=queue_statuses,
            ).order_by("created_at").first()
            if queue_ticket is None:
                queue_ticket = Queue.objects.create(
                    patient=patient,
                    service=service,
                    priority=priority,
                    status=QueueStatus.WAITING,
                    window=window,
                )

        write_audit_log(
            request,
            AuditAction.UPDATE,
            "Patient",
            str(patient.id),
            {
                "action": "frontdesk_checkin",
                "appointmentId": str(appointment.id) if appointment else None,
                "queueId": str(queue_ticket.id) if queue_ticket else None,
            },
        )

        active_admission = Admission.objects.select_related(
            "admitting_doctor", "department", "ward", "bed"
        ).filter(
            patient_id=patient.id,
            status=AdmissionStatus.ACTIVE,
        ).order_by("-admitted_at").first()
        today_appointments = Appointment.objects.filter(
            patient_id=patient.id,
            deleted_at__isnull=True,
            date=timezone.localdate(),
        ).select_related("doctor", "department").order_by("time")

        return Response(
            {
                "checkedIn": True,
                "patient": PatientSerializer(patient, context={"request": request}).data,
                "appointment": AppointmentSerializer(
                    appointment,
                    context={"request": request},
                ).data if appointment else None,
                "queueTicket": QueueSerializer(
                    queue_ticket,
                    context={"request": request},
                ).data if queue_ticket else None,
                "todayAppointments": AppointmentSerializer(
                    today_appointments,
                    many=True,
                    context={"request": request},
                ).data,
                "activeAdmission": AdmissionSerializer(
                    active_admission,
                    context={"request": request},
                ).data if active_admission else None,
            }
        )


# ---------------------------------------------------------------------------
# Queue
# ---------------------------------------------------------------------------

class QueueListCreateView(APIView):
    permission_classes = [IsAuthenticated, QueueReadWritePermission]
    serializer_class = QueueSerializer

    def get(self, request):
        qs = Queue.objects.select_related("patient").all()
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        else:
            qs = qs.filter(status__in=[QueueStatus.WAITING, QueueStatus.CALLED, QueueStatus.SERVING])
        if service := request.query_params.get("service"):
            qs = qs.filter(service=service)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("priority", "created_at"), request)
        data = QueueSerializer(page, many=True, context={"request": request}).data
        now = timezone.now()
        for idx, item in enumerate(data, start=1):
            source = page[idx - 1]
            item["queuePosition"] = idx
            if source.status == QueueStatus.WAITING:
                item["estimatedWait"] = max(int((now - source.created_at).total_seconds() // 60), 0)
            elif source.status in (QueueStatus.CALLED, QueueStatus.SERVING):
                item["estimatedWait"] = 0
            else:
                item["estimatedWait"] = None
        return paginator.get_paginated_response(data)

    def post(self, request):
        serializer = QueueSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        ticket_obj = serializer.save(status=QueueStatus.WAITING)
        return Response(
            QueueSerializer(ticket_obj, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class QueueStatusView(APIView):
    """
    PUT /queue/:id/status
    Body: { status }  â€” supports waiting, called, serving, completed, no-show
    FIXED: dedicated status endpoint.
    """
    permission_classes = [IsAuthenticated, IsStaff]

    def put(self, request, pk):
        try:
            ticket = Queue.objects.select_related("patient").get(id=pk)
        except Queue.DoesNotExist:
            raise NotFoundError("Queue ticket not found.")

        new_status = request.data.get("status")
        allowed = [s.value for s in QueueStatus]
        if new_status not in allowed:
            raise ValidationAppError(f"Invalid status. Allowed: {allowed}")
        validate_status_transition(
            ticket.status,
            new_status,
            {
                QueueStatus.WAITING: {QueueStatus.CALLED, QueueStatus.NO_SHOW},
                QueueStatus.CALLED: {QueueStatus.SERVING, QueueStatus.WAITING, QueueStatus.NO_SHOW},
                QueueStatus.SERVING: {QueueStatus.COMPLETED, QueueStatus.WAITING},
                QueueStatus.COMPLETED: set(),
                QueueStatus.NO_SHOW: set(),
            },
            "queue ticket",
        )

        ticket.status = new_status
        if new_status == QueueStatus.CALLED:
            ticket.called_at = timezone.now()
            emit_queue_ticket_called({
                "ticketId": str(ticket.id),
                "ticketNumber": ticket.ticket_number,
                "patientName": ticket.patient.full_name,
            })
        elif new_status in (QueueStatus.COMPLETED, QueueStatus.NO_SHOW):
            ticket.completed_at = timezone.now()

        ticket.save()
        return Response(QueueSerializer(ticket, context={"request": request}).data)


class QueueCallView(APIView):
    """Legacy convenience endpoint â€” calls PUT /queue/:id/status with status=called."""
    permission_classes = [IsAuthenticated, IsStaff]

    def post(self, request, pk):
        try:
            ticket = Queue.objects.select_related("patient").get(id=pk)
        except Queue.DoesNotExist:
            raise NotFoundError("Queue ticket not found.")
        if ticket.status != QueueStatus.WAITING:
            raise ConflictError(f"Ticket is already {ticket.status}.")
        ticket.status = QueueStatus.CALLED
        ticket.called_at = timezone.now()
        ticket.save(update_fields=["status", "called_at"])
        emit_queue_ticket_called({
            "ticketId": str(ticket.id),
            "ticketNumber": ticket.ticket_number,
            "patientName": ticket.patient.full_name,
        })
        return Response(QueueSerializer(ticket, context={"request": request}).data)


class QueueStatsView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]

    def get(self, request):
        today = timezone.now().date()
        return Response({
            "waiting": Queue.objects.filter(status=QueueStatus.WAITING).count(),
            "called": Queue.objects.filter(status=QueueStatus.CALLED).count(),
            "serving": Queue.objects.filter(status=QueueStatus.SERVING).count(),
            "completed": Queue.objects.filter(
                status=QueueStatus.COMPLETED, queue_date=today
            ).count(),
            "noShow": Queue.objects.filter(
                status=QueueStatus.NO_SHOW, queue_date=today
            ).count(),
        })


# ---------------------------------------------------------------------------
# Appointments
# ---------------------------------------------------------------------------

class AppointmentListCreateView(APIView):
    permission_classes = [IsAuthenticated, AppointmentReadWritePermission]
    serializer_class = AppointmentSerializer

    def get(self, request):
        qs = Appointment.objects.filter(deleted_at__isnull=True).select_related("patient", "doctor")
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if doctor_id := request.query_params.get("doctorId"):
            qs = qs.filter(doctor_id=doctor_id)
        if date := request.query_params.get("date"):
            qs = qs.filter(date=date)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("date", "time"), request)
        return paginator.get_paginated_response(
            AppointmentSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = AppointmentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        appt = serializer.save()
        write_audit_log(request, AuditAction.CREATE, "Appointment", str(appt.id))
        return Response(
            AppointmentSerializer(appt, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AppointmentDetailView(APIView):
    permission_classes = [IsAuthenticated, AppointmentReadWritePermission]
    serializer_class = AppointmentSerializer

    def _get(self, pk):
        try:
            return Appointment.objects.select_related("patient", "doctor").get(
                id=pk, deleted_at__isnull=True
            )
        except Appointment.DoesNotExist:
            raise NotFoundError("Appointment not found.")

    def get(self, request, pk):
        return Response(AppointmentSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        appt = self._get(pk)
        serializer = AppointmentSerializer(
            appt, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(AppointmentSerializer(appt, context={"request": request}).data)

    def delete(self, request, pk):
        appt = self._get(pk)
        appt.soft_delete()
        write_audit_log(request, AuditAction.DELETE, "Appointment", str(appt.id))
        return Response(status=status.HTTP_204_NO_CONTENT)


class AppointmentStatusView(APIView):
    """
    PUT /appointments/:id/status
    Body: { status }
    FIXED: dedicated status endpoint.
    """
    permission_classes = [IsAuthenticated, IsDoctor | IsAdmin | IsFrontDesk]
    serializer_class = AppointmentSerializer

    def put(self, request, pk):
        try:
            appt = Appointment.objects.get(id=pk, deleted_at__isnull=True)
        except Appointment.DoesNotExist:
            raise NotFoundError("Appointment not found.")
        new_status = request.data.get("status")
        allowed = [s.value for s in AppointmentStatus]
        if new_status not in allowed:
            raise ValidationAppError(f"Invalid status. Allowed: {allowed}")
        validate_status_transition(
            appt.status,
            new_status,
            {
                AppointmentStatus.SCHEDULED: {AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW},
                AppointmentStatus.IN_PROGRESS: {AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED},
                AppointmentStatus.COMPLETED: set(),
                AppointmentStatus.CANCELLED: set(),
                AppointmentStatus.NO_SHOW: set(),
            },
            "appointment",
        )
        appt.status = new_status
        appt.save(update_fields=["status"])
        write_audit_log(
            request, AuditAction.UPDATE, "Appointment", str(appt.id), {"status": new_status}
        )
        return Response(AppointmentSerializer(appt, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Consents
# ---------------------------------------------------------------------------

class ConsentListCreateView(APIView):
    permission_classes = [IsAuthenticated, ConsentReadWritePermission]
    serializer_class = ConsentSerializer

    def get(self, request, patient_pk):
        qs = Consent.objects.filter(patient_id=patient_pk).order_by("-created_at")
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(
            ConsentSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request, patient_pk):
        try:
            Patient.objects.get(id=patient_pk, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        serializer = ConsentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        consent = serializer.save(patient_id=patient_pk)
        return Response(
            ConsentSerializer(consent, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ConsentSignView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]
    serializer_class = ConsentSerializer

    def post(self, request, consent_pk, patient_pk=None):
        try:
            filters = {"id": consent_pk}
            if patient_pk:
                filters["patient_id"] = patient_pk
            consent = Consent.objects.get(**filters)
        except Consent.DoesNotExist:
            raise NotFoundError("Consent not found.")
        if consent.status == "signed":
            raise ConflictError("Consent already signed.")
        consent.status = "signed"
        consent.signed_by = request.user
        consent.signed_at = timezone.now()
        consent.save(update_fields=["status", "signed_by", "signed_at"])
        write_audit_log(
            request, AuditAction.UPDATE, "Consent", str(consent.id),
            {"action": "sign"}, AuditSeverity.HIGH,
        )
        return Response(ConsentSerializer(consent, context={"request": request}).data)


class ConsentFileUploadView(APIView):
    permission_classes = [IsAuthenticated, IsStaff]
    parser_classes = [MultiPartParser]

    def post(self, request, patient_pk, consent_pk):
        try:
            consent = Consent.objects.get(id=consent_pk, patient_id=patient_pk)
        except Consent.DoesNotExist:
            raise NotFoundError("Consent not found.")
        f = request.FILES.get("file")
        if not f:
            raise ValidationAppError("No file provided.")
        validate_file(
            f,
            allowed_types=["application/pdf", "image/jpeg", "image/png"],
            max_size=MAX_CONSENT_SIZE,
        )
        result = upload_file(f, "consents", f.name)
        consent.file_url = result["fileUrl"]
        consent.save(update_fields=["file_url"])
        return Response(upload_response(result), status=status.HTTP_201_CREATED)
















