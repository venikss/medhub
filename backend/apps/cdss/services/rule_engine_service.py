from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import re
from typing import Any

from django.utils import timezone

from apps.cdss.models import (
    CDSSOutputKind,
    CDSSRecommendation,
    CDSSRecommendationType,
    CDSSSeverity,
    CDSSSourceModule,
    CDSSStatus,
)
from apps.cdss.services.graph_service import GraphService
from apps.patients.models import Patient


@dataclass
class RuleResult:
    source_module: str
    rec_type: str
    severity: str
    title: str
    summary: str
    triggered_by: str
    target_roles: list[str]
    suggested_actions: list[str]
    explanation: dict[str, Any]
    evidence_sources: list[dict[str, Any]]
    affected_medications: list[str]
    output_kind: str = CDSSOutputKind.ALERT
    snomed_code: str | None = None
    snomed_display: str | None = None


class GraphRuleEngineService:
    """
    Hybrid rule engine:
    - Uses relational clinical data for current workflow state
    - Uses knowledge graph snapshot for longitudinal coded context
    - Persists deduplicated CDSSRecommendation rows
    """

    FOLLOW_UP_PATTERN = re.compile(r"\b(follow[\s-]?up|repeat|surveillance|re[- ]?image|recommended?)\b", re.I)
    DIABETES_PATTERN = re.compile(r"\b(diabetes|dm|e11)\b", re.I)
    HYPERTENSION_PATTERN = re.compile(r"\b(hypertension|htn|i10)\b", re.I)
    CKD_PATTERN = re.compile(r"\b(ckd|chronic kidney|renal impairment|n18)\b", re.I)

    @classmethod
    def run_for_patient(cls, patient_id: str | Any, persist: bool = True) -> dict[str, Any]:
        patient = Patient.objects.get(id=patient_id)
        snapshot = cls._build_snapshot(patient)
        generated = cls._evaluate(snapshot)

        if persist:
            persisted = [cls._upsert_recommendation(patient, result) for result in generated]
        else:
            persisted = generated

        return {
            "patientId": str(patient.id),
            "generatedCount": len(generated),
            "recommendations": persisted,
            "graphSnapshot": snapshot["graph"],
        }

    @classmethod
    def _build_snapshot(cls, patient: Patient) -> dict[str, Any]:
        from apps.doctors.models import Diagnosis, Prescription, DiagnosisStatus, PrescriptionStatus
        from apps.laboratory.models import CriticalValue, LabTestResult, LabResultFlag
        from apps.nurses.models import Task, TaskStatus, Vitals
        from apps.pharmacy.models import PharmacyPrescription, RxStatus
        from apps.radiology.models import RadCriticalFinding, RadCriticalFindingStatus, RadiologyReport

        graph = GraphService.get_patient_structured_snapshot(str(patient.id))

        diagnoses = list(
            Diagnosis.objects.filter(patient=patient).order_by("-created_at")
        )
        active_prescriptions = list(
            Prescription.objects.filter(patient=patient, status=PrescriptionStatus.ACTIVE).order_by("-created_at")
        )
        pharmacy_prescriptions = list(
            PharmacyPrescription.objects.select_related("original_prescription").filter(
                patient=patient,
                status__in=[
                    RxStatus.ORDERED,
                    RxStatus.PENDING_VERIFICATION,
                    RxStatus.VERIFIED,
                    RxStatus.DISPENSING,
                    RxStatus.DISPENSED,
                ],
            )
        )
        latest_vitals = Vitals.objects.filter(patient=patient).order_by("-recorded_at").first()
        overdue_tasks = list(
            Task.objects.filter(patient=patient, status=TaskStatus.OVERDUE).order_by("due_time")
        )
        critical_values = list(
            CriticalValue.objects.select_related("result").filter(patient=patient).exclude(status="acknowledged")
        )
        recent_results = list(
            LabTestResult.objects.filter(panel__patient=patient).select_related("panel").order_by("-created_at")[:20]
        )
        urgent_findings = list(
            RadCriticalFinding.objects.filter(patient=patient).exclude(status=RadCriticalFindingStatus.ACKNOWLEDGED)
        )
        recent_reports = list(
            RadiologyReport.objects.filter(patient=patient).select_related("study__order").order_by("-created_at")[:10]
        )

        return {
            "patient": patient,
            "graph": graph,
            "diagnoses": diagnoses,
            "active_prescriptions": active_prescriptions,
            "pharmacy_prescriptions": pharmacy_prescriptions,
            "latest_vitals": latest_vitals,
            "overdue_tasks": overdue_tasks,
            "critical_values": critical_values,
            "recent_results": recent_results,
            "urgent_findings": urgent_findings,
            "recent_reports": recent_reports,
        }

    @classmethod
    def _evaluate(cls, snapshot: dict[str, Any]) -> list[RuleResult]:
        results: list[RuleResult] = []
        results.extend(cls._doctor_rules(snapshot))
        results.extend(cls._pharmacy_rules(snapshot))
        results.extend(cls._lab_rules(snapshot))
        results.extend(cls._radiology_rules(snapshot))
        results.extend(cls._nursing_rules(snapshot))
        return results

    @classmethod
    def _doctor_rules(cls, snapshot: dict[str, Any]) -> list[RuleResult]:
        graph_diagnoses = snapshot["graph"]["diagnoses"]
        graph_meds = snapshot["graph"]["medications"]
        diagnosis_text = " | ".join(
            filter(
                None,
                [d.description for d in snapshot["diagnoses"]] + [item.get("name") for item in graph_diagnoses],
            )
        )
        med_names = [
            *(med.medication for med in snapshot["active_prescriptions"]),
            *(item.get("name") for item in graph_meds if item.get("name")),
        ]
        results: list[RuleResult] = []

        if cls.DIABETES_PATTERN.search(diagnosis_text) and cls.HYPERTENSION_PATTERN.search(diagnosis_text):
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.DOCTOR,
                    rec_type=CDSSRecommendationType.RISK_SCORE,
                    severity=CDSSSeverity.WARNING,
                    title="Cardiometabolic risk cluster identified",
                    summary=(
                        "The patient has graph-linked evidence of diabetes and hypertension. "
                        "This combination increases cardiovascular and renal risk and should drive tighter follow-up."
                    ),
                    triggered_by="knowledge_graph_problem_list",
                    target_roles=["doctor", "nurse"],
                    affected_medications=[],
                    suggested_actions=[
                        "Review blood pressure and glycemic targets at the current encounter.",
                        "Confirm lipid-lowering therapy and renal monitoring plan.",
                        "Consider structured follow-up for cardiovascular risk reduction.",
                    ],
                    explanation={
                        "summary": "A combined diabetes + hypertension pattern was found in the longitudinal coded problem list.",
                        "reasoning": [
                            "Knowledge graph contains diabetes-linked diagnosis nodes.",
                            "Knowledge graph contains hypertension-linked diagnosis nodes.",
                            "Combined burden indicates higher end-organ risk than either condition alone.",
                        ],
                        "clinicalInputs": [
                            {"label": "Diagnoses in graph", "value": diagnosis_text or "Not available", "flag": "high"},
                            {"label": "Graph diagnosis count", "value": str(len(graph_diagnoses))},
                        ],
                        "limitations": [
                            "This rule does not yet incorporate HbA1c, LDL, or blood pressure trend severity.",
                        ],
                        "confidence": "moderate",
                        "confidenceScore": 82,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-cardiometabolic-cluster",
                            "title": "Graph rule: diabetes + hypertension composite risk",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        has_diabetes = cls.DIABETES_PATTERN.search(diagnosis_text)
        has_statin = any("statin" in (name or "").lower() or "atorvastatin" in (name or "").lower() or "rosuvastatin" in (name or "").lower() for name in med_names)
        if has_diabetes and not has_statin:
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.DOCTOR,
                    rec_type=CDSSRecommendationType.CARE_GAP,
                    severity=CDSSSeverity.INFO,
                    title="Diabetes medication plan lacks visible statin therapy",
                    summary="Diabetes is present in the coded problem list, but a statin is not visible in the active medication context.",
                    triggered_by="graph_problem_medication_gap",
                    target_roles=["doctor", "pharmacist"],
                    affected_medications=[],
                    suggested_actions=[
                        "Review whether lipid-lowering therapy is already intended but not active.",
                        "Assess cardiovascular risk and document the statin plan.",
                        "Clarify contraindications or prior intolerance if no statin is chosen.",
                    ],
                    explanation={
                        "summary": "A diabetes-coded problem was found without a visible statin in the active medication list.",
                        "reasoning": [
                            "The diagnosis graph includes diabetes-related coding.",
                            "No statin medication was matched in the active medication context.",
                        ],
                        "clinicalInputs": [
                            {"label": "Diagnoses in graph", "value": diagnosis_text or "Not available", "flag": "high"},
                            {"label": "Visible medications", "value": ", ".join(sorted(set(filter(None, med_names)))) or "None recorded"},
                        ],
                        "limitations": [
                            "This rule does not yet account for documented statin intolerance or external medication history.",
                        ],
                        "confidence": "moderate",
                        "confidenceScore": 74,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-diabetes-statin-gap",
                            "title": "Rule: diabetes problem list without visible statin therapy",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        latest_egfr = cls._extract_latest_numeric_result(snapshot["recent_results"], ["egfr", "glomerular filtration"])
        has_ckd = bool(cls.CKD_PATTERN.search(diagnosis_text))
        nsaid_names = sorted({name for name in med_names if cls._is_nsaid(name)})
        if has_ckd and nsaid_names and latest_egfr is not None and latest_egfr < 60:
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.DOCTOR,
                    rec_type=CDSSRecommendationType.CARE_GAP,
                    severity=CDSSSeverity.WARNING if latest_egfr >= 30 else CDSSSeverity.CRITICAL,
                    title="CKD with active NSAID exposure requires review",
                    summary=(
                        f"Chronic kidney disease context is present and eGFR is {latest_egfr:g} mL/min/1.73m2 while "
                        f"{', '.join(nsaid_names[:2])} appears active."
                    ),
                    triggered_by="graph_diagnosis_plus_medication_plus_lab_rule",
                    target_roles=["doctor", "pharmacist", "nurse"],
                    affected_medications=nsaid_names[:5],
                    suggested_actions=[
                        "Review whether the NSAID is still necessary given the renal risk.",
                        "Consider a safer analgesic strategy and document the rationale.",
                        "Repeat renal monitoring if continued exposure is unavoidable.",
                    ],
                    explanation={
                        "summary": "The rule combined CKD-coded context, active NSAID exposure, and current renal function.",
                        "reasoning": [
                            "The diagnosis context includes chronic kidney disease or renal impairment.",
                            f"Latest extracted eGFR is {latest_egfr:g}.",
                            f"Active medication context includes {', '.join(nsaid_names[:3])}.",
                        ],
                        "clinicalInputs": [
                            {"label": "eGFR", "value": f"{latest_egfr:g} mL/min/1.73m2", "flag": "critical" if latest_egfr < 30 else "high"},
                            {"label": "NSAID exposure", "value": ", ".join(nsaid_names[:3]), "flag": "high"},
                        ],
                        "limitations": [
                            "This rule does not yet account for temporary supervised NSAID use or external medication history.",
                        ],
                        "confidence": "moderate",
                        "confidenceScore": 83,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-ckd-nsaid",
                            "title": "Rule: CKD context with active NSAID exposure",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )
        return results

    @classmethod
    def _pharmacy_rules(cls, snapshot: dict[str, Any]) -> list[RuleResult]:
        patient = snapshot["patient"]
        allergies = patient.allergies or []
        graph_meds = snapshot["graph"]["medications"]
        active_prescriptions = snapshot["active_prescriptions"]
        results: list[RuleResult] = []
        med_entries = cls._build_medication_entries(active_prescriptions, graph_meds)

        med_names = []
        for med in active_prescriptions:
            med_names.append(med.medication)
        for med in graph_meds:
            if med.get("name"):
                med_names.append(med["name"])

        normalized_groups: dict[str, list[str]] = {}
        for name in med_names:
            key = cls._normalize_medication_name(name)
            normalized_groups.setdefault(key, []).append(name)

        for allergy in allergies:
            allergy_text = allergy if isinstance(allergy, str) else str(allergy.get("substance") or allergy.get("reaction") or allergy)
            for med_name in med_names:
                if allergy_text and med_name and allergy_text.lower() in med_name.lower():
                    results.append(
                        RuleResult(
                            source_module=CDSSSourceModule.PHARMACY,
                            rec_type=CDSSRecommendationType.ALLERGY,
                            severity=CDSSSeverity.CRITICAL,
                            title=f"Allergy conflict: {med_name}",
                            summary=f"Patient allergy list includes '{allergy_text}', which overlaps with active medication '{med_name}'.",
                            triggered_by="patient_allergy_profile",
                            target_roles=["pharmacist", "doctor", "nurse"],
                            affected_medications=[med_name],
                            suggested_actions=[
                                "Hold or review the medication immediately.",
                                "Confirm the allergy history and reaction severity with the patient or chart.",
                                "Choose a safer alternative before administration.",
                            ],
                            explanation={
                                "summary": "Medication safety check matched an active medication against the documented allergy profile.",
                                "reasoning": [
                                    f"Active medication list includes {med_name}.",
                                    f"Patient allergy list includes {allergy_text}.",
                                ],
                                "clinicalInputs": [
                                    {"label": "Allergy", "value": allergy_text, "flag": "critical"},
                                    {"label": "Medication", "value": med_name, "flag": "critical"},
                                ],
                                "limitations": ["String matching may require clinician confirmation for cross-reactivity nuances."],
                                "confidence": "high",
                                "confidenceScore": 95,
                                "modelVersion": "GraphRuleEngine v1",
                            },
                            evidence_sources=[
                                {
                                    "id": "rule-allergy-match",
                                    "title": "Rule: active medication conflicts with documented allergy",
                                    "shortName": "Rule Engine",
                                    "sourceType": "ehr_pattern",
                                    "publishedYear": timezone.now().year,
                                    "evidenceGrade": "Deterministic",
                                }
                            ],
                        )
                    )
                elif cls._allergy_cross_reacts(allergy_text, med_name):
                    results.append(
                        RuleResult(
                            source_module=CDSSSourceModule.PHARMACY,
                            rec_type=CDSSRecommendationType.ALLERGY,
                            severity=CDSSSeverity.CRITICAL,
                            title=f"Potential cross-reactive allergy: {med_name}",
                            summary=f"Documented allergy '{allergy_text}' may cross-react with active medication '{med_name}'.",
                            triggered_by="patient_allergy_cross_reactivity",
                            target_roles=["pharmacist", "doctor", "nurse"],
                            affected_medications=[med_name],
                            suggested_actions=[
                                "Pause dispensing until allergy cross-reactivity is reviewed.",
                                "Confirm the original allergy reaction and its severity.",
                                "Switch to a safer alternative if the allergy is clinically relevant.",
                            ],
                            explanation={
                                "summary": "A medication family cross-reactivity rule matched the documented allergy and active drug.",
                                "reasoning": [
                                    f"Allergy profile includes {allergy_text}.",
                                    f"Medication profile includes {med_name}.",
                                    "The medication belongs to a family commonly treated as cross-reactive with the documented allergy.",
                                ],
                                "clinicalInputs": [
                                    {"label": "Allergy", "value": allergy_text, "flag": "critical"},
                                    {"label": "Medication", "value": med_name, "flag": "critical"},
                                ],
                                "limitations": ["Cross-reactivity rules are conservative and still require clinician confirmation."],
                                "confidence": "moderate",
                                "confidenceScore": 84,
                                "modelVersion": "GraphRuleEngine v1",
                            },
                            evidence_sources=[
                                {
                                    "id": "rule-allergy-cross-reactivity",
                                    "title": "Rule: allergy family cross-reactivity",
                                    "shortName": "Rule Engine",
                                    "sourceType": "ehr_pattern",
                                    "publishedYear": timezone.now().year,
                                    "evidenceGrade": "Deterministic",
                                }
                            ],
                        )
                    )

        for names in normalized_groups.values():
            unique_names = sorted(set(filter(None, names)))
            if len(unique_names) >= 2:
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.PHARMACY,
                        rec_type=CDSSRecommendationType.DUPLICATE_THERAPY,
                        severity=CDSSSeverity.WARNING,
                        title="Possible duplicate therapy detected",
                        summary=f"Multiple active medications appear to represent the same therapy family: {', '.join(unique_names[:3])}.",
                        triggered_by="active_medication_profile",
                        target_roles=["pharmacist", "doctor"],
                        affected_medications=unique_names[:5],
                        suggested_actions=[
                            "Review whether duplicate ordering is intentional.",
                            "Rationalize the regimen to the minimum necessary therapy.",
                            "Clarify administration plan before dispensing or administration.",
                        ],
                        explanation={
                            "summary": "Medication normalization grouped more than one active order into the same therapy bucket.",
                            "reasoning": [f"Grouped medications: {', '.join(unique_names)}"],
                            "clinicalInputs": [
                                {"label": "Grouped medications", "value": ", ".join(unique_names), "flag": "high"},
                            ],
                            "limitations": ["This heuristic uses normalized medication naming and may over-group related products."],
                            "confidence": "moderate",
                            "confidenceScore": 77,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-duplicate-therapy",
                                "title": "Rule: normalized medication duplication",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                    )
                )

        interaction_hits: set[tuple[str, str]] = set()
        for index, left in enumerate(med_entries):
            for right in med_entries[index + 1 :]:
                interaction = cls._match_drug_interaction(left, right)
                if not interaction:
                    continue
                pair_key = tuple(sorted((interaction["left_label"], interaction["right_label"])))
                if pair_key in interaction_hits:
                    continue
                interaction_hits.add(pair_key)
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.PHARMACY,
                        rec_type=CDSSRecommendationType.CONTRAINDICATION
                        if interaction["severity"] == CDSSSeverity.CRITICAL
                        else CDSSRecommendationType.DOSAGE_WARNING,
                        severity=interaction["severity"],
                        title=interaction["title"],
                        summary=interaction["summary"],
                        triggered_by="pharmacy_pairwise_interaction_rule",
                        target_roles=["pharmacist", "doctor", "nurse"],
                        affected_medications=[interaction["left_label"], interaction["right_label"]],
                        suggested_actions=interaction["actions"],
                        explanation={
                            "summary": interaction["reasoning_summary"],
                            "reasoning": interaction["reasoning"],
                            "clinicalInputs": [
                                {"label": "Medication A", "value": interaction["left_label"], "flag": "high"},
                                {"label": "Medication B", "value": interaction["right_label"], "flag": "high"},
                            ],
                            "limitations": [
                                "This first-pass interaction layer is rule-based and not yet a full commercial interaction database.",
                            ],
                            "confidence": "high",
                            "confidenceScore": interaction["confidence"],
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": interaction["id"],
                                "title": interaction["evidence_title"],
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                    )
                )

        latest_egfr = cls._extract_latest_numeric_result(snapshot["recent_results"], ["egfr", "glomerular filtration"])
        latest_inr = cls._extract_latest_numeric_result(snapshot["recent_results"], ["inr"])
        latest_potassium = cls._extract_latest_numeric_result(snapshot["recent_results"], ["potassium"])
        if latest_egfr is not None:
            has_metformin = any("metformin" in (name or "").lower() for name in med_names)
            has_ckd = cls.CKD_PATTERN.search(
                " | ".join(filter(None, [d.description for d in snapshot["diagnoses"]] + [item.get("name") for item in snapshot["graph"]["diagnoses"]]))
            )
            if has_metformin and latest_egfr < 30:
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.PHARMACY,
                        rec_type=CDSSRecommendationType.CONTRAINDICATION,
                        severity=CDSSSeverity.CRITICAL,
                        title="Metformin safety concern with reduced renal function",
                        summary=(
                            f"Latest eGFR is {latest_egfr:g} mL/min/1.73m2 while metformin appears active. "
                            "This combination should be reviewed urgently."
                        ),
                        triggered_by="graph_medication_plus_lab_rule",
                        target_roles=["pharmacist", "doctor"],
                        affected_medications=["Metformin"],
                        suggested_actions=[
                            "Hold or review metformin before further dispensing.",
                            "Confirm the renal function trend and repeat labs if needed.",
                            "Escalate to the prescribing doctor for an alternative plan.",
                        ],
                        explanation={
                            "summary": "The rule combined graph-linked medication context with current renal lab data.",
                            "reasoning": [
                                "Metformin was found in the active medication profile / graph medication list.",
                                f"Latest extracted eGFR is {latest_egfr:g}.",
                                "Renal impairment increases concern for continued metformin exposure.",
                                "CKD context is present in the clinical record." if has_ckd else "CKD diagnosis was not required because the lab threshold itself was sufficient.",
                            ],
                            "clinicalInputs": [
                                {"label": "eGFR", "value": f"{latest_egfr:g}", "flag": "critical"},
                                {"label": "Medication", "value": "Metformin", "flag": "critical"},
                            ],
                            "limitations": ["This rule does not yet incorporate a full medication reconciliation or temporary AKI context."],
                            "confidence": "high",
                            "confidenceScore": 93,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-metformin-egfr",
                                "title": "Rule: metformin with eGFR below safety threshold",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                        )
                )

        if latest_inr is not None and latest_inr > 3.0 and any("warfarin" in (name or "").lower() for name in med_names):
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.PHARMACY,
                    rec_type=CDSSRecommendationType.DOSAGE_WARNING,
                    severity=CDSSSeverity.WARNING if latest_inr < 4.5 else CDSSSeverity.CRITICAL,
                    title="Warfarin monitoring concern with elevated INR",
                    summary=f"Latest INR is {latest_inr:g} while warfarin appears active. The anticoagulation plan should be reviewed.",
                    triggered_by="graph_medication_plus_lab_rule",
                    target_roles=["pharmacist", "doctor", "nurse"],
                    affected_medications=["Warfarin"],
                    suggested_actions=[
                        "Review the current warfarin dose and timing.",
                        "Assess for bleeding symptoms and interacting factors.",
                        "Coordinate repeat INR timing and clinician follow-up.",
                    ],
                    explanation={
                        "summary": "An elevated INR was combined with active warfarin therapy from the medication graph.",
                        "reasoning": [
                            "Warfarin appears in the active medication profile.",
                            f"Latest INR extracted from recent labs is {latest_inr:g}.",
                        ],
                        "clinicalInputs": [
                            {"label": "Medication", "value": "Warfarin", "flag": "high"},
                            {"label": "INR", "value": f"{latest_inr:g}", "flag": "critical" if latest_inr >= 4.5 else "high"},
                        ],
                        "limitations": ["This rule does not yet incorporate target INR range by indication."],
                        "confidence": "high",
                        "confidenceScore": 90,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-warfarin-inr",
                            "title": "Rule: active warfarin with supratherapeutic INR",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        potassium_active_agents = sorted({name for name in med_names if cls._is_ace_or_arb(name)})
        if latest_potassium is not None and latest_potassium >= 5.5 and potassium_active_agents:
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.PHARMACY,
                    rec_type=CDSSRecommendationType.DOSAGE_WARNING,
                    severity=CDSSSeverity.CRITICAL if latest_potassium >= 6.0 else CDSSSeverity.WARNING,
                    title="Hyperkalemia medication review required",
                    summary=(
                        f"Latest potassium is {latest_potassium:g} mmol/L while "
                        f"{', '.join(potassium_active_agents[:2])} appears active."
                    ),
                    triggered_by="graph_medication_plus_lab_rule",
                    target_roles=["pharmacist", "doctor", "nurse"],
                    affected_medications=potassium_active_agents[:5],
                    suggested_actions=[
                        "Review ACE inhibitor/ARB continuation against the current potassium trend.",
                        "Confirm whether potassium-lowering treatment or repeat labs are already planned.",
                        "Escalate promptly if ECG or urgent clinical review is needed.",
                    ],
                    explanation={
                        "summary": "The rule matched elevated potassium with active renin-angiotensin system blockers.",
                        "reasoning": [
                            f"Latest potassium extracted from recent labs is {latest_potassium:g}.",
                            f"Active medication context includes {', '.join(potassium_active_agents[:3])}.",
                        ],
                        "clinicalInputs": [
                            {"label": "Potassium", "value": f"{latest_potassium:g} mmol/L", "flag": "critical" if latest_potassium >= 6.0 else "high"},
                            {"label": "Medication context", "value": ", ".join(potassium_active_agents[:3]), "flag": "high"},
                        ],
                        "limitations": [
                            "This rule does not yet account for the full potassium contributor list or recent medication holds.",
                        ],
                        "confidence": "high",
                        "confidenceScore": 89,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-hyperkalemia-ace-arb",
                            "title": "Rule: elevated potassium with active ACE inhibitor or ARB",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        return results

    @classmethod
    def _lab_rules(cls, snapshot: dict[str, Any]) -> list[RuleResult]:
        results: list[RuleResult] = []
        for critical_value in snapshot["critical_values"]:
            result = critical_value.result
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.LAB,
                    rec_type=CDSSRecommendationType.PANIC_VALUE,
                    severity=CDSSSeverity.CRITICAL,
                    title=f"Critical lab value pending acknowledgement: {critical_value.test_name}",
                    summary=f"{critical_value.test_name} = {critical_value.value} {critical_value.unit or ''}. Immediate clinical acknowledgement is still pending.",
                    triggered_by="critical_value_queue",
                    target_roles=["doctor", "nurse", "lab_tech"],
                    affected_medications=[],
                    suggested_actions=[
                        "Notify or re-notify the responsible clinician.",
                        "Document read-back and acknowledgement status.",
                        "Escalate per critical value policy if unacknowledged.",
                    ],
                    explanation={
                        "summary": "A critical value remains open in the laboratory escalation queue.",
                        "reasoning": [
                            f"Critical value record status is {critical_value.status}.",
                            f"Result: {critical_value.test_name} = {critical_value.value} {critical_value.unit or ''}.",
                        ],
                        "clinicalInputs": [
                            {"label": "Critical value status", "value": critical_value.status, "flag": "critical"},
                            {"label": "Result", "value": f"{critical_value.test_name}: {critical_value.value} {critical_value.unit or ''}", "flag": "critical"},
                        ],
                        "limitations": ["This rule relies on the critical value queue being up to date."],
                        "confidence": "high",
                        "confidenceScore": 96,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-critical-value-open",
                            "title": "Rule: unacknowledged critical value",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        for lab_result in snapshot["recent_results"]:
            if lab_result.delta_flag or lab_result.delta:
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.LAB,
                        rec_type=CDSSRecommendationType.DELTA_CHECK,
                        severity=CDSSSeverity.WARNING,
                        title=f"Delta check review: {lab_result.test_name}",
                        summary=f"{lab_result.test_name} has a recorded delta ({lab_result.delta or lab_result.delta_flag}) that should be clinically reconciled.",
                        triggered_by="laboratory_delta_check",
                        target_roles=["doctor", "lab_tech", "nurse"],
                        affected_medications=[],
                        suggested_actions=[
                            "Confirm whether the change is physiologic or analytic.",
                            "Repeat the test if specimen or analyzer error is suspected.",
                            "Correlate with the patient’s recent treatment and bleeding/infection status.",
                        ],
                        explanation={
                            "summary": "The laboratory record includes a delta indicator that merits review.",
                            "reasoning": [
                                f"Result value: {lab_result.value} {lab_result.unit or ''}.",
                                f"Previous value: {lab_result.previous_value or 'not recorded'}.",
                                f"Delta metadata: {lab_result.delta or lab_result.delta_flag}.",
                            ],
                            "clinicalInputs": [
                                {"label": "Result", "value": f"{lab_result.test_name}: {lab_result.value}", "flag": "high"},
                                {"label": "Previous value", "value": lab_result.previous_value or "Unknown"},
                                {"label": "Delta", "value": lab_result.delta or lab_result.delta_flag or "Flagged", "flag": "high"},
                            ],
                            "limitations": ["This rule does not independently calculate delta magnitude when only text metadata is available."],
                            "confidence": "moderate",
                            "confidenceScore": 80,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-lab-delta",
                                "title": "Rule: laboratory delta check flag",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                        )
                )

            numeric_value = cls._coerce_numeric(lab_result.value)
            test_name = (lab_result.test_name or "").lower()
            if numeric_value is None:
                continue
            if "hemoglobin" in test_name and numeric_value < 8:
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.LAB,
                        rec_type=CDSSRecommendationType.CRITICAL_RESULT,
                        severity=CDSSSeverity.CRITICAL,
                        title="Severe anemia signal from recent hemoglobin",
                        summary=f"Hemoglobin is {numeric_value:g} g/dL, which may require urgent clinical correlation.",
                        triggered_by="laboratory_severity_threshold",
                        target_roles=["doctor", "nurse", "lab_tech"],
                        affected_medications=[],
                        suggested_actions=[
                            "Confirm symptoms, bleeding risk, and hemodynamic stability.",
                            "Escalate to the clinical team if the value is newly severe or falling.",
                            "Correlate with anticoagulation and transfusion planning.",
                        ],
                        explanation={
                            "summary": "The recent hemoglobin crosses a severe anemia threshold.",
                            "reasoning": [
                                f"Hemoglobin value is {numeric_value:g} g/dL.",
                                f"Result flag is {lab_result.flag or 'not specified'}.",
                            ],
                            "clinicalInputs": [
                                {"label": "Hemoglobin", "value": f"{numeric_value:g} g/dL", "flag": "critical"},
                            ],
                            "limitations": ["This rule does not replace local transfusion or bleeding protocols."],
                            "confidence": "high",
                            "confidenceScore": 94,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-hgb-severe",
                                "title": "Rule: severe hemoglobin threshold",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                    )
                )
            if "potassium" in test_name and numeric_value >= 6.0:
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.LAB,
                        rec_type=CDSSRecommendationType.CRITICAL_RESULT,
                        severity=CDSSSeverity.CRITICAL,
                        title="Severe hyperkalemia signal from recent potassium",
                        summary=f"Potassium is {numeric_value:g} mmol/L and requires rapid clinical review.",
                        triggered_by="laboratory_severity_threshold",
                        target_roles=["doctor", "nurse", "lab_tech"],
                        affected_medications=[],
                        suggested_actions=[
                            "Confirm the value and assess for ECG/telemetry escalation.",
                            "Review renal function and medication contributors.",
                            "Ensure the critical value communication loop is complete.",
                        ],
                        explanation={
                            "summary": "The recent potassium crosses a severe hyperkalemia threshold.",
                            "reasoning": [
                                f"Potassium value is {numeric_value:g} mmol/L.",
                                f"Result flag is {lab_result.flag or 'not specified'}.",
                            ],
                            "clinicalInputs": [
                                {"label": "Potassium", "value": f"{numeric_value:g} mmol/L", "flag": "critical"},
                            ],
                            "limitations": ["This rule does not distinguish hemolysis from true hyperkalemia on its own."],
                            "confidence": "high",
                            "confidenceScore": 95,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-k-severe",
                                "title": "Rule: severe potassium threshold",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                    )
                )
        return results

    @classmethod
    def _radiology_rules(cls, snapshot: dict[str, Any]) -> list[RuleResult]:
        results: list[RuleResult] = []
        for finding in snapshot["urgent_findings"]:
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.RADIOLOGY,
                    rec_type=CDSSRecommendationType.URGENT_FINDING,
                    severity=CDSSSeverity.CRITICAL,
                    title="Critical radiology finding awaiting closed-loop follow-through",
                    summary=finding.finding,
                    triggered_by="radiology_critical_findings_queue",
                    target_roles=["doctor", "radiologist", "nurse"],
                    affected_medications=[],
                    suggested_actions=[
                        "Document direct clinician notification if not already complete.",
                        "Confirm acknowledgement and next-step plan.",
                        "Escalate again if the finding remains unacknowledged.",
                    ],
                    explanation={
                        "summary": "A radiology critical finding remains open in the communication workflow.",
                        "reasoning": [
                            f"Finding status is {finding.status}.",
                            f"Severity recorded as {finding.severity}.",
                        ],
                        "clinicalInputs": [
                            {"label": "Finding", "value": finding.finding, "flag": "critical"},
                            {"label": "Workflow status", "value": finding.status, "flag": "critical"},
                        ],
                        "limitations": ["This rule does not judge imaging correctness; it monitors communication closure."],
                        "confidence": "high",
                        "confidenceScore": 94,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-rad-critical-open",
                            "title": "Rule: open radiology critical finding",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        for report in snapshot["recent_reports"]:
            recommendations = report.recommendations or ""
            if recommendations and cls.FOLLOW_UP_PATTERN.search(recommendations):
                exam_name = getattr(getattr(report.study, "order", None), "exam_name", "Radiology study")
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.RADIOLOGY,
                        rec_type=CDSSRecommendationType.FOLLOW_UP_REMINDER,
                        severity=CDSSSeverity.INFO,
                        title=f"Radiology follow-up recommendation documented for {exam_name}",
                        summary=recommendations[:280],
                        triggered_by="radiology_report_recommendations",
                        target_roles=["doctor", "radiologist"],
                        affected_medications=[],
                        suggested_actions=[
                            "Translate the radiology recommendation into a concrete order or appointment.",
                            "Confirm the follow-up plan is documented in the patient record.",
                        ],
                        explanation={
                            "summary": "The report contains follow-up language that should become a tracked next step.",
                            "reasoning": [
                                f"Exam: {exam_name}.",
                                "Recommendation text contains follow-up keywords.",
                            ],
                            "clinicalInputs": [
                                {"label": "Exam", "value": exam_name},
                                {"label": "Recommendation text", "value": recommendations[:180], "flag": "high"},
                            ],
                            "limitations": ["Keyword matching may miss context-specific exceptions or outside follow-up already arranged."],
                            "confidence": "moderate",
                            "confidenceScore": 76,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-rad-followup",
                                "title": "Rule: follow-up language in radiology report",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                    )
                )
        return results

    @classmethod
    def _nursing_rules(cls, snapshot: dict[str, Any]) -> list[RuleResult]:
        results: list[RuleResult] = []
        latest_vitals = snapshot["latest_vitals"]
        if latest_vitals and latest_vitals.news2_score and latest_vitals.news2_score >= 5:
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.NURSING,
                    rec_type=CDSSRecommendationType.DETERIORATION_ALERT,
                    severity=CDSSSeverity.CRITICAL if latest_vitals.news2_score >= 7 else CDSSSeverity.WARNING,
                    title=f"NEWS2 deterioration alert: score {latest_vitals.news2_score}",
                    summary="Latest bedside observations meet the NEWS2 escalation threshold.",
                    triggered_by="latest_vitals_news2",
                    target_roles=["nurse", "doctor"],
                    affected_medications=[],
                    suggested_actions=[
                        "Escalate to the responsible medical team immediately.",
                        "Increase observation frequency based on deterioration policy.",
                        "Document actions taken and reassessment timing.",
                    ],
                    explanation={
                        "summary": "The latest vital set crosses the configured NEWS2 deterioration threshold.",
                        "reasoning": [
                            f"NEWS2 score recorded as {latest_vitals.news2_score}.",
                            f"Observed heart rate: {latest_vitals.heart_rate or 'n/a'}.",
                            f"Observed respiratory rate: {latest_vitals.respiratory_rate or 'n/a'}.",
                            f"Observed oxygen saturation: {latest_vitals.spo2 or 'n/a'}.",
                        ],
                        "clinicalInputs": [
                            {"label": "NEWS2", "value": str(latest_vitals.news2_score), "flag": "critical" if latest_vitals.news2_score >= 7 else "high"},
                            {"label": "Heart rate", "value": str(latest_vitals.heart_rate or "n/a")},
                            {"label": "Respiratory rate", "value": str(latest_vitals.respiratory_rate or "n/a")},
                            {"label": "SpO2", "value": str(latest_vitals.spo2 or "n/a")},
                        ],
                        "limitations": ["This rule depends on complete and timely vital documentation."],
                        "confidence": "high",
                        "confidenceScore": 92,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-news2",
                            "title": "Rule: NEWS2 threshold escalation",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        if snapshot["overdue_tasks"]:
            overdue_labels = [task.description for task in snapshot["overdue_tasks"][:3]]
            results.append(
                RuleResult(
                    source_module=CDSSSourceModule.NURSING,
                    rec_type=CDSSRecommendationType.OVERDUE_TASK,
                    severity=CDSSSeverity.WARNING,
                    title="Overdue nursing tasks require review",
                    summary=f"{len(snapshot['overdue_tasks'])} nursing task(s) are overdue for this patient.",
                    triggered_by="nursing_task_queue",
                    target_roles=["nurse"],
                    affected_medications=[],
                    suggested_actions=[
                        "Prioritize or reassign overdue bedside tasks.",
                        "Document why the tasks were delayed if clinically appropriate.",
                        "Escalate workload or patient-risk concerns when delays are unsafe.",
                    ],
                    explanation={
                        "summary": "The patient has pending care tasks past their due time.",
                        "reasoning": overdue_labels or ["Overdue tasks were identified from the task queue."],
                        "clinicalInputs": [
                            {"label": "Overdue count", "value": str(len(snapshot["overdue_tasks"])), "flag": "high"},
                            {"label": "Examples", "value": "; ".join(overdue_labels) if overdue_labels else "Not available"},
                        ],
                        "limitations": ["Task urgency still requires local clinical judgment and staffing context."],
                        "confidence": "high",
                        "confidenceScore": 90,
                        "modelVersion": "GraphRuleEngine v1",
                    },
                    evidence_sources=[
                        {
                            "id": "rule-overdue-task",
                            "title": "Rule: overdue nursing task",
                            "shortName": "Rule Engine",
                            "sourceType": "ehr_pattern",
                            "publishedYear": timezone.now().year,
                            "evidenceGrade": "Deterministic",
                        }
                    ],
                )
            )

        infection_context = cls._has_infection_context(snapshot)
        if latest_vitals and infection_context:
            sepsis_points = 0
            if latest_vitals.temperature is not None and (float(latest_vitals.temperature) >= 38.0 or float(latest_vitals.temperature) <= 36.0):
                sepsis_points += 1
            if latest_vitals.respiratory_rate is not None and latest_vitals.respiratory_rate >= 22:
                sepsis_points += 1
            if latest_vitals.systolic is not None and latest_vitals.systolic <= 100:
                sepsis_points += 1
            if latest_vitals.heart_rate is not None and latest_vitals.heart_rate >= 100:
                sepsis_points += 1
            if sepsis_points >= 2:
                results.append(
                    RuleResult(
                        source_module=CDSSSourceModule.NURSING,
                        rec_type=CDSSRecommendationType.SEPSIS_ALERT,
                        severity=CDSSSeverity.CRITICAL if sepsis_points >= 3 else CDSSSeverity.WARNING,
                        title="Possible sepsis deterioration pattern",
                        summary="Infection-related diagnoses plus abnormal bedside observations meet a basic sepsis escalation pattern.",
                        triggered_by="infection_context_plus_vitals",
                        target_roles=["nurse", "doctor"],
                        affected_medications=[],
                        suggested_actions=[
                            "Escalate to the responsible clinician using the sepsis workflow.",
                            "Repeat vitals promptly and confirm oxygenation, blood pressure, and mental status.",
                            "Review cultures, lactate, and treatment timing if clinically appropriate.",
                        ],
                        explanation={
                            "summary": "The nursing deterioration layer found infection context plus multiple abnormal bedside observations.",
                            "reasoning": [
                                "The coded problem list includes infection-related context.",
                                f"Temperature: {latest_vitals.temperature or 'n/a'}.",
                                f"Respiratory rate: {latest_vitals.respiratory_rate or 'n/a'}.",
                                f"Systolic blood pressure: {latest_vitals.systolic or 'n/a'}.",
                                f"Heart rate: {latest_vitals.heart_rate or 'n/a'}.",
                            ],
                            "clinicalInputs": [
                                {"label": "Sepsis pattern score", "value": str(sepsis_points), "flag": "critical" if sepsis_points >= 3 else "high"},
                                {"label": "Temperature", "value": str(latest_vitals.temperature or "n/a")},
                                {"label": "Respiratory rate", "value": str(latest_vitals.respiratory_rate or "n/a")},
                                {"label": "Systolic BP", "value": str(latest_vitals.systolic or "n/a")},
                                {"label": "Heart rate", "value": str(latest_vitals.heart_rate or "n/a")},
                            ],
                            "limitations": ["This is a screening rule and not a diagnostic sepsis definition."],
                            "confidence": "moderate",
                            "confidenceScore": 81,
                            "modelVersion": "GraphRuleEngine v1",
                        },
                        evidence_sources=[
                            {
                                "id": "rule-sepsis-pattern",
                                "title": "Rule: infection context with abnormal bedside observations",
                                "shortName": "Rule Engine",
                                "sourceType": "ehr_pattern",
                                "publishedYear": timezone.now().year,
                                "evidenceGrade": "Deterministic",
                            }
                        ],
                    )
                )

        return results

    @classmethod
    def _upsert_recommendation(cls, patient: Patient, result: RuleResult) -> CDSSRecommendation:
        rec, created = CDSSRecommendation.objects.get_or_create(
            patient=patient,
            source_module=result.source_module,
            type=result.rec_type,
            title=result.title,
            status=CDSSStatus.ACTIVE,
            defaults={
                "output_kind": result.output_kind,
                "severity": result.severity,
                "summary": result.summary,
                "triggered_by": result.triggered_by,
                "target_roles": result.target_roles,
                "affected_medications": result.affected_medications,
                "suggested_actions": result.suggested_actions,
                "explanation": result.explanation,
                "evidence_sources": result.evidence_sources,
                "snomed_code": result.snomed_code,
                "snomed_display": result.snomed_display,
            },
        )
        if not created:
            changed = False
            for field, value in {
                "output_kind": result.output_kind,
                "severity": result.severity,
                "summary": result.summary,
                "triggered_by": result.triggered_by,
                "target_roles": result.target_roles,
                "affected_medications": result.affected_medications,
                "suggested_actions": result.suggested_actions,
                "explanation": result.explanation,
                "evidence_sources": result.evidence_sources,
                "snomed_code": result.snomed_code,
                "snomed_display": result.snomed_display,
            }.items():
                if getattr(rec, field) != value:
                    setattr(rec, field, value)
                    changed = True
            if changed:
                rec.save()
        return rec

    @staticmethod
    def _normalize_medication_name(name: str | None) -> str:
        if not name:
            return ""
        cleaned = re.sub(r"[^a-z0-9\s]", " ", name.lower())
        tokens = [token for token in cleaned.split() if token not in {"mg", "mcg", "ml", "tablet", "capsule", "tab", "cap"}]
        return " ".join(tokens[:2])

    @classmethod
    def _build_medication_entries(cls, active_prescriptions: list[Any], graph_meds: list[dict[str, Any]]) -> list[dict[str, str]]:
        entries: list[dict[str, str]] = []
        seen: set[tuple[str, str, str]] = set()

        for prescription in active_prescriptions:
            label = str(getattr(prescription, "medication", "") or "").strip()
            ingredient = str(getattr(prescription, "generic_name", "") or label).strip()
            rxnorm = str(getattr(prescription, "rxnorm_code", "") or "").strip()
            key = (label.lower(), ingredient.lower(), rxnorm)
            if key in seen or not label:
                continue
            seen.add(key)
            entries.append({"label": label, "ingredient": ingredient, "rxnorm": rxnorm})

        for med in graph_meds:
            label = str(med.get("name") or "").strip()
            ingredient = str(med.get("activeIngredient") or label).strip()
            rxnorm = str(med.get("rxnorm") or "").strip()
            key = (label.lower(), ingredient.lower(), rxnorm)
            if key in seen or not label:
                continue
            seen.add(key)
            entries.append({"label": label, "ingredient": ingredient, "rxnorm": rxnorm})

        return entries

    @classmethod
    def _match_drug_interaction(cls, left: dict[str, str], right: dict[str, str]) -> dict[str, Any] | None:
        left_text = f"{left.get('label', '')} {left.get('ingredient', '')}".lower()
        right_text = f"{right.get('label', '')} {right.get('ingredient', '')}".lower()
        left_label = left.get("label") or left.get("ingredient") or "Medication"
        right_label = right.get("label") or right.get("ingredient") or "Medication"

        def contains(text: str, terms: list[str]) -> bool:
            return any(term in text for term in terms)

        if (contains(left_text, ["warfarin"]) and cls._is_nsaid(right_text)) or (
            contains(right_text, ["warfarin"]) and cls._is_nsaid(left_text)
        ):
            return {
                "id": "rule-warfarin-nsaid",
                "title": "Major bleeding interaction risk detected",
                "summary": f"{left_label} and {right_label} together increase bleeding risk and need pharmacy review.",
                "severity": CDSSSeverity.CRITICAL,
                "actions": [
                    "Review whether this combination is intentional and time-limited.",
                    "Assess bleeding risk, gastroprotection, and monitoring plan.",
                    "Escalate to the prescriber if a safer analgesic or anticoagulation plan is needed.",
                ],
                "reasoning_summary": "The active medication pair matches a warfarin plus NSAID interaction rule.",
                "reasoning": [
                    f"Medication pair identified: {left_label} + {right_label}.",
                    "Warfarin combined with an NSAID raises concern for GI and systemic bleeding.",
                ],
                "evidence_title": "Rule: warfarin combined with NSAID",
                "confidence": 93,
                "left_label": left_label,
                "right_label": right_label,
            }

        if (contains(left_text, ["warfarin"]) and contains(right_text, ["azithromycin"])) or (
            contains(right_text, ["warfarin"]) and contains(left_text, ["azithromycin"])
        ):
            return {
                "id": "rule-warfarin-azithromycin",
                "title": "Warfarin interaction may increase anticoagulation effect",
                "summary": f"{left_label} and {right_label} together may increase INR and bleeding risk.",
                "severity": CDSSSeverity.WARNING,
                "actions": [
                    "Review the latest INR and expected antibiotic duration.",
                    "Plan closer INR follow-up while the combination is active.",
                    "Counsel the team to watch for bleeding symptoms.",
                ],
                "reasoning_summary": "The active medication pair matches a warfarin plus macrolide interaction rule.",
                "reasoning": [
                    f"Medication pair identified: {left_label} + {right_label}.",
                    "Macrolide exposure can increase anticoagulation effect in patients receiving warfarin.",
                ],
                "evidence_title": "Rule: warfarin combined with azithromycin",
                "confidence": 84,
                "left_label": left_label,
                "right_label": right_label,
            }

        if (cls._is_ace_or_arb(left_text) and contains(right_text, ["spironolactone"])) or (
            cls._is_ace_or_arb(right_text) and contains(left_text, ["spironolactone"])
        ):
            return {
                "id": "rule-ace-arb-spironolactone",
                "title": "Potassium-raising drug interaction risk detected",
                "summary": f"{left_label} and {right_label} together increase hyperkalemia risk.",
                "severity": CDSSSeverity.CRITICAL,
                "actions": [
                    "Review whether both agents are intended together and check the indication.",
                    "Confirm potassium and renal monitoring plan before verification/dispense.",
                    "Escalate rapidly if potassium is already elevated or renal function is worsening.",
                ],
                "reasoning_summary": "The active medication pair matches an ACE/ARB plus spironolactone interaction rule.",
                "reasoning": [
                    f"Medication pair identified: {left_label} + {right_label}.",
                    "Both agents can raise potassium and increase renal safety risk together.",
                ],
                "evidence_title": "Rule: ACE inhibitor/ARB combined with spironolactone",
                "confidence": 91,
                "left_label": left_label,
                "right_label": right_label,
            }

        if (cls._is_opioid(left_text) and cls._is_benzodiazepine(right_text)) or (
            cls._is_opioid(right_text) and cls._is_benzodiazepine(left_text)
        ):
            return {
                "id": "rule-opioid-benzodiazepine",
                "title": "Sedation and respiratory depression interaction risk detected",
                "summary": f"{left_label} and {right_label} together increase oversedation and respiratory-depression risk.",
                "severity": CDSSSeverity.CRITICAL,
                "actions": [
                    "Verify that concurrent use is intentional and clinically justified.",
                    "Review sedation monitoring and respiratory observation needs.",
                    "Consider safer alternatives or dose minimization if possible.",
                ],
                "reasoning_summary": "The active medication pair matches an opioid plus benzodiazepine interaction rule.",
                "reasoning": [
                    f"Medication pair identified: {left_label} + {right_label}.",
                    "Concurrent opioid and benzodiazepine exposure can increase sedation and respiratory compromise risk.",
                ],
                "evidence_title": "Rule: opioid combined with benzodiazepine",
                "confidence": 94,
                "left_label": left_label,
                "right_label": right_label,
            }

        return None

    @staticmethod
    def _is_nsaid(name: str | None) -> bool:
        medication = (name or "").lower()
        return any(token in medication for token in ["ibuprofen", "diclofenac", "ketorolac", "naproxen", "celecoxib", "indomethacin"])

    @staticmethod
    def _is_ace_or_arb(name: str | None) -> bool:
        medication = (name or "").lower()
        return any(
            token in medication
            for token in [
                "lisinopril",
                "enalapril",
                "ramipril",
                "captopril",
                "losartan",
                "valsartan",
                "irbesartan",
                "candesartan",
                "telmisartan",
                "olmesartan",
            ]
        )

    @staticmethod
    def _is_opioid(name: str | None) -> bool:
        medication = (name or "").lower()
        return any(token in medication for token in ["morphine", "fentanyl", "oxycodone", "hydromorphone", "tramadol", "codeine"])

    @staticmethod
    def _is_benzodiazepine(name: str | None) -> bool:
        medication = (name or "").lower()
        return any(token in medication for token in ["lorazepam", "diazepam", "midazolam", "alprazolam", "clonazepam"])

    @staticmethod
    def _extract_latest_numeric_result(results: list[Any], patterns: list[str]) -> float | None:
        for result in results:
            test_name = (result.test_name or "").lower()
            if not any(pattern in test_name for pattern in patterns):
                continue
            value = GraphRuleEngineService._coerce_numeric(result.value)
            if value is not None:
                return value
        return None

    @staticmethod
    def _coerce_numeric(value: Any) -> float | None:
        if value in (None, ""):
            return None
        text = str(value).strip()
        if not text:
            return None
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        if not match:
            return None
        try:
            return float(Decimal(match.group(0)))
        except (InvalidOperation, ValueError, TypeError):
            return None

    @staticmethod
    def _allergy_cross_reacts(allergy_text: str | None, med_name: str | None) -> bool:
        if not allergy_text or not med_name:
            return False
        allergy = allergy_text.lower()
        medication = med_name.lower()
        if "penicillin" in allergy and any(token in medication for token in ["piperacillin", "amoxicillin", "ampicillin", "penicillin"]):
            return True
        if "nsaid" in allergy and any(token in medication for token in ["ibuprofen", "diclofenac", "ketorolac", "naproxen"]):
            return True
        return False

    @classmethod
    def _has_infection_context(cls, snapshot: dict[str, Any]) -> bool:
        text = " | ".join(
            filter(
                None,
                [d.description for d in snapshot["diagnoses"]] + [item.get("name") for item in snapshot["graph"]["diagnoses"]],
            )
        ).lower()
        return any(term in text for term in ["pneumonia", "infection", "sepsis", "copd with acute exacerbation"])
