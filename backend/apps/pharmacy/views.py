"""
Pharmacy module views.

Added:
  - RefillListCreateView  (GET/POST /pharmacy/refills/)
  - SubstitutionListCreateView  (GET/POST /pharmacy/substitutions/)
  - SubstitutionDetailView  (GET/PUT /pharmacy/substitutions/:id/)
  - FormularyStockView  (GET /pharmacy/formulary/:id/stock/)
Fixed:
  - PharmacyIntervention.save() now passes pharmacist FK (model fixed too)
"""

import logging

from django.utils import timezone
from django.db.models import Q
from django.db.models import F
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsPharmacist, IsDoctor, IsAdmin, UserRole, ReadWriteRolePermission
from core.websockets import (
    emit_pharmacy_rx_verified,
    emit_pharmacy_rx_dispensed,
    emit_pharmacy_rx_rejected,
    emit_pharmacy_rx_on_hold,
    emit_pharmacy_intervention_created,
    emit_pharmacy_substitution_proposed,
    emit_pharmacy_rx_cancelled,
    emit_pharmacy_substitution_approved,
    emit_pharmacy_substitution_rejected,
)
from core.workflows import validate_status_transition

from .models import (
    PharmacyPrescription, DrugWarning, FormularyItem,
    DispenseRecord, PharmacyIntervention, Refill, Substitution,
    RxStatus, SubstitutionStatus,
)
from .serializers import (
    PharmacyPrescriptionSerializer, DrugWarningSerializer, FormularyItemSerializer,
    DispenseRecordSerializer, PharmacyInterventionSerializer,
    RefillSerializer, SubstitutionSerializer,
)

PharmacyReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN],
    [UserRole.PHARMACIST],
)

PharmacyDoctorResponsePermission = ReadWriteRolePermission.for_roles(
    [UserRole.PHARMACIST, UserRole.DOCTOR, UserRole.ADMIN],
    [UserRole.PHARMACIST, UserRole.DOCTOR],
)

def _map_warning_severity_to_cdss(severity: str) -> str:
    mapping = {
        "contraindicated": "critical",
        "severe": "critical",
        "moderate": "warning",
        "info": "info",
    }
    return mapping.get(severity, "warning")

def _trigger_drug_safety_cdss(patient_id, warning):
    from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
    from core.websockets import emit_cdss_new_recommendation
    cdss_severity = _map_warning_severity_to_cdss(warning.severity)
    rec_type = (
        CDSSRecommendationType.ALLERGY
        if warning.type == "allergy"
        else CDSSRecommendationType.DRUG_INTERACTION
    )
    rec = CDSSRecommendation.objects.create(
        patient_id=patient_id,
        source_module="pharmacy",
        triggered_by="pharmacy_drug_check",
        type=rec_type,
        title=f"Drug Safety Alert: {warning.type.title()}",
        summary=warning.message,
        explanation={
            "warningId": str(warning.id),
            "medications": warning.medications_involved,
            "severity": warning.severity,
        },
        severity=cdss_severity,
        target_roles=["doctor", "pharmacist"],
    )
    emit_cdss_new_recommendation({
        "recommendationId": str(rec.id),
        "id": str(rec.id),
        "patientId": str(patient_id),
        "type": rec_type,
        "severity": rec.severity,
        "title": rec.title,
        "summary": rec.summary,
        "targetRoles": rec.target_roles,
    }, target_roles=rec.target_roles)

class PharmacyStatsView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request):
        today = timezone.now().date()
        pending_verification = PharmacyPrescription.objects.filter(
            status__in=[RxStatus.ORDERED, RxStatus.PENDING_VERIFICATION]
        ).count()
        verified = PharmacyPrescription.objects.filter(status=RxStatus.VERIFIED).count()
        dispensing = PharmacyPrescription.objects.filter(status=RxStatus.DISPENSING).count()
        dispensed_today = PharmacyPrescription.objects.filter(
            status=RxStatus.DISPENSED,
            dispensed_at__date=today,
        ).count()
        active_warnings = DrugWarning.objects.filter(resolved=False).count()
        pending_interventions = PharmacyIntervention.objects.filter(
            Q(outcome__isnull=True) | Q(outcome__exact="") | Q(outcome="pending")
        ).count()
        low_stock_items = FormularyItem.objects.filter(stock_level__lte=F("reorder_level")).count()
        pending_substitutions = Substitution.objects.filter(status=SubstitutionStatus.PENDING).count()
        return Response({
            "pendingVerification": pending_verification,
            "verified": verified,
            "dispensing": dispensing,
            "dispensedToday": dispensed_today,
            "activeWarnings": active_warnings,
            "pendingInterventions": pending_interventions,
            "lowStockItems": low_stock_items,
            "pendingSubstitutions": pending_substitutions,
        })

class PharmacyProfilesView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request):
        patient_id = request.query_params.get("patientId")
        if patient_id:
            prescriptions = PharmacyPrescription.objects.select_related("patient", "original_prescription__prescribed_by").filter(
                patient_id=patient_id
            ).order_by("-created_at")
            refills = Refill.objects.select_related("patient", "pharmacist").filter(patient_id=patient_id).order_by("-created_at")
            patient = prescriptions.first().patient if prescriptions.exists() else refills.first().patient if refills.exists() else None
            if patient is None:
                raise NotFoundError("Patient profile not found.")
            return Response({
                "patientId": str(patient.id),
                "patientName": patient.full_name,
                "mrn": patient.mrn,
                "allergies": patient.allergies or [],
                "activeMedications": PharmacyPrescriptionSerializer(prescriptions, many=True, context={"request": request}).data,
                "refills": RefillSerializer(refills, many=True, context={"request": request}).data,
            })

        qs = PharmacyPrescription.objects.select_related("patient").all().order_by("patient__last_name", "patient__first_name")
        seen = {}
        for rx in qs:
            if rx.patient_id in seen:
                continue
            seen[rx.patient_id] = {
                "id": str(rx.patient_id),
                "patientId": str(rx.patient_id),
                "name": rx.patient.full_name,
                "patientName": rx.patient.full_name,
                "mrn": rx.patient.mrn,
                "allergies": rx.patient.allergies or [],
                "activeMedicationCount": PharmacyPrescription.objects.filter(
                    patient_id=rx.patient_id,
                    status__in=[RxStatus.ORDERED, RxStatus.PENDING_VERIFICATION, RxStatus.VERIFIED, RxStatus.DISPENSING, RxStatus.DISPENSED],
                ).count(),
            }
        return Response({"data": list(seen.values()), "total": len(seen)})

class PharmacyDashboardView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request):
        pending_verification_qs = PharmacyPrescription.objects.select_related(
            "patient", "original_prescription__prescribed_by"
        ).filter(
            status__in=[RxStatus.ORDERED, RxStatus.PENDING_VERIFICATION]
        ).order_by("priority", "-created_at")[:10]
        severe_warnings_qs = DrugWarning.objects.select_related("patient").filter(
            resolved=False,
            severity__in=["severe", "contraindicated"],
        ).order_by("-created_at")[:10]
        pending_interventions_qs = PharmacyIntervention.objects.select_related(
            "prescription__patient", "pharmacist"
        ).filter(
            Q(outcome__isnull=True) | Q(outcome__exact="") | Q(outcome="pending")
        ).order_by("-created_at")[:10]
        low_stock_items_qs = FormularyItem.objects.filter(
            stock_level__lte=F("reorder_level")
        ).order_by("stock_level", "name")[:10]

        today = timezone.now().date()
        stats = {
            "pendingVerification": PharmacyPrescription.objects.filter(
                status__in=[RxStatus.ORDERED, RxStatus.PENDING_VERIFICATION]
            ).count(),
            "verified": PharmacyPrescription.objects.filter(status=RxStatus.VERIFIED).count(),
            "dispensing": PharmacyPrescription.objects.filter(status=RxStatus.DISPENSING).count(),
            "dispensedToday": PharmacyPrescription.objects.filter(
                status=RxStatus.DISPENSED,
                dispensed_at__date=today,
            ).count(),
            "activeWarnings": DrugWarning.objects.filter(resolved=False).count(),
            "pendingInterventions": PharmacyIntervention.objects.filter(
                Q(outcome__isnull=True) | Q(outcome__exact="") | Q(outcome="pending")
            ).count(),
            "lowStockItems": FormularyItem.objects.filter(stock_level__lte=F("reorder_level")).count(),
            "pendingSubstitutions": Substitution.objects.filter(status=SubstitutionStatus.PENDING).count(),
        }
        return Response({
            "stats": stats,
            "pendingVerification": PharmacyPrescriptionSerializer(
                pending_verification_qs,
                many=True,
                context={"request": request},
            ).data,
            "severeWarnings": DrugWarningSerializer(
                severe_warnings_qs,
                many=True,
                context={"request": request},
            ).data,
            "pendingInterventions": PharmacyInterventionSerializer(
                pending_interventions_qs,
                many=True,
                context={"request": request},
            ).data,
            "lowStockItems": FormularyItemSerializer(
                low_stock_items_qs,
                many=True,
                context={"request": request},
            ).data,
        })

class PharmacyRxListView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]
    serializer_class = PharmacyPrescriptionSerializer

    def get(self, request):
        qs = PharmacyPrescription.objects.select_related(
            "patient", "original_prescription__prescribed_by", "verified_by", "dispensed_by"
        ).all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            if s == "all":
                pass
            elif s == "verification":
                qs = qs.filter(status__in=[RxStatus.ORDERED, RxStatus.PENDING_VERIFICATION])
            elif s == "dispense":
                qs = qs.filter(status__in=[RxStatus.VERIFIED, RxStatus.DISPENSING])
            else:
                qs = qs.filter(status=s)
        if setting := request.query_params.get("setting"):
            if setting != "all":
                qs = qs.filter(setting=setting)
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(original_prescription__medication__icontains=q)
                | Q(original_prescription__prescribed_by__first_name__icontains=q)
                | Q(original_prescription__prescribed_by__last_name__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("priority", "-created_at"), request)
        return paginator.get_paginated_response(
            PharmacyPrescriptionSerializer(page, many=True, context={"request": request}).data
        )

class PharmacyDispenseQueueView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request):
        qs = PharmacyPrescription.objects.select_related(
            "patient", "original_prescription__prescribed_by", "verified_by", "dispensed_by"
        ).filter(
            status__in=[RxStatus.VERIFIED, RxStatus.DISPENSING]
        )
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(original_prescription__medication__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("priority", "-verified_at", "-created_at"), request)
        return paginator.get_paginated_response(
            PharmacyPrescriptionSerializer(page, many=True, context={"request": request}).data
        )

class PharmacyRxDetailView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]
    serializer_class = PharmacyPrescriptionSerializer

    def get(self, request, pk):
        try:
            rx = PharmacyPrescription.objects.select_related("patient").get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        return Response(PharmacyPrescriptionSerializer(rx, context={"request": request}).data)

class PharmacyRxVerifyView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]
    serializer_class = PharmacyPrescriptionSerializer

    def post(self, request, pk):
        try:
            rx = PharmacyPrescription.objects.select_related("patient").get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        if rx.status not in (RxStatus.ORDERED, RxStatus.PENDING_VERIFICATION):
            raise ConflictError(f"Cannot verify prescription with status: {rx.status}")
        rx.status = RxStatus.VERIFIED
        rx.verified_by = request.user
        rx.verified_at = timezone.now()
        rx.verification_notes = request.data.get("verificationNotes") or ""
        rx.save(update_fields=["status", "verified_by", "verified_at", "verification_notes"])
        emit_pharmacy_rx_verified(
            {
                "rxId": str(rx.id),
                "patientId": str(rx.patient_id),
                "patientName": rx.patient.full_name,
            }
        )
        write_audit_log(
            request, AuditAction.UPDATE, "PharmacyPrescription", str(rx.id),
            {"action": "verify"}, AuditSeverity.HIGH,
        )
        try:
            from apps.pharmacy.cdss_service import PharmacyCDSSService
            med_name = getattr(getattr(rx, "original_prescription", None), "medication", None)
            safety = PharmacyCDSSService.run_kg_safety_check(str(rx.patient_id), med_name)
            if safety["total_alerts"] > 0:
                PharmacyCDSSService.persist_kg_safety_alerts(
                    rx.patient_id, safety, prescription=rx
                )
        except Exception:
            pass
        return Response(PharmacyPrescriptionSerializer(rx, context={"request": request}).data)

class PharmacyRxRejectView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]
    serializer_class = PharmacyPrescriptionSerializer

    def post(self, request, pk):
        try:
            rx = PharmacyPrescription.objects.select_related(
                "patient", "original_prescription__prescribed_by"
            ).get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        reason = request.data.get("reason")
        if not reason:
            raise ValidationAppError("Rejection reason is required.")
        validate_status_transition(
            rx.status,
            RxStatus.CANCELLED,
            {
                RxStatus.ORDERED: {RxStatus.CANCELLED},
                RxStatus.PENDING_VERIFICATION: {RxStatus.CANCELLED},
                RxStatus.ON_HOLD: {RxStatus.CANCELLED},
            },
            "pharmacy prescription",
        )
        rx.status = RxStatus.CANCELLED
        rx.hold_reason = reason
        rx.save(update_fields=["status", "hold_reason"])
        original_rx = getattr(rx, "original_prescription", None)
        if original_rx:
            original_rx.status = "discontinued"
            original_rx.save(update_fields=["status"])
        prescriber = getattr(getattr(rx, "original_prescription", None), "prescribed_by", None)
        medication = getattr(getattr(rx, "original_prescription", None), "medication", "") or ""
        emit_pharmacy_rx_rejected(
            {
                "rxId": str(rx.id),
                "patientId": str(rx.patient_id),
                "medication": medication,
                "reason": reason,
            },
            prescriber_id=str(prescriber.id) if prescriber else None,
        )
        write_audit_log(
            request, AuditAction.UPDATE, "PharmacyPrescription", str(rx.id),
            {"action": "reject", "reason": reason}, AuditSeverity.HIGH,
        )
        return Response(PharmacyPrescriptionSerializer(rx, context={"request": request}).data)

class PharmacyRxHoldView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]
    serializer_class = PharmacyPrescriptionSerializer

    def put(self, request, pk):
        try:
            rx = PharmacyPrescription.objects.select_related(
                "patient", "original_prescription__prescribed_by"
            ).get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        reason = request.data.get("reason")
        if not reason:
            raise ValidationAppError("Hold reason is required.")
        validate_status_transition(
            rx.status,
            RxStatus.ON_HOLD,
            {
                RxStatus.ORDERED: {RxStatus.ON_HOLD},
                RxStatus.PENDING_VERIFICATION: {RxStatus.ON_HOLD},
                RxStatus.VERIFIED: {RxStatus.ON_HOLD},
            },
            "pharmacy prescription",
        )
        rx.status = RxStatus.ON_HOLD
        rx.hold_reason = reason
        rx.save(update_fields=["status", "hold_reason"])
        original_rx = getattr(rx, "original_prescription", None)
        if original_rx:
            original_rx.status = "on-hold"
            original_rx.save(update_fields=["status"])
        prescriber = getattr(getattr(rx, "original_prescription", None), "prescribed_by", None)
        medication = getattr(getattr(rx, "original_prescription", None), "medication", "") or ""
        emit_pharmacy_rx_on_hold(
            {
                "rxId": str(rx.id),
                "patientId": str(rx.patient_id),
                "medication": medication,
                "reason": reason,
            },
            prescriber_id=str(prescriber.id) if prescriber else None,
        )
        return Response(PharmacyPrescriptionSerializer(rx, context={"request": request}).data)

    def post(self, request, pk):
        """Release a hold — moves on-hold → pending-verification for re-review."""
        try:
            rx = PharmacyPrescription.objects.select_related(
                "patient", "original_prescription__prescribed_by"
            ).get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        if rx.status != RxStatus.ON_HOLD:
            raise ConflictError("Only on-hold prescriptions can be released.")
        rx.status = RxStatus.PENDING_VERIFICATION
        rx.hold_reason = None
        rx.save(update_fields=["status", "hold_reason"])
        original_rx = getattr(rx, "original_prescription", None)
        if original_rx:
            original_rx.status = "active"
            original_rx.save(update_fields=["status"])
        write_audit_log(
            request, AuditAction.UPDATE, "PharmacyRx", str(pk),
            {"action": "hold_released", "patientId": str(rx.patient_id)},
        )
        return Response(PharmacyPrescriptionSerializer(rx, context={"request": request}).data)

class PharmacyRxCancelView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]
    serializer_class = PharmacyPrescriptionSerializer

    def put(self, request, pk):
        try:
            rx = PharmacyPrescription.objects.select_related(
                "patient", "original_prescription__prescribed_by"
            ).get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        reason = request.data.get("reason")
        if not reason:
            raise ValidationAppError("Cancellation reason is required.")
        validate_status_transition(
            rx.status,
            RxStatus.CANCELLED,
            {
                RxStatus.ORDERED: {RxStatus.CANCELLED},
                RxStatus.PENDING_VERIFICATION: {RxStatus.CANCELLED},
                RxStatus.ON_HOLD: {RxStatus.CANCELLED},
                RxStatus.VERIFIED: {RxStatus.CANCELLED},
            },
            "pharmacy prescription",
        )
        rx.status = RxStatus.CANCELLED
        rx.hold_reason = reason
        rx.save(update_fields=["status", "hold_reason"])
        original_rx = getattr(rx, "original_prescription", None)
        if original_rx:
            original_rx.status = "discontinued"
            original_rx.save(update_fields=["status"])
        prescriber = getattr(original_rx, "prescribed_by", None)
        medication = getattr(original_rx, "medication", "") or ""
        emit_pharmacy_rx_cancelled(
            {
                "rxId": str(rx.id),
                "patientId": str(rx.patient_id),
                "patientName": rx.patient.full_name,
                "medication": medication,
                "reason": reason,
            },
            prescriber_id=str(prescriber.id) if prescriber else None,
        )
        write_audit_log(
            request, AuditAction.UPDATE, "PharmacyPrescription", str(rx.id),
            {"action": "cancel", "reason": reason}, AuditSeverity.HIGH,
        )
        return Response(PharmacyPrescriptionSerializer(rx, context={"request": request}).data)

class PharmacyRxDispenseView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist]
    serializer_class = DispenseRecordSerializer

    def post(self, request, pk):
        try:
            rx = PharmacyPrescription.objects.select_related("patient").get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        validate_status_transition(
            rx.status,
            RxStatus.DISPENSED,
            {RxStatus.VERIFIED: {RxStatus.DISPENSED}},
            "pharmacy prescription",
        )
        dispense_serializer = DispenseRecordSerializer(
            data={
                "prescription": str(rx.id),
                "patient": str(rx.patient_id),
                "quantity": request.data.get("quantity"),
                "lot_number": request.data.get("lotNumber"),
                "expiration_date": request.data.get("expirationDate"),
                "days_supply": request.data.get("daysSupply"),
            },
            context={"request": request},
        )
        dispense_serializer.is_valid(raise_exception=True)
        dispense = dispense_serializer.save(dispensed_by=request.user)
        rx.status = RxStatus.DISPENSED
        rx.dispensed_by = request.user
        rx.dispensed_at = dispense.dispensed_at
        rx.quantity_dispensed = dispense.quantity
        rx.lot_number = dispense.lot_number
        rx.expiration_date = dispense.expiration_date
        rx.save(
            update_fields=[
                "status", "dispensed_by", "dispensed_at",
                "quantity_dispensed", "lot_number", "expiration_date",
            ]
        )
        emit_pharmacy_rx_dispensed({
            "rxId": str(rx.id),
            "patientId": str(rx.patient_id),
            "patientName": rx.patient.full_name,
            "dispenseId": str(dispense.id),
        })
        med_name = getattr(getattr(rx, "original_prescription", None), "medication", None)
        if med_name and dispense.quantity:
            FormularyItem.objects.filter(
                name__iexact=med_name, stock_level__gte=dispense.quantity
            ).update(stock_level=F("stock_level") - dispense.quantity)
        write_audit_log(
            request, AuditAction.UPDATE, "PharmacyPrescription", str(rx.id),
            {"action": "dispense"}, AuditSeverity.HIGH,
        )
        return Response(
            DispenseRecordSerializer(dispense, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class DrugSafetyCheckView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def post(self, request):
        patient_id = request.data.get("patientId")
        drug = request.data.get("medication")
        if not patient_id or not drug:
            raise ValidationAppError("patientId and medication are required.")
        from apps.patients.models import Patient
        try:
            patient = Patient.objects.get(id=patient_id)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        allergies = patient.allergies or []
        allergy_warnings = []
        for allergy in allergies:
            if isinstance(allergy, str) and drug.lower() in allergy.lower():
                warning = DrugWarning.objects.create(
                    patient_id=patient_id,
                    type="allergy",
                    severity="contraindicated",
                    message=f"Patient has documented allergy to {allergy}. Drug requested: {drug}.",
                    medications_involved=[drug, allergy],
                )
                allergy_warnings.append(warning)
                _trigger_drug_safety_cdss(patient_id, warning)
        existing = DrugWarning.objects.filter(
            patient_id=patient_id,
            severity__in=["severe", "contraindicated"],
        )
        warnings = list(existing) + allergy_warnings
        if warnings:
            return Response({
                "safe": False,
                "warnings": DrugWarningSerializer(warnings, many=True, context={"request": request}).data,
            })
        return Response({"safe": True, "warnings": []})

class FormularyListView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist | IsDoctor]
    serializer_class = FormularyItemSerializer

    def get(self, request):
        qs = FormularyItem.objects.all()
        if q := request.query_params.get("q"):
            from django.db.models import Q
            qs = qs.filter(Q(name__icontains=q) | Q(generic_name__icontains=q))
        if drug_class := request.query_params.get("drugClass"):
            qs = qs.filter(drug_class=drug_class)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("name"), request)
        return paginator.get_paginated_response(
            FormularyItemSerializer(page, many=True, context={"request": request}).data
        )

class FormularyDetailView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist | IsAdmin]
    serializer_class = FormularyItemSerializer

    def _get(self, pk):
        try:
            return FormularyItem.objects.get(id=pk)
        except FormularyItem.DoesNotExist:
            raise NotFoundError("Formulary item not found.")

    def get(self, request, pk):
        return Response(FormularyItemSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        item = self._get(pk)
        serializer = FormularyItemSerializer(item, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        item.refresh_from_db()
        return Response(FormularyItemSerializer(item, context={"request": request}).data)

class FormularyStockView(APIView):
    """GET /pharmacy/formulary/:id/stock â€” current stock level (was missing)."""
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request, pk):
        try:
            item = FormularyItem.objects.get(id=pk)
        except FormularyItem.DoesNotExist:
            raise NotFoundError("Formulary item not found.")
        return Response({
            "id": str(item.id),
            "name": item.name,
            "stockLevel": item.stock_level,
            "reorderLevel": item.reorder_level,
            "unit": item.unit,
            "isLowStock": item.stock_level <= item.reorder_level,
        })

class FormularyCreateView(APIView):
    permission_classes = [IsAuthenticated, IsPharmacist | IsAdmin]
    serializer_class = FormularyItemSerializer

    def post(self, request):
        serializer = FormularyItemSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        item = serializer.save()
        return Response(
            FormularyItemSerializer(item, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class PharmacyInterventionListCreateView(APIView):
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]
    serializer_class = PharmacyInterventionSerializer

    def get(self, request):
        qs = PharmacyIntervention.objects.all()
        if rx_id := request.query_params.get("rxId"):
            qs = qs.filter(prescription_id=rx_id)
        if prescriber_id := request.query_params.get("prescriberId"):
            qs = qs.filter(prescription__original_prescription__prescribed_by_id=prescriber_id)
        if request.query_params.get("pendingOnly"):
            qs = qs.filter(
                Q(outcome__isnull=True) | Q(outcome__exact="") | Q(outcome="pending")
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            PharmacyInterventionSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = PharmacyInterventionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        intervention = serializer.save(pharmacist=request.user)
        prescriber = getattr(
            getattr(getattr(intervention, "prescription", None), "original_prescription", None),
            "prescribed_by",
            None,
        )
        medication = getattr(
            getattr(getattr(intervention, "prescription", None), "original_prescription", None),
            "medication",
            "",
        ) or ""
        patient_id = getattr(getattr(intervention, "prescription", None), "patient_id", None)
        emit_pharmacy_intervention_created(
            {
                "interventionId": str(intervention.id),
                "patientId": str(patient_id) if patient_id else "",
                "medication": medication,
                "note": intervention.reason or "",
            },
            prescriber_id=str(prescriber.id) if prescriber else None,
        )
        return Response(
            PharmacyInterventionSerializer(intervention, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class PharmacyInterventionRespondView(APIView):
    permission_classes = [IsAuthenticated, PharmacyDoctorResponsePermission]
    serializer_class = PharmacyInterventionSerializer

    def put(self, request, pk):
        try:
            intervention = PharmacyIntervention.objects.get(id=pk)
        except PharmacyIntervention.DoesNotExist:
            raise NotFoundError("Intervention not found.")
        prescriber = getattr(getattr(intervention.prescription, "original_prescription", None), "prescribed_by", None)
        if request.user.role == "doctor" and prescriber and request.user.id != prescriber.id:
            raise ConflictError("Only the prescribing doctor can respond to this intervention.")
        intervention.prescriber_response = request.data.get("response", intervention.prescriber_response or "")
        intervention.outcome = request.data.get("outcome", intervention.outcome or "")
        intervention.resolved_at = timezone.now()
        intervention.save(update_fields=["prescriber_response", "outcome", "resolved_at"])
        return Response(PharmacyInterventionSerializer(intervention, context={"request": request}).data)

    post = put

class RefillListCreateView(APIView):
    """GET/POST /pharmacy/refills/"""
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request):
        qs = Refill.objects.select_related("patient", "prescription").all()
        if rx_id := request.query_params.get("rxId"):
            qs = qs.filter(prescription_id=rx_id)
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            RefillSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        if request.user.role != "pharmacist":
            raise ConflictError("Only pharmacists can create refill records.")
        serializer = RefillSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        rx_prescription = serializer.validated_data.get("prescription")
        if rx_prescription:
            orig = getattr(rx_prescription, "original_prescription", None)
            max_refills = getattr(orig, "refills", 0) or 0
            used = Refill.objects.filter(prescription=rx_prescription).count()
            if used >= max_refills:
                raise ValidationAppError(
                    f"No refills remaining. Maximum allowed: {max_refills}."
                )
        refill = serializer.save(pharmacist=request.user)
        write_audit_log(
            request, AuditAction.CREATE, "Refill", str(refill.id),
            {"prescriptionId": str(refill.prescription_id)}, AuditSeverity.HIGH,
        )
        return Response(
            RefillSerializer(refill, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class SubstitutionListCreateView(APIView):
    """GET/POST /pharmacy/substitutions/"""
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request):
        qs = Substitution.objects.all()
        if rx_id := request.query_params.get("rxId"):
            qs = qs.filter(prescription_id=rx_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            SubstitutionSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        if request.user.role != "pharmacist":
            raise ConflictError("Only pharmacists can create substitution requests.")
        serializer = SubstitutionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        sub = serializer.save(
            requested_by=request.user,
            approved_by=None,
            status=request.data.get("status") or SubstitutionStatus.PENDING,
        )
        prescriber = getattr(
            getattr(getattr(sub, "prescription", None), "original_prescription", None),
            "prescribed_by",
            None,
        )
        original_med = getattr(
            getattr(getattr(sub, "prescription", None), "original_prescription", None),
            "medication",
            "",
        ) or ""
        patient_id = getattr(getattr(sub, "prescription", None), "patient_id", None)
        emit_pharmacy_substitution_proposed(
            {
                "substitutionId": str(sub.id),
                "patientId": str(patient_id) if patient_id else "",
                "originalMedication": original_med,
                "suggestedMedication": sub.substitute_medication or "",
                "reason": sub.reason or "",
            },
            prescriber_id=str(prescriber.id) if prescriber else None,
        )
        return Response(
            SubstitutionSerializer(sub, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class SubstitutionDetailView(APIView):
    """GET/PUT /pharmacy/substitutions/:id/"""
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def _get(self, pk):
        try:
            return Substitution.objects.get(id=pk)
        except Substitution.DoesNotExist:
            raise NotFoundError("Substitution not found.")

    def get(self, request, pk):
        return Response(SubstitutionSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        sub = self._get(pk)
        if request.user.role != "pharmacist":
            raise ConflictError("Only pharmacists can update substitution records.")
        serializer = SubstitutionSerializer(sub, data=request.data, partial=True, context={"request": request})
        serializer.is_valid(raise_exception=True)
        save_kwargs = {}
        if request.data.get("status") == SubstitutionStatus.APPROVED:
            save_kwargs["approved_by"] = request.user
        serializer.save(**save_kwargs)
        sub.refresh_from_db()
        new_status = request.data.get("status")
        if new_status in (SubstitutionStatus.APPROVED, SubstitutionStatus.REJECTED):
            prescriber = getattr(
                getattr(getattr(sub, "prescription", None), "original_prescription", None),
                "prescribed_by", None,
            )
            patient_id = getattr(getattr(sub, "prescription", None), "patient_id", None)
            original_med = getattr(
                getattr(getattr(sub, "prescription", None), "original_prescription", None),
                "medication", "",
            ) or ""
            emit_fn = (
                emit_pharmacy_substitution_approved
                if new_status == SubstitutionStatus.APPROVED
                else emit_pharmacy_substitution_rejected
            )
            emit_fn(
                {
                    "substitutionId": str(sub.id),
                    "patientId": str(patient_id) if patient_id else "",
                    "originalMedication": original_med,
                    "suggestedMedication": sub.substitute_medication or "",
                    "status": new_status,
                },
                prescriber_id=str(prescriber.id) if prescriber else None,
            )
        return Response(SubstitutionSerializer(sub, context={"request": request}).data)

class PharmacyKGSafetyView(APIView):
    """
    GET /pharmacy/patients/<patient_pk>/kg_safety/
    Query params: ?drug=<medication_name> (optional — filters to that drug)

    Returns a structured KG-based drug safety report:
    DDI alerts, allergy cross-reactivity alerts, risk-group alerts.
    Read-only — does NOT create DrugWarning records.
    """
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def get(self, request, patient_pk):
        from apps.pharmacy.cdss_service import PharmacyCDSSService
        drug_name = request.query_params.get("drug")
        try:
            safety = PharmacyCDSSService.run_kg_safety_check(str(patient_pk), drug_name)
        except Exception as exc:
            logger.error("KG safety check failed for patient %s: %s", patient_pk, exc)
            return Response(
                {"error": "KG safety check unavailable", "detail": str(exc)},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response(safety)

class PharmacyPatientAIConsultView(APIView):
    """
    POST /pharmacy/patients/<patient_pk>/ai_consult/
    Body: { "prompt": "...", "drug": "..." (optional) }

    Pharmacy-focused MedGemma consult using the patient KG subgraph and
    the drug safety knowledge graph as grounding context.
    """
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def post(self, request, patient_pk):
        from apps.pharmacy.cdss_service import PharmacyCDSSService
        prompt_query = request.data.get("prompt")
        if not prompt_query:
            raise ValidationAppError("prompt is required.")
        drug_name = request.data.get("drug")
        response_text = PharmacyCDSSService.ai_consult(
            str(patient_pk), prompt_query, drug_name
        )
        return Response({
            "patientId": str(patient_pk),
            "drug": drug_name,
            "query": prompt_query,
            "response": response_text,
        })

class PharmacyRxAIConsultView(APIView):
    """
    POST /pharmacy/prescriptions/<pk>/ai_consult/
    Body: { "prompt": "..." } (optional — defaults to a safety review prompt)

    AI consult scoped to a specific prescription. The medication name is
    automatically extracted from the prescription and used as KG context.
    """
    permission_classes = [IsAuthenticated, PharmacyReadWritePermission]

    def post(self, request, pk):
        from apps.pharmacy.cdss_service import PharmacyCDSSService
        try:
            rx = PharmacyPrescription.objects.select_related(
                "patient", "original_prescription"
            ).get(id=pk)
        except PharmacyPrescription.DoesNotExist:
            raise NotFoundError("Pharmacy prescription not found.")
        prompt_query = request.data.get(
            "prompt",
            "Review this prescription for drug interactions, allergy risks, "
            "dose appropriateness, and suggest any required interventions.",
        )
        drug_name = getattr(rx.original_prescription, "medication", None)
        response_text = PharmacyCDSSService.ai_consult(
            str(rx.patient_id), prompt_query, drug_name
        )
        return Response({
            "rxId": str(rx.id),
            "patientId": str(rx.patient_id),
            "drug": drug_name,
            "query": prompt_query,
            "response": response_text,
        })

