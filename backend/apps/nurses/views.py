"""
Nurses module views â€” fixed model field refs, added missing endpoints:
  - GET /patients/:id/vitals/latest
  - DELETE /io/:id
  - PUT /tasks/:id/complete
  - PUT /mar/:id/status (missed/refused)
  - Ward census moved to patients app (noted below)
  - Discharge checklist path fixed to use patient_id
"""

from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsNurse, IsAdmin, UserRole, ReadWriteRolePermission
from core.storage import upload_file, validate_file
from core.utils import calculate_news2_score

from .models import (
    Vitals, IntakeOutput, PainAssessment, MAREntry, MARStatus,
    NursingNote, Task, TaskStatus, Wound, Handoff, DischargeChecklistItem,
)
from .serializers import (
    VitalsSerializer, IntakeOutputSerializer, PainAssessmentSerializer,
    MAREntrySerializer, NursingNoteSerializer, TaskSerializer,
    WoundSerializer, HandoffSerializer, DischargeChecklistSerializer,
)

NursingReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.NURSE, UserRole.DOCTOR],
    [UserRole.NURSE],
)

def _trigger_news2_cdss(vitals, patient_id, user):
    if vitals.news2_score and vitals.news2_score >= 5:
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        from core.websockets import emit_cdss_new_recommendation
        rec = CDSSRecommendation.objects.create(
            patient_id=patient_id,
            source_module="nursing",
            triggered_by="vitals_recorded",
            type=CDSSRecommendationType.DETERIORATION_ALERT,
            title=f"NEWS2 Alert â€” Score {vitals.news2_score}",
            summary=(
                f"Patient NEWS2 score is {vitals.news2_score} "
                f"(threshold: 5). Immediate clinical review required."
            ),
            explanation={"news2Score": vitals.news2_score, "vitalsId": str(vitals.id)},
            severity="critical" if vitals.news2_score >= 7 else "warning",
            target_roles=["doctor", "nurse"],
        )
        emit_cdss_new_recommendation({
            "recommendationId": str(rec.id),
            "id": str(rec.id),
            "patientId": str(patient_id),
            "type": CDSSRecommendationType.DETERIORATION_ALERT,
            "severity": rec.severity,
            "title": rec.title,
            "summary": rec.summary,
            "targetRoles": rec.target_roles,
        }, target_roles=rec.target_roles)

class VitalsListCreateView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = Vitals.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-recorded_at"), request)
        return paginator.get_paginated_response(
            VitalsSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = VitalsSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        vitals_data = serializer.validated_data

        news2 = calculate_news2_score({
            "respiratoryRate": vitals_data.get("respiratory_rate"),
            "oxygenSaturation": vitals_data.get("spo2"),
            "systolicBp": vitals_data.get("systolic"),
            "heartRate": vitals_data.get("heart_rate"),
            "consciousness": vitals_data.get("gcs"),
            "temperature": vitals_data.get("temperature"),
        })
        vitals = serializer.save(recorded_by=request.user, news2_score=news2)
        _trigger_news2_cdss(vitals, vitals.patient_id, request.user)
        return Response(
            VitalsSerializer(vitals, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class VitalsDetailView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request, pk):
        try:
            v = Vitals.objects.get(id=pk)
        except Vitals.DoesNotExist:
            raise NotFoundError("Vitals record not found.")
        return Response(VitalsSerializer(v, context={"request": request}).data)

class VitalsLatestView(APIView):
    """
    FIX: GET /patients/:id/vitals/latest â€” was completely missing.
    """
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request, patient_id):
        vitals = Vitals.objects.filter(patient_id=patient_id).order_by("-recorded_at").first()
        if not vitals:
            raise NotFoundError("No vitals found for this patient.")
        return Response(VitalsSerializer(vitals, context={"request": request}).data)

class IntakeOutputListCreateView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = IntakeOutput.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            IntakeOutputSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = IntakeOutputSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        record = serializer.save(recorded_by=request.user)
        return Response(
            IntakeOutputSerializer(record, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class IntakeOutputDetailView(APIView):
    """
    FIX: DELETE /io/:id â€” was completely missing.
    """
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def _get(self, pk):
        try:
            return IntakeOutput.objects.get(id=pk)
        except IntakeOutput.DoesNotExist:
            raise NotFoundError("IO record not found.")

    def get(self, request, pk):
        return Response(IntakeOutputSerializer(self._get(pk), context={"request": request}).data)

    def delete(self, request, pk):
        self._get(pk).delete()
        return Response({"message": "IO record deleted."}, status=status.HTTP_204_NO_CONTENT)

class PainAssessmentListCreateView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = PainAssessment.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            PainAssessmentSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = PainAssessmentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        record = serializer.save(recorded_by=request.user)
        return Response(
            PainAssessmentSerializer(record, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class MARListView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = MAREntry.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if date := request.query_params.get("date"):
            qs = qs.filter(scheduled_time__date=date)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("scheduled_time"), request)
        return paginator.get_paginated_response(
            MAREntrySerializer(page, many=True, context={"request": request}).data
        )

class MARAdministerView(APIView):
    permission_classes = [IsAuthenticated, IsNurse]

    def post(self, request, pk):
        try:
            entry = MAREntry.objects.get(id=pk)
        except MAREntry.DoesNotExist:
            raise NotFoundError("MAR entry not found.")
        if entry.status == MARStatus.GIVEN:
            raise ConflictError("Medication already administered.")
        entry.status = MARStatus.GIVEN
        entry.administered_time = timezone.now()
        entry.administered_by = request.user
        entry.barcode = request.data.get("barcode", entry.barcode)
        entry.notes = request.data.get("notes", entry.notes)
        entry.save()
        write_audit_log(
            request, AuditAction.UPDATE, "MAREntry", str(entry.id),
            {"action": "administer"}, AuditSeverity.HIGH,
        )
        return Response(MAREntrySerializer(entry, context={"request": request}).data)

class MARStatusView(APIView):
    """
    FIX: PUT /mar/:id/status â€” replaces the old hold-only view.
    Handles: held, missed, refused (and given via administer endpoint).
    """
    permission_classes = [IsAuthenticated, IsNurse]

    ALLOWED_STATUSES = [MARStatus.HELD, MARStatus.MISSED, MARStatus.REFUSED, MARStatus.NOT_APPLICABLE]

    def put(self, request, pk):
        try:
            entry = MAREntry.objects.get(id=pk)
        except MAREntry.DoesNotExist:
            raise NotFoundError("MAR entry not found.")

        new_status = request.data.get("status")
        if not new_status:
            raise ValidationAppError("status is required.")
        if new_status == "overdue":
            new_status = MARStatus.SCHEDULED
        if new_status not in [s.value for s in self.ALLOWED_STATUSES]:
            raise ValidationAppError(
                f"Invalid status. Use administer endpoint for 'given'. "
                f"Other allowed values: {[s.value for s in self.ALLOWED_STATUSES]}"
            )

        entry.status = new_status
        entry.notes = request.data.get("reason", entry.notes)
        entry.save(update_fields=["status", "notes"])
        write_audit_log(
            request, AuditAction.UPDATE, "MAREntry", str(entry.id),
            {"action": "status_change", "newStatus": new_status},
        )
        return Response(MAREntrySerializer(entry, context={"request": request}).data)

class NursingNoteListCreateView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = NursingNote.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            NursingNoteSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = NursingNoteSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        from datetime import timedelta
        note = serializer.save(
            nurse=request.user,
            edit_deadline=timezone.now() + timedelta(hours=4),
        )
        return Response(
            NursingNoteSerializer(note, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class NursingNoteDetailView(APIView):
    permission_classes = [IsAuthenticated, IsNurse]

    def _get(self, pk):
        try:
            return NursingNote.objects.get(id=pk)
        except NursingNote.DoesNotExist:
            raise NotFoundError("Nursing note not found.")

    def put(self, request, pk):
        note = self._get(pk)
        if timezone.now() >= note.edit_deadline:
            raise ConflictError("This note can no longer be edited (4-hour window expired).")
        if note.nurse != request.user:
            raise ConflictError("You can only edit your own notes.")
        serializer = NursingNoteSerializer(
            note, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(NursingNoteSerializer(note, context={"request": request}).data)

    def delete(self, request, pk):
        note = self._get(pk)
        if timezone.now() >= note.edit_deadline:
            raise ConflictError("This note can no longer be deleted.")
        note.delete()
        return Response({"message": "Note deleted."}, status=status.HTTP_204_NO_CONTENT)

class TaskListCreateView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = Task.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if assigned_to := request.query_params.get("assignedTo"):
            qs = qs.filter(assigned_to_id=assigned_to)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        if shift := request.query_params.get("shift"):
            qs = qs.filter(shift=shift)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("due_time"), request)
        return paginator.get_paginated_response(
            TaskSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = TaskSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        task = serializer.save()
        return Response(
            TaskSerializer(task, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class TaskDetailView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def _get(self, pk):
        try:
            return Task.objects.get(id=pk)
        except Task.DoesNotExist:
            raise NotFoundError("Task not found.")

    def put(self, request, pk):
        task = self._get(pk)
        serializer = TaskSerializer(
            task, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        updated_task = serializer.save()
        if updated_task.status == TaskStatus.COMPLETED and not updated_task.completed_time:
            updated_task.completed_time = timezone.now()
            updated_task.completed_by = request.user
            updated_task.save(update_fields=["completed_time", "completed_by"])
        return Response(TaskSerializer(updated_task, context={"request": request}).data)

class TaskCompleteView(APIView):
    """
    FIX: PUT /tasks/:id/complete â€” dedicated complete endpoint was missing.
    """
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def put(self, request, pk):
        try:
            task = Task.objects.get(id=pk)
        except Task.DoesNotExist:
            raise NotFoundError("Task not found.")
        if task.status == TaskStatus.COMPLETED:
            raise ConflictError("Task is already completed.")
        task.status = TaskStatus.COMPLETED
        task.completed_time = timezone.now()
        task.completed_by = request.user
        task.completion_notes = request.data.get("completionNotes", "")
        task.save(update_fields=["status", "completed_time", "completed_by", "completion_notes"])
        return Response(TaskSerializer(task, context={"request": request}).data)

class WoundListCreateView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request):
        qs = Wound.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            WoundSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = WoundSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        wound = serializer.save(recorded_by=request.user)
        return Response(
            WoundSerializer(wound, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class WoundDetailView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def _get(self, pk):
        try:
            return Wound.objects.get(id=pk)
        except Wound.DoesNotExist:
            raise NotFoundError("Wound record not found.")

    def get(self, request, pk):
        return Response(WoundSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        wound = self._get(pk)
        serializer = WoundSerializer(
            wound, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(WoundSerializer(wound, context={"request": request}).data)

class WoundPhotoView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            wound = Wound.objects.get(id=pk)
        except Wound.DoesNotExist:
            raise NotFoundError("Wound not found.")
        f = request.FILES.get("file")
        if not f:
            raise ValidationAppError("No file provided.")
        validate_file(f, allowed_types=["image/jpeg", "image/png"])
        result = upload_file(f, "wound-photos", f.name)
        wound.description = wound.description + f"\n[photo:{result['fileUrl']}]"
        wound.save(update_fields=["description"])
        return Response({"photoUrl": result["fileUrl"]})

class HandoffListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsNurse]

    def get(self, request):
        qs = Handoff.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if ward_id := request.query_params.get("wardId"):
            qs = qs.filter(ward_id=ward_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            HandoffSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = HandoffSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        handoff = serializer.save(from_nurse=request.user)
        return Response(
            HandoffSerializer(handoff, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class HandoffAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, IsNurse]

    def post(self, request, pk):
        try:
            handoff = Handoff.objects.get(id=pk)
        except Handoff.DoesNotExist:
            raise NotFoundError("Handoff not found.")
        if handoff.from_nurse == request.user:
            raise ConflictError("You cannot acknowledge your own handoff.")
        handoff.to_nurse = request.user
        handoff.save(update_fields=["to_nurse"])
        return Response(HandoffSerializer(handoff, context={"request": request}).data)

class DischargeChecklistView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def get(self, request, patient_id):
        from apps.doctors.views import _auto_populate_discharge_checklist
        _auto_populate_discharge_checklist(patient_id)

        qs = DischargeChecklistItem.objects.filter(
            patient_id=patient_id
        ).order_by("category", "item")
        return Response(
            DischargeChecklistSerializer(qs, many=True, context={"request": request}).data
        )

    def post(self, request, patient_id):
        from apps.patients.models import Patient
        if not Patient.objects.filter(id=patient_id).exists():
            raise NotFoundError("Patient not found.")
        serializer = DischargeChecklistSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        item = serializer.save(patient_id=patient_id)
        return Response(
            DischargeChecklistSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class DischargeChecklistItemView(APIView):
    permission_classes = [IsAuthenticated, NursingReadWritePermission]

    def put(self, request, patient_id, pk):
        try:
            item = DischargeChecklistItem.objects.get(id=pk, patient_id=patient_id)
        except DischargeChecklistItem.DoesNotExist:
            raise NotFoundError("Checklist item not found.")
        serializer = DischargeChecklistSerializer(
            item, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()
        if updated.completed and not updated.completed_at:
            updated.completed_at = timezone.now()
            updated.completed_by = request.user
            updated.save(update_fields=["completed_at", "completed_by"])
        return Response(DischargeChecklistSerializer(updated, context={"request": request}).data)
