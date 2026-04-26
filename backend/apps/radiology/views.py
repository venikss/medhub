"""
Radiology module views â€” RIS-PACS: Orders, Studies, Reports, Critical Findings, Schedules.
Fixed: is_signed (use status field), reportâ†’study on critical finding, field name mismatches,
       cancel_reason (doesn't exist, use protocol_notes pattern), missing endpoints added.
"""

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsRadiologist, IsDoctor, IsAdmin, UserRole, ReadWriteRolePermission
from core.storage import upload_file, upload_response, validate_file, MAX_LAB_REPORT_SIZE
from core.utils import generate_accession_number
from core.websockets import emit_radiology_critical_finding, emit_radiology_report_signed
from core.workflows import validate_status_transition
from apps.authentication.models import User

from .models import (
    ImagingOrder, ImagingStudy, RadiologyReport, RadCriticalFinding,
    ModalitySchedule, ImagingStudyStatus, RadReportStatus, RadCriticalFindingStatus,
)
from .serializers import (
    ImagingOrderSerializer, ImagingStudySerializer, RadiologyReportSerializer,
    RadCriticalFindingSerializer, ModalityScheduleSerializer,
)


def _sync_order_status(study):
    """Keep the parent ImagingOrder status in sync with the study status."""
    if not study.order_id:
        return
    order = study.order
    if order.status != study.status:
        order.status = study.status
        order.save(update_fields=["status"])


RadiologyOrderReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.RADIOLOGIST, UserRole.DOCTOR],
    [UserRole.DOCTOR],
)

RadiologyDepartmentPermission = ReadWriteRolePermission.for_roles(
    [UserRole.RADIOLOGIST, UserRole.DOCTOR],
    [UserRole.RADIOLOGIST],
)

RadiologyCancelPermission = ReadWriteRolePermission.for_roles(
    [UserRole.RADIOLOGIST, UserRole.DOCTOR],
    [UserRole.RADIOLOGIST, UserRole.DOCTOR],
)


def _create_cdss_urgent_finding(study, patient_id, description):
    """Auto-create CDSS recommendation for a critical radiology finding."""
    from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
    from core.websockets import emit_cdss_new_recommendation

    rec = CDSSRecommendation.objects.create(
        patient_id=patient_id,
        source_module="radiology",
        triggered_by="radiology_critical_finding",
        type=CDSSRecommendationType.URGENT_FINDING,
        title="Critical Radiology Finding",
        summary=description,
        explanation={"studyId": str(study.id), "finding": description},
        severity="critical",
        target_roles=["doctor"],
    )
    emit_cdss_new_recommendation({
        "recommendationId": str(rec.id),
        "id": str(rec.id),
        "patientId": str(patient_id),
        "type": CDSSRecommendationType.URGENT_FINDING,
        "severity": "critical",
        "title": rec.title,
        "summary": rec.summary,
        "targetRoles": rec.target_roles,
    }, target_roles=rec.target_roles)


# ---------------------------------------------------------------------------
# Imaging Orders
# ---------------------------------------------------------------------------

class RadiologyStatsView(APIView):
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def get(self, request):
        today = timezone.now().date()
        return Response({
            "pendingOrders": ImagingOrder.objects.filter(status=ImagingStudyStatus.ORDERED).count(),
            "protocoled": ImagingOrder.objects.filter(status=ImagingStudyStatus.PROTOCOLED).count(),
            "scheduled": ImagingOrder.objects.filter(status=ImagingStudyStatus.SCHEDULED).count(),
            "inProgress": ImagingStudy.objects.filter(status=ImagingStudyStatus.IN_PROGRESS).count(),
            "awaitingRead": ImagingStudy.objects.filter(status__in=[ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.READING]).count(),
            "pendingSign": RadiologyReport.objects.filter(status__in=[RadReportStatus.DRAFT, RadReportStatus.PRELIMINARY]).count(),
            "signedToday": RadiologyReport.objects.filter(
                status__in=[RadReportStatus.FINAL, RadReportStatus.ADDENDUM],
                signed_at__date=today,
            ).count(),
            "pendingCritical": RadCriticalFinding.objects.exclude(status=RadCriticalFindingStatus.ACKNOWLEDGED).count(),
            "statOrders": ImagingOrder.objects.filter(priority__in=["stat", "urgent"]).count(),
        })


class RadiologyDashboardView(APIView):
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def get(self, request):
        today = timezone.now().date()
        stat_orders_qs = ImagingOrder.objects.select_related("patient", "ordered_by").filter(
            priority__in=["stat", "urgent"]
        ).order_by("-created_at")[:5]
        recent_reports_qs = RadiologyReport.objects.select_related(
            "study__order__patient", "signed_by"
        ).filter(
            status__in=[RadReportStatus.FINAL, RadReportStatus.ADDENDUM],
        ).order_by("-signed_at", "-updated_at")[:4]
        critical_qs = RadCriticalFinding.objects.select_related(
            "patient", "study__order", "identified_by", "acknowledged_by"
        ).exclude(
            status=RadCriticalFindingStatus.ACKNOWLEDGED
        ).order_by("-created_at")
        return Response({
            "stats": {
                "pendingOrders": ImagingOrder.objects.filter(status=ImagingStudyStatus.ORDERED).count(),
                "protocoled": ImagingOrder.objects.filter(status=ImagingStudyStatus.PROTOCOLED).count(),
                "scheduled": ImagingOrder.objects.filter(status=ImagingStudyStatus.SCHEDULED).count(),
                "inProgress": ImagingStudy.objects.filter(status=ImagingStudyStatus.IN_PROGRESS).count(),
                "awaitingRead": ImagingStudy.objects.filter(status__in=[ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.READING]).count(),
                "pendingSign": RadiologyReport.objects.filter(status__in=[RadReportStatus.DRAFT, RadReportStatus.PRELIMINARY]).count(),
                "signedToday": RadiologyReport.objects.filter(
                    status__in=[RadReportStatus.FINAL, RadReportStatus.ADDENDUM],
                    signed_at__date=today,
                ).count(),
                "pendingCritical": critical_qs.count(),
                "statOrders": ImagingOrder.objects.filter(priority__in=["stat", "urgent"]).count(),
            },
            "statOrders": ImagingOrderSerializer(stat_orders_qs, many=True, context={"request": request}).data,
            "recentSignedReports": RadiologyReportSerializer(recent_reports_qs, many=True, context={"request": request}).data,
            "pendingCriticalFindings": RadCriticalFindingSerializer(critical_qs[:10], many=True, context={"request": request}).data,
        })

class ImagingOrderListCreateView(APIView):
    permission_classes = [IsAuthenticated, RadiologyOrderReadWritePermission]

    def get(self, request):
        qs = ImagingOrder.objects.select_related(
            "patient", "ordered_by", "technologist", "assigned_radiologist", "protocoled_by"
        ).all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if modality := request.query_params.get("modality"):
            qs = qs.filter(modality=modality)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        if priority := request.query_params.get("priority"):
            qs = qs.filter(priority=priority)
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(exam_name__icontains=q)
                | Q(accession_number__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            ImagingOrderSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = ImagingOrderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        modality = serializer.validated_data.get("modality", "IMG")
        acc_num = generate_accession_number(modality)
        order = serializer.save(ordered_by=request.user, accession_number=acc_num)
        return Response(
            ImagingOrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ImagingOrderDetailView(APIView):
    permission_classes = [IsAuthenticated, RadiologyOrderReadWritePermission]

    def _get(self, pk):
        try:
            return ImagingOrder.objects.get(id=pk)
        except ImagingOrder.DoesNotExist:
            raise NotFoundError("Imaging order not found.")

    def get(self, request, pk):
        return Response(ImagingOrderSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        order = self._get(pk)
        serializer = ImagingOrderSerializer(order, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ImagingOrderSerializer(order, context={"request": request}).data)


class ImagingOrderProtocolView(APIView):
    """PUT /radiology/orders/:id/protocol â€” radiologist sets protocol."""
    permission_classes = [IsAuthenticated, IsRadiologist]

    def put(self, request, pk):
        try:
            order = ImagingOrder.objects.get(id=pk)
        except ImagingOrder.DoesNotExist:
            raise NotFoundError("Imaging order not found.")
        protocol_notes = request.data.get("protocolNotes", "")
        validate_status_transition(
            order.status,
            ImagingStudyStatus.PROTOCOLED,
            {
                ImagingStudyStatus.ORDERED: {ImagingStudyStatus.PROTOCOLED},
                ImagingStudyStatus.SCHEDULED: {ImagingStudyStatus.PROTOCOLED},
            },
            "imaging order",
        )
        order.protocol_notes = protocol_notes
        order.protocoled_by = request.user
        order.status = ImagingStudyStatus.PROTOCOLED
        order.save(update_fields=["protocol_notes", "protocoled_by", "status"])
        write_audit_log(request, AuditAction.UPDATE, "ImagingOrder", str(order.id), {"action": "protocol"})
        return Response(ImagingOrderSerializer(order, context={"request": request}).data)


class ImagingOrderScheduleView(APIView):
    """PUT /radiology/orders/:id/schedule â€” schedule an imaging order."""
    permission_classes = [IsAuthenticated, IsRadiologist]

    def put(self, request, pk):
        try:
            order = ImagingOrder.objects.get(id=pk)
        except ImagingOrder.DoesNotExist:
            raise NotFoundError("Imaging order not found.")
        scheduled_at = request.data.get("scheduledAt")
        scheduled_room = request.data.get("scheduledRoom", "")
        if not scheduled_at:
            raise ValidationAppError("scheduledAt is required.")
        parsed_scheduled_at = parse_datetime(scheduled_at) if isinstance(scheduled_at, str) else scheduled_at
        if parsed_scheduled_at is None:
            raise ValidationAppError("scheduledAt must be a valid ISO datetime.")
        validate_status_transition(
            order.status,
            ImagingStudyStatus.SCHEDULED,
            {
                ImagingStudyStatus.ORDERED: {ImagingStudyStatus.SCHEDULED},
                ImagingStudyStatus.PROTOCOLED: {ImagingStudyStatus.SCHEDULED},
            },
            "imaging order",
        )
        order.scheduled_at = parsed_scheduled_at
        order.scheduled_room = scheduled_room
        order.status = ImagingStudyStatus.SCHEDULED
        order.save(update_fields=["scheduled_at", "scheduled_room", "status"])
        return Response(ImagingOrderSerializer(order, context={"request": request}).data)


class ImagingOrderAssignView(APIView):
    """PUT /radiology/orders/:id/assign â€” assign radiologist or technologist."""
    permission_classes = [IsAuthenticated, IsRadiologist]

    def put(self, request, pk):
        try:
            order = ImagingOrder.objects.get(id=pk)
        except ImagingOrder.DoesNotExist:
            raise NotFoundError("Imaging order not found.")
        update_fields = []
        if radiologist_id := request.data.get("assignedRadiologistId"):
            try:
                assigned_radiologist = User.objects.get(id=radiologist_id)
            except User.DoesNotExist:
                raise ValidationAppError("assignedRadiologistId is invalid.")
            if assigned_radiologist.role != UserRole.RADIOLOGIST:
                raise ValidationAppError("assignedRadiologistId must belong to a radiologist.")
            order.assigned_radiologist_id = radiologist_id
            update_fields.append("assigned_radiologist")
        if technologist_id := request.data.get("technologistId"):
            try:
                technologist = User.objects.get(id=technologist_id)
            except User.DoesNotExist:
                raise ValidationAppError("technologistId is invalid.")
            if technologist.role != UserRole.RADIOLOGIST:
                raise ValidationAppError("technologistId must belong to radiology staff.")
            order.technologist_id = technologist_id
            update_fields.append("technologist")
        if not update_fields:
            raise ValidationAppError("assignedRadiologistId or technologistId is required.")
        order.save(update_fields=update_fields)
        return Response(ImagingOrderSerializer(order, context={"request": request}).data)


class ImagingOrderCancelView(APIView):
    permission_classes = [IsAuthenticated, RadiologyCancelPermission]

    def put(self, request, pk):
        try:
            order = ImagingOrder.objects.get(id=pk)
        except ImagingOrder.DoesNotExist:
            raise NotFoundError("Imaging order not found.")
        validate_status_transition(
            order.status,
            ImagingStudyStatus.CANCELLED,
            {
                ImagingStudyStatus.ORDERED: {ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.PROTOCOLED: {ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.SCHEDULED: {ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.ARRIVED: {ImagingStudyStatus.CANCELLED},
            },
            "imaging order",
        )
        # Store cancel reason in protocol_notes (model has no cancel_reason field)
        order.protocol_notes = request.data.get("reason", "")
        order.status = ImagingStudyStatus.CANCELLED
        order.cancelled_at = timezone.now()
        order.cancelled_by = request.user
        order.save(update_fields=["status", "protocol_notes", "cancelled_at", "cancelled_by"])
        return Response(ImagingOrderSerializer(order, context={"request": request}).data)

    post = put


# ---------------------------------------------------------------------------
# Imaging Studies
# ---------------------------------------------------------------------------

class ImagingStudyListCreateView(APIView):
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def get(self, request):
        qs = ImagingStudy.objects.all()
        if order_id := request.query_params.get("orderId"):
            qs = qs.filter(order_id=order_id)
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        # Model field is exam_date, not study_date
        page = paginator.paginate_queryset(qs.order_by("-exam_date"), request)
        return paginator.get_paginated_response(
            ImagingStudySerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = ImagingStudySerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order_id = serializer.validated_data.get("order_id")
        patient = serializer.validated_data.get("patient")
        order = None
        if order_id:
            try:
                order = ImagingOrder.objects.select_related("patient").get(id=order_id)
            except ImagingOrder.DoesNotExist:
                raise NotFoundError("Imaging order not found.")
            if patient and patient.id != order.patient_id:
                raise ValidationAppError("Study patient must match the selected imaging order patient.")
            study = serializer.save(patient=order.patient)
        else:
            study = serializer.save()
        if study.order_id:
            order = study.order
            desired_status = study.status if study.status != ImagingStudyStatus.ORDERED else ImagingStudyStatus.SCHEDULED
            transition_map = {
                ImagingStudyStatus.ORDERED: {ImagingStudyStatus.PROTOCOLED, ImagingStudyStatus.SCHEDULED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.PROTOCOLED: {ImagingStudyStatus.SCHEDULED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.SCHEDULED: {ImagingStudyStatus.ARRIVED, ImagingStudyStatus.IN_PROGRESS, ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.ARRIVED: {ImagingStudyStatus.IN_PROGRESS, ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.IN_PROGRESS: {ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.ACQUIRED: {ImagingStudyStatus.READING, ImagingStudyStatus.REPORTED, ImagingStudyStatus.SIGNED},
                ImagingStudyStatus.READING: {ImagingStudyStatus.REPORTED, ImagingStudyStatus.SIGNED},
                ImagingStudyStatus.REPORTED: {ImagingStudyStatus.SIGNED},
                ImagingStudyStatus.SIGNED: set(),
                ImagingStudyStatus.CANCELLED: set(),
            }
            if desired_status != order.status and desired_status in transition_map.get(order.status, set()):
                order.status = desired_status
                order.save(update_fields=["status"])
        return Response(
            ImagingStudySerializer(study, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ImagingStudyDetailView(APIView):
    """GET /radiology/studies/:id â€” single study detail (was missing)."""
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def _get(self, pk):
        try:
            return ImagingStudy.objects.select_related("order", "patient").get(id=pk)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("Imaging study not found.")

    def get(self, request, pk):
        return Response(ImagingStudySerializer(self._get(pk), context={"request": request}).data)


class ImagingStudyStatusView(APIView):
    """PUT /radiology/studies/:id/status â€” update study status (was missing)."""
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def put(self, request, pk):
        try:
            study = ImagingStudy.objects.get(id=pk)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("Imaging study not found.")
        new_status = request.data.get("status")
        if not new_status:
            raise ValidationAppError("status is required.")
        valid = [c[0] for c in ImagingStudyStatus.choices]
        if new_status not in valid:
            raise ValidationAppError(f"Invalid status. Choose from: {valid}")
        validate_status_transition(
            study.status,
            new_status,
            {
                ImagingStudyStatus.ORDERED: {ImagingStudyStatus.SCHEDULED, ImagingStudyStatus.ARRIVED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.SCHEDULED: {ImagingStudyStatus.ARRIVED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.ARRIVED: {ImagingStudyStatus.IN_PROGRESS, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.IN_PROGRESS: {ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.CANCELLED},
                ImagingStudyStatus.ACQUIRED: {ImagingStudyStatus.READING, ImagingStudyStatus.REPORTED},
                ImagingStudyStatus.READING: {ImagingStudyStatus.REPORTED},
                ImagingStudyStatus.REPORTED: {ImagingStudyStatus.SIGNED},
                ImagingStudyStatus.SIGNED: set(),
                ImagingStudyStatus.PROTOCOLED: {ImagingStudyStatus.SCHEDULED},
                ImagingStudyStatus.CANCELLED: set(),
            },
            "imaging study",
        )
        study.status = new_status
        update_fields = ["status"]
        if new_status == ImagingStudyStatus.IN_PROGRESS:
            study.started_at = timezone.now()
            update_fields.append("started_at")
        elif new_status in (ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.REPORTED, ImagingStudyStatus.SIGNED):
            study.completed_at = timezone.now()
            update_fields.append("completed_at")
        study.save(update_fields=update_fields)
        _sync_order_status(study)
        return Response(ImagingStudySerializer(study, context={"request": request}).data)


class ImagingStudyPriorsView(APIView):
    """GET /radiology/studies/:id/priors -- prior studies for same patient/modality."""
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def get(self, request, pk):
        try:
            study = ImagingStudy.objects.select_related("order").get(id=pk)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("Imaging study not found.")
        priors = ImagingStudy.objects.select_related(
            "order", "patient", "report", "order__assigned_radiologist",
        ).filter(
            patient_id=study.patient_id,
        ).exclude(id=pk).order_by("-exam_date")
        if study.order_id:
            priors = priors.filter(order__modality=study.order.modality)
        results = []
        for p in priors[:20]:
            report = getattr(p, "report", None)
            results.append({
                "id": str(p.id),
                "patientId": str(p.patient_id),
                "modality": p.order.modality if p.order_id else None,
                "examName": p.order.exam_name if p.order_id else None,
                "examDate": p.exam_date.isoformat() if p.exam_date else None,
                "reportStatus": report.status if report else None,
                "radiologist": p.order.assigned_radiologist.get_full_name() if p.order_id and p.order.assigned_radiologist_id else None,
                "impression": report.impression if report else None,
                "pacsUrl": p.pacs_url,
            })
        return Response(results)


class ImagingStudyImageUploadView(APIView):
    """POST /radiology/studies/:id/images - store an image/DICOM upload."""
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]
    parser_classes = [MultiPartParser]

    def post(self, request, pk):
        try:
            study = ImagingStudy.objects.get(id=pk)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("Imaging study not found.")

        f = request.FILES.get("file")
        if not f:
            raise ValidationAppError("No file provided.")

        validate_file(
            f,
            allowed_types=["application/dicom", "application/octet-stream", "image/jpeg", "image/png"],
            max_size=MAX_LAB_REPORT_SIZE,
        )
        result = upload_file(f, "radiology-studies", f.name)

        study.pacs_url = result["fileUrl"]
        study.images_count = (study.images_count or 0) + 1
        study.save(update_fields=["pacs_url", "images_count"])

        return Response(upload_response(result), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------------
# Radiology Reports
# ---------------------------------------------------------------------------

class RadiologyReportListCreateView(APIView):
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def get(self, request):
        qs = RadiologyReport.objects.all()
        if study_id := request.query_params.get("studyId"):
            qs = qs.filter(study_id=study_id)
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            RadiologyReportSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = RadiologyReportSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        study_id = serializer.validated_data.get("study_id")
        study = None
        if study_id:
            try:
                study = ImagingStudy.objects.select_related("order").get(id=study_id)
            except ImagingStudy.DoesNotExist:
                raise NotFoundError("Imaging study not found.")
            report = serializer.save(patient_id=study.patient_id, signed_by=None)
            # Auto-advance study to reading if still acquired
            if study.status in (ImagingStudyStatus.ACQUIRED,):
                study.status = ImagingStudyStatus.READING
                study.save(update_fields=["status"])
                _sync_order_status(study)
        else:
            report = serializer.save(signed_by=None)
        return Response(
            RadiologyReportSerializer(report, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class RadiologyReportDetailView(APIView):
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def _get(self, pk):
        try:
            return RadiologyReport.objects.select_related("study__order__patient").get(id=pk)
        except RadiologyReport.DoesNotExist:
            raise NotFoundError("Radiology report not found.")

    def get(self, request, pk):
        report = self._get(pk)
        write_audit_log(request, AuditAction.READ, "RadiologyReport", str(report.id))
        return Response(RadiologyReportSerializer(report, context={"request": request}).data)

    def put(self, request, pk):
        report = self._get(pk)
        # A signed (final/addendum) report can only be edited by the signer
        is_signed = report.status in (RadReportStatus.FINAL, RadReportStatus.ADDENDUM)
        if is_signed and request.user != report.signed_by:
            raise ConflictError("Cannot modify a signed report by another radiologist.")
        serializer = RadiologyReportSerializer(
            report, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        # Auto-advance study to reported when report has findings/impression
        if report.study_id and report.status in (RadReportStatus.DRAFT, RadReportStatus.PRELIMINARY):
            study = report.study
            has_content = bool(report.findings and report.impression)
            if has_content and study.status in (ImagingStudyStatus.READING, ImagingStudyStatus.ACQUIRED):
                study.status = ImagingStudyStatus.REPORTED
                study.completed_at = timezone.now()
                study.save(update_fields=["status", "completed_at"])
                _sync_order_status(study)
        return Response(RadiologyReportSerializer(report, context={"request": request}).data)


class RadiologyReportSignView(APIView):
    permission_classes = [IsAuthenticated, IsRadiologist]

    def post(self, request, pk):
        try:
            report = RadiologyReport.objects.select_related("study__order__patient").get(id=pk)
        except RadiologyReport.DoesNotExist:
            raise NotFoundError("Radiology report not found.")
        if report.status in (RadReportStatus.FINAL, RadReportStatus.ADDENDUM):
            raise ConflictError("Report is already signed.")
        if report.study.status not in (ImagingStudyStatus.ACQUIRED, ImagingStudyStatus.READING, ImagingStudyStatus.REPORTED):
            raise ConflictError("Study must be acquired or reported before signing the report.")
        # Sign: set status to final, record signer
        report.status = RadReportStatus.FINAL
        report.signed_by = request.user
        report.signed_at = timezone.now()
        report.save(update_fields=["status", "signed_by", "signed_at"])
        if report.study_id:
            report.study.status = ImagingStudyStatus.SIGNED
            report.study.save(update_fields=["status"])
            _sync_order_status(report.study)
        write_audit_log(
            request, AuditAction.UPDATE, "RadiologyReport", str(report.id),
            {"action": "sign"}, AuditSeverity.HIGH,
        )
        patient = report.patient
        # Targeted notification to Ordering and Assigned doctors
        order = report.study.order if report.study else None
        ordering_doctor_id = order.ordered_by_id if order else None
        assigned_doctor_id = report.patient.assigned_doctor_id
        
        payload = {
            "reportId": str(report.id),
            "patientId": str(patient.id),
            "patientName": f"{patient.first_name} {patient.last_name}",
            "modality": order.modality if order else None,
        }
        
        if ordering_doctor_id:
            emit_radiology_report_signed(payload, user_id=str(ordering_doctor_id))
        
        if assigned_doctor_id and str(assigned_doctor_id) != str(ordering_doctor_id):
            emit_radiology_report_signed(payload, user_id=str(assigned_doctor_id))
            
        if not ordering_doctor_id and not assigned_doctor_id:
            emit_radiology_report_signed(payload)
        return Response(RadiologyReportSerializer(report, context={"request": request}).data)


class RadiologyReportAddendumView(APIView):
    permission_classes = [IsAuthenticated, IsRadiologist]

    def post(self, request, pk):
        try:
            report = RadiologyReport.objects.get(id=pk)
        except RadiologyReport.DoesNotExist:
            raise NotFoundError("Radiology report not found.")
        is_signed = report.status in (RadReportStatus.FINAL, RadReportStatus.ADDENDUM)
        if not is_signed:
            raise ConflictError("Can only add addendum to signed (final) reports.")
        addendum_text = request.data.get("addendum")
        if not addendum_text:
            raise ValidationAppError("addendum text is required.")
        report.addendum = addendum_text
        report.addendum_by = request.user
        report.addendum_at = timezone.now()
        report.status = RadReportStatus.ADDENDUM
        report.save(update_fields=["addendum", "addendum_by", "addendum_at", "status"])
        return Response(RadiologyReportSerializer(report, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Critical Findings
# ---------------------------------------------------------------------------

class RadCriticalFindingListView(APIView):
    """GET /radiology/critical â€” list critical findings (was at wrong path /critical/list/)."""
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def get(self, request):
        qs = RadCriticalFinding.objects.all()
        if request.query_params.get("unacknowledged"):
            # status field, not a boolean is_acknowledged
            qs = qs.exclude(status=RadCriticalFindingStatus.ACKNOWLEDGED)
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            RadCriticalFindingSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = RadCriticalFindingSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        study_id = serializer.validated_data.get("study_id")
        if not study_id:
            raise ValidationAppError("studyId is required.")
        try:
            study = ImagingStudy.objects.get(id=study_id)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("Imaging study not found.")
        finding = serializer.save(
            patient_id=study.patient_id,
            identified_by=request.user,
            status=RadCriticalFindingStatus.IDENTIFIED,
        )
        patient = finding.patient
        # Targeted notification to Ordering and Assigned doctors
        order = finding.study.order if finding.study else None
        ordering_doctor_id = order.ordered_by_id if order else None
        assigned_doctor_id = finding.patient.assigned_doctor_id
        
        payload = {
            "findingId": str(finding.id),
            "patientId": str(patient.id),
            "patientName": f"{patient.first_name} {patient.last_name}",
            "severity": finding.severity,
            "finding": finding.finding,
        }
        
        if ordering_doctor_id:
            emit_radiology_critical_finding(payload, user_id=str(ordering_doctor_id))
        
        if assigned_doctor_id and str(assigned_doctor_id) != str(ordering_doctor_id):
            emit_radiology_critical_finding(payload, user_id=str(assigned_doctor_id))
            
        if not ordering_doctor_id and not assigned_doctor_id:
            emit_radiology_critical_finding(payload)
        _create_cdss_urgent_finding(finding.study, patient.id, finding.finding)
        write_audit_log(
            request, AuditAction.CREATE, "RadCriticalFinding", str(finding.id), {}, AuditSeverity.HIGH
        )
        return Response(
            RadCriticalFindingSerializer(finding, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class RadCriticalFindingCreateView(APIView):
    """POST /radiology/critical â€” create a critical finding."""
    permission_classes = [IsAuthenticated, IsRadiologist]

    def post(self, request):
        serializer = RadCriticalFindingSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        study_id = serializer.validated_data.get("study_id")
        if not study_id:
            raise ValidationAppError("studyId is required.")
        try:
            study = ImagingStudy.objects.get(id=study_id)
        except ImagingStudy.DoesNotExist:
            raise NotFoundError("Imaging study not found.")
        finding = serializer.save(
            patient_id=study.patient_id,
            identified_by=request.user,
            status=RadCriticalFindingStatus.IDENTIFIED,
        )
        patient = finding.patient
        # Targeted notification to Ordering and Assigned doctors
        order = finding.study.order if finding.study else None
        ordering_doctor_id = order.ordered_by_id if order else None
        assigned_doctor_id = finding.patient.assigned_doctor_id
        
        payload = {
            "findingId": str(finding.id),
            "patientId": str(patient.id),
            "patientName": f"{patient.first_name} {patient.last_name}",
            "severity": finding.severity,
            "finding": finding.finding,
        }
        
        if ordering_doctor_id:
            emit_radiology_critical_finding(payload, user_id=str(ordering_doctor_id))
        
        if assigned_doctor_id and str(assigned_doctor_id) != str(ordering_doctor_id):
            emit_radiology_critical_finding(payload, user_id=str(assigned_doctor_id))
            
        if not ordering_doctor_id and not assigned_doctor_id:
            emit_radiology_critical_finding(payload)
        _create_cdss_urgent_finding(finding.study, patient.id, finding.finding)
        write_audit_log(
            request, AuditAction.CREATE, "RadCriticalFinding", str(finding.id), {}, AuditSeverity.HIGH
        )
        return Response(
            RadCriticalFindingSerializer(finding, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class RadCriticalFindingNotifyView(APIView):
    """PUT /radiology/critical/:id/notify â€” record notification of a critical finding (was missing)."""
    permission_classes = [IsAuthenticated, RadiologyDepartmentPermission]

    def put(self, request, pk):
        try:
            finding = RadCriticalFinding.objects.get(id=pk)
        except RadCriticalFinding.DoesNotExist:
            raise NotFoundError("Critical finding not found.")
        validate_status_transition(
            finding.status,
            RadCriticalFindingStatus.NOTIFIED,
            {
                RadCriticalFindingStatus.IDENTIFIED: {RadCriticalFindingStatus.NOTIFIED},
                RadCriticalFindingStatus.NOTIFIED: set(),
                RadCriticalFindingStatus.ACKNOWLEDGED: set(),
            },
            "radiology critical finding",
        )
        notified_to = request.data.get("notifiedTo")
        if not notified_to:
            raise ValidationAppError("notifiedTo is required.")
        finding.notified_to = notified_to
        finding.callback_number = request.data.get("callbackNumber", "")
        finding.notified_at = timezone.now()
        finding.status = RadCriticalFindingStatus.NOTIFIED
        finding.save(update_fields=["notified_to", "callback_number", "notified_at", "status"])
        return Response(RadCriticalFindingSerializer(finding, context={"request": request}).data)


class RadCriticalFindingAcknowledgeView(APIView):
    permission_classes = [IsAuthenticated, RadiologyOrderReadWritePermission]

    def put(self, request, pk):
        try:
            finding = RadCriticalFinding.objects.get(id=pk)
        except RadCriticalFinding.DoesNotExist:
            raise NotFoundError("Critical finding not found.")
        validate_status_transition(
            finding.status,
            RadCriticalFindingStatus.ACKNOWLEDGED,
            {
                RadCriticalFindingStatus.IDENTIFIED: {RadCriticalFindingStatus.ACKNOWLEDGED},
                RadCriticalFindingStatus.NOTIFIED: {RadCriticalFindingStatus.ACKNOWLEDGED},
                RadCriticalFindingStatus.ACKNOWLEDGED: set(),
            },
            "radiology critical finding",
        )
        # Use status field â€” model has no is_acknowledged boolean
        finding.status = RadCriticalFindingStatus.ACKNOWLEDGED
        finding.acknowledged_by = request.user
        finding.acknowledged_at = timezone.now()
        finding.save(update_fields=["status", "acknowledged_by", "acknowledged_at"])
        return Response(RadCriticalFindingSerializer(finding, context={"request": request}).data)

    post = put


# ---------------------------------------------------------------------------
# Modality Schedules
# ---------------------------------------------------------------------------

class ModalityScheduleListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsRadiologist]

    def get(self, request):
        qs = ModalitySchedule.objects.all()
        if modality := request.query_params.get("modality"):
            qs = qs.filter(modality=modality)
        if date := request.query_params.get("date"):
            # Model has a date field, not scheduled_at
            qs = qs.filter(date=date)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("date", "start_time"), request)
        return paginator.get_paginated_response(
            ModalityScheduleSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = ModalityScheduleSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        schedule = serializer.save()
        return Response(
            ModalityScheduleSerializer(schedule, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ModalityScheduleDetailView(APIView):
    permission_classes = [IsAuthenticated, IsRadiologist]

    def _get(self, pk):
        try:
            return ModalitySchedule.objects.get(id=pk)
        except ModalitySchedule.DoesNotExist:
            raise NotFoundError("Modality schedule not found.")

    def get(self, request, pk):
        return Response(ModalityScheduleSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        schedule = self._get(pk)
        serializer = ModalityScheduleSerializer(
            schedule, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ModalityScheduleSerializer(schedule, context={"request": request}).data)

    def delete(self, request, pk):
        self._get(pk).delete()
        return Response({"message": "Schedule cancelled."}, status=status.HTTP_200_OK)

