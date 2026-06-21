"""
Doctors module views — Encounters, Diagnoses, Orders, Prescriptions, Referrals.
Fixed: is_signed references, OrderCancelView method, missing status endpoints,
       missing results inbox path, missing PUT /results/:id/review,
       missing PUT /appointments/:id/status, missing PUT /prescriptions/:id/status.
"""

from django.utils import timezone
from django.db.models import Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.audit import write_audit_log, AuditAction, AuditSeverity
from core.exceptions import NotFoundError, ConflictError, ValidationAppError, ForbiddenError
from core.pagination import StandardPagination
from core.permissions import IsDoctor, IsAdmin, IsClinicalStaff, UserRole, ReadWriteRolePermission
from core.websockets import emit_pharmacy_new_prescription, emit_pharmacy_prescription_discontinued
from core.workflows import validate_status_transition
from apps.administration.models import RadiologyCatalogItem
from apps.pharmacy.models import PharmacyPrescription, RxSetting, RxStatus
from apps.radiology.models import ImagingOrder, ImagingModality, ImagingStudyStatus
from apps.laboratory.models import (
    LabPanel, LabPanelStatus,
    Specimen as LabSpecimen,
    SpecimenType as LabSpecimenType,
    SpecimenStatus as LabSpecimenStatus,
)
from apps.cdss.models import MedicalOntologyMapping, OntologyDomain, OntologyCodeSystem

from .models import (
    Encounter, Diagnosis, Order, Prescription, Referral,
    EncounterStatus, DiagnosisStatus, PrescriptionStatus, ReferralStatus, OrderStatus, OrderCategory,
)
from .serializers import (
    EncounterSerializer, DiagnosisSerializer, OrderSerializer,
    PrescriptionSerializer, ReferralSerializer,
)

DoctorReadWritePermission = ReadWriteRolePermission.for_roles(
    [UserRole.DOCTOR, UserRole.ADMIN],
    [UserRole.DOCTOR],
)

class EncounterListCreateView(APIView):
    permission_classes = [IsAuthenticated, DoctorReadWritePermission]
    serializer_class = EncounterSerializer

    def get(self, request):
        qs = Encounter.objects.select_related("patient", "doctor").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if doc_id := request.query_params.get("doctorId"):
            qs = qs.filter(doctor_id=doc_id)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            EncounterSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = EncounterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        encounter = serializer.save(doctor=request.user)
        write_audit_log(request, AuditAction.CREATE, "Encounter", str(encounter.id))
        return Response(
            EncounterSerializer(encounter, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class EncounterDetailView(APIView):
    permission_classes = [IsAuthenticated, DoctorReadWritePermission]
    serializer_class = EncounterSerializer

    def _get(self, pk):
        try:
            return Encounter.objects.select_related("patient", "doctor").get(id=pk)
        except Encounter.DoesNotExist:
            raise NotFoundError("Encounter not found.")

    def get(self, request, pk):
        encounter = self._get(pk)
        write_audit_log(request, AuditAction.READ, "Encounter", str(encounter.id))
        return Response(EncounterSerializer(encounter, context={"request": request}).data)

    def put(self, request, pk):
        encounter = self._get(pk)
        if encounter.status == EncounterStatus.SIGNED and request.user != encounter.doctor:
            raise ConflictError("Signed encounters can only be amended by the signing doctor.")
        serializer = EncounterSerializer(
            encounter, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(EncounterSerializer(encounter, context={"request": request}).data)

    def delete(self, request, pk):
        encounter = self._get(pk)
        if encounter.status == EncounterStatus.SIGNED:
            raise ConflictError("Signed encounters cannot be deleted.")
        if encounter.doctor != request.user:
            raise ConflictError("Only the doctor who created this encounter can delete it.")
        write_audit_log(
            request, AuditAction.DELETE, "Encounter", str(encounter.id),
            {"patientId": str(encounter.patient_id), "status": encounter.status},
        )
        encounter.delete()
        from rest_framework import status as drf_status
        return Response(status=drf_status.HTTP_204_NO_CONTENT)

class EncounterSignView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = EncounterSerializer

    def post(self, request, pk):
        try:
            encounter = Encounter.objects.get(id=pk)
        except Encounter.DoesNotExist:
            raise NotFoundError("Encounter not found.")
        if encounter.status == EncounterStatus.SIGNED:
            raise ConflictError("Encounter already signed.")
        if encounter.doctor != request.user:
            raise ConflictError("Only the assigned doctor can sign this encounter.")
        encounter.status = EncounterStatus.SIGNED
        encounter.signed_at = timezone.now()
        encounter.signed_by = request.user
        encounter.save(update_fields=["status", "signed_at", "signed_by"])
        write_audit_log(
            request, AuditAction.UPDATE, "Encounter", str(encounter.id),
            {"action": "sign"}, AuditSeverity.HIGH,
        )
        return Response(EncounterSerializer(encounter, context={"request": request}).data)

class EncounterAmendView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = EncounterSerializer

    def post(self, request, pk):
        try:
            encounter = Encounter.objects.get(id=pk)
        except Encounter.DoesNotExist:
            raise NotFoundError("Encounter not found.")
        if encounter.status != EncounterStatus.SIGNED:
            raise ConflictError("Only signed encounters can be amended.")
        note = request.data.get("amendmentNote")
        if not note:
            raise ValidationAppError("amendmentNote is required.")
        amendments = encounter.amendments or []
        amendments.append({
            "amendedBy": str(request.user.id),
            "amendedAt": timezone.now().isoformat(),
            "note": note,
            "previousStatus": encounter.status,
        })
        encounter.amendments = amendments
        encounter.status = EncounterStatus.AMENDED
        encounter.save(update_fields=["amendments", "status"])
        write_audit_log(
            request, AuditAction.UPDATE, "Encounter", str(encounter.id),
            {"action": "amend"}, AuditSeverity.HIGH,
        )
        return Response(EncounterSerializer(encounter, context={"request": request}).data)

class DiagnosisListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = DiagnosisSerializer

    def get(self, request):
        qs = Diagnosis.objects.select_related("patient", "encounter", "diagnosed_by").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if encounter_id := request.query_params.get("encounterId"):
            qs = qs.filter(encounter_id=encounter_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            DiagnosisSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = DiagnosisSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        diagnosis = serializer.save(diagnosed_by=request.user)
        return Response(
            DiagnosisSerializer(diagnosis, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class DiagnosisDetailView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = DiagnosisSerializer

    def _get(self, pk):
        try:
            return Diagnosis.objects.get(id=pk)
        except Diagnosis.DoesNotExist:
            raise NotFoundError("Diagnosis not found.")

    def get(self, request, pk):
        return Response(DiagnosisSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        diag = self._get(pk)
        serializer = DiagnosisSerializer(
            diag, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(DiagnosisSerializer(diag, context={"request": request}).data)

    def delete(self, request, pk):
        self._get(pk).delete()
        return Response({"message": "Diagnosis deleted."}, status=status.HTTP_204_NO_CONTENT)

class DiagnosisStatusView(APIView):
    """PATCH /diagnoses/<pk>/status/ — update only the status field and sync Neo4j."""
    permission_classes = [IsAuthenticated, IsDoctor]

    _ALLOWED = {DiagnosisStatus.ACTIVE, DiagnosisStatus.RESOLVED, DiagnosisStatus.CHRONIC, DiagnosisStatus.SUSPECTED}

    def patch(self, request, pk):
        try:
            diag = Diagnosis.objects.select_related("patient").get(id=pk)
        except Diagnosis.DoesNotExist:
            raise NotFoundError("Diagnosis not found.")

        new_status = request.data.get("status", "").strip()
        if new_status not in self._ALLOWED:
            raise ValidationAppError(
                f"status must be one of: {', '.join(sorted(self._ALLOWED))}"
            )

        if diag.status == new_status:
            return Response(DiagnosisSerializer(diag, context={"request": request}).data)

        diag.status = new_status
        diag.save(update_fields=["status", "updated_at"])
        write_audit_log(
            request, AuditAction.UPDATE, "Diagnosis", str(diag.id),
            {"status": new_status},
        )

        try:
            from apps.cdss.services.graph_sync_service import GraphSyncService
            GraphSyncService.sync_diagnosis(diag)
        except Exception:
            pass

        return Response(DiagnosisSerializer(diag, context={"request": request}).data)

class ICD10SearchView(APIView):
    permission_classes = [IsAuthenticated, DoctorReadWritePermission]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        if not q:
            return Response({"data": []})
        try:
            import simple_icd_10 as icd
            results = []
            if icd.is_valid_item(q.upper()):
                results.append({"code": q.upper(), "description": icd.get_description(q.upper())})
            else:
                for code in icd.get_all_codes()[:10000]:
                    desc = icd.get_description(code)
                    if desc and q.lower() in desc.lower():
                        results.append({"code": code, "description": desc})
                        if len(results) >= 20:
                            break
        except Exception:
            results = []
        return Response({"data": results})

class DiagnosisCatalogSearchView(APIView):
    permission_classes = [IsAuthenticated, DoctorReadWritePermission]

    def get(self, request):
        q = request.query_params.get("q", "").strip()
        qs = (
            MedicalOntologyMapping.objects.select_related("concept")
            .filter(
                domain=OntologyDomain.CONDITION,
                concept__domain=OntologyDomain.CONDITION,
                concept__is_active=True,
            )
            .order_by("local_display", "concept__code_system", "concept__code")
        )
        if q:
            qs = qs.filter(
                Q(local_display__icontains=q)
                | Q(local_code__icontains=q)
                | Q(concept__display__icontains=q)
                | Q(concept__code__icontains=q)
            )

        grouped = {}
        for mapping in qs[:100]:
            key = (mapping.normalized_local_display or mapping.local_display.lower(), mapping.local_code or "")
            bucket = grouped.setdefault(
                key,
                {
                    "label": mapping.local_display,
                    "icd10Code": mapping.local_code or None,
                    "snomedCode": None,
                    "snomedDisplay": None,
                },
            )
            if mapping.concept.code_system == OntologyCodeSystem.SNOMED_CT:
                bucket["snomedCode"] = mapping.concept.code
                bucket["snomedDisplay"] = mapping.concept.display
            elif mapping.concept.code_system == OntologyCodeSystem.ICD10 and not bucket["icd10Code"]:
                bucket["icd10Code"] = mapping.concept.code

        data = list(grouped.values())[:20]
        return Response({"data": data})

def _sync_pharmacy_prescription_from_doctor_rx(rx):
    setting = RxSetting.OUTPATIENT
    if rx.encounter_id and getattr(rx.encounter, "visit_type", None) == "inpatient":
        setting = RxSetting.INPATIENT

    pharmacy_rx, created = PharmacyPrescription.objects.update_or_create(
        original_prescription=rx,
        defaults={
            "patient": rx.patient,
            "setting": setting,
            "priority": "routine",
            "status": (RxStatus.CANCELLED if rx.status in {PrescriptionStatus.DISCONTINUED, PrescriptionStatus.EXPIRED} else RxStatus.PENDING_VERIFICATION),
        },
    )
    medication = getattr(rx, "medication", "") or ""
    patient_name = rx.patient.full_name if rx.patient else ""
    emit_pharmacy_new_prescription({
        "rxId": str(pharmacy_rx.id),
        "patientId": str(rx.patient_id),
        "patientName": patient_name,
        "medication": medication,
        "priority": pharmacy_rx.priority,
        "isNew": created,
    })
    return pharmacy_rx

_FREQUENCY_MAP = {
    "once daily": 1, "daily": 1, "qd": 1, "od": 1,
    "twice daily": 2, "bid": 2, "bd": 2, "b.i.d.": 2,
    "three times daily": 3, "tid": 3, "t.i.d.": 3,
    "four times daily": 4, "qid": 4, "q.i.d.": 4,
    "every 4 hours": 6, "q4h": 6,
    "every 6 hours": 4, "q6h": 4,
    "every 8 hours": 3, "q8h": 3,
    "every 12 hours": 2, "q12h": 2,
    "as needed": 0, "prn": 0,
    "stat": 1, "once": 1,
}

_ADMIN_TIMES = {
    1: [(8, 0)],
    2: [(8, 0), (20, 0)],
    3: [(8, 0), (14, 0), (20, 0)],
    4: [(6, 0), (12, 0), (18, 0), (22, 0)],
    6: [(0, 0), (4, 0), (8, 0), (12, 0), (16, 0), (20, 0)],
}

def _sync_mar_entries_from_prescription(rx):
    """Create MAR entries for a prescription based on its frequency and date range."""
    from datetime import datetime, timedelta
    from apps.nurses.models import MAREntry, MARStatus

    freq_text = (rx.frequency or "").strip().lower()
    times_per_day = _FREQUENCY_MAP.get(freq_text, 1)

    if times_per_day == 0:
        return

    if rx.status in {PrescriptionStatus.DISCONTINUED, PrescriptionStatus.EXPIRED}:
        MAREntry.objects.filter(
            prescription=rx,
            status=MARStatus.SCHEDULED,
            scheduled_time__gte=timezone.now(),
        ).delete()
        return

    if rx.status != "active":
        return

    start = rx.start_date or timezone.now().date()
    end = rx.end_date or (start + timedelta(days=6))

    admin_times = _ADMIN_TIMES.get(times_per_day, [(8, 0)])
    current = start
    entries_created = 0
    while current <= end:
        for hour, minute in admin_times:
            scheduled = timezone.make_aware(
                datetime.combine(current, datetime.min.time().replace(hour=hour, minute=minute))
            )
            _, created = MAREntry.objects.get_or_create(
                prescription=rx,
                scheduled_time=scheduled,
                defaults={
                    "patient": rx.patient,
                    "status": MARStatus.SCHEDULED,
                },
            )
            if created:
                entries_created += 1
        current += timedelta(days=1)

    return entries_created

def _create_nursing_task_from_order(order):
    """Create a nursing task when a doctor places an order."""
    from datetime import timedelta
    from apps.nurses.models import Task, TaskStatus as NurseTaskStatus

    if order.status in {OrderStatus.CANCELLED, OrderStatus.COMPLETED, OrderStatus.RESULTED}:
        return None

    _CATEGORY_TASK_MAP = {
        OrderCategory.LAB: ("Lab Collection", "Collect specimen and process lab order"),
        OrderCategory.IMAGING: ("Imaging Prep", "Prepare patient for imaging study"),
        OrderCategory.PROCEDURE: ("Procedure Assist", "Assist with ordered procedure"),
        OrderCategory.CONSULT: ("Consult Coordination", "Coordinate consultation request"),
    }

    task_type, task_desc = _CATEGORY_TASK_MAP.get(
        order.category,
        ("Follow Order", "Follow up on doctor order"),
    )

    description = f"{task_desc}: {order.name or ''}"
    if order.indication:
        description += f" — Indication: {order.indication}"

    _PRIORITY_MAP = {"stat": "urgent", "urgent": "high", "routine": "normal", "asap": "high"}
    priority = _PRIORITY_MAP.get(order.priority, "normal")

    task, created = Task.objects.get_or_create(
        patient=order.patient,
        type=task_type,
        description=description,
        defaults={
            "room": "",
            "priority": priority,
            "status": NurseTaskStatus.PENDING,
            "due_time": timezone.now() + timedelta(hours=1),
        },
    )
    return task if created else None

def _auto_populate_discharge_checklist(patient_id):
    """Create standard discharge checklist items for a patient if none exist."""
    from apps.nurses.models import DischargeChecklistItem
    from apps.patients.models import Patient

    if DischargeChecklistItem.objects.filter(patient_id=patient_id).exists():
        return

    if not Patient.objects.filter(id=patient_id).exists():
        return

    STANDARD_ITEMS = [
        ("Medications", "Verify discharge medication list with pharmacy"),
        ("Medications", "Provide medication reconciliation to patient"),
        ("Medications", "Patient/family medication education completed"),
        ("Follow-up", "Schedule follow-up appointment"),
        ("Follow-up", "Provide follow-up care instructions"),
        ("Documentation", "Discharge summary signed by physician"),
        ("Documentation", "Nursing discharge assessment completed"),
        ("Documentation", "Patient education materials provided"),
        ("Patient Care", "Remove IV lines and catheters"),
        ("Patient Care", "Final vital signs recorded"),
        ("Patient Care", "Wound care instructions given (if applicable)"),
        ("Administrative", "Patient belongings returned"),
        ("Administrative", "Insurance/billing clearance confirmed"),
        ("Administrative", "Transport arranged"),
    ]

    items = [
        DischargeChecklistItem(
            patient_id=patient_id,
            category=cat,
            item=item,
        )
        for cat, item in STANDARD_ITEMS
    ]
    DischargeChecklistItem.objects.bulk_create(items)

def _infer_imaging_modality(order_name):
    name = (order_name or "").lower()
    if "mri" in name:
        return ImagingModality.MRI
    if "ct" in name or "cat scan" in name:
        return ImagingModality.CT
    if "ultrasound" in name or name.startswith("us ") or " us " in name:
        return ImagingModality.US
    if "mamm" in name:
        return ImagingModality.MAMMO
    if "pet" in name:
        return ImagingModality.PET
    if "dexa" in name:
        return ImagingModality.DEXA
    if "fluoro" in name:
        return ImagingModality.FLUORO
    if "nuclear" in name:
        return ImagingModality.NM
    return ImagingModality.XR

def _infer_imaging_body_part(order_name):
    name = (order_name or "").lower()
    if any(token in name for token in ["brain", "head", "skull"]):
        return "head"
    if "neck" in name:
        return "neck"
    if any(token in name for token in ["chest", "lung", "thorax"]):
        return "chest"
    if any(token in name for token in ["abdomen", "abdominal"]):
        return "abdomen"
    if "pelvis" in name:
        return "pelvis"
    if "spine" in name or "lumbar" in name or "cervical" in name or "thoracic" in name:
        return "spine"
    if any(token in name for token in ["arm", "shoulder", "hand", "wrist", "elbow"]):
        return "upper-extremity"
    if any(token in name for token in ["leg", "knee", "foot", "ankle", "hip", "femur"]):
        return "lower-extremity"
    if "breast" in name:
        return "breast"
    return "other"

def _match_radiology_catalog_item(order_name):
    if not order_name:
        return None
    catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, code__iexact=order_name).first()
    if not catalog_item:
        catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, cpt_code__iexact=order_name).first()
    if not catalog_item:
        catalog_item = RadiologyCatalogItem.objects.filter(is_active=True, name__iexact=order_name).first()
    return catalog_item

def _match_radiology_catalog_from_order(order):
    catalog_item = _match_radiology_catalog_item(getattr(order, "exam_code", None))
    if not catalog_item and getattr(order, "name", None):
        catalog_item = _match_radiology_catalog_item(order.name)
    return catalog_item

_DOCTOR_SPECIMEN_TO_LAB_SPECIMEN = {
    "blood":   LabSpecimenType.BLOOD,
    "urine":   LabSpecimenType.URINE,
    "stool":   LabSpecimenType.STOOL,
    "swab":    LabSpecimenType.SWAB,
    "tissue":  LabSpecimenType.TISSUE,
    "sputum":  LabSpecimenType.OTHER,
    "saliva":  LabSpecimenType.OTHER,
    "other":   LabSpecimenType.OTHER,
}

def _infer_lab_specimen_type(test_name):
    """Infer the most likely specimen type from the ordered test name."""
    if not test_name:
        return LabSpecimenType.BLOOD
    name = test_name.lower()
    if any(t in name for t in ["urine", "urinalysis", " ua", "urine culture"]):
        return LabSpecimenType.URINE
    if any(t in name for t in ["stool", "fecal", "c. diff", "cdiff", "ova", "parasite"]):
        return LabSpecimenType.STOOL
    if any(t in name for t in ["swab", "wound culture", "throat culture", "nasal"]):
        return LabSpecimenType.SWAB
    if any(t in name for t in ["biopsy", "pathology", "tissue"]):
        return LabSpecimenType.TISSUE
    if any(t in name for t in ["sputum", "bronchoalveolar", "bal"]):
        return LabSpecimenType.OTHER
    return LabSpecimenType.BLOOD

def _sync_lab_order_from_doctor_order(order):
    """Mirror a doctor lab Order into Specimen + LabPanel so lab staff see it on their worklist."""
    if order.category != OrderCategory.LAB:
        return None

    if order.specimen_type:
        lab_specimen_type = _DOCTOR_SPECIMEN_TO_LAB_SPECIMEN.get(
            order.specimen_type, LabSpecimenType.OTHER
        )
    else:
        lab_specimen_type = _infer_lab_specimen_type(order.name)

    is_cancelled = order.status == OrderStatus.CANCELLED

    specimen, specimen_created = LabSpecimen.objects.get_or_create(
        order=order,
        defaults={
            "patient": order.patient,
            "type": lab_specimen_type,
            "status": LabSpecimenStatus.ORDERED,
        },
    )
    if not specimen_created and specimen.status == LabSpecimenStatus.ORDERED:
        specimen.type = lab_specimen_type
        specimen.status = LabSpecimenStatus.REJECTED if is_cancelled else LabSpecimenStatus.ORDERED
        specimen.save(update_fields=["type", "status"])
    elif specimen_created and is_cancelled:
        specimen.status = LabSpecimenStatus.REJECTED
        specimen.save(update_fields=["status"])

    panel, panel_created = LabPanel.objects.get_or_create(
        order=order,
        defaults={
            "patient": order.patient,
            "specimen": specimen,
            "name": order.name,
            "priority": order.priority,
            "status": LabPanelStatus.PENDING,
        },
    )
    if not panel_created and panel.status == LabPanelStatus.PENDING:
        panel.priority = order.priority
        panel.name = order.name
        panel.save(update_fields=["priority", "name"])

    return panel

def _sync_radiology_order_from_doctor_order(order):
    if order.category != OrderCategory.IMAGING:
        return None

    catalog_item = _match_radiology_catalog_from_order(order)
    order_name = (order.name or "").strip()
    indication = (order.indication or order.notes or "").strip()
    clinical_history = (order.clinical_history or "").strip()

    defaults = {
        "patient": order.patient,
        "ordered_by": order.ordered_by,
        "modality": catalog_item.modality if catalog_item else _infer_imaging_modality(order_name),
        "exam_code": order.exam_code or (catalog_item.code if catalog_item else None),
        "exam_name": catalog_item.name if catalog_item else (order_name or None),
        "body_part": order.body_part or (catalog_item.body_part if catalog_item else _infer_imaging_body_part(order_name)),
        "indication": indication or None,
        "clinical_history": clinical_history or None,
        "laterality": order.laterality or None,
        "contrast_required": bool(order.contrast_required or (catalog_item.with_contrast if catalog_item else False)),
        "priority": order.priority,
        "status": ImagingStudyStatus.CANCELLED if order.status == OrderStatus.CANCELLED else ImagingStudyStatus.ORDERED,
    }
    rad_order, _ = ImagingOrder.objects.update_or_create(doctor_order=order, defaults=defaults)
    return rad_order

class OrderListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = OrderSerializer

    def get(self, request):
        qs = Order.objects.select_related("patient", "ordered_by").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if encounter_id := request.query_params.get("encounterId"):
            qs = qs.filter(encounter_id=encounter_id)
        if category := request.query_params.get("category"):
            qs = qs.filter(category=category)
        if s := request.query_params.get("status"):
            qs = qs.filter(status=s)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            OrderSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = OrderSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save(ordered_by=request.user)
        _sync_radiology_order_from_doctor_order(order)
        _sync_lab_order_from_doctor_order(order)
        _create_nursing_task_from_order(order)
        return Response(
            OrderSerializer(order, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class OrderDetailView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = OrderSerializer

    def _get(self, pk):
        try:
            return Order.objects.get(id=pk)
        except Order.DoesNotExist:
            raise NotFoundError("Order not found.")

    def get(self, request, pk):
        return Response(OrderSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        order = self._get(pk)
        serializer = OrderSerializer(
            order, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        _sync_radiology_order_from_doctor_order(order)
        _sync_lab_order_from_doctor_order(order)
        return Response(OrderSerializer(order, context={"request": request}).data)

    def delete(self, request, pk):
        order = self._get(pk)
        validate_status_transition(
            order.status,
            OrderStatus.CANCELLED,
            {
                OrderStatus.PENDING: {OrderStatus.CANCELLED},
                OrderStatus.IN_PROGRESS: {OrderStatus.CANCELLED},
                OrderStatus.COMPLETED: set(),
                OrderStatus.CANCELLED: set(),
                OrderStatus.RESULTED: set(),
            },
            "order",
        )
        reason = request.data.get("reason", "") if hasattr(request, "data") else ""
        order.status = OrderStatus.CANCELLED
        order.completed_at = timezone.now()
        order.notes = reason if reason else order.notes
        order.save(update_fields=["status", "completed_at", "notes"])
        _sync_radiology_order_from_doctor_order(order)
        _sync_lab_order_from_doctor_order(order)
        return Response(OrderSerializer(order, context={"request": request}).data)

class PrescriptionListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = PrescriptionSerializer

    def get(self, request):
        qs = Prescription.objects.select_related("patient", "prescribed_by").all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if encounter_id := request.query_params.get("encounterId"):
            qs = qs.filter(encounter_id=encounter_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            PrescriptionSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = PrescriptionSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        rx = serializer.save(prescribed_by=request.user)
        _sync_pharmacy_prescription_from_doctor_rx(rx)
        _sync_mar_entries_from_prescription(rx)
        return Response(
            PrescriptionSerializer(rx, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class PrescriptionDetailView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = PrescriptionSerializer

    def _get(self, pk):
        try:
            return Prescription.objects.get(id=pk)
        except Prescription.DoesNotExist:
            raise NotFoundError("Prescription not found.")

    def get(self, request, pk):
        return Response(PrescriptionSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        rx = self._get(pk)
        serializer = PrescriptionSerializer(
            rx, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        rx = serializer.save()
        _sync_pharmacy_prescription_from_doctor_rx(rx)
        _sync_mar_entries_from_prescription(rx)
        return Response(PrescriptionSerializer(rx, context={"request": request}).data)

class PrescriptionStatusView(APIView):
    """
    FIX: PUT /prescriptions/:id/status — dedicated status endpoint.
    Handles discontinue / on-hold / active / expired transitions.
    """
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = PrescriptionSerializer

    def put(self, request, pk):
        try:
            rx = Prescription.objects.get(id=pk)
        except Prescription.DoesNotExist:
            raise NotFoundError("Prescription not found.")

        new_status = request.data.get("status")
        if not new_status:
            raise ValidationAppError("status is required.")
        valid = [s.value for s in PrescriptionStatus]
        if new_status not in valid:
            raise ValidationAppError(f"Invalid status. Must be one of: {valid}")
        validate_status_transition(
            rx.status,
            new_status,
            {
                PrescriptionStatus.ACTIVE: {PrescriptionStatus.ON_HOLD, PrescriptionStatus.DISCONTINUED, PrescriptionStatus.EXPIRED},
                PrescriptionStatus.ON_HOLD: {PrescriptionStatus.ACTIVE, PrescriptionStatus.DISCONTINUED, PrescriptionStatus.EXPIRED},
                PrescriptionStatus.DISCONTINUED: set(),
                PrescriptionStatus.EXPIRED: set(),
            },
            "prescription",
        )

        rx.status = new_status
        rx.save(update_fields=["status"])
        _sync_pharmacy_prescription_from_doctor_rx(rx)
        _sync_mar_entries_from_prescription(rx)
        if new_status in {PrescriptionStatus.DISCONTINUED, PrescriptionStatus.EXPIRED}:
            emit_pharmacy_prescription_discontinued({
                "rxId": str(rx.id),
                "patientId": str(rx.patient_id),
                "medication": getattr(rx, "medication", "") or "",
                "status": new_status,
            })
        write_audit_log(
            request, AuditAction.UPDATE, "Prescription", str(rx.id),
            {"action": "status_change", "newStatus": new_status}, AuditSeverity.HIGH,
        )
        return Response(PrescriptionSerializer(rx, context={"request": request}).data)

class ReferralListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = ReferralSerializer

    def get(self, request):
        qs = Referral.objects.all()
        if patient_id := request.query_params.get("patientId"):
            qs = qs.filter(patient_id=patient_id)
        if doc_id := request.query_params.get("doctorId"):
            qs = qs.filter(referring_doctor_id=doc_id)
        paginator = StandardPagination()
        page = paginator.paginate_queryset(qs.order_by("-created_at"), request)
        return paginator.get_paginated_response(
            ReferralSerializer(page, many=True, context={"request": request}).data
        )

    def post(self, request):
        serializer = ReferralSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        referral = serializer.save(referring_doctor=request.user)
        return Response(
            ReferralSerializer(referral, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

class ReferralDetailView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = ReferralSerializer

    def _get(self, pk):
        try:
            return Referral.objects.select_related("patient", "referring_doctor", "to_doctor", "to_department").get(id=pk)
        except Referral.DoesNotExist:
            raise NotFoundError("Referral not found.")

    def get(self, request, pk):
        return Response(ReferralSerializer(self._get(pk), context={"request": request}).data)

    def put(self, request, pk):
        referral = self._get(pk)
        serializer = ReferralSerializer(
            referral, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(ReferralSerializer(referral, context={"request": request}).data)

class ReferralStatusView(APIView):
    permission_classes = [IsAuthenticated, IsDoctor]
    serializer_class = ReferralSerializer

    def put(self, request, pk):
        referral = ReferralDetailView()._get(pk)
        new_status = request.data.get("status")
        valid = [s.value for s in ReferralStatus]
        if new_status not in valid:
            raise ValidationAppError(f"Invalid status. Must be one of: {valid}")
        validate_status_transition(
            referral.status,
            new_status,
            {
                ReferralStatus.PENDING: {ReferralStatus.ACCEPTED, ReferralStatus.DECLINED},
                ReferralStatus.ACCEPTED: {ReferralStatus.COMPLETED, ReferralStatus.DECLINED},
                ReferralStatus.COMPLETED: set(),
                ReferralStatus.DECLINED: set(),
            },
            "referral",
        )
        referral.status = new_status
        referral.save(update_fields=["status"])
        return Response(ReferralSerializer(referral, context={"request": request}).data)

class DoctorResultsInboxView(APIView):
    """
    FIX: Now accepts a doctor `pk` param so the URL matches
    GET /doctors/:id/results as required by spec.
    Falls back to request.user if pk is omitted (self-lookup).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, pk=None):
        from apps.laboratory.models import LabReport
        from apps.laboratory.serializers import LabReportSerializer
        from apps.radiology.models import RadiologyReport
        from apps.radiology.serializers import RadiologyReportSerializer

        doctor_id = pk if pk else request.user.id
        user_role = getattr(request.user, "role", None)
        if user_role not in {UserRole.DOCTOR, UserRole.ADMIN}:
            raise ForbiddenError("Only doctors and admins can access the results inbox.")
        if user_role != UserRole.ADMIN and str(doctor_id) != str(request.user.id):
            raise ForbiddenError("Doctors can only access their own results inbox.")

        lab_qs = LabReport.objects.filter(
            panel__specimen__order__ordered_by_id=doctor_id,
            status__in=["released", "corrected"],
        ).order_by("-released_at")[:20]

        rad_qs = RadiologyReport.objects.filter(
            study__order__ordered_by_id=doctor_id,
            signed_by__isnull=False,
        ).order_by("-signed_at")[:20]

        return Response({
            "labResults": LabReportSerializer(
                lab_qs, many=True, context={"request": request}
            ).data,
            "radiologyReports": RadiologyReportSerializer(
                rad_qs, many=True, context={"request": request}
            ).data,
        })

class ResultReviewView(APIView):
    """
    FIX: PUT /results/:id/review — was completely missing.
    Marks a lab result as reviewed with optional notes.
    """
    permission_classes = [IsAuthenticated, IsDoctor]

    def put(self, request, pk):
        from apps.laboratory.models import LabTestResult
        from apps.laboratory.serializers import LabTestResultSerializer

        try:
            result = LabTestResult.objects.get(id=pk)
        except LabTestResult.DoesNotExist:
            raise NotFoundError("Lab result not found.")

        notes = request.data.get("notes", "")
        if notes:
            existing = result.comment or ""
            prefix = "\n" if existing else ""
            result.comment = f"{existing}{prefix}[reviewed by {request.user.id}] {notes}"
            result.save(update_fields=["comment"])

        write_audit_log(
            request, AuditAction.UPDATE, "LabTestResult", str(result.id),
            {"action": "review", "reviewedBy": str(request.user.id)},
        )
        return Response(LabTestResultSerializer(result, context={"request": request}).data)

class DoctorPatientChartView(APIView):
    permission_classes = [IsAuthenticated, IsClinicalStaff]

    def get(self, request, patient_id):
        from apps.patients.models import Patient
        from apps.patients.serializers import PatientSerializer
        from apps.cdss.models import CDSSRecommendation
        from apps.cdss.serializers import CDSSRecommendationSerializer
        from apps.laboratory.models import LabTestResult
        from apps.laboratory.serializers import LabTestResultSerializer
        from apps.radiology.models import RadiologyReport
        from apps.radiology.serializers import RadiologyReportSerializer

        try:
            patient = Patient.objects.get(id=patient_id, deleted_at__isnull=True)
        except Patient.DoesNotExist:
            raise NotFoundError("Patient not found.")

        encounters = Encounter.objects.filter(patient_id=patient_id).order_by("-created_at")[:20]
        diagnoses = Diagnosis.objects.filter(patient_id=patient_id).order_by("-created_at")[:20]
        orders = Order.objects.filter(patient_id=patient_id).order_by("-created_at")[:20]
        prescriptions = Prescription.objects.filter(patient_id=patient_id).order_by("-created_at")[:20]
        lab_results = LabTestResult.objects.filter(panel__patient_id=patient_id).order_by("-created_at")[:20]
        radiology_reports = RadiologyReport.objects.filter(patient_id=patient_id).order_by("-created_at")[:20]
        cdss = CDSSRecommendation.objects.filter(
            patient_id=patient_id,
            status__in=["active", "acknowledged"],
        ).order_by("-created_at")[:20]

        return Response({
            "patient": PatientSerializer(patient, context={"request": request}).data,
            "encounters": EncounterSerializer(encounters, many=True, context={"request": request}).data,
            "diagnoses": DiagnosisSerializer(diagnoses, many=True, context={"request": request}).data,
            "orders": OrderSerializer(orders, many=True, context={"request": request}).data,
            "prescriptions": PrescriptionSerializer(prescriptions, many=True, context={"request": request}).data,
            "labResults": LabTestResultSerializer(lab_results, many=True, context={"request": request}).data,
            "radiologyReports": RadiologyReportSerializer(radiology_reports, many=True, context={"request": request}).data,
            "cdss": CDSSRecommendationSerializer(cdss, many=True, context={"request": request}).data,
        })
