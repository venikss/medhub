"""
Laboratory module views â€” LIS: Specimens, Accessions, Analyzer Queue,
Panels, Results, Reports, Critical Values.

Fixed:
  - LabWorklistView: removed invalid LabPanel.LabPanelStatus inner class reference
  - AnalyzerQueueStatusView: fixed TextChoices iteration (use .choices not direct iteration)
  - LabReportReleaseView: changed select_related("panel__results") to prefetch_related
  - CriticalValueAcknowledgeView: method changed POST â†’ PUT (spec requirement)
  - Added LabResultDetailView (GET /lab/results/:id was missing)
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
from core.permissions import IsLabTech, IsDoctor, IsAdmin, UserRole, ReadWriteRolePermission
from core.storage import upload_file, validate_file
from core.utils import generate_accession_number
from core.websockets import emit_lab_critical_result, emit_lab_result_released, broadcast_to_user

from .models import (
    Specimen, SpecimenStatus, Accession, AnalyzerQueue, AnalyzerQueueStatus,
    LabPanel, LabPanelStatus, LabTestResult, LabReport, CriticalValue,
    LabReportStatus, LabResultStatus,
)
from .serializers import (
    SpecimenSerializer, AccessionSerializer, AnalyzerQueueSerializer,
    LabPanelSerializer, LabPanelWithResultsSerializer,
    LabTestResultSerializer, LabReportSerializer, CriticalValueSerializer,
    ANALYZER_QUEUE_STATUS_FROM_API, LAB_PANEL_STATUS_FROM_API,
)


LabReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.LAB_TECH, UserRole.DOCTOR],
    [UserRole.LAB_TECH],
)


def _create_cdss_panic_value(result, patient_id):
    """Create CDSS recommendation for a critical lab value."""
    try:
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        from core.websockets import emit_cdss_new_recommendation
        rec = CDSSRecommendation.objects.create(
            patient_id=patient_id,
            source_module="lab",
            triggered_by="lab_critical_result",
            type=CDSSRecommendationType.PANIC_VALUE,
            title=f"Critical Lab Value: {result.test_name}",
            summary=(
                f"{result.test_name} = {result.value} {result.unit or ''} â€” CRITICAL."
                " Immediate notification required."
            ),
            explanation={
                "testName": result.test_name,
                "value": result.value,
                "unit": result.unit,
                "flag": result.flag,
                "panelId": str(result.panel_id),
            },
            severity="critical",
            target_roles=["doctor", "nurse"],
        )
        emit_cdss_new_recommendation({
            "recommendationId": str(rec.id),
            "id": str(rec.id),
            "patientId": str(patient_id),
            "type": CDSSRecommendationType.PANIC_VALUE,
            "severity": "critical",
            "title": rec.title,
            "summary": rec.summary,
            "targetRoles": rec.target_roles,
        }, target_roles=rec.target_roles)
    except Exception:
        pass  # CDSS failure must never break the lab workflow


# ---------------------------------------------------------------------------
# Worklist
# ---------------------------------------------------------------------------

class LabWorklistView(APIView):
    """GET /lab/worklist"""
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = LabPanel.objects.select_related("patient", "specimen", "order__ordered_by").prefetch_related("results").all()

        if s := request.query_params.get("status"):
            qs = qs.filter(status=LAB_PANEL_STATUS_FROM_API.get(s, s))
        else:
            # Default: active work — exclude released panels
            qs = qs.exclude(status=LabPanelStatus.RELEASED)

        if priority := request.query_params.get("priority"):
            qs = qs.filter(priority=priority)

        if date := request.query_params.get("date"):
            qs = qs.filter(created_at__date=date)

        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            LabPanelWithResultsSerializer(page, many=True, context={"request": request}).data
        )


# ---------------------------------------------------------------------------
# Specimens
# ---------------------------------------------------------------------------

class SpecimenListCreateView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = Specimen.objects.select_related("patient", "accession").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=ANALYZER_QUEUE_STATUS_FROM_API.get(s, s))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            SpecimenSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = SpecimenSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        specimen = serializer.save(collected_by=request.user)
        return Response(
            SpecimenSerializer(specimen, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class SpecimenDetailView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def _get(self, pk):
        try:
            return Specimen.objects.select_related("patient", "order", "collected_by", "received_by").get(id=pk)
        except Specimen.DoesNotExist:
            raise NotFoundError("Specimen not found.")

    def get(self, request, pk):
        return Response(SpecimenSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        specimen = self._get(pk)
        serializer = SpecimenSerializer(
            specimen, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        specimen.refresh_from_db()
        return Response(SpecimenSerializer(specimen, context={"request": request}).data)


class SpecimenReceiveView(APIView):
    permission_classes = [IsAuthenticated, IsLabTech]

    def post(self, request, pk):
        try:
            specimen = Specimen.objects.select_related("patient").get(id=pk)
        except Specimen.DoesNotExist:
            raise NotFoundError("Specimen not found.")
        specimen.status = "received"
        specimen.received_at = timezone.now()
        specimen.received_by = request.user
        specimen.condition = request.data.get("condition", "acceptable")
        specimen.save(update_fields=["status", "received_at", "received_by", "condition"])
        return Response(SpecimenSerializer(specimen, context={"request": request}).data)


class SpecimenRejectView(APIView):
    permission_classes = [IsAuthenticated, IsLabTech]

    def post(self, request, pk):
        try:
            specimen = Specimen.objects.select_related("patient").get(id=pk)
        except Specimen.DoesNotExist:
            raise NotFoundError("Specimen not found.")
        reason = request.data.get("reason")
        if not reason:
            raise ValidationAppError("Rejection reason is required.")
        specimen.status = "rejected"
        specimen.rejection_reason = reason
        specimen.save(update_fields=["status", "rejection_reason"])
        return Response(SpecimenSerializer(specimen, context={"request": request}).data)


class SpecimenRecollectView(APIView):
    """POST /specimens/recollect"""
    permission_classes = [IsAuthenticated, IsLabTech]

    def post(self, request):
        specimen_id = request.data.get("specimenId")
        reason = request.data.get("reason")
        if not specimen_id or not reason:
            raise ValidationAppError("specimenId and reason are required.")
        try:
            original = Specimen.objects.select_related("patient", "order").get(id=specimen_id)
        except Specimen.DoesNotExist:
            raise NotFoundError("Specimen not found.")

        original.status = "recollect"
        original.recollect_reason = reason
        original.save(update_fields=["status", "recollect_reason"])

        new_specimen = Specimen.objects.create(
            patient=original.patient,
            order=original.order,
            type=original.type,
            tube_type=original.tube_type,
            status="ordered",
        )
        write_audit_log(
            request, AuditAction.CREATE, "Specimen", str(new_specimen.id),
            {"action": "recollect", "originalSpecimenId": str(original.id), "reason": reason},
        )
        return Response(
            {
                "original": SpecimenSerializer(original, context={"request": request}).data,
                "newSpecimen": SpecimenSerializer(new_specimen, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )


class RecollectionRequestListView(APIView):
    """GET /lab/recollections"""
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = Specimen.objects.select_related("patient", "collected_by").filter(recollect_reason__isnull=False)
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-updated_at"), request)
        follow_up_ids = {}
        for specimen in page:
            follow_up_ids[specimen.id] = Specimen.objects.filter(
                patient=specimen.patient,
                order=specimen.order,
                type=specimen.type,
                created_at__gt=specimen.updated_at,
            ).order_by("created_at").values_list("id", flat=True).first()
        data = []
        for specimen in page:
            new_specimen_id = follow_up_ids.get(specimen.id)
            data.append({
                "id": str(specimen.id),
                "originalSpecimenId": str(specimen.id),
                "patientId": str(specimen.patient_id),
                "patientName": specimen.patient.full_name,
                "reason": specimen.recollect_reason,
                "requestedBy": specimen.collected_by.get_full_name() if specimen.collected_by_id else None,
                "requestedAt": specimen.updated_at.isoformat(),
                "notes": specimen.rejection_reason,
                "resolved": bool(new_specimen_id),
                "newSpecimenId": str(new_specimen_id) if new_specimen_id else None,
            })
        return paginator.get_paginated_response(data)


# ---------------------------------------------------------------------------
# Accessions
# ---------------------------------------------------------------------------

class AccessionListCreateView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = Accession.objects.select_related("specimen__patient", "received_by").all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            AccessionSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = AccessionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        acc_num = generate_accession_number("LAB")
        accession = serializer.save(accession_number=acc_num, received_by=request.user)
        # Auto-advance specimen to received
        specimen = accession.specimen
        if specimen.status in (SpecimenStatus.ORDERED, SpecimenStatus.COLLECTED, "in-transit"):
            specimen.status = SpecimenStatus.RECEIVED
            specimen.received_at = specimen.received_at or timezone.now()
            specimen.received_by = specimen.received_by or request.user
            specimen.save(update_fields=["status", "received_at", "received_by"])
        return Response(
            AccessionSerializer(accession, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class AccessionDetailView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def _get(self, pk):
        try:
            return Accession.objects.select_related("specimen__patient", "received_by").get(id=pk)
        except Accession.DoesNotExist:
            raise NotFoundError("Accession not found.")

    def get(self, request, pk):
        return Response(AccessionSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        acc = self._get(pk)
        serializer = AccessionSerializer(
            acc, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        acc.refresh_from_db()
        return Response(AccessionSerializer(acc, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Analyzer Queue
# ---------------------------------------------------------------------------

class AnalyzerQueueListView(APIView):
    """GET /lab/analyzers/queue"""
    permission_classes = [IsAuthenticated, IsLabTech]

    def get(self, request):
        qs = AnalyzerQueue.objects.select_related("specimen__patient").all()
        if s := request.query_params.get("status"):
            qs = qs.filter(status=ANALYZER_QUEUE_STATUS_FROM_API.get(s, s))
        if instrument := request.query_params.get("instrument"):
            qs = qs.filter(instrument=instrument)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        data = AnalyzerQueueSerializer(page, many=True, context={"request": request}).data
        for idx, item in enumerate(data, start=1):
            item["queuePosition"] = idx
        return paginator.get_paginated_response(data)


class AnalyzerQueueStatusView(APIView):
    """PUT /lab/analyzers/queue/:id/status"""
    permission_classes = [IsAuthenticated, IsLabTech]

    def put(self, request, pk):
        try:
            entry = AnalyzerQueue.objects.select_related("specimen__patient", "specimen__order").get(id=pk)
        except AnalyzerQueue.DoesNotExist:
            raise NotFoundError("Analyzer queue entry not found.")

        new_status = ANALYZER_QUEUE_STATUS_FROM_API.get(request.data.get("status"), request.data.get("status"))
        # TextChoices.choices gives [(value, label), ...] â€” extract values correctly
        allowed = [c[0] for c in AnalyzerQueueStatus.choices]
        if new_status not in allowed:
            raise ValidationAppError(f"Invalid status. Allowed: {allowed}")

        entry.status = new_status
        update_fields = ["status"]

        if new_status == AnalyzerQueueStatus.IN_PROGRESS and not entry.started_at:
            entry.started_at = timezone.now()
            update_fields.append("started_at")
        elif new_status == AnalyzerQueueStatus.COMPLETED and not entry.completed_at:
            entry.completed_at = timezone.now()
            update_fields.append("completed_at")
        elif new_status == AnalyzerQueueStatus.ERROR:
            entry.error_message = request.data.get("errorMessage", "")
            update_fields.append("error_message")

        entry.save(update_fields=update_fields)

        # Auto-advance specimen status based on analyzer queue status
        specimen = entry.specimen
        if new_status == AnalyzerQueueStatus.IN_PROGRESS and specimen.status == SpecimenStatus.RECEIVED:
            specimen.status = SpecimenStatus.PROCESSING
            specimen.save(update_fields=["status"])
        elif new_status == AnalyzerQueueStatus.COMPLETED and specimen.status in (SpecimenStatus.RECEIVED, SpecimenStatus.PROCESSING):
            specimen.status = SpecimenStatus.ANALYZED
            specimen.save(update_fields=["status"])

        # When analysis completes, ensure LabPanel + result placeholders exist
        if new_status == AnalyzerQueueStatus.COMPLETED:
            panels = LabPanel.objects.filter(specimen=specimen)
            if not panels.exists():
                LabPanel.objects.create(
                    patient=specimen.patient,
                    order=specimen.order,
                    specimen=specimen,
                    name=specimen.order.name if specimen.order else "Lab Panel",
                    status=LabPanelStatus.IN_PROGRESS,
                )
                panels = LabPanel.objects.filter(specimen=specimen)
            for panel in panels:
                if panel.status == LabPanelStatus.PENDING:
                    panel.status = LabPanelStatus.IN_PROGRESS
                    panel.save(update_fields=["status"])
                if not panel.results.exists():
                    test_names = []
                    try:
                        test_names = specimen.accession.test_names or []
                    except Accession.DoesNotExist:
                        pass
                    for tname in test_names:
                        LabTestResult.objects.create(
                            panel=panel, specimen=specimen,
                            test_code="", test_name=tname, value="",
                            status=LabResultStatus.PENDING,
                        )

        return Response(AnalyzerQueueSerializer(entry, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Lab Panels
# ---------------------------------------------------------------------------

class LabPanelListCreateView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = LabPanel.objects.select_related("patient", "specimen", "order").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=LAB_PANEL_STATUS_FROM_API.get(s, s))
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            LabPanelSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = LabPanelSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        panel = serializer.save()
        return Response(
            LabPanelSerializer(panel, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class LabPanelDetailView(APIView):
    """GET /lab/panels/:id â€” returns panel with results inline."""
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def _get(self, pk):
        try:
            return LabPanel.objects.select_related("patient", "specimen", "order").prefetch_related("results").get(id=pk)
        except LabPanel.DoesNotExist:
            raise NotFoundError("Lab panel not found.")

    def get(self, request, pk):
        return Response(
            LabPanelWithResultsSerializer(self._get(pk), context={"request": request}).data
        )


class LabPanelResultsView(APIView):
    """POST /lab/panels/:id/results â€” enter results for a panel."""
    permission_classes = [IsAuthenticated, IsLabTech]

    def post(self, request, pk):
        try:
            panel = LabPanel.objects.select_related("specimen", "patient").get(id=pk)
        except LabPanel.DoesNotExist:
            raise NotFoundError("Lab panel not found.")

        if panel.status in (LabPanelStatus.VERIFIED, LabPanelStatus.RELEASED):
            raise ConflictError(f"Cannot add results to a {panel.status} panel.")

        results_data = request.data.get("results", [])
        if not results_data:
            raise ValidationAppError("results array is required.")

        created = []
        has_critical = False
        for r in results_data:
            result = LabTestResult.objects.create(
                panel=panel,
                specimen=panel.specimen,
                test_code=r.get("testCode", ""),
                test_name=r.get("testName", ""),
                value=r.get("value", ""),
                unit=r.get("unit", ""),
                reference_range=r.get("referenceRange", ""),
                flag=r.get("flag"),
                previous_value=r.get("previousValue"),
                delta=r.get("delta"),
                comment=r.get("comment"),
                status=LabResultStatus.PRELIMINARY,
            )
            if result.is_critical:
                has_critical = True
            created.append(result)

        update_fields = ["status"]
        if has_critical:
            panel.has_critical = True
            update_fields.append("has_critical")
        panel.status = LabPanelStatus.RESULTED
        panel.save(update_fields=update_fields)

        if hasattr(panel, "report") and panel.report.has_critical != panel.has_critical:
            panel.report.has_critical = panel.has_critical
            panel.report.save(update_fields=["has_critical"])

        # Auto-advance specimen to resulted
        specimen = panel.specimen
        if specimen and specimen.status in (SpecimenStatus.RECEIVED, SpecimenStatus.PROCESSING, SpecimenStatus.ANALYZED):
            specimen.status = SpecimenStatus.RESULTED
            specimen.save(update_fields=["status"])

        return Response(
            LabTestResultSerializer(created, many=True, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class LabPanelVerifyView(APIView):
    """PUT /lab/panels/:id/verify â€” panel-level verification."""
    permission_classes = [IsAuthenticated, IsLabTech]

    def put(self, request, pk):
        try:
            panel = LabPanel.objects.select_related("patient", "specimen").prefetch_related("results").get(id=pk)
        except LabPanel.DoesNotExist:
            raise NotFoundError("Lab panel not found.")

        if panel.status == LabPanelStatus.VERIFIED:
            raise ConflictError("Panel already verified.")

        now = timezone.now()
        # update_fields on queryset.update() â€” verified_by and verified_at need
        # to be set per-result; use a loop for FK assignment
        panel.results.filter(
            status__in=[LabResultStatus.PRELIMINARY, LabResultStatus.FINAL]
        ).update(
            status=LabResultStatus.VERIFIED,
            verified_by_id=request.user.pk,
            verified_at=now,
        )

        panel.status = LabPanelStatus.VERIFIED
        panel.verified_by = request.user
        panel.verified_at = now
        panel.save(update_fields=["status", "verified_by", "verified_at"])

        write_audit_log(
            request, AuditAction.UPDATE, "LabPanel", str(panel.id),
            {"action": "verify"}
        )
        panel.refresh_from_db()
        return Response(LabPanelWithResultsSerializer(panel, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Lab Test Results
# ---------------------------------------------------------------------------

class LabResultListCreateView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = LabTestResult.objects.select_related("panel__patient", "specimen").all()
        if panel_id := request.query_params.get("panelId"):
            qs = qs.filter(panel_id=panel_id)
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(panel__patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("test_name"), request)
        return paginator.get_paginated_response(
            LabTestResultSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = LabTestResultSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        return Response(
            LabTestResultSerializer(result, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class LabResultDetailView(APIView):
    """GET /lab/results/:id â€” single result detail (was missing)."""
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request, pk):
        try:
            result = LabTestResult.objects.select_related("panel__patient").get(id=pk)
        except LabTestResult.DoesNotExist:
            raise NotFoundError("Lab result not found.")
        write_audit_log(request, AuditAction.READ, "LabTestResult", str(result.id))
        return Response(LabTestResultSerializer(result, context={"request": request}).data)


class LabResultVerifyView(APIView):
    permission_classes = [IsAuthenticated, IsLabTech]

    def post(self, request, pk):
        try:
            result = LabTestResult.objects.select_related("panel__patient").get(id=pk)
        except LabTestResult.DoesNotExist:
            raise NotFoundError("Lab result not found.")
        if result.status == LabResultStatus.VERIFIED:
            raise ConflictError("Result already verified.")
        result.status = LabResultStatus.VERIFIED
        result.verified_by = request.user
        result.verified_at = timezone.now()
        result.save(update_fields=["status", "verified_by", "verified_at"])
        write_audit_log(
            request, AuditAction.UPDATE, "LabTestResult", str(result.id),
            {"action": "verify"}, AuditSeverity.HIGH,
        )
        return Response(LabTestResultSerializer(result, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Lab Reports
# ---------------------------------------------------------------------------

class LabReportListView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = LabReport.objects.select_related(
            "patient", "panel__order__ordered_by", "released_by"
        ).prefetch_related("panel__results").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            LabReportSerializer(page, many=True, context={"request": request}).data
        )


class LabReportDetailView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request, pk):
        try:
            report = LabReport.objects.select_related(
                "patient", "panel__order__ordered_by", "released_by"
            ).prefetch_related("panel__results").get(id=pk)
        except LabReport.DoesNotExist:
            raise NotFoundError("Lab report not found.")
        write_audit_log(request, AuditAction.READ, "LabReport", str(report.id))
        return Response(LabReportSerializer(report, context={"request": request}).data)


class LabReportReleaseView(APIView):
    permission_classes = [IsAuthenticated, IsLabTech]

    def put(self, request, pk):
        try:
            # Fixed: results is a reverse relation â€” use prefetch_related, not select_related
            report = LabReport.objects.select_related(
                "patient", "panel__order__ordered_by"
            ).prefetch_related("panel__results").get(id=pk)
        except LabReport.DoesNotExist:
            raise NotFoundError("Lab report not found.")

        if report.status == LabReportStatus.RELEASED:
            raise ConflictError("Report already released.")

        critical_results = [r for r in report.panel.results.all() if r.is_critical]
        report_has_critical = bool(report.has_critical or report.panel.has_critical or critical_results)

        report.status = LabReportStatus.RELEASED
        report.released_by = request.user
        report.released_at = timezone.now()
        report.notes = request.data.get("notes", report.notes)
        report.has_critical = report_has_critical
        report.save(update_fields=["status", "released_by", "released_at", "notes", "has_critical"])
        
        # Integration: Notify ordering doctor about release
        ordering_doctor_id = report.panel.order.ordered_by_id if report.panel.order else None
        assigned_doctor_id = report.patient.assigned_doctor_id
        
        rel_payload = {
            "reportId": str(report.id),
            "resultId": str(report.id),
            "patientId": str(report.patient_id),
            "patientName": report.patient.full_name,
            "panelId": str(report.panel_id),
        }
        
        # Notify ordering doctor
        if ordering_doctor_id:
            emit_lab_result_released(rel_payload, user_id=str(ordering_doctor_id))
        
        # Notify assigned doctor if different
        if assigned_doctor_id and str(assigned_doctor_id) != str(ordering_doctor_id):
            emit_lab_result_released(rel_payload, user_id=str(assigned_doctor_id))

        write_audit_log(
            request, AuditAction.UPDATE, "LabReport", str(report.id),
            {"action": "release"}, AuditSeverity.HIGH,
        )

        patient = report.patient

        if report_has_critical:
            # Integration: Target the ordering doctor
            ordering_doctor_id = report.panel.order.ordered_by_id if report.panel.order else None
            
            payload = {
                "reportId": str(report.id),
                "resultId": str(report.id),
                "patientId": str(patient.id),
                "patientName": patient.full_name,
                "panelId": str(report.panel_id),
            }

            # Notify ordering doctor
            if ordering_doctor_id:
                emit_lab_critical_result(payload, user_id=str(ordering_doctor_id))
            
            # Notify assigned doctor if different
            assigned_doctor_id = report.patient.assigned_doctor_id
            if assigned_doctor_id and str(assigned_doctor_id) != str(ordering_doctor_id):
                emit_lab_critical_result(payload, user_id=str(assigned_doctor_id))
            
            # If no target doctor at all, fallback to role-based
            if not ordering_doctor_id and not assigned_doctor_id:
                emit_lab_critical_result(payload)
            # panel__results already prefetched
            for result in critical_results:
                _create_cdss_panic_value(result, patient.id)
                CriticalValue.objects.get_or_create(
                    result=result,
                    defaults={
                        "patient": patient,
                        "test_name": result.test_name,
                        "value": result.value,
                        "unit": result.unit or "",
                        "notified_at": timezone.now(),
                        "notification_method": "system",
                    },
                )

        return Response(LabReportSerializer(report, context={"request": request}).data)


class LabReportCorrectView(APIView):
    permission_classes = [IsAuthenticated, IsLabTech]

    def post(self, request, pk):
        try:
            report = LabReport.objects.select_related("patient", "panel").get(id=pk)
        except LabReport.DoesNotExist:
            raise NotFoundError("Lab report not found.")
        note = request.data.get("correctionNote")
        if not note:
            raise ValidationAppError("correctionNote is required.")
        report.status = LabReportStatus.CORRECTED
        report.corrected_at = timezone.now()
        report.correction_note = note
        report.save(update_fields=["status", "corrected_at", "correction_note"])
        return Response(LabReportSerializer(report, context={"request": request}).data)


class LabReportAttachmentView(APIView):
    permission_classes = [IsAuthenticated, IsLabTech]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            report = LabReport.objects.get(id=pk)
        except LabReport.DoesNotExist:
            raise NotFoundError("Lab report not found.")
        f = request.FILES.get("file")
        if not f:
            raise ValidationAppError("No file provided.")
        validate_file(f, allowed_types=["application/pdf", "image/jpeg", "image/png"])
        result = upload_file(f, "lab-reports", f.name)
        report.attachment_url = result["fileUrl"]
        report.attachment_id = result.get("fileId", "")
        report.save(update_fields=["attachment_url", "attachment_id"])
        return Response(
            {
                "fileUrl": result["fileUrl"],
                "fileId": result.get("fileId", ""),
                "uploadedAt": timezone.now().isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )


# ---------------------------------------------------------------------------
# Critical Values
# ---------------------------------------------------------------------------

class CriticalValueListView(APIView):
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def get(self, request):
        qs = CriticalValue.objects.select_related("patient", "result").all()
        if request.query_params.get("unacknowledged"):
            qs = qs.filter(status__in=["pending", "notified"])
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            CriticalValueSerializer(page, many=True, context={"request": request}).data
        )


class CriticalValueNotifyView(APIView):
    """POST /lab/critical/:resultId/notify"""
    permission_classes = [IsAuthenticated, LabReadWritePermission]

    def post(self, request, result_id):
        try:
            cv = CriticalValue.objects.select_related("patient", "result").get(result_id=result_id)
        except CriticalValue.DoesNotExist:
            raise NotFoundError("Critical value record not found for this result.")

        notified_to = request.data.get("notifiedTo")
        if not notified_to:
            raise ValidationAppError("notifiedTo is required.")

        cv.status = "notified"
        cv.notified_to = notified_to
        cv.notified_at = timezone.now()
        cv.notification_method = request.data.get("notificationMethod", "phone")
        cv.readback_provided = request.data.get("readbackProvided", False)
        cv.save(update_fields=[
            "status", "notified_to", "notified_at",
            "notification_method", "readback_provided",
        ])
        write_audit_log(
            request, AuditAction.UPDATE, "CriticalValue", str(cv.id),
            {"action": "notify", "notifiedTo": notified_to}, AuditSeverity.HIGH,
        )
        return Response(CriticalValueSerializer(cv, context={"request": request}).data)


class CriticalValueAcknowledgeView(APIView):
    """
    PUT /lab/critical/:resultId/acknowledge
    Fixed: method changed from POST to PUT per spec.
    """
    permission_classes = [IsAuthenticated, IsDoctor]

    def put(self, request, result_id):
        try:
            cv = CriticalValue.objects.select_related("patient", "result").get(result_id=result_id)
        except CriticalValue.DoesNotExist:
            raise NotFoundError("Critical value not found.")
        if cv.status == "acknowledged":
            raise ConflictError("Critical value already acknowledged.")
        cv.status = "acknowledged"
        cv.acknowledged_by = request.user
        cv.acknowledged_at = timezone.now()
        cv.readback_provided = request.data.get("readbackProvided", cv.readback_provided)
        cv.save(update_fields=[
            "status", "acknowledged_by", "acknowledged_at", "readback_provided"
        ])
        write_audit_log(
            request, AuditAction.UPDATE, "CriticalValue", str(cv.id),
            {"action": "acknowledge"}, AuditSeverity.HIGH,
        )
        return Response(CriticalValueSerializer(cv, context={"request": request}).data)
