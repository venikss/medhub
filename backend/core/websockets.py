"""
WebSocket broadcast utilities — Redis pub/sub adapter.
All events: { event: string, payload: object, timestamp: ISO8601 }
"""

import logging
from datetime import datetime, timezone
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

logger = logging.getLogger(__name__)

def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).isoformat()

def _normalize_payload(event: str, payload: dict | None) -> dict:
    payload = dict(payload or {})

    if event in {"lab.result_released", "lab.critical_result"}:
        result_id = payload.get("resultId") or payload.get("reportId")
        payload.setdefault("resultId", result_id)
        payload.setdefault("reportId", payload.get("reportId") or result_id)
        if payload.get("patientName"):
            default_message = f"Lab result ready for {payload['patientName']}."
            if event == "lab.critical_result":
                default_message = f"Critical lab result for {payload['patientName']}."
            payload.setdefault("message", default_message)

    elif event == "cdss.new_recommendation":
        recommendation_id = payload.get("recommendationId") or payload.get("id")
        payload.setdefault("id", recommendation_id)
        payload.setdefault("recommendationId", recommendation_id)
        payload.setdefault(
            "message",
            payload.get("summary")
            or payload.get("title")
            or "New clinical recommendation.",
        )

    elif event == "cdss.recommendation_updated":
        recommendation_id = payload.get("recommendationId") or payload.get("id")
        payload.setdefault("id", recommendation_id)
        payload.setdefault("recommendationId", recommendation_id)
        payload.setdefault(
            "message",
            payload.get("summary")
            or payload.get("title")
            or "Clinical recommendation updated.",
        )

    elif event == "adt.admission" and payload.get("patientName"):
        payload.setdefault("message", f"{payload['patientName']} has been admitted.")
    elif event == "adt.discharge" and payload.get("patientName"):
        payload.setdefault("message", f"{payload['patientName']} has been discharged.")
    elif event == "radiology.report_signed" and payload.get("patientName"):
        payload.setdefault("message", f"Radiology report signed for {payload['patientName']}.")
    elif event == "radiology.critical_finding" and payload.get("patientName"):
        payload.setdefault("message", f"Critical radiology finding for {payload['patientName']}.")
    elif event == "pharmacy.rx_verified":
        payload.setdefault("message", "Prescription verified by pharmacy.")
    elif event == "pharmacy.rx_dispensed":
        payload.setdefault("message", "Medication dispensed by pharmacy.")
    elif event == "pharmacy.new_prescription":
        med = payload.get("medication", "a medication")
        patient = payload.get("patientName", "a patient")
        payload.setdefault("message", f"New prescription for {patient}: {med}.")
    elif event == "pharmacy.rx_rejected":
        med = payload.get("medication", "a medication")
        reason = payload.get("reason", "no reason given")
        payload.setdefault("message", f"Prescription for {med} was rejected: {reason}")
    elif event == "pharmacy.rx_on_hold":
        med = payload.get("medication", "a medication")
        reason = payload.get("reason", "no reason given")
        payload.setdefault("message", f"Prescription for {med} put on hold: {reason}")
    elif event == "pharmacy.intervention_created":
        med = payload.get("medication", "a medication")
        note = payload.get("note", "Pharmacist raised a concern.")
        payload.setdefault("message", f"Pharmacist intervention on {med}: {note}")
    elif event == "pharmacy.substitution_proposed":
        original = payload.get("originalMedication", "the original")
        suggested = payload.get("suggestedMedication", "an alternative")
        payload.setdefault("message", f"Pharmacist suggests substituting {original} with {suggested}.")
    elif event == "pharmacy.rx_cancelled":
        med = payload.get("medication", "a medication")
        reason = payload.get("reason", "no reason given")
        payload.setdefault("message", f"Prescription for {med} was cancelled by pharmacy: {reason}")
    elif event == "pharmacy.prescription_discontinued":
        med = payload.get("medication", "a medication")
        payload.setdefault("message", f"Doctor discontinued {med}.")
    elif event == "pharmacy.substitution_approved":
        suggested = payload.get("suggestedMedication", "the substitute")
        payload.setdefault("message", f"Substitution approved: use {suggested}.")
    elif event == "pharmacy.substitution_rejected":
        original = payload.get("originalMedication", "the medication")
        payload.setdefault("message", f"Substitution for {original} was rejected.")

    return payload

def broadcast(group: str, event: str, payload: dict):
    """
    Broadcast a WebSocket event to a channel group via Redis pub/sub.
    Safe to call from synchronous (non-async) code.
    """
    try:
        channel_layer = get_channel_layer()
        normalized_payload = _normalize_payload(event, payload)
        message = {
            "type": "ws.message",
            "event": event,
            "payload": normalized_payload,
            "timestamp": _now_iso(),
        }
        async_to_sync(channel_layer.group_send)(group, message)
    except Exception as exc:
        logger.error("WebSocket broadcast failed [%s / %s]: %s", group, event, exc)

ROLE_GROUP_MAP = {
    "admin":         "role_admin",
    "doctor":        "role_doctor",
    "nurse":         "role_nurse",
    "lab_tech":      "role_lab_tech",
    "radiologist":   "role_radiologist",
    "pharmacist":    "role_pharmacist",
    "billing_staff": "role_billing_staff",
    "front_desk":    "role_front_desk",
    "patient":       "role_patient",
}

def broadcast_to_roles(roles: list | None, event: str, payload: dict):
    """Send an event to multiple role groups."""
    for role in roles or []:
        group = ROLE_GROUP_MAP.get(role)
        if group:
            broadcast(group, event, payload)

def broadcast_to_user(user_id: str, event: str, payload: dict):
    """Send an event to a specific user group."""
    broadcast(f"user_{user_id}", event, payload)

def emit_cdss_new_recommendation(payload: dict, user_id: str = None, target_roles: list | None = None):
    if user_id:
        broadcast_to_user(user_id, "cdss.new_recommendation", payload)
    else:
        roles = target_roles or payload.get("targetRoles") or payload.get("target_roles")
        if not roles:
            roles = ["doctor", "nurse", "lab_tech", "radiologist", "pharmacist"]
        broadcast_to_roles(roles, "cdss.new_recommendation", payload)

def emit_cdss_recommendation_updated(payload: dict, user_id: str = None, target_roles: list | None = None):
    if user_id:
        broadcast_to_user(user_id, "cdss.recommendation_updated", payload)
    else:
        roles = target_roles or payload.get("targetRoles") or payload.get("target_roles")
        if not roles:
            roles = ["doctor", "nurse", "lab_tech", "radiologist", "pharmacist"]
        broadcast_to_roles(roles, "cdss.recommendation_updated", payload)

def emit_lab_critical_result(payload: dict, user_id: str = None):
    if user_id:
       broadcast_to_user(user_id, "lab.critical_result", payload)
    else:
       broadcast_to_roles(["doctor", "nurse", "lab_tech"], "lab.critical_result", payload)

def emit_lab_result_released(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "lab.result_released", payload)
    else:
        broadcast_to_roles(["doctor"], "lab.result_released", payload)

def emit_radiology_critical_finding(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "radiology.critical_finding", payload)
    else:
        broadcast_to_roles(["doctor", "nurse", "radiologist"], "radiology.critical_finding", payload)

def emit_radiology_report_signed(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "radiology.report_signed", payload)
    else:
        broadcast_to_roles(["doctor"], "radiology.report_signed", payload)

def emit_adt_admission(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "adt.admission", payload)
    else:
        broadcast_to_roles(["doctor", "nurse", "front_desk"], "adt.admission", payload)

def emit_adt_discharge(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "adt.discharge", payload)
    else:
        broadcast_to_roles(["doctor", "nurse", "front_desk"], "adt.discharge", payload)

def emit_adt_bed_available(payload: dict):
    broadcast_to_roles(["front_desk", "nurse"], "adt.bed_available", payload)

def emit_queue_ticket_called(payload: dict, patient_id: str = None):
    broadcast_to_roles(["front_desk"], "queue.ticket_called", payload)
    if patient_id:
        broadcast(f"patient_{patient_id}", "queue.ticket_called", payload)

def emit_pharmacy_rx_verified(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "pharmacy.rx_verified", payload)
    else:
        broadcast_to_roles(["doctor", "nurse"], "pharmacy.rx_verified", payload)

def emit_pharmacy_rx_dispensed(payload: dict, user_id: str = None):
    if user_id:
        broadcast_to_user(user_id, "pharmacy.rx_dispensed", payload)
    else:
        broadcast_to_roles(["nurse"], "pharmacy.rx_dispensed", payload)

def emit_pharmacy_new_prescription(payload: dict):
    """Notify pharmacists when a doctor creates or updates a prescription."""
    broadcast_to_roles(["pharmacist"], "pharmacy.new_prescription", payload)

def emit_pharmacy_rx_rejected(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor that their Rx was rejected."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.rx_rejected", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.rx_rejected", payload)

def emit_pharmacy_rx_on_hold(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor that their Rx was put on hold."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.rx_on_hold", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.rx_on_hold", payload)

def emit_pharmacy_intervention_created(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor of a new pharmacist intervention."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.intervention_created", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.intervention_created", payload)

def emit_pharmacy_substitution_proposed(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor that a substitution has been proposed."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.substitution_proposed", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.substitution_proposed", payload)

def emit_pharmacy_rx_cancelled(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor that pharmacy cancelled their Rx."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.rx_cancelled", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.rx_cancelled", payload)

def emit_pharmacy_prescription_discontinued(payload: dict):
    """Notify pharmacists when a doctor discontinues or expires a prescription."""
    broadcast_to_roles(["pharmacist"], "pharmacy.prescription_discontinued", payload)

def emit_pharmacy_substitution_approved(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor that their substitution was approved."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.substitution_approved", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.substitution_approved", payload)

def emit_pharmacy_substitution_rejected(payload: dict, prescriber_id: str = None):
    """Notify the prescribing doctor that their substitution was rejected."""
    if prescriber_id:
        broadcast_to_user(prescriber_id, "pharmacy.substitution_rejected", payload)
    else:
        broadcast_to_roles(["doctor"], "pharmacy.substitution_rejected", payload)
