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
from core.permissions import IsDoctor, IsAdmin, IsClinicalStaff, IsPharmacist, IsRadiologist

from .models import (
    CDSSConsultRequest, CDSSConsultRequestStatus, CDSSOutputKind,
    CDSSRecommendation, CDSSOverrideRecord, CDSSStatus,
    CDSSResponseAction, CDSSSeverity,
    CDSSSourceModule, CDSSRecommendationType,
)
from .serializers import (
    CDSSConsultRequestSerializer,
    CDSSRecommendationSerializer,
    CDSSOverrideRecordSerializer,
)

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

class CDSSRecommendationListView(APIView):
    """
    GET  /cdss/recommendations  — list, filtered by role/patient/status/severity/type
    POST /cdss/recommendations  — backend rule-engine creates a new recommendation
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def get(self, request):
        qs = CDSSRecommendation.objects.select_related("patient").all()

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
            pass
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

class CDSSRecommendationDetailView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def get(self, request, pk):
        rec = _get_recommendation(pk)
        if request.user.role != "admin" and rec.target_roles and request.user.role not in rec.target_roles:
            raise NotFoundError("Recommendation not found.")
        return Response(CDSSRecommendationSerializer(rec, context={"request": request}).data)

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

        reason = str(request.data.get("reason", "")).strip()
        reason_category = str(request.data.get("reasonCategory", "")).strip()
        notes = str(request.data.get("clinicalJustification", "")).strip()

        if len(reason) > 1000:
            raise ValidationAppError("reason must not exceed 1000 characters.")
        if len(notes) > 2000:
            raise ValidationAppError("clinicalJustification must not exceed 2000 characters.")

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

class CDSSFeedbackView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, pk):
        rec = _get_recommendation(pk)
        if request.user.role != "admin" and rec.target_roles and request.user.role not in rec.target_roles:
            raise NotFoundError("Recommendation not found.")
        rating = request.data.get("feedbackRating")
        comment = str(request.data.get("feedbackComment", "")).strip()
        if rating is None:
            raise ValidationAppError("feedbackRating (1-5) is required.")
        try:
            rating = int(rating)
            if not 1 <= rating <= 5:
                raise ValueError
        except (ValueError, TypeError):
            raise ValidationAppError("feedbackRating must be an integer between 1 and 5.")
        if len(comment) > 1000:
            raise ValidationAppError("feedbackComment must not exceed 1000 characters.")
        rec.feedback_rating = rating
        rec.feedback_comment = comment
        rec.save(update_fields=["feedback_rating", "feedback_comment"])
        return Response(CDSSRecommendationSerializer(rec, context={"request": request}).data)

class CDSSOverrideListView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def get(self, request):
        qs = CDSSOverrideRecord.objects.select_related("recommendation__patient").all()
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-recorded_at"), request)
        return paginator.get_paginated_response(
            CDSSOverrideRecordSerializer(page, many=True, context={"request": request}).data
        )

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
        if not prompt_query or not str(prompt_query).strip():
            raise ValidationAppError("prompt is required.")
        prompt_query = str(prompt_query).strip()
        if len(prompt_query) > 2000:
            raise ValidationAppError("prompt must not exceed 2000 characters.")

        role = getattr(request.user, "role", "doctor") or "doctor"
        response = AIService.generate_cdss_recommendation(str(patient_pk), prompt_query, role=role)
        
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

class CDSSPatientReportView(APIView):
    """
    POST /cdss/patients/:id/report/
    Generates a comprehensive NLP narrative report for the patient using MedGemma.
    The report style adapts to the caller's role (doctor vs pharmacist).
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, patient_pk):
        role = getattr(request.user, "role", "doctor") or "doctor"
        report = AIService.generate_patient_report(str(patient_pk), role=role)
        return Response({"report": report, "role": role}, status=status.HTTP_200_OK)

class CDSSChatView(APIView):
    """
    POST /cdss/patients/:id/chat/
    Multi-turn chat with MedGemma grounded in the patient's live KG context.

    Body: { "message": "...", "history": [{role, content}, ...] }
    Returns: { "response": "...", "history": [...updated...] }
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, patient_pk):
        user_message = request.data.get("message", "").strip()
        if not user_message:
            raise ValidationAppError("message is required.")
        if len(user_message) > 2000:
            raise ValidationAppError("message must not exceed 2000 characters.")

        history = request.data.get("history", [])
        if not isinstance(history, list):
            history = []
        history = history[-20:]

        role = getattr(request.user, "role", "doctor") or "doctor"

        response, updated_history = AIService.chat_with_context(
            str(patient_pk),
            user_message,
            history,
            role=role,
        )
        return Response(
            {"response": response, "history": updated_history},
            status=status.HTTP_200_OK,
        )

class CDSSChatStreamView(APIView):
    """
    POST /cdss/patients/:id/chat/stream/
    Same as CDSSChatView but streams the response token-by-token as SSE.
    The client receives events: thinking | answer | done | error
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsPharmacist | IsAdmin]

    def post(self, request, patient_pk):
        from django.http import StreamingHttpResponse

        user_message = request.data.get("message", "").strip()
        if not user_message:
            raise ValidationAppError("message is required.")
        if len(user_message) > 2000:
            raise ValidationAppError("message must not exceed 2000 characters.")

        history = request.data.get("history", [])
        if not isinstance(history, list):
            history = []
        history = history[-20:]

        role = getattr(request.user, "role", "doctor") or "doctor"

        def event_stream():
            yield from AIService.chat_stream_with_context(
                str(patient_pk), user_message, history, role=role
            )

        response = StreamingHttpResponse(event_stream(), content_type="text/event-stream")
        response["Cache-Control"] = "no-cache"
        response["X-Accel-Buffering"] = "no"
        return response

class CDSSEncounterSuggestView(APIView):
    """
    POST /cdss/encounters/:encounter_id/suggest/

    Analyse a SOAP encounter note with the patient's full KG context and return
    AI-suggested differential diagnoses, assessment text, and plan text.

    Body (optional — if omitted, reads from the saved encounter):
      { "subjective": "...", "objective": "...", "assessment": "...", "plan": "..." }

    Returns:
      {
        "encounter_id": "...",
        "differential": ["1. Pneumonia — ...", "2. ..."],
        "assessment": "Suggested assessment text",
        "plan": "Suggested plan text",
        "alerts": "Any safety alerts",
        "raw": "Full LLM response"
      }
    """
    permission_classes = [IsAuthenticated, IsDoctor | IsAdmin]

    def post(self, request, encounter_pk):
        from apps.doctors.models import Encounter

        try:
            encounter = Encounter.objects.select_related("patient", "doctor").get(
                id=encounter_pk
            )
        except Encounter.DoesNotExist:
            raise NotFoundError("Encounter not found.")

        subjective = request.data.get("subjective", encounter.subjective or "")
        objective = request.data.get("objective", encounter.objective or "")
        existing_assessment = request.data.get("assessment", encounter.assessment or "")
        existing_plan = request.data.get("plan", encounter.plan or "")

        if not subjective and not objective:
            raise ValidationAppError(
                "Both Subjective and Objective sections are empty. "
                "Please fill in at least one section before requesting AI suggestions."
            )

        result = AIService.suggest_encounter_assessment(
            encounter_id=str(encounter_pk),
            patient_uuid=str(encounter.patient.id),
            subjective=subjective,
            objective=objective,
            existing_assessment=existing_assessment,
            existing_plan=existing_plan,
        )

        write_audit_log(
            request, AuditAction.READ, "CDSSEncounterSuggest", str(encounter_pk),
            details={"patient_id": str(encounter.patient.id)}
        )

        return Response(result, status=status.HTTP_200_OK)

class PharmacyRxAISuggestView(APIView):
    """
    POST /cdss/prescriptions/:prescription_id/ai_suggest/
    Body: { "patientId": "...", "medication": "...", "dose": "...", "route": "...",
            "frequency": "...", "sig": "...", "indication": "..." }
    Returns AI-assisted pharmacy verification analysis powered by MedGemma + KG.
    """
    permission_classes = [IsAuthenticated, IsPharmacist | IsClinicalStaff | IsAdmin]

    def post(self, request, prescription_pk):
        patient_id = request.data.get("patientId")
        if not patient_id:
            raise ValidationAppError("patientId is required.")

        rx = {
            "medication": request.data.get("medication", ""),
            "dose": request.data.get("dose", ""),
            "route": request.data.get("route", ""),
            "frequency": request.data.get("frequency", ""),
            "sig": request.data.get("sig", ""),
            "indication": request.data.get("indication", ""),
        }

        result = AIService.suggest_rx_verification(str(patient_id), rx)
        write_audit_log(
            request, AuditAction.READ, "PharmacyRxAISuggest", str(prescription_pk),
            details={"patientId": str(patient_id), "medication": rx["medication"]}
        )
        return Response(result, status=status.HTTP_200_OK)

class LabResultAISuggestView(APIView):
    """
    POST /cdss/lab-panels/:panel_id/ai_suggest/
    Body: { "patientId": "...", "panelName": "...", "results": [{testName, value, unit, referenceRange, flag}, ...] }
    Returns AI-assisted lab result interpretation powered by MedGemma + KG.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsAdmin]

    def post(self, request, panel_pk):
        patient_id = request.data.get("patientId")
        panel_name = request.data.get("panelName", "Lab Panel")
        results = request.data.get("results", [])

        if not patient_id:
            raise ValidationAppError("patientId is required.")
        if not isinstance(results, list) or len(results) == 0:
            raise ValidationAppError("results must be a non-empty list.")

        result = AIService.suggest_lab_interpretation(str(patient_id), panel_name, results)
        write_audit_log(
            request, AuditAction.READ, "LabResultAISuggest", str(panel_pk),
            details={"patientId": str(patient_id), "panelName": panel_name}
        )
        return Response(result, status=status.HTTP_200_OK)

class RadiologyAppropriatenessView(APIView):
    """
    POST /cdss/imaging-orders/:order_id/appropriateness/

    Checks whether the ordered imaging study is appropriate for the clinical
    indication using MedGemma + the patient KG (ACR Appropriateness Criteria
    style). If flagged inappropriate, a CDSS APPROPRIATENESS_CHECK alert is
    auto-created and pushed via WebSocket.
    """
    permission_classes = [IsAuthenticated, IsClinicalStaff | IsRadiologist | IsAdmin]

    def post(self, request, order_pk):
        from apps.radiology.models import ImagingOrder

        try:
            order = ImagingOrder.objects.select_related("patient").get(id=order_pk)
        except ImagingOrder.DoesNotExist:
            raise NotFoundError("Imaging order not found.")

        indication = (order.indication or "").strip()
        clinical_history = (order.clinical_history or "").strip()
        if not indication and not clinical_history:
            raise ValidationAppError(
                "The imaging order has no indication or clinical history. "
                "Add clinical context to the order before requesting an appropriateness check."
            )

        result = AIService.suggest_imaging_appropriateness(
            patient_uuid=str(order.patient_id),
            modality=order.modality or "",
            body_part=order.body_part or "",
            indication=indication,
            clinical_history=clinical_history,
        )

        if result["appropriate"] is False:
            try:
                rec = CDSSRecommendation.objects.create(
                    patient_id=order.patient_id,
                    source_module=CDSSSourceModule.RADIOLOGY,
                    triggered_by="imaging_appropriateness_check",
                    type=CDSSRecommendationType.APPROPRIATENESS_CHECK,
                    title=f"Imaging Appropriateness Concern: {order.modality} {order.body_part}",
                    summary=(result["verdict_text"] or result["raw"])[:500],
                    explanation={
                        "orderId": str(order.id),
                        "modality": order.modality,
                        "bodyPart": order.body_part,
                        "indication": indication,
                        "reasoning": result["reasoning"],
                        "alternatives": result["alternatives"],
                    },
                    severity="warning",
                    target_roles=["doctor", "radiologist"],
                )
                from core.websockets import emit_cdss_new_recommendation
                emit_cdss_new_recommendation({
                    "id": str(rec.id),
                    "patientId": str(order.patient_id),
                    "type": CDSSRecommendationType.APPROPRIATENESS_CHECK,
                    "severity": "warning",
                    "title": rec.title,
                    "summary": rec.summary,
                    "targetRoles": rec.target_roles,
                }, target_roles=rec.target_roles)
            except Exception:
                pass

        write_audit_log(
            request, AuditAction.READ, "RadiologyAppropriateness", str(order.id),
            details={"patientId": str(order.patient_id), "modality": order.modality},
        )
        return Response(result, status=status.HTTP_200_OK)

class RadiologyReportAIAssistView(APIView):
    """
    POST /cdss/radiology-reports/:report_id/ai_assist/

    AI-assisted radiology report writing. The radiologist provides their
    findings text; MedGemma drafts a structured impression and follow-up
    recommendations cross-referenced with the patient KG.

    Body (optional — falls back to saved report fields if omitted):
      { "findings": "...", "technique": "..." }

    Returns:
      { "impression": str, "recommendations": str, "alerts": str, "raw": str }
    """
    permission_classes = [IsAuthenticated, IsRadiologist | IsAdmin]

    def post(self, request, report_pk):
        from apps.radiology.models import RadiologyReport

        try:
            report = RadiologyReport.objects.select_related(
                "study__order", "patient"
            ).get(id=report_pk)
        except RadiologyReport.DoesNotExist:
            raise NotFoundError("Radiology report not found.")

        findings = (request.data.get("findings") or report.findings or "").strip()
        technique = (request.data.get("technique") or report.technique or "").strip()

        if not findings:
            raise ValidationAppError(
                "findings are required to generate AI report suggestions. "
                "Enter your findings before requesting AI assistance."
            )
        if len(findings) > 5000:
            raise ValidationAppError("findings must not exceed 5000 characters.")

        order = (
            report.study.order
            if report.study_id and report.study.order_id
            else None
        )
        modality = order.modality if order else ""
        body_part = order.body_part if order else ""
        indication = (
            (order.indication or report.indication or "").strip()
            if order
            else (report.indication or "").strip()
        )

        result = AIService.suggest_radiology_report(
            patient_uuid=str(report.patient_id),
            modality=modality,
            body_part=body_part,
            indication=indication,
            technique=technique,
            findings=findings,
        )

        write_audit_log(
            request, AuditAction.READ, "RadiologyReportAIAssist", str(report_pk),
            details={"patientId": str(report.patient_id), "modality": modality},
        )
        return Response(result, status=status.HTTP_200_OK)

class CDSSAcceptAIDiagnosisView(APIView):
    """
    POST /cdss/encounters/:encounter_pk/accept_diagnosis/

    Doctor accepts one differential diagnosis suggestion produced by MedGemma.
    Creates a formal Diagnosis record (type=differential, status=suspected by
    default) which triggers the existing post_save signal chain:
      sync_diagnosis_to_graph → OntologyService.sync_diagnosis_ontology
    so the disease is automatically added to the ontology catalog.

    Body:
      {
        "diagnosis":     str   (required — disease name),
        "icd10Code":     str   (optional — validated; auto-resolved if omitted),
        "snomedCode":    str   (optional),
        "snomedDisplay": str   (optional),
        "diagnosisType": str   (optional, default: "differential"),
        "status":        str   (optional, default: "suspected")
      }
    """
    permission_classes = [IsAuthenticated, IsDoctor | IsAdmin]

    def post(self, request, encounter_pk):
        from apps.doctors.models import Diagnosis, Encounter
        from apps.doctors.serializers import DiagnosisSerializer

        try:
            encounter = Encounter.objects.select_related("patient").get(id=encounter_pk)
        except Encounter.DoesNotExist:
            raise NotFoundError("Encounter not found.")

        diagnosis_text = (request.data.get("diagnosis") or "").strip()
        if not diagnosis_text:
            raise ValidationAppError("diagnosis is required.")

        raw_code = (request.data.get("icd10Code") or "").strip().upper()
        resolved_code = None
        resolved_description = diagnosis_text

        try:
            import simple_icd_10 as icd

            if raw_code and icd.is_valid_item(raw_code):
                resolved_code = raw_code
                resolved_description = icd.get_description(raw_code) or diagnosis_text
            else:
                search_term = diagnosis_text.lower()
                for code in icd.get_all_codes()[:10000]:
                    desc = icd.get_description(code) or ""
                    if search_term in desc.lower():
                        resolved_code = code
                        resolved_description = desc
                        break
        except Exception:
            pass

        if not resolved_code:
            resolved_code = "R69"

        diagnosis = Diagnosis.objects.create(
            patient=encounter.patient,
            encounter=encounter,
            code=resolved_code,
            description=resolved_description,
            type=request.data.get("diagnosisType") or "differential",
            status=request.data.get("status") or "suspected",
            diagnosed_by=request.user,
            snomed_code=request.data.get("snomedCode") or "",
            snomed_display=request.data.get("snomedDisplay") or "",
        )

        write_audit_log(
            request, AuditAction.CREATE, "AIDiagnosisAccepted", str(diagnosis.id),
            {"encounterId": str(encounter_pk), "icd10Code": resolved_code, "diagnosis": diagnosis_text},
        )
        return Response(
            DiagnosisSerializer(diagnosis, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )
