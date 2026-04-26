"""
Laboratory module serializers.
"""

from rest_framework import serializers
from core.standards import is_valid_loinc
from .models import (
    Specimen, Accession, AnalyzerQueue, LabPanel,
    LabTestResult, LabReport, CriticalValue,
)


ANALYZER_QUEUE_STATUS_TO_API = {
    "pending": "queued",
    "in-progress": "running",
    "completed": "completed",
    "error": "error",
}
ANALYZER_QUEUE_STATUS_FROM_API = {
    "queued": "pending",
    "loading": "pending",
    "running": "in-progress",
    "completed": "completed",
    "error": "error",
}
LAB_PANEL_STATUS_TO_API = {
    "pending": "pending",
    "in-progress": "partial",
    "resulted": "complete",
    "verified": "verified",
    "released": "released",
}
LAB_PANEL_STATUS_FROM_API = {
    "pending": "pending",
    "partial": "in-progress",
    "complete": "resulted",
    "verified": "verified",
    "released": "released",
}
LAB_REPORT_STATUS_TO_API = {
    "pending": "draft",
    "preliminary": "preliminary",
    "final": "final",
    "released": "final",
    "corrected": "amended",
    "amended": "amended",
}
LAB_REPORT_STATUS_FROM_API = {
    "draft": "pending",
    "preliminary": "preliminary",
    "final": "final",
    "amended": "amended",
    "cancelled": "corrected",
}


def accession_status_for_api(instance):
    if instance.specimen.recollect_reason:
        return "recollect-requested"
    if instance.specimen.rejection_reason:
        return "rejected"
    return "accessioned"


class SpecimenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specimen
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "collected_by", "received_by"]
        extra_kwargs = {"patient": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        order = attrs.get("order", getattr(self.instance, "order", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if order and not patient:
            attrs["patient"] = order.patient
            patient = order.patient
        if order and patient and order.patient_id != patient.id:
            raise serializers.ValidationError({"patient": "Specimen patient must match the selected order patient."})
        return attrs

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "orderId": str(instance.order_id) if instance.order_id else None,
            "collectedById": str(instance.collected_by_id) if instance.collected_by_id else None,
            "collectedByName": instance.collected_by.get_full_name() if instance.collected_by_id else None,
            "type": instance.type,
            "tubeType": instance.tube_type,
            "volume": float(instance.volume) if instance.volume is not None else None,
            "barcode": instance.barcode,
            "storageLocation": instance.storage_location,
            "collectedAt": instance.collected_at.isoformat() if instance.collected_at else None,
            "receivedAt": instance.received_at.isoformat() if instance.received_at else None,
            "receivedById": str(instance.received_by_id) if instance.received_by_id else None,
            "status": instance.status,
            "condition": instance.condition,
            "rejectionReason": instance.rejection_reason,
            "recollectReason": instance.recollect_reason,
            "createdAt": instance.created_at.isoformat(),
            "testNames": self._get_test_names(instance),
        }

    @staticmethod
    def _get_test_names(instance):
        try:
            acc = instance.accession
            return acc.test_names or []
        except Exception:
            return []


class AccessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Accession
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "accession_number", "received_by"]

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "accessionNumber": instance.accession_number,
            "specimenId": str(instance.specimen_id),
            "patientId": str(instance.specimen.patient_id),
            "patientName": instance.specimen.patient.full_name,
            "mrn": instance.specimen.patient.mrn,
            "specimenType": instance.specimen.type,
            "receivedAt": instance.created_at.isoformat(),
            "receivedById": str(instance.received_by_id) if instance.received_by_id else None,
            "receivedBy": instance.received_by.get_full_name() if instance.received_by_id else None,
            "receivedByName": instance.received_by.get_full_name() if instance.received_by_id else None,
            "condition": instance.condition,
            "testNames": instance.test_names,
            "status": accession_status_for_api(instance),
            "notes": instance.specimen.rejection_reason or instance.specimen.recollect_reason,
            "createdAt": instance.created_at.isoformat(),
        }


class AnalyzerQueueSerializer(serializers.ModelSerializer):
    class Meta:
        model = AnalyzerQueue
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_status(self, value):
        return ANALYZER_QUEUE_STATUS_FROM_API.get(value, value)

    def to_representation(self, instance):
        test_names = []
        try:
            test_names = instance.specimen.accession.test_names or []
        except Exception:
            pass
        return {
            "id": str(instance.id),
            "specimenId": str(instance.specimen_id),
            "specimenBarcode": instance.specimen.barcode,
            "patientName": instance.specimen.patient.full_name,
            "testName": test_names[0] if test_names else None,
            "priority": getattr(instance.specimen.order, "priority", "routine") if instance.specimen.order_id else "routine",
            "queuePosition": None,
            "estimatedMinutes": instance.estimated_minutes,
            "instrument": instance.instrument,
            "status": ANALYZER_QUEUE_STATUS_TO_API.get(instance.status, instance.status),
            "backendStatus": instance.status,
            "startedAt": instance.started_at.isoformat() if instance.started_at else None,
            "completedAt": instance.completed_at.isoformat() if instance.completed_at else None,
            "errorMessage": instance.error_message,
            "createdAt": instance.created_at.isoformat(),
        }


class LabPanelSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabPanel
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "verified_by", "verified_at"]
        extra_kwargs = {"patient": {"required": False}}

    def validate_status(self, value):
        return LAB_PANEL_STATUS_FROM_API.get(value, value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        specimen = attrs.get("specimen", getattr(self.instance, "specimen", None))
        order = attrs.get("order", getattr(self.instance, "order", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        linked_patient = specimen.patient if specimen else (order.patient if order else None)
        if linked_patient and not patient:
            attrs["patient"] = linked_patient
            patient = linked_patient
        if linked_patient and patient and linked_patient.id != patient.id:
            raise serializers.ValidationError({"patient": "Lab panel patient must match the linked specimen or order patient."})
        if order and not attrs.get("name") and not getattr(self.instance, "name", None):
            attrs["name"] = order.name
        return attrs

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "code": instance.order.exam_code if instance.order_id else None,
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "orderId": str(instance.order_id) if instance.order_id else None,
            "specimenId": str(instance.specimen_id),
            "name": instance.name,
            "orderedBy": instance.order.ordered_by.get_full_name() if instance.order_id and instance.order.ordered_by_id else None,
            "orderedAt": instance.order.created_at.isoformat() if instance.order_id and instance.order.created_at else None,
            "status": LAB_PANEL_STATUS_TO_API.get(instance.status, instance.status),
            "backendStatus": instance.status,
            "priority": instance.priority,
            "hasCritical": instance.has_critical,
            "turnaroundMinutes": None,
            "verifiedById": str(instance.verified_by_id) if instance.verified_by_id else None,
            "verifiedByName": instance.verified_by.get_full_name() if instance.verified_by_id else None,
            "verifiedAt": instance.verified_at.isoformat() if instance.verified_at else None,
            "createdAt": instance.created_at.isoformat(),
        }


class LabPanelWithResultsSerializer(LabPanelSerializer):
    """Extended serializer that includes results inline."""

    def to_representation(self, instance):
        data = super().to_representation(instance)
        results = instance.results.all()
        data["results"] = LabTestResultSerializer(results, many=True).data
        return data


class LabTestResultSerializer(serializers.ModelSerializer):
    testCode = serializers.CharField(source="test_code")

    class Meta:
        model = LabTestResult
        fields = "__all__"
        read_only_fields = ["id", "created_at", "updated_at", "verified_by", "verified_at", "is_critical"]
        extra_kwargs = {"specimen": {"required": False}}

    def validate_testCode(self, value):
        code = value.strip()
        if not is_valid_loinc(code):
            raise serializers.ValidationError("testCode must be a valid LOINC code.")
        return code

    def validate(self, attrs):
        attrs = super().validate(attrs)
        panel = attrs.get("panel", getattr(self.instance, "panel", None))
        specimen = attrs.get("specimen", getattr(self.instance, "specimen", None))
        if panel and not specimen and panel.specimen_id:
            attrs["specimen"] = panel.specimen
        return attrs

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "panelId": str(instance.panel_id),
            "specimenId": str(instance.specimen_id) if instance.specimen_id else None,
            "patientId": str(instance.panel.patient_id) if getattr(instance, "panel_id", None) else None,
            "patientName": instance.panel.patient.full_name if getattr(instance, "panel_id", None) else None,
            "testCode": instance.test_code,
            "testName": instance.test_name,
            "value": instance.value,
            "unit": instance.unit,
            "referenceRange": instance.reference_range,
            "flag": instance.flag,
            "isCritical": instance.is_critical,
            "previousValue": instance.previous_value,
            "delta": instance.delta,
            "deltaFlag": instance.delta_flag,
            "method": instance.method,
            "comment": instance.comment,
            "analyzedAt": instance.analyzed_at.isoformat() if instance.analyzed_at else None,
            "status": instance.status,
            "verifiedById": str(instance.verified_by_id) if instance.verified_by_id else None,
            "verifiedByName": instance.verified_by.get_full_name() if instance.verified_by_id else None,
            "verifiedAt": instance.verified_at.isoformat() if instance.verified_at else None,
            "createdAt": instance.created_at.isoformat(),
        }


class LabReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabReport
        fields = "__all__"
        read_only_fields = [
            "id", "created_at", "updated_at",
            "released_by", "released_at",
            "corrected_at",
        ]
        extra_kwargs = {"patient": {"required": False}}

    def validate_status(self, value):
        return LAB_REPORT_STATUS_FROM_API.get(value, value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        panel = attrs.get("panel", getattr(self.instance, "panel", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if panel and not patient:
            attrs["patient"] = panel.patient
            patient = panel.patient
        if panel and patient and panel.patient_id != patient.id:
            raise serializers.ValidationError({"patient": "Lab report patient must match the selected panel patient."})
        if panel:
            attrs.setdefault("has_critical", panel.has_critical)
        return attrs

    def to_representation(self, instance):
        panel = instance.panel
        order = panel.order if panel else None
        results = list(panel.results.all()) if panel else []
        has_critical = bool(
            instance.has_critical
            or (panel.has_critical if panel else False)
            or any(
                result.is_critical or result.flag in ("critical-high", "critical-low")
                for result in results
            )
        )
        # Find critical notification info from CriticalValue records
        critical_notified_to = None
        critical_notified_at = None
        if has_critical:
            try:
                from .models import CriticalValue
                cv = CriticalValue.objects.filter(
                    result__panel=panel, notified_to__isnull=False
                ).order_by("-notified_at").first()
                if cv:
                    critical_notified_to = cv.notified_to
                    critical_notified_at = cv.notified_at
            except Exception:
                pass
        return {
            "id": str(instance.id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "mrn": instance.patient.mrn if hasattr(instance, "patient") else None,
            "panelId": str(instance.panel_id),
            "panelName": panel.name if panel else None,
            "results": LabTestResultSerializer(results, many=True).data,
            "orderedBy": order.ordered_by.get_full_name() if order and order.ordered_by_id else None,
            "orderedAt": order.created_at.isoformat() if order and order.created_at else None,
            "authorizedBy": instance.released_by.get_full_name() if instance.released_by_id else None,
            "authorizedAt": instance.released_at.isoformat() if instance.released_at else None,
            "status": LAB_REPORT_STATUS_TO_API.get(instance.status, instance.status),
            "backendStatus": instance.status,
            "hasCritical": has_critical,
            "criticalNotifiedTo": critical_notified_to,
            "criticalNotifiedAt": critical_notified_at.isoformat() if critical_notified_at else None,
            "notes": instance.notes,
            "releasedById": str(instance.released_by_id) if instance.released_by_id else None,
            "releasedByName": instance.released_by.get_full_name() if instance.released_by_id else None,
            "releasedAt": instance.released_at.isoformat() if instance.released_at else None,
            "correctedAt": instance.corrected_at.isoformat() if instance.corrected_at else None,
            "correctionNote": instance.correction_note,
            "attachmentUrl": instance.attachment_url,
            "createdAt": instance.created_at.isoformat(),
        }


class CriticalValueSerializer(serializers.ModelSerializer):
    class Meta:
        model = CriticalValue
        fields = "__all__"
        read_only_fields = [
            "id", "created_at", "updated_at",
            "acknowledged_by", "acknowledged_at",
        ]
        extra_kwargs = {"patient": {"required": False}, "test_name": {"required": False}, "value": {"required": False}}

    def validate(self, attrs):
        attrs = super().validate(attrs)
        result = attrs.get("result", getattr(self.instance, "result", None))
        patient = attrs.get("patient", getattr(self.instance, "patient", None))
        if result:
            if not patient:
                attrs["patient"] = result.panel.patient
                patient = result.panel.patient
            if patient and result.panel.patient_id != patient.id:
                raise serializers.ValidationError({"patient": "Critical value patient must match the selected result patient."})
            attrs.setdefault("test_name", result.test_name)
            attrs.setdefault("value", result.value)
            attrs.setdefault("unit", result.unit)
        return attrs

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "resultId": str(instance.result_id),
            "patientId": str(instance.patient_id),
            "patientName": instance.patient.full_name if hasattr(instance, "patient") else None,
            "testName": instance.test_name,
            "value": instance.value,
            "unit": instance.unit,
            "status": instance.status,
            "notifiedTo": instance.notified_to,
            "notifiedAt": instance.notified_at.isoformat() if instance.notified_at else None,
            "notificationMethod": instance.notification_method,
            "callbackTime": instance.callback_time.isoformat() if instance.callback_time else None,
            "readbackProvided": instance.readback_provided,
            "acknowledgedById": str(instance.acknowledged_by_id) if instance.acknowledged_by_id else None,
            "acknowledgedByName": instance.acknowledged_by.get_full_name() if instance.acknowledged_by_id else None,
            "acknowledgedAt": instance.acknowledged_at.isoformat() if instance.acknowledged_at else None,
            "createdAt": instance.created_at.isoformat(),
        }
