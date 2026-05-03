"""
PharmacyCDSSService
===================
Connects the pharmacy workflow to the Neo4j Knowledge Graph and MedGemma
for automated drug safety checking and AI-powered clinical decision support.

Three capabilities:
  1. run_kg_safety_check()  — query Neo4j DDI / allergy / risk-group alerts
  2. persist_kg_safety_alerts() — write DrugWarning + CDSSRecommendation records
  3. ai_consult()            — call MedGemma with a pharmacy-domain system prompt
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def _map_ddi_severity_to_warning(severity: str) -> str:
    """Map KG DDI severity to DrugWarning.severity choices."""
    return {
        "contraindicated": "contraindicated",
        "major": "severe",
        "moderate": "moderate",
        "minor": "info",
    }.get(severity, "moderate")


def _map_warning_severity_to_cdss(severity: str) -> str:
    return {
        "contraindicated": "critical",
        "severe": "critical",
        "moderate": "warning",
        "info": "info",
    }.get(severity, "warning")


class PharmacyCDSSService:

    # ------------------------------------------------------------------
    # 1. KG Drug Safety Check (read-only)
    # ------------------------------------------------------------------

    @staticmethod
    def run_kg_safety_check(
        patient_uuid: str,
        new_drug_name: str | None = None,
    ) -> dict:
        """
        Run a full KG-based drug safety check for a patient.

        If *new_drug_name* is provided the results are filtered to alerts
        that involve that specific drug — useful at prescription-verify time.

        Returns:
            {
              ddi_alerts: list,
              allergy_alerts: list,
              risk_group_alerts: list,
              has_contraindications: bool,
              has_critical: bool,
              total_alerts: int,
            }
        """
        from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService

        ddi_alerts = DrugKnowledgeService.get_patient_ddi_alerts(patient_uuid)
        allergy_alerts = DrugKnowledgeService.get_patient_allergy_drug_alerts(patient_uuid)
        risk_alerts = DrugKnowledgeService.get_patient_risk_group_alerts(patient_uuid)

        if new_drug_name:
            dl = new_drug_name.lower()
            ddi_alerts = [
                a for a in ddi_alerts
                if dl in a["drug_a"].lower() or dl in a["drug_b"].lower()
            ]
            allergy_alerts = [
                a for a in allergy_alerts
                if dl in a["prescribed_medication"].lower()
            ]
            risk_alerts = [
                a for a in risk_alerts
                if any(dl in d.lower() for d in a.get("involved_drugs", []))
            ]

        has_contraindications = any(
            a.get("severity") == "contraindicated" for a in ddi_alerts
        )
        has_critical = has_contraindications or bool(allergy_alerts)

        return {
            "ddi_alerts": ddi_alerts,
            "allergy_alerts": allergy_alerts,
            "risk_group_alerts": risk_alerts,
            "has_contraindications": has_contraindications,
            "has_critical": has_critical,
            "total_alerts": len(ddi_alerts) + len(allergy_alerts) + len(risk_alerts),
        }

    # ------------------------------------------------------------------
    # 2. Persist alerts as DrugWarning + CDSS recommendations
    # ------------------------------------------------------------------

    @staticmethod
    def persist_kg_safety_alerts(
        patient_id,
        safety_check: dict,
        prescription=None,
    ) -> list:
        """
        Persist KG-detected drug safety alerts as DrugWarning records and
        fire CDSSRecommendation records via the pharmacy → CDSS pipeline.

        Duplicate-safe: skips alerts for medication pairs that already have
        an unresolved DrugWarning to avoid alert fatigue.
        """
        from apps.pharmacy.models import DrugWarning
        from apps.cdss.models import CDSSRecommendation, CDSSRecommendationType
        from core.websockets import emit_cdss_new_recommendation

        def _fire_cdss(w):
            cdss_severity = _map_warning_severity_to_cdss(w.severity)
            rec_type = (
                CDSSRecommendationType.ALLERGY
                if w.type == "allergy"
                else CDSSRecommendationType.DRUG_INTERACTION
            )
            rec = CDSSRecommendation.objects.create(
                patient_id=patient_id,
                source_module="pharmacy",
                triggered_by="pharmacy_kg_safety_check",
                type=rec_type,
                title=f"KG Drug Safety Alert: {w.type.replace('-', ' ').title()}",
                summary=w.message,
                explanation={
                    "warningId": str(w.id),
                    "medications": w.medications_involved,
                    "severity": w.severity,
                    "source": "neo4j_knowledge_graph",
                },
                severity=cdss_severity,
                target_roles=["doctor", "pharmacist"],
            )
            try:
                emit_cdss_new_recommendation(
                    {
                        "recommendationId": str(rec.id),
                        "id": str(rec.id),
                        "patientId": str(patient_id),
                        "type": rec_type,
                        "severity": rec.severity,
                        "title": rec.title,
                        "summary": rec.summary,
                        "targetRoles": rec.target_roles,
                    },
                    target_roles=rec.target_roles,
                )
            except Exception:
                pass  # WebSocket is non-critical

        created: list = []

        # DDI alerts
        for alert in safety_check["ddi_alerts"]:
            meds = sorted([alert["drug_a"], alert["drug_b"]])
            if DrugWarning.objects.filter(
                patient_id=patient_id,
                type="interaction",
                medications_involved=meds,
                resolved=False,
            ).exists():
                continue
            sev = _map_ddi_severity_to_warning(alert.get("severity", "moderate"))
            message = (
                f"Drug interaction: {alert['drug_a']} + {alert['drug_b']}. "
                f"{alert.get('description', '')} "
                f"Management: {alert.get('management', '')} "
                f"[Evidence: {alert.get('evidence_level', '?')}]"
            ).strip()
            w = DrugWarning.objects.create(
                prescription=prescription,
                patient_id=patient_id,
                type="interaction",
                severity=sev,
                message=message,
                medications_involved=meds,
            )
            _fire_cdss(w)
            created.append(w)

        # Allergy cross-reactivity alerts
        for alert in safety_check["allergy_alerts"]:
            if DrugWarning.objects.filter(
                patient_id=patient_id,
                type="allergy",
                medications_involved__contains=[alert["prescribed_medication"]],
                resolved=False,
            ).exists():
                continue
            message = (
                f"Allergy cross-reactivity: Patient is allergic to "
                f"{alert['allergen']} ({alert['allergen_group']}). "
                f"Prescribed {alert['prescribed_medication']} belongs to the same "
                f"allergen group. Possible reactions: {alert.get('reaction_types', 'unknown')}"
            )
            w = DrugWarning.objects.create(
                prescription=prescription,
                patient_id=patient_id,
                type="allergy",
                severity="contraindicated",
                message=message,
                medications_involved=[alert["prescribed_medication"], alert["allergen"]],
            )
            _fire_cdss(w)
            created.append(w)

        # Risk group alerts
        for alert in safety_check["risk_group_alerts"]:
            meds = sorted(alert.get("involved_drugs", []))
            if DrugWarning.objects.filter(
                patient_id=patient_id,
                type="interaction",
                medications_involved=meds,
                resolved=False,
            ).exists():
                continue
            sev = _map_ddi_severity_to_warning(alert.get("severity", "major"))
            drug_list = ", ".join(meds)
            message = (
                f"Pharmacological risk group — {alert['interaction_group']}: "
                f"Patient is prescribed {drug_list}. "
                f"{alert.get('description', '')} "
                f"Management: {alert.get('management', '')}"
            ).strip()
            w = DrugWarning.objects.create(
                prescription=prescription,
                patient_id=patient_id,
                type="interaction",
                severity=sev,
                message=message,
                medications_involved=meds,
            )
            _fire_cdss(w)
            created.append(w)

        logger.info(
            "PharmacyCDSSService persisted %d KG safety alerts for patient %s",
            len(created), patient_id,
        )
        return created

    # ------------------------------------------------------------------
    # 3. Pharmacy AI Consult (MedGemma + KG)
    # ------------------------------------------------------------------

    @staticmethod
    def ai_consult(
        patient_uuid: str,
        query: str,
        drug_name: str | None = None,
    ) -> str:
        """
        MedGemma-powered pharmacy CDSS consult.

        Builds a pharmacy-domain system + user prompt grounded in:
          - Patient's Neo4j subgraph (diagnoses, meds, allergies, labs)
          - Drug safety context from the KG (DDI, allergy, risk-group alerts)
          - Drug under review (if provided)
        """
        from apps.cdss.services.graph_service import GraphService
        from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService
        from apps.cdss.services.ai_service import _call_llm

        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)

        logger.info(
            "Pharmacy AI consult — patient %s | drug: %s | graph %d chars",
            patient_uuid, drug_name or "(none)", len(graph_context),
        )

        system = (
            "You are an expert clinical pharmacist AI embedded in a hospital Clinical Decision "
            "Support System (CDSS). Your role is evidence-based pharmacotherapy decision support.\n\n"
            "Responsibilities:\n"
            "- Detect and explain drug-drug interactions, allergy cross-reactivity, "
            "and pharmacological risk-group co-prescribing issues.\n"
            "- Suggest clinically appropriate alternatives or dose adjustments.\n"
            "- Flag CRITICAL any contraindicated drug combinations.\n"
            "- Consider renal/hepatic adjustments if lab data is present.\n"
            "- Request any missing data explicitly rather than guessing.\n"
            "- NEVER fabricate diagnoses, medications, or lab values not in the provided context."
        )

        drug_focus = f"\nDrug under review: {drug_name}\n" if drug_name else ""
        user = (
            "=== Patient Knowledge Graph Context ===\n"
            f"{graph_context}\n\n"
            "=== Drug Safety Analysis (Knowledge Graph) ===\n"
            f"{drug_safety_context}\n"
            f"{drug_focus}\n"
            "=== Pharmacist Query ===\n"
            f"{query}"
        )

        return _call_llm(system, user)
