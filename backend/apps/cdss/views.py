"""
CDSS module views — Recommendations, Overrides, Feedback.
Fixed:
  - Added POST /recommendations/ (backend rule-engine create)
  - Unified POST /recommendations/:id/respond (replaces separate acknowledge/override;
    now also handles dismiss and follow)
  - Added PUT /recommendations/:id/expire (was missing)
  - Added GET /stats (was missing)
  - patientName + patientMRN denormalized into serializer output
  - target_roles__contains guard with fallback comment for SQLite dev environments
  - Kept separate /acknowledge/ and /override/ endpoints as aliases for
    backward-compatibility (frontend may still call them)
"""

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsDoctor, IsAdmin, IsClinicalStaff, IsPharmacist

from .models import (
    CDSSConsultRequest, CDSSConsultRequestStatus, CDSSOutputKind,
    CDSSRecommendation, CDSSOverrideRecord, CDSSStatus,
    CDSSResponseAction, CDSSSeverity,
)
from .serializers import (
    CDSSConsultRequestSerializer,
    CDSSRecommendationSerializer,
    CDSSOverrideRecordSerializer,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_recommendation(pk):
    try:
        return CDSSRecommendation.objects.select_related("patient").get(id=pk)
    except CDSSRecommendation.DoesNotExist:
        raise NotFoundError("Recommendation not found.")


def _get_consult_request(pk):
    try:
        return CDSSConsultRequest.objects.select_related("patient", "requested_by").get(id=pk)
    except CDSSConsultRequest.DoesNotExist:
        raise NotFoundError("CDSS support request not found.")


def _record_and_save(rec, action, request, reason="", reason_category="", notes=""):
    """Create an immutable CDSSOverrideRecord and update the recommendation status."""
    override = CDSSOverrideRecord.objects.create(
        recommendation=rec,
        action=action,
        reason=reason,
        reason_category=reason_category,
        notes=notes,
        clinician_name=request.user.get_full_name() or request.user.username,
        clinician_role=request.user.role,
        source_module=rec.source_module,
    )
    return override


# ---------------------------------------------------------------------------
# Recommendations — list / create
# ---------------------------------------------------------------------------

class CDSSRecommendationListView(APIView):
    """
    GET  /cdss/recommendations  — list, filtered by role/patient/status/severity/type
    POST /cdss/recommendations  — backend rule-engine creates a new recommendation
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def get(self, request):
        qs = CDSSRecommendation.objects.select_related("patient").all()

        # Role-based visibility.
        # target_roles__contains=[role] is JSONField array containment — works correctly
        # on PostgreSQL. On SQLite (dev only) this will silently return all records;
        # acceptable for local development, must use Postgres in staging/production.
        user_role = getattr(request.user, "role", None)
        if user_role and user_role != "admin":
            qs = qs.filter(Q(target_roles__contains=[user_role]) | Q(target_roles=[]))

        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        if severity := request.query_params.get("severity"):
            qs = qs.filter(severity=severity)
        if rec_type := request.query_params.get("type"):
            qs = qs.filter(type=rec_type)
        if output_kind := request.query_params.get("outputKind"):
            qs = qs.filter(output_kind=output_kind)

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            CDSSRecommendationSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        """
        Backend rule-engine endpoint to create a recommendation programmatically.
        Also callable by admin/clinical staff to manually inject an alert.
        """
        serializer = CDSSRecommendationSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        rec = serializer.save(status=CDSSStatus.ACTIVE)
        if rec.consult_request_id:
            consult_request = rec.consult_request
            consult_request.status = CDSSConsultRequestStatus.ANSWERED
            consult_request.answered_at = timezone.now()
            consult_request.save(update_fields=["status", "answered_at"])

        # Emit websocket event so active sessions receive the alert immediately
        try:
            from core.websockets import emit_cdss_new_recommendation
            emit_cdss_new_recommendation({
                "recommendationId": str(rec.id),
                "id": str(rec.id),
                "patientId": str(rec.patient_id),
                "outputKind": rec.output_kind,
                "type": rec.type,
                "severity": rec.severity,
                "title": rec.title,
                "summary": rec.summary,
                "targetRoles": rec.target_roles,
            }, target_roles=rec.target_roles)
        except Exception:
            pass  # WebSocket emission is non-critical; don't fail the write
        write_audit_log(
            request, AuditAction.CREATE, "CDSSRecommendation", str(rec.id),
            {"type": rec.type, "severity": rec.severity},
        )
        return Response(
            CDSSRecommendationSerializer(rec, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CDSSConsultRequestListView(APIView):
    """
    GET  /cdss/requests  - list CDSS support requests
    POST /cdss/requests  - doctor/clinical staff requests recommendation support
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin]

    def get(self, request):
        qs = CDSSConsultRequest.objects.select_related("patient", "requested_by").all()

        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if req_status := request.query_params.get("status"):
            qs = qs.filter(status=req_status)

        if getattr(request.user, "role", None) not in ("admin",):
            qs = qs.filter(Q(requested_by=request.user) | Q(requested_by__isnull=True))

        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            CDSSConsultRequestSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        payload = request.data.copy()
        if not payload.get("requested_by"):
            payload["requested_by"] = str(request.user.id)
        serializer = CDSSConsultRequestSerializer(data=payload, context={"request": request})
        serializer.is_valid(raise_exception=True)
        consult_request = serializer.save()
        write_audit_log(
            request, AuditAction.CREATE, "CDSSConsultRequest", str(consult_request.id),
            {"status": consult_request.status},
        )
        return Response(
            CDSSConsultRequestSerializer(consult_request, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class CDSSConsultRequestDetailView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin]

    def get(self, request, pk):
        consult_request = _get_consult_request(pk)
        if request.user.role != "admin" and consult_request.requested_by_id and consult_request.requested_by_id != request.user.id:
            raise NotFoundError("CDSS support request not found.")
        return Response(CDSSConsultRequestSerializer(consult_request, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Recommendation detail
# ---------------------------------------------------------------------------

class CDSSRecommendationDetailView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def get(self, request, pk):
        rec = _get_recommendation(pk)
        if request.user.role != "admin" and rec.target_roles and request.user.role not in rec.target_roles:
            raise NotFoundError("Recommendation not found.")
        return Response(CDSSRecommendationSerializer(rec, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Unified respond endpoint  (spec: POST /recommendations/:id/respond)
# ---------------------------------------------------------------------------

TERMINAL_STATUSES = {
    CDSSStatus.ACKNOWLEDGED,
    CDSSStatus.OVERRIDDEN,
    CDSSStatus.DISMISSED,
    CDSSStatus.FOLLOWED,
    CDSSStatus.EXPIRED,
}

ACTION_TO_STATUS = {
    CDSSResponseAction.ACKNOWLEDGE: CDSSStatus.ACKNOWLEDGED,
    CDSSResponseAction.OVERRIDE: CDSSStatus.OVERRIDDEN,
    CDSSResponseAction.DISMISS: CDSSStatus.DISMISSED,
    CDSSResponseAction.FOLLOW: CDSSStatus.FOLLOWED,
}


class CDSSRespondView(APIView):
    """
    POST /cdss/recommendations/:id/respond
    Body: { action: "override"|"acknowledge"|"dismiss"|"follow",
            reason?: str, reasonCategory?: str, clinicalJustification?: str }
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, pk):
        rec = _get_recommendation(pk)
        if request.user.role != "admin" and rec.target_roles and request.user.role not in rec.target_roles:
            raise NotFoundError("Recommendation not found.")

        if rec.status in TERMINAL_STATUSES:
            raise ConflictError(f"Recommendation is already {rec.status}.")

        action = request.data.get("action")
        if not action:
            raise ValidationAppError("action is required.")
        valid_actions = [c[0] for c in CDSSResponseAction.choices]
        if action not in valid_actions:
            raise ValidationAppError(f"Invalid action. Choose from: {valid_actions}")

        reason = request.data.get("reason", "")
        reason_category = request.data.get("reasonCategory", "")
        notes = request.data.get("clinicalJustification", "")

        # Override requires a reason
        if action == CDSSResponseAction.OVERRIDE and not reason:
            raise ValidationAppError("reason is required for override.")

        override = _record_and_save(rec, action, request, reason, reason_category, notes)

        new_status = ACTION_TO_STATUS[action]
        update_fields = ["status"]

        if action == CDSSResponseAction.ACKNOWLEDGE:
            rec.acknowledged_by = request.user
            rec.acknowledged_at = timezone.now()
            update_fields += ["acknowledged_by", "acknowledged_at"]
        elif action == CDSSResponseAction.OVERRIDE:
            rec.overridden_by = request.user
            rec.overridden_at = timezone.now()
            rec.override_reason = reason
            rec.override_reason_category = reason_category
            update_fields += ["overridden_by", "overridden_at", "override_reason", "override_reason_category"]

        rec.status = new_status
        rec.save(update_fields=update_fields)

        severity = AuditSeverity.HIGH if action == CDSSResponseAction.OVERRIDE else AuditSeverity.INFO
        write_audit_log(
            request, AuditAction.UPDATE, "CDSSRecommendation", str(rec.id),
            {"action": action, "reason": reason}, severity,
        )
        return Response({
            "recommendation": CDSSRecommendationSerializer(rec, context={"request": request}).data,
            "overrideRecord": CDSSOverrideRecordSerializer(override, context={"request": request}).data,
        })


# ---------------------------------------------------------------------------
# Expire endpoint  (was missing)
# ---------------------------------------------------------------------------

class CDSSExpireView(APIView):
    """PUT /cdss/recommendations/:id/expire — mark a recommendation as expired."""
    permission_classes = [IsAuthenticated, IsAdmin | IsClinicalStaff]

    def put(self, request, pk):
        rec = _get_recommendation(pk)
        if rec.status == CDSSStatus.EXPIRED:
            raise ConflictError("Recommendation is already expired.")
        rec.status = CDSSStatus.EXPIRED
        rec.expires_at = timezone.now()
        rec.save(update_fields=["status", "expires_at"])
        write_audit_log(
            request, AuditAction.UPDATE, "CDSSRecommendation", str(rec.id), {"action": "expire"}
        )
        return Response(CDSSRecommendationSerializer(rec, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

class CDSSFeedbackView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, pk):
        rec = _get_recommendation(pk)
        if request.user.role != "admin" and rec.target_roles and request.user.role not in rec.target_roles:
            raise NotFoundError("Recommendation not found.")
        rating = request.data.get("feedbackRating")
        comment = request.data.get("feedbackComment", "")
        if rating is None:
            raise ValidationAppError("feedbackRating (1-5) is required.")
        try:
            rating = int(rating)
            if not 1 <= rating <= 5:
                raise ValueError
        except (ValueError, TypeError):
            raise ValidationAppError("feedbackRating must be an integer between 1 and 5.")
        rec.feedback_rating = rating
        rec.feedback_comment = comment
        rec.save(update_fields=["feedback_rating", "feedback_comment"])
        return Response(CDSSRecommendationSerializer(rec, context={"request": request}).data)


# ---------------------------------------------------------------------------
# Override history
# ---------------------------------------------------------------------------

class CDSSOverrideListView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def get(self, request):
        qs = CDSSOverrideRecord.objects.select_related("recommendation").all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-recorded_at"), request)
        return paginator.get_paginated_response(
            CDSSOverrideRecordSerializer(page, many=True, context={"request": request}).data
        )


# ---------------------------------------------------------------------------
# Patient alert summary (banner / alert tray)
# ---------------------------------------------------------------------------

class CDSSPatientSummaryView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist]

    def get(self, request, patient_pk):
        qs = CDSSRecommendation.objects.filter(
            patient_id=patient_pk,
            status=CDSSStatus.ACTIVE,
        ).order_by("-created_at")
        if request.user.role != "admin":
            qs = qs.filter(Q(target_roles__contains=[request.user.role]) | Q(target_roles=[]))
        return Response({
            "total": qs.count(),
            "critical": qs.filter(severity=CDSSSeverity.CRITICAL).count(),
            "warning": qs.filter(severity=CDSSSeverity.WARNING).count(),
            "info": qs.filter(severity=CDSSSeverity.INFO).count(),
            "data": CDSSRecommendationSerializer(qs[:10], many=True, context={"request": request}).data,
        })


# ---------------------------------------------------------------------------
# Stats  (was missing entirely)
# ---------------------------------------------------------------------------

class CDSSStatsView(APIView):
    """GET /cdss/stats — aggregate recommendation metrics."""
    permission_classes = [IsAuthenticated, IsAdmin | IsClinicalStaff | IsPharmacist]

    def get(self, request):
        from django.utils import timezone as tz
        from django.db.models import Count

        today = tz.now().date()
        all_recs = CDSSRecommendation.objects.all()

        total = all_recs.count()
        active = all_recs.filter(status=CDSSStatus.ACTIVE).count()
        acknowledged = all_recs.filter(status=CDSSStatus.ACKNOWLEDGED).count()
        overridden = all_recs.filter(status=CDSSStatus.OVERRIDDEN).count()
        dismissed = all_recs.filter(status=CDSSStatus.DISMISSED).count()
        followed = all_recs.filter(status=CDSSStatus.FOLLOWED).count()
        expired = all_recs.filter(status=CDSSStatus.EXPIRED).count()

        critical_active = all_recs.filter(
            status=CDSSStatus.ACTIVE, severity=CDSSSeverity.CRITICAL
        ).count()
        generated_today = all_recs.filter(generated_at__date=today).count()
        overrides_today = CDSSOverrideRecord.objects.filter(recorded_at__date=today).count()
        followed_today = all_recs.filter(status=CDSSStatus.FOLLOWED, updated_at__date=today).count()
        acknowledged_today = all_recs.filter(status=CDSSStatus.ACKNOWLEDGED, updated_at__date=today).count()
        info_active = all_recs.filter(
            status=CDSSStatus.ACTIVE, severity=CDSSSeverity.INFO
        ).count()
        warning_active = all_recs.filter(
            status=CDSSStatus.ACTIVE, severity=CDSSSeverity.WARNING
        ).count()

        by_type = list(
            all_recs.values("type").annotate(count=Count("id")).order_by("-count")[:10]
        )
        by_module = list(
            all_recs.values("source_module").annotate(count=Count("id")).order_by("-count")
        )
        by_output_kind = list(
            all_recs.values("output_kind").annotate(count=Count("id")).order_by("-count")
        )
        consult_requests = CDSSConsultRequest.objects.all()

        override_rate = round((overridden / total * 100) if total else 0, 2)
        follow_rate = round((followed / total * 100) if total else 0, 2)

        return Response({
            "total": total,
            "active": active,
            "acknowledged": acknowledged,
            "overridden": overridden,
            "dismissed": dismissed,
            "followed": followed,
            "expired": expired,
            "criticalActive": critical_active,
            "generatedToday": generated_today,
            "overridesToday": overrides_today,
            "followedToday": followed_today,
            "acknowledgedToday": acknowledged_today,
            "infoActive": info_active,
            "warningActive": warning_active,
            "overrideRate": override_rate,
            "followRate": follow_rate,
            "byType": by_type,
            "byModule": by_module,
            "byOutputKind": by_output_kind,
            "consultRequestsOpen": consult_requests.filter(status=CDSSConsultRequestStatus.OPEN).count(),
            "consultRequestsAnswered": consult_requests.filter(status=CDSSConsultRequestStatus.ANSWERED).count(),
        })

# ---------------------------------------------------------------------------
# Knowledge Graph and GraphRAG External Integrations
# ---------------------------------------------------------------------------

from apps.cdss.services.graph_service import GraphService
from apps.cdss.services.ai_service import AIService
from apps.cdss.services.rule_engine_service import GraphRuleEngineService

class HospitalKnowledgeGraphView(APIView):
    """
    GET /cdss/graph/hospital
    Returns a small, hospital-wide aggregated graph that stays fast at large scale.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin | IsPharmacist]

    def get(self, request):
        graph_data = GraphService.get_hospital_graph_for_visualization()
        return Response(graph_data)


class HospitalCDSSKnowledgeSummaryView(APIView):
    """
    GET /cdss/graph/hospital/summary
    Returns hospital-wide KG/CDSS summaries for dashboards and module overviews.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin | IsPharmacist]

    def get(self, request):
        summary = GraphService.get_hospital_cdss_summary()
        return Response(summary)


class PatientModuleGraphSummaryView(APIView):
    """
    GET /cdss/patients/:id/graph-summary?module=doctor
    Returns a module-aware summary of the patient KG.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin | IsPharmacist]

    def get(self, request, patient_pk):
        module = request.query_params.get("module", "")
        summary = GraphService.get_patient_module_graph_summary(str(patient_pk), module)
        return Response(summary)

class PatientKnowledgeGraphView(APIView):
    """
    GET /cdss/patients/:id/graph
    Exports a serialized, exact JSON representation of nodes and links for Next.js traversal.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin | IsPharmacist]

    def get(self, request, patient_pk):
        graph_data = GraphService.get_patient_graph_for_visualization(str(patient_pk))
        return Response(graph_data)

class CDSSAIConsultView(APIView):
    """
    POST /cdss/patients/:id/ai_consult
    Body: { "prompt": "..." }
    Uses GraphRAG to gather patient context from Neo4j and injects it into prompt for MedGemma.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, patient_pk):
        prompt_query = request.data.get("prompt")
        if not prompt_query:
            raise ValidationAppError("prompt is required.")
        
        response = AIService.generate_cdss_recommendation(str(patient_pk), prompt_query)
        
        return Response({
            "query": prompt_query,
            "response": response,
        }, status=status.HTTP_200_OK)


class CDSSRuleRefreshView(APIView):
    """
    POST /cdss/patients/:id/run_rules
    Runs deterministic graph-backed CDSS rules for the patient and persists them.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, patient_pk):
        outcome = GraphRuleEngineService.run_for_patient(patient_pk, persist=True)
        serialized = CDSSRecommendationSerializer(
            outcome["recommendations"],
            many=True,
            context={"request": request},
        ).data
        return Response({
            "patientId": outcome["patientId"],
            "generatedCount": outcome["generatedCount"],
            "graphSnapshot": outcome["graphSnapshot"],
            "recommendations": serialized,
        }, status=status.HTTP_200_OK)
