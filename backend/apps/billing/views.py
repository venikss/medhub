"""
Billing module views — Invoices, Claims, Payments, Denials, Accounts, Stats.
"""

import uuid
from django.utils import timezone
from django.db.models import Sum, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError
from core.pagination import StandardPagination
from core.permissions import IsBillingStaff, IsAdmin, IsFrontDesk
from core.workflows import validate_status_transition

from .models import Invoice, Claim, Payment, Denial, BillingInvoiceStatus, ClaimStatus, DenialStatus
from .serializers import (
    InvoiceSerializer, ClaimSerializer, PaymentSerializer, DenialSerializer,
    CLAIM_STATUS_FROM_API, DENIAL_STATUS_FROM_API,
)

class BillingDashboardView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request):
        today = timezone.now().date()
        recent_payments = Payment.objects.select_related("patient").filter(voided=False).order_by("-posted_at")[:5]
        active_denials = Denial.objects.select_related("patient", "claim__invoice").exclude(
            status__in=[DenialStatus.OVERTURNED, DenialStatus.WRITE_OFF]
        ).order_by("-created_at")[:10]
        claim_status_summary = {
            "submitted": Claim.objects.filter(status=ClaimStatus.SUBMITTED).count(),
            "pending": Claim.objects.filter(status__in=[ClaimStatus.ACKNOWLEDGED, ClaimStatus.UNDER_REVIEW]).count(),
            "partially_paid": Claim.objects.filter(status=ClaimStatus.PARTIALLY_PAID).count(),
            "paid": Claim.objects.filter(status__in=[ClaimStatus.PAID, ClaimStatus.CLOSED]).count(),
        }
        stats_response = BillingStatsView().get(request).data
        return Response({
            "stats": stats_response,
            "recentPayments": PaymentSerializer(recent_payments, many=True, context={"request": request}).data,
            "activeDenials": DenialSerializer(active_denials, many=True, context={"request": request}).data,
            "claimStatusSummary": claim_status_summary,
            "billedToday": Invoice.objects.filter(created_at__date=today).count(),
        })

class PatientAccountListView(APIView):
    """GET /billing/accounts  — list all patient account summaries."""
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request):
        from apps.patients.models import Patient
        qs = Patient.objects.filter(deleted_at__isnull=True)
        if search := request.query_params.get("search"):
            from django.db.models import Q as DQ
            qs = qs.filter(
                DQ(mrn__icontains=search)
                | DQ(first_name__icontains=search)
                | DQ(last_name__icontains=search)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("last_name", "first_name"), request)
        data = [_build_account_summary(p) for p in page]
        return paginator.get_paginated_response(data)

class PatientAccountDetailView(APIView):
    """GET /billing/accounts/:patientId"""
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request, patient_id):
        from apps.patients.models import Patient
        try:
            patient = Patient.objects.get(id=patient_id, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")
        return Response(_build_account_summary(patient))

def _build_account_summary(patient):
    invoices = Invoice.objects.filter(patient=patient)
    total_billed = invoices.aggregate(t=Sum("total_amount"))["t"] or 0
    total_paid = invoices.aggregate(t=Sum("patient_paid"))["t"] or 0
    insurance_paid = invoices.aggregate(t=Sum("insurance_paid"))["t"] or 0
    balance_due = invoices.exclude(
        status__in=[BillingInvoiceStatus.CLEARED, BillingInvoiceStatus.VOID]
    ).aggregate(t=Sum("balance"))["t"] or 0
    pending_claims = Claim.objects.filter(
        patient=patient, status=ClaimStatus.SUBMITTED
    ).count()
    return {
        "patientId": str(patient.id),
        "mrn": patient.mrn,
        "patientName": patient.full_name,
        "totalBilled": float(total_billed),
        "totalPaid": float(total_paid),
        "insurancePaid": float(insurance_paid),
        "balanceDue": float(balance_due),
        "pendingClaims": pending_claims,
    }

class PatientAccountTimelineView(APIView):
    """
    GET /billing/accounts/:patientId/timeline
    FIXED: was missing entirely.
    """
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request, patient_id):
        from apps.patients.models import Patient
        try:
            Patient.objects.get(id=patient_id, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")

        invoices = list(
            Invoice.objects.filter(patient_id=patient_id).order_by("-created_at")
        )
        payments = list(
            Payment.objects.filter(patient_id=patient_id).order_by("-posted_at")
        )
        denials = list(
            Denial.objects.filter(patient_id=patient_id).order_by("-created_at")
        )

        timeline = []
        for inv in invoices:
            timeline.append({
                "type": "invoice",
                "date": inv.created_at.isoformat(),
                "data": InvoiceSerializer(inv).data,
            })
        for pay in payments:
            timeline.append({
                "type": "payment",
                "date": pay.posted_at.isoformat(),
                "data": PaymentSerializer(pay).data,
            })
        for den in denials:
            timeline.append({
                "type": "denial",
                "date": den.created_at.isoformat(),
                "data": DenialSerializer(den).data,
            })

        timeline.sort(key=lambda x: x["date"], reverse=True)
        return Response({"data": timeline, "total": len(timeline)})

class InvoiceListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request):
        qs = Invoice.objects.select_related("patient").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(primary_diagnosis__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            InvoiceSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = InvoiceSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        invoice = serializer.save()
        write_audit_log(request, AuditAction.CREATE, "Invoice", str(invoice.id))
        return Response(
            InvoiceSerializer(invoice, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class InvoiceDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def _get(self, pk):
        try:
            return Invoice.objects.get(id=pk)
        except Invoice.DoesNotExist:
            raise NotFoundError("Invoice not found.")

    def get(self, request, pk):
        return Response(InvoiceSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        invoice = self._get(pk)
        if invoice.status in (BillingInvoiceStatus.CLEARED, BillingInvoiceStatus.VOID):
            raise ConflictError(f"Cannot modify a {invoice.status} invoice.")
        serializer = InvoiceSerializer(
            invoice, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

class InvoiceSendView(APIView):
    """
    POST /billing/invoices/:id/send
    FIXED: was missing entirely.
    """
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(id=pk)
        except Invoice.DoesNotExist:
            raise NotFoundError("Invoice not found.")
        validate_status_transition(
            invoice.status,
            BillingInvoiceStatus.SENT,
            {
                BillingInvoiceStatus.DRAFT: {BillingInvoiceStatus.SENT},
                BillingInvoiceStatus.UNPAID: {BillingInvoiceStatus.SENT},
                BillingInvoiceStatus.PARTIAL: {BillingInvoiceStatus.SENT},
                BillingInvoiceStatus.SENT: set(),
                BillingInvoiceStatus.BILLED_INSURANCE: set(),
                BillingInvoiceStatus.OVERDUE: {BillingInvoiceStatus.SENT},
                BillingInvoiceStatus.CLEARED: set(),
                BillingInvoiceStatus.VOID: set(),
            },
            "invoice",
        )
        invoice.status = BillingInvoiceStatus.SENT
        invoice.sent_at = timezone.now()
        invoice.save(update_fields=["status", "sent_at"])
        write_audit_log(request, AuditAction.UPDATE, "Invoice", str(invoice.id), {"action": "send"})
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

class InvoiceVoidView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        try:
            invoice = Invoice.objects.get(id=pk)
        except Invoice.DoesNotExist:
            raise NotFoundError("Invoice not found.")
        if invoice.status == BillingInvoiceStatus.VOID:
            raise ConflictError("Invoice already voided.")
        reason = request.data.get("reason")
        if not reason:
            raise ValidationAppError("Void reason is required.")
        invoice.status = BillingInvoiceStatus.VOID
        invoice.void_at = timezone.now()
        invoice.void_by = request.user
        invoice.save(update_fields=["status", "void_at", "void_by"])
        write_audit_log(
            request, AuditAction.UPDATE, "Invoice", str(invoice.id),
            {"action": "void", "reason": reason}, AuditSeverity.HIGH,
        )
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

class ClaimListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request):
        qs = Claim.objects.select_related("patient", "invoice").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=CLAIM_STATUS_FROM_API.get(s, s))
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(payer_id__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            ClaimSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = ClaimSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        claim = serializer.save()
        write_audit_log(request, AuditAction.CREATE, "Claim", str(claim.id))
        return Response(
            ClaimSerializer(claim, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class ClaimDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def _get(self, pk):
        try:
            return Claim.objects.get(id=pk)
        except Claim.DoesNotExist:
            raise NotFoundError("Claim not found.")

    def get(self, request, pk):
        return Response(ClaimSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        claim = self._get(pk)
        serializer = ClaimSerializer(
            claim, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ClaimSerializer(claim, context={"request": request}).data)

class ClaimStatusView(APIView):
    """
    PUT /billing/claims/:id/status
    FIXED: dedicated status endpoint.
    """
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def put(self, request, pk):
        try:
            claim = Claim.objects.get(id=pk)
        except Claim.DoesNotExist:
            raise NotFoundError("Claim not found.")
        new_status = CLAIM_STATUS_FROM_API.get(request.data.get("status"), request.data.get("status"))
        allowed = [s.value for s in ClaimStatus]
        if new_status not in allowed:
            raise ValidationAppError(f"Invalid status. Allowed: {allowed}")
        validate_status_transition(
            claim.status,
            new_status,
            {
                ClaimStatus.DRAFT: {ClaimStatus.SUBMITTED},
                ClaimStatus.SUBMITTED: {ClaimStatus.ACKNOWLEDGED, ClaimStatus.DENIED, ClaimStatus.CLOSED},
                ClaimStatus.ACKNOWLEDGED: {ClaimStatus.UNDER_REVIEW, ClaimStatus.DENIED, ClaimStatus.PAID, ClaimStatus.PARTIALLY_PAID},
                ClaimStatus.UNDER_REVIEW: {ClaimStatus.PAID, ClaimStatus.PARTIALLY_PAID, ClaimStatus.DENIED, ClaimStatus.CLOSED},
                ClaimStatus.DENIED: {ClaimStatus.APPEALED, ClaimStatus.CLOSED},
                ClaimStatus.APPEALED: {ClaimStatus.SUBMITTED, ClaimStatus.CLOSED},
                ClaimStatus.PAID: {ClaimStatus.CLOSED},
                ClaimStatus.PARTIALLY_PAID: {ClaimStatus.CLOSED},
                ClaimStatus.CLOSED: set(),
            },
            "claim",
        )
        claim.status = new_status
        claim.save(update_fields=["status"])
        write_audit_log(
            request, AuditAction.UPDATE, "Claim", str(claim.id), {"status": new_status}
        )
        return Response(ClaimSerializer(claim, context={"request": request}).data)

class ClaimSubmitView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def post(self, request, pk):
        try:
            claim = Claim.objects.get(id=pk)
        except Claim.DoesNotExist:
            raise NotFoundError("Claim not found.")
        validate_status_transition(
            claim.status,
            ClaimStatus.SUBMITTED,
            {
                ClaimStatus.DRAFT: {ClaimStatus.SUBMITTED},
                ClaimStatus.APPEALED: {ClaimStatus.SUBMITTED},
            },
            "claim",
        )
        claim.status = ClaimStatus.SUBMITTED
        claim.submitted_at = timezone.now()
        claim.save(update_fields=["status", "submitted_at"])
        write_audit_log(request, AuditAction.UPDATE, "Claim", str(claim.id), {"action": "submit"})
        return Response(ClaimSerializer(claim, context={"request": request}).data)

class ClaimResubmitView(APIView):
    """
    POST /billing/claims/:id/resubmit
    FIXED: was missing entirely.
    """
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def post(self, request, pk):
        try:
            claim = Claim.objects.get(id=pk)
        except Claim.DoesNotExist:
            raise NotFoundError("Claim not found.")
        if claim.status not in (ClaimStatus.DENIED, ClaimStatus.APPEALED, ClaimStatus.CLOSED):
            raise ConflictError(
                f"Only denied, appealed, or closed claims can be resubmitted. Current: {claim.status}"
            )
        claim.status = ClaimStatus.SUBMITTED
        claim.resubmitted_at = timezone.now()
        claim.save(update_fields=["status", "resubmitted_at"])
        write_audit_log(
            request, AuditAction.UPDATE, "Claim", str(claim.id), {"action": "resubmit"}
        )
        return Response(ClaimSerializer(claim, context={"request": request}).data)

class PaymentListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin | IsFrontDesk]

    def get(self, request):
        qs = Payment.objects.select_related("patient", "claim").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if invoice_id := request.query_params.get("invoiceId"):
            qs = qs.filter(invoice_id=invoice_id)
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(payer__icontains=q)
                | Q(reference_number__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-posted_at"), request)
        return paginator.get_paginated_response(
            PaymentSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = PaymentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        payment = serializer.save(posted_by=request.user)
        invoice = payment.invoice
        if invoice:
            invoice.patient_paid = (invoice.patient_paid or 0) + payment.amount
            invoice.balance = max(
                0,
                invoice.total_amount - invoice.insurance_paid - invoice.patient_paid,
            )
            invoice.status = (
                BillingInvoiceStatus.CLEARED
                if invoice.balance <= 0
                else BillingInvoiceStatus.PARTIAL
            )
            invoice.save(update_fields=["patient_paid", "balance", "status"])
        write_audit_log(
            request, AuditAction.CREATE, "Payment", str(payment.id), {}, AuditSeverity.HIGH
        )
        return Response(
            PaymentSerializer(payment, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class PaymentVoidView(APIView):
    """
    PUT /billing/payments/:id/void
    FIXED: renamed from PaymentRefundView and path changed to /void/.
    """
    permission_classes = [IsAuthenticated, IsAdmin]

    def put(self, request, pk):
        try:
            payment = Payment.objects.get(id=pk)
        except Payment.DoesNotExist:
            raise NotFoundError("Payment not found.")
        if payment.voided:
            raise ConflictError("Payment already voided.")
        reason = request.data.get("reason")
        if not reason:
            raise ValidationAppError("Void reason is required.")
        payment.voided = True
        payment.voided_at = timezone.now()
        payment.void_reason = reason
        payment.save(update_fields=["voided", "voided_at", "void_reason"])

        if payment.invoice_id:
            try:
                invoice = Invoice.objects.get(id=payment.invoice_id)
                invoice.patient_paid = max(0, (invoice.patient_paid or 0) - payment.amount)
                invoice.balance = max(
                    0,
                    invoice.total_amount - invoice.insurance_paid - invoice.patient_paid,
                )
                invoice.status = (
                    BillingInvoiceStatus.CLEARED
                    if invoice.balance <= 0
                    else BillingInvoiceStatus.PARTIAL
                )
                invoice.save(update_fields=["patient_paid", "balance", "status"])
            except Invoice.DoesNotExist:
                pass

        write_audit_log(
            request, AuditAction.UPDATE, "Payment", str(payment.id),
            {"action": "void", "reason": reason}, AuditSeverity.HIGH,
        )
        return Response(PaymentSerializer(payment, context={"request": request}).data)

class DenialListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request):
        qs = Denial.objects.select_related("patient", "claim__invoice").all()
        if claim_id := request.query_params.get("claimId"):
            qs = qs.filter(claim_id=claim_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=DENIAL_STATUS_FROM_API.get(s, s))
        if q := request.query_params.get("q"):
            qs = qs.filter(
                Q(patient__first_name__icontains=q)
                | Q(patient__last_name__icontains=q)
                | Q(patient__mrn__icontains=q)
                | Q(reason_description__icontains=q)
                | Q(reason_code__icontains=q)
            )
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            DenialSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = DenialSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        denial = serializer.save()
        if denial.claim_id:
            Claim.objects.filter(id=denial.claim_id).update(status=ClaimStatus.DENIED)
        write_audit_log(request, AuditAction.CREATE, "Denial", str(denial.id))
        return Response(
            DenialSerializer(denial, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class DenialDetailView(APIView):
    """
    GET /billing/denials/:id
    PUT /billing/denials/:id
    FIXED: was missing entirely.
    """
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def _get(self, pk):
        try:
            return Denial.objects.get(id=pk)
        except Denial.DoesNotExist:
            raise NotFoundError("Denial not found.")

    def get(self, request, pk):
        return Response(DenialSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        denial = self._get(pk)
        serializer = DenialSerializer(
            denial, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        write_audit_log(request, AuditAction.UPDATE, "Denial", str(denial.id))
        return Response(DenialSerializer(denial, context={"request": request}).data)

class DenialAppealView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def post(self, request, pk):
        try:
            denial = Denial.objects.get(id=pk)
        except Denial.DoesNotExist:
            raise NotFoundError("Denial not found.")
        validate_status_transition(
            denial.status,
            DenialStatus.APPEALED,
            {
                DenialStatus.OPEN: {DenialStatus.IN_REVIEW, DenialStatus.APPEALED, DenialStatus.UPHELD, DenialStatus.OVERTURNED, DenialStatus.WRITE_OFF},
                DenialStatus.IN_REVIEW: {DenialStatus.APPEALED, DenialStatus.UPHELD, DenialStatus.OVERTURNED, DenialStatus.WRITE_OFF},
                DenialStatus.APPEALED: set(),
                DenialStatus.OVERTURNED: set(),
                DenialStatus.UPHELD: set(),
                DenialStatus.WRITE_OFF: set(),
            },
            "denial",
        )
        denial.status = DenialStatus.APPEALED
        denial.appeal_submitted_at = timezone.now()
        denial.appeal_notes = request.data.get("appealNotes", "")
        denial.save(update_fields=["status", "appeal_submitted_at", "appeal_notes"])
        write_audit_log(request, AuditAction.UPDATE, "Denial", str(denial.id), {"action": "appeal"})
        return Response(DenialSerializer(denial, context={"request": request}).data)

class BillingStatsView(APIView):
    permission_classes = [IsAuthenticated, IsBillingStaff | IsAdmin]

    def get(self, request):
        today = timezone.now().date()
        thirty_days_ago = today.replace(day=today.day) if False else None
        import datetime
        thirty_days_ago = today - datetime.timedelta(days=30)

        total_billed_today = (
            Invoice.objects.filter(created_at__date=today)
            .aggregate(t=Sum("total_amount"))["t"] or 0
        )
        collected_today = (
            Payment.objects.filter(posted_at__date=today, voided=False)
            .aggregate(t=Sum("amount"))["t"] or 0
        )
        pending_insurance = (
            Invoice.objects.filter(status=BillingInvoiceStatus.BILLED_INSURANCE)
            .aggregate(t=Sum("balance"))["t"] or 0
        )
        patient_balance_due = (
            Invoice.objects.exclude(
                status__in=[BillingInvoiceStatus.CLEARED, BillingInvoiceStatus.VOID]
            )
            .aggregate(t=Sum("balance"))["t"] or 0
        )
        pending_claims = Claim.objects.filter(
            status__in=[ClaimStatus.SUBMITTED, ClaimStatus.ACKNOWLEDGED, ClaimStatus.UNDER_REVIEW]
        ).count()
        denied_claims = Claim.objects.filter(status=ClaimStatus.DENIED).count()
        overdue_30_days = Invoice.objects.filter(
            status=BillingInvoiceStatus.OVERDUE,
            created_at__date__lte=thirty_days_ago,
        ).count()
        total_billed = Invoice.objects.aggregate(t=Sum("total_amount"))["t"] or 1
        total_collected = (
            Payment.objects.filter(voided=False).aggregate(t=Sum("amount"))["t"] or 0
        )
        collection_rate = round(float(total_collected) / float(total_billed) * 100, 2)

        return Response({
            "totalBilledToday": float(total_billed_today),
            "collectedToday": float(collected_today),
            "pendingInsurance": float(pending_insurance),
            "patientBalanceDue": float(patient_balance_due),
            "pendingClaims": pending_claims,
            "deniedClaims": denied_claims,
            "overdue30Days": overdue_30_days,
            "collectionRate": collection_rate,
        })
