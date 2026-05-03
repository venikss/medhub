import json
import logging
import re
from typing import Any
from urllib import error, request

from apps.cdss.services.graph_service import GraphService
from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService

logger = logging.getLogger(__name__)


def context_sentences(text: str):
    return [line for line in text.split("\n") if line.strip().startswith("-")]


def _call_llm(system: str, user: str) -> str:
    """
    Call the local MedGemma server (mlx_lm OpenAI-compatible API).

    Sends a proper system + user message pair which MedGemma's chat template
    merges as: <start_of_turn>user\\n{system}\\n\\n{user}<end_of_turn>
    """
    return _call_llm_messages([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])


def _call_llm_messages(messages: list[dict[str, str]], max_tokens: int = 1500) -> str:
    """
    Call MedGemma with an arbitrary messages list (supports multi-turn chat).
    """
    from django.conf import settings

    llm_url = getattr(settings, "LLM_API_URL", "http://localhost:8081/v1/chat/completions")
    model_name = getattr(settings, "LLM_MODEL_NAME", "medgemma")
    llm_timeout = getattr(settings, "LLM_API_TIMEOUT_SECONDS", 120)

    payload = {
        "model": model_name,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }

    try:
        req = request.Request(
            llm_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=llm_timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
            return (
                result.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "[Error: No response from MedGemma]")
            )

    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("MedGemma HTTP %s from %s: %s", exc.code, llm_url, body)
        return (
            f"[MedGemma Unavailable — HTTP {exc.code}]\n"
            f"Endpoint: {llm_url}  Model: {model_name}\n"
            "Verify mlx_lm server is running: "
            "mlx_lm server --model .models/medgemma-1_5-4b-it-4bit --port 8081"
        )
    except error.URLError as exc:
        logger.error("MedGemma connection error at %s: %s", llm_url, exc)
        return (
            f"[MedGemma Unavailable — Connection Error]\n"
            f"Could not reach: {llm_url}\n"
            "Start the server with: "
            "mlx_lm server --model .models/medgemma-1_5-4b-it-4bit --port 8081"
        )
    except Exception as exc:
        logger.exception("MedGemma unexpected error")
        return f"[MedGemma Unavailable — Unexpected Error]\n{exc}"


def _parse_substitutions(subs_raw: str) -> list:
    """
    Robustly parse substitution suggestions from MedGemma output.
    Handles multiple output formats the model might use:
      1. Numbered list with Reason: on next line (preferred)
         1. Doxycycline 100 mg PO BID
            Reason: Lower QT risk
      2. SUBSTITUTE: X | REASON: Y  (pipe-delimited)
      3. 1. Drug name — Reason: Y  (em-dash inline)
      4. - Drug name: reason
    """
    import re as _re

    if not subs_raw:
        return []
    skip_phrases = ("none required", "no substitution", "not applicable", "n/a", "no suitable")
    if any(p in subs_raw.lower() for p in skip_phrases):
        return []

    results = []

    # Strategy 1: numbered entry then indented Reason: line
    lines = subs_raw.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        # numbered item like "1. Doxycycline 100 mg PO BID" or "1) ..."
        m = _re.match(r"^\d+[\.\)]\s+(.+)$", line)
        if m:
            drug = m.group(1).strip()
            reason = ""
            # look ahead for a Reason: line
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                reason_m = _re.match(r"(?i)reason\s*:\s*(.+)", next_line)
                if reason_m:
                    reason = reason_m.group(1).strip()
                    i += 1  # consume reason line
            # If no reason on next line, check inline after " - " or " — "
            if not reason:
                inline = _re.split(r"\s[—\-]\s", drug, maxsplit=1)
                if len(inline) == 2:
                    drug, reason = inline[0].strip(), inline[1].strip()
            if drug and len(drug) > 3:
                results.append({"substitute": drug, "reason": reason or "See AI recommendations above."})
        i += 1

    if results:
        return results

    # Strategy 2: SUBSTITUTE: X | REASON: Y
    for line in lines:
        line = line.strip()
        if "SUBSTITUTE:" in line and "REASON:" in line:
            try:
                sub_part, reason_part = line.split("|", 1)
                drug = sub_part.replace("SUBSTITUTE:", "").strip()
                reason = reason_part.replace("REASON:", "").strip()
                if drug:
                    results.append({"substitute": drug, "reason": reason})
            except ValueError:
                pass

    if results:
        return results

    # Strategy 3: "- Drug name: reason" or "Drug name — reason"
    for line in lines:
        line = _re.sub(r"^[-•*]\s*", "", line.strip())
        if not line or len(line) < 5:
            continue
        # try colon split
        parts = line.split(":", 1)
        if len(parts) == 2 and len(parts[0]) < 80:
            results.append({"substitute": parts[0].strip(), "reason": parts[1].strip()})
        elif " — " in line or " - " in line:
            parts = _re.split(r"\s[—\-]\s", line, maxsplit=1)
            if len(parts) == 2:
                results.append({"substitute": parts[0].strip(), "reason": parts[1].strip()})

    return results[:3]  # max 3


class AIService:
    @staticmethod
    def generate_cdss_recommendation(patient_uuid: str, prompt_query: str, role: str = "doctor") -> str:
        """
        GraphRAG + MedGemma CDSS recommendation.

        Fetches the patient's Neo4j subgraph and drug safety context, then
        sends them to the local MedGemma model as grounding context.

        Args:
            patient_uuid: UUID of the patient.
            prompt_query: Free-text clinical question from the user.
            role: Caller role — "pharmacist" gets a medication-focused report;
                  any other value gets the full clinical report for doctors.
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)

        logger.info(
            "CDSS AI consult — patient %s | role %s | graph %d chars | drug safety %d chars",
            patient_uuid, role, len(graph_context), len(drug_safety_context),
        )

        if role == "pharmacist":
            system = (
                "You are a Clinical Pharmacist AI embedded in a hospital pharmacy system. "
                "Your sole focus is medication safety and pharmacotherapy optimization.\n\n"
                "Rules:\n"
                "- Base every finding strictly on the Knowledge Graph context provided.\n"
                "- Never fabricate drug names, doses, interactions, or allergy data.\n"
                "- Flag CRITICAL any contraindicated drug combinations or life-threatening interactions.\n"
                "- Flag WARNING for significant interactions, allergy cross-reactivity risks, and dose concerns.\n"
                "- If data is missing, state what is needed rather than guessing.\n"
                "- Be precise and action-oriented; pharmacists need clear dispensing decisions.\n\n"
                "Always respond using exactly these section headers (include only sections with content):\n"
                "## CRITICAL ALERTS\n"
                "## DRUG-DRUG INTERACTIONS\n"
                "## ALLERGY & CROSS-REACTIVITY RISKS\n"
                "## DOSE & RENAL/HEPATIC ADJUSTMENTS\n"
                "## PHARMACIST RECOMMENDATIONS"
            )
            user = (
                "=== Patient Medication & Allergy Context (Knowledge Graph) ===\n"
                f"{graph_context}\n\n"
                "=== Drug Safety Analysis (DDI, Allergen Groups, Risk Groups) ===\n"
                f"{drug_safety_context}\n\n"
                "=== Pharmacist Query ===\n"
                f"{prompt_query}"
            )
        else:
            system = (
                "You are an expert Clinical Decision Support System (CDSS) AI embedded in a hospital EHR. "
                "Your role is evidence-based clinical decision support for attending physicians.\n\n"
                "Rules:\n"
                "- Base every recommendation strictly on the Knowledge Graph context provided.\n"
                "- Never fabricate diagnoses, medications, lab values, or clinical findings.\n"
                "- Flag CRITICAL any contraindicated drug combinations or life-threatening interactions.\n"
                "- Flag WARNING for significant risks, care gaps, or abnormal findings.\n"
                "- If information is missing, state what is needed rather than guessing.\n"
                "- Lead with the most clinically urgent finding.\n\n"
                "Always respond using exactly these section headers (include only sections with content):\n"
                "## CRITICAL ALERTS\n"
                "## CLINICAL SUMMARY\n"
                "## MEDICATION SAFETY\n"
                "## CARE GAPS & RECOMMENDATIONS\n"
                "## FOLLOW-UP ACTIONS"
            )
            user = (
                "=== Patient Knowledge Graph Context ===\n"
                f"{graph_context}\n\n"
                "=== Drug Safety Analysis (Knowledge Graph) ===\n"
                f"{drug_safety_context}\n\n"
                "=== Doctor Query ===\n"
                f"{prompt_query}"
            )

        return _call_llm(system, user)

    @staticmethod
    def generate_patient_report(patient_uuid: str, role: str = "doctor") -> str:
        """
        Generate a comprehensive NLP narrative report for a patient with no free-text query.
        The report covers the full clinical picture (doctor) or medication safety (pharmacist).
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)

        logger.info("Patient NLP report — patient %s | role %s", patient_uuid, role)

        if role == "pharmacist":
            system = (
                "You are a Clinical Pharmacist AI. Write a professional medication safety report "
                "for this patient based solely on the Knowledge Graph data provided.\n\n"
                "The report must:\n"
                "- Be written in clear, professional clinical English.\n"
                "- Identify all medication safety issues (DDIs, allergy risks, dose concerns).\n"
                "- Use section headers exactly as shown below.\n"
                "- Never invent drug names, doses, or interactions not present in the data.\n\n"
                "Required sections (omit any with no relevant data):\n"
                "## Medication Safety Report\n"
                "## Current Medications\n"
                "## Drug-Drug Interactions\n"
                "## Allergy & Cross-Reactivity Assessment\n"
                "## Dose & Renal/Hepatic Considerations\n"
                "## Pharmacist Recommendations"
            )
            user = (
                "=== Patient Medication & Allergy Context (Knowledge Graph) ===\n"
                f"{graph_context}\n\n"
                "=== Drug Safety Analysis ===\n"
                f"{drug_safety_context}\n\n"
                "Generate a complete medication safety report for this patient."
            )
        else:
            system = (
                "You are an expert Clinical Decision Support AI. Write a comprehensive clinical "
                "summary report for this patient based solely on the Knowledge Graph data provided.\n\n"
                "The report must:\n"
                "- Be written in clear, professional clinical English suitable for a patient chart.\n"
                "- Cover all clinical domains: diagnoses, medications, labs, imaging, and safety.\n"
                "- Highlight the most clinically urgent issues first.\n"
                "- Use section headers exactly as shown below.\n"
                "- Never fabricate diagnoses, medications, lab values, or findings not in the data.\n\n"
                "Required sections (omit any with no relevant data):\n"
                "## Clinical Summary Report\n"
                "## Active Diagnoses & Problem List\n"
                "## Current Medications\n"
                "## Medication Safety\n"
                "## Laboratory Findings\n"
                "## Imaging & Radiology\n"
                "## Clinical Alerts\n"
                "## Care Gaps & Recommendations"
            )
            user = (
                "=== Patient Knowledge Graph Context ===\n"
                f"{graph_context}\n\n"
                "=== Drug Safety Analysis ===\n"
                f"{drug_safety_context}\n\n"
                "Generate a complete clinical summary report for this patient."
            )

        return _call_llm_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=2000,
        )

    @staticmethod
    def chat_with_context(
        patient_uuid: str,
        user_message: str,
        history: list[dict[str, str]],
        role: str = "doctor",
    ) -> tuple[str, list[dict[str, str]]]:
        """
        Multi-turn chat with MedGemma, grounded in live patient KG context.

        The patient's KG snapshot is injected as the system message on every turn
        so answers stay grounded even as the conversation grows.

        Args:
            patient_uuid: UUID of the patient being discussed.
            user_message: The clinician's latest message.
            history: Previous turns as [{role: "user"|"assistant", content: "..."}].
            role: "pharmacist" for pharmacy-focused chat, otherwise doctor mode.

        Returns:
            (assistant_response, updated_history)
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)

        logger.info(
            "CDSS chat — patient %s | role %s | history_turns %d",
            patient_uuid, role, len(history),
        )

        if role == "pharmacist":
            system_content = (
                "You are a Clinical Pharmacist AI embedded in a hospital EHR. "
                "You are having a conversation with a pharmacist about a specific patient. "
                "Answer questions about medication safety — drug interactions, allergy risks, "
                "dosing, renal/hepatic adjustments, and formulary alternatives.\n\n"
                "Rules:\n"
                "- Ground every answer in the patient context below.\n"
                "- Never fabricate drug names, doses, or interactions.\n"
                "- Flag CRITICAL any life-threatening issues immediately.\n"
                "- Keep answers concise and action-oriented.\n\n"
                f"=== Patient Medication & Allergy Context ===\n{graph_context}\n\n"
                f"=== Drug Safety Analysis ===\n{drug_safety_context}"
            )
        else:
            system_content = (
                "You are an expert Clinical Decision Support AI embedded in a hospital EHR. "
                "You are having a conversation with an attending physician about a specific patient. "
                "Answer clinical questions about diagnoses, medications, labs, imaging, and care planning.\n\n"
                "Rules:\n"
                "- Ground every answer in the patient context below.\n"
                "- Never fabricate diagnoses, medications, lab values, or findings.\n"
                "- Flag CRITICAL any life-threatening issues immediately.\n"
                "- Be concise and evidence-based.\n\n"
                f"=== Patient Knowledge Graph Context ===\n{graph_context}\n\n"
                f"=== Drug Safety Analysis ===\n{drug_safety_context}"
            )

        # Validate history entries before sending — only allow role/content
        safe_history = [
            {"role": m["role"], "content": str(m["content"])}
            for m in history
            if isinstance(m, dict) and m.get("role") in ("user", "assistant") and m.get("content")
        ]

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_content},
            *safe_history,
            {"role": "user", "content": user_message},
        ]

        response = _call_llm_messages(messages, max_tokens=1024)

        updated_history = [
            *safe_history,
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": response},
        ]

        return response, updated_history

    @staticmethod
    def suggest_encounter_assessment(
        encounter_id: str,
        patient_uuid: str,
        subjective: str,
        objective: str,
        existing_assessment: str = "",
        existing_plan: str = "",
    ) -> dict[str, Any]:
        """
        Analyse a SOAP encounter note with the patient's full KG context and
        return:
          - differential: list of differential diagnoses with reasoning
          - assessment: suggested Assessment text for the doctor to review
          - plan: suggested Plan text (investigations, treatments, follow-up)
          - alerts: any urgent safety or drug interaction alerts

        The doctor always decides — this is decision *support*, not automation.
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)
        encounter_history = GraphService.get_patient_encounter_context(patient_uuid, max_encounters=3)

        # Pull latest vitals from ORM and format for LLM
        vitals_dict = GraphService.get_patient_latest_vitals_dict(patient_uuid)
        if vitals_dict:
            v = vitals_dict
            vitals_parts = []
            if v.get("systolic") and v.get("diastolic"):
                vitals_parts.append(f"BP {v['systolic']}/{v['diastolic']} mmHg")
            if v.get("heartRate"):
                vitals_parts.append(f"HR {v['heartRate']} bpm")
            if v.get("spo2"):
                vitals_parts.append(f"SpO\u2082 {v['spo2']}%")
            if v.get("temperature"):
                vitals_parts.append(f"Temp {v['temperature']:.1f}\u00b0C")
            if v.get("respiratoryRate"):
                vitals_parts.append(f"RR {v['respiratoryRate']}/min")
            if v.get("painScore") is not None:
                vitals_parts.append(f"Pain {v['painScore']}/10")
            if v.get("gcs"):
                vitals_parts.append(f"GCS {v['gcs']}/15")
            if v.get("news2Score") is not None:
                news2 = v["news2Score"]
                risk = "LOW" if news2 < 3 else ("MEDIUM" if news2 < 5 else ("HIGH" if news2 < 7 else "VERY HIGH"))
                vitals_parts.append(f"NEWS2 {news2} ({risk} risk)")
            label = "Admission baseline" if v.get("isAdmissionVitals") else "Latest"
            recorded = v.get("recordedAt", "")[:16] if v.get("recordedAt") else "recently"
            vitals_context = (
                f"{label} vitals ({recorded}): {', '.join(vitals_parts)}.\n"
                + (f"Notes: {v['notes']}" if v.get("notes") else "")
            )
        else:
            vitals_context = "No vitals recorded yet."

        logger.info(
            "Encounter AI suggest — encounter %s | patient %s", encounter_id, patient_uuid
        )

        system = (
            "You are a Clinical Decision Support AI in a hospital EHR. "
            "Analyse the SOAP note and patient Knowledge Graph context provided by the doctor "
            "and return a structured clinical suggestion.\n\n"
            "Output EXACTLY these four sections in order:\n"
            "## DIFFERENTIAL DIAGNOSIS — numbered list, each entry MUST follow this exact format:\n"
            "  N. Diagnosis Name (ICD-10: X00.0) — brief reasoning\n"
            "  Always include the most likely ICD-10 code in parentheses after the diagnosis name.\n"
            "## SUGGESTED ASSESSMENT — concise paragraph the doctor can copy\n"
            "## SUGGESTED PLAN — three sub-sections:\n"
            "  Medications: one drug per line as: DrugName | dose | route | frequency (e.g. Furosemide | 40 mg | IV | once)\n"
            "  Investigations: one test name per line\n"
            "  Other: monitoring, non-pharmacological steps, follow-up\n"
            "## CLINICAL ALERTS — list any DDIs, allergy conflicts, or dangerous combinations; "
            "if none write: No urgent alerts detected.\n\n"
            "Rules: base output only on provided data; never fabricate values; "
            "keep medication lines to DrugName | dose | route | frequency with no extra text on that line."
        )

        soap_block = (
            f"=== Current Encounter SOAP Note ===\n"
            f"Subjective:\n{subjective or '(not provided)'}\n\n"
            f"Objective:\n{objective or '(not provided)'}\n\n"
        )
        if existing_assessment:
            soap_block += f"Doctor's draft Assessment:\n{existing_assessment}\n\n"
        if existing_plan:
            soap_block += f"Doctor's draft Plan:\n{existing_plan}\n\n"

        user = (
            f"{soap_block}"
            f"=== Patient Knowledge Graph Context ===\n{graph_context}\n\n"
            f"=== Current Patient Vitals ===\n{vitals_context}\n\n"
            f"=== Drug Safety Analysis ===\n{drug_safety_context}\n\n"
            f"=== Previous Encounter Notes ===\n{encounter_history}\n\n"
            "Based on all the above, provide your differential diagnosis, suggested assessment, "
            "suggested plan, and any clinical alerts."
        )


        raw = _call_llm_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=900,
        )

        # Parse sections from the structured response
        def _extract_section(text: str, header: str, next_headers: list[str]) -> str:
            start_marker = f"## {header}"
            start = text.find(start_marker)
            if start == -1:
                return ""
            start = text.find("\n", start) + 1
            end = len(text)
            for nxt in next_headers:
                pos = text.find(f"## {nxt}", start)
                if pos != -1:
                    end = min(end, pos)
            return text[start:end].strip()

        all_headers = ["DIFFERENTIAL DIAGNOSIS", "SUGGESTED ASSESSMENT", "SUGGESTED PLAN", "CLINICAL ALERTS"]

        differential_text = _extract_section(raw, "DIFFERENTIAL DIAGNOSIS",
                                             ["SUGGESTED ASSESSMENT", "SUGGESTED PLAN", "CLINICAL ALERTS"])
        assessment_text = _extract_section(raw, "SUGGESTED ASSESSMENT",
                                           ["SUGGESTED PLAN", "CLINICAL ALERTS"])
        plan_text = _extract_section(raw, "SUGGESTED PLAN", ["CLINICAL ALERTS"])
        alerts_text = _extract_section(raw, "CLINICAL ALERTS", [])

        # ── De-loop plan text ─────────────────────────────────────────────────
        # Small 4-bit quantised models can get stuck repeating the same line
        # dozens of times. Deduplicate while preserving order and section headers.
        def _dedup_plan(text: str, max_per_item: int = 1) -> str:
            seen: set[str] = set()
            out: list[str] = []
            for line in text.splitlines():
                key = line.strip().lower()
                if not key or key.endswith(":"):   # keep blank/header lines
                    out.append(line)
                    continue
                if key not in seen:
                    seen.add(key)
                    out.append(line)
            return "\n".join(out)

        plan_text = _dedup_plan(plan_text)

        # ── Parse differential ────────────────────────────────────────────────
        # MedGemma sometimes collapses all entries onto one line.
        # Strategy: split on the ICD-10 anchor "(ICD-10: X00.0) — " which gives
        # alternating chunks [pre_name, code, reasoning+next_name, code, ...].
        # The name is the LAST phrase in each pre_name chunk (after the last ".").
        # The reasoning is the FIRST sentence of each post-code chunk.

        def _trim_reasoning(text: str, max_len: int = 120) -> str:
            text = re.sub(r"\s+", " ", text).strip()
            m = re.match(r"^(.{20,}?[.!?])(?:\s|$)", text)
            if m and len(m.group(1)) <= max_len:
                return m.group(1)
            if len(text) <= max_len:
                return text
            return text[:max_len].rsplit(" ", 1)[0].rstrip(".,;") + "\u2026"

        def _extract_name(chunk: str) -> str:
            chunk = re.sub(r"\s+", " ", chunk).strip()
            chunk = re.sub(r"^\d+[\.)]\s*", "", chunk)
            frags = re.split(r"[.!?]\s+", chunk)
            name = frags[-1].strip()
            name = re.sub(r"^\d+[\.)]\s*", "", name).strip()
            return name.rstrip(".,: ")

        _anchor = re.compile(
            r"\(ICD-10:\s*([A-Z]\d[\w.]{0,6})\)\s*[\u2014\u2013\-]\s*",
            re.IGNORECASE,
        )
        pieces = _anchor.split(differential_text)
        # pieces = [pre0, code1, post1, code2, post2, ...]
        # step by 2 to pair (pre[i], code[i+1], post[i+2])

        differential_list = []
        i = 0
        while i + 1 < len(pieces):
            name = _extract_name(pieces[i])
            code = pieces[i + 1].upper()
            reasoning_raw = pieces[i + 2] if i + 2 < len(pieces) else ""
            reasoning = _trim_reasoning(reasoning_raw)
            if name and len(name) >= 3:
                differential_list.append({
                    "diagnosis": name,
                    "icd10Code": code,
                    "reasoning": reasoning,
                })
            i += 2

        # Fallback: model didn't use ICD-10 format — plain line-by-line split
        if not differential_list:
            for line in differential_text.split("\n"):
                line = line.strip()
                if not line or not (line[0].isdigit() or line.startswith("-") or line.startswith("\u2022")):
                    continue
                cleaned = line.lstrip("0123456789.-\u2022) ").strip()
                if not cleaned:
                    continue
                parts = re.split(r"\s+[\u2014\u2013\-]\s+", cleaned, maxsplit=1)
                differential_list.append({
                    "diagnosis": parts[0].rstrip(".,: "),
                    "icd10Code": None,
                    "reasoning": _trim_reasoning(parts[1]) if len(parts) > 1 else "",
                })

        # ── Persist AI-generated encounter alerts to CDSS ────────────────────
        AIService._persist_encounter_alerts(
            alerts_text=alerts_text,
            patient_uuid=patient_uuid,
            encounter_id=encounter_id,
        )

        return {
            "encounter_id": encounter_id,
            "differential": differential_list if differential_list else (
                [{"diagnosis": differential_text, "icd10Code": None, "reasoning": ""}]
                if differential_text else []
            ),
            "assessment": assessment_text,
            "plan": plan_text,
            "alerts": alerts_text,
            "raw": raw,
        }

    @staticmethod
    def _persist_encounter_alerts(alerts_text: str, patient_uuid: str, encounter_id: str) -> None:
        """
        Parse the CLINICAL ALERTS section of the encounter AI response and persist
        each alert as a CDSSRecommendation so it surfaces in the CDSS alert center,
        the doctor sidebar, and the real-time WebSocket feed.
        """
        if not alerts_text or re.search(r"no urgent alerts", alerts_text, re.IGNORECASE):
            return

        try:
            from apps.cdss.models import (
                CDSSRecommendation,
                CDSSRecommendationType,
                CDSSSeverity,
                CDSSOutputKind,
                CDSSSourceModule,
            )
            from apps.patients.models import Patient
            from apps.doctors.models import Encounter
            from core.websockets import emit_cdss_new_recommendation

            patient = Patient.objects.filter(id=patient_uuid).first()
            if not patient:
                return
            encounter = Encounter.objects.filter(id=encounter_id).first()

            # Split into individual alert lines (skip blanks / no-alert lines)
            alert_lines = [
                l.lstrip("-•*0123456789.) ").strip()
                for l in alerts_text.split("\n")
                if l.strip() and not re.search(
                    r"^(no urgent|none detected|no alerts|n/a)", l.strip(), re.IGNORECASE
                )
            ]

            _CRITICAL_KEYWORDS = re.compile(
                r"\b(contraindicated|do not|severe|life.?threatening|toxic|fatal|"
                r"critical|danger(?:ous)?|avoid|stop immediately)\b",
                re.IGNORECASE,
            )

            for alert_line in alert_lines:
                if len(alert_line) < 10:          # skip noise
                    continue
                # Truncate title to 280 chars
                title = alert_line[:280]
                severity = (
                    CDSSSeverity.CRITICAL
                    if _CRITICAL_KEYWORDS.search(alert_line)
                    else CDSSSeverity.WARNING
                )
                # Infer type from keywords
                if re.search(r"\b(allerg|cross.?react|hypersensitiv)\b", alert_line, re.IGNORECASE):
                    rec_type = CDSSRecommendationType.ALLERGY
                elif re.search(r"\b(interact|DDI|combination)\b", alert_line, re.IGNORECASE):
                    rec_type = CDSSRecommendationType.DRUG_INTERACTION
                elif re.search(r"\b(dose|dosage|overdose|renal|hepatic|adjust)\b", alert_line, re.IGNORECASE):
                    rec_type = CDSSRecommendationType.DOSAGE_WARNING
                elif re.search(r"\b(contraindicated|contraindication)\b", alert_line, re.IGNORECASE):
                    rec_type = CDSSRecommendationType.CONTRAINDICATION
                else:
                    rec_type = CDSSRecommendationType.GUIDELINE

                rec = CDSSRecommendation.objects.create(
                    patient=patient,
                    encounter=encounter,
                    source_module=CDSSSourceModule.DOCTOR,
                    target_roles=["doctor", "pharmacy"],
                    output_kind=CDSSOutputKind.ALERT,
                    type=rec_type,
                    severity=severity,
                    title=title,
                    summary=alert_line,
                    triggered_by=f"Encounter AI assessment (encounter {encounter_id})",
                    explanation={
                        "summary": alert_line,
                        "reasoning": ["Generated by MedGemma during encounter AI assessment."],
                        "confidence": "AI-generated — verify clinically",
                    },
                )

                # Real-time WebSocket push
                try:
                    emit_cdss_new_recommendation({
                        "id": str(rec.id),
                        "patientId": str(patient_uuid),
                        "type": rec_type,
                        "severity": severity,
                        "title": title,
                        "summary": alert_line,
                        "sourceModule": CDSSSourceModule.DOCTOR,
                    })
                except Exception:
                    pass  # WebSocket failure must not block the API response

        except Exception as exc:
            logger.warning("_persist_encounter_alerts failed silently: %s", exc)


    @staticmethod
    def suggest_rx_verification(patient_uuid: str, rx: dict) -> dict:
        """AI-assisted pharmacy Rx verification grounded in the patient KG."""
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)
        logger.info("Pharmacy AI Rx verification — patient %s | drug %s", patient_uuid, rx.get("medication", "?"))

        system = (
            "You are a Clinical Pharmacist AI embedded in a hospital pharmacy system. "
            "A pharmacist is about to verify a prescription and has asked you to review it "
            "against the patient's complete medication history, allergies, and diagnoses "
            "from the hospital Knowledge Graph.\n\n"
            "Your task:\n"
            "1. Determine whether this prescription is SAFE TO DISPENSE, requires CAUTION, "
            "   or should NOT BE DISPENSED.\n"
            "2. Check for drug-drug interactions with the patient's current medications.\n"
            "3. Check for allergy or cross-reactivity risks.\n"
            "4. Assess dose appropriateness (consider renal/hepatic function if data available).\n"
            "5. Provide clear, actionable pharmacist recommendations.\n"
            "6. If CAUTION or DO NOT DISPENSE, suggest up to 3 specific therapeutic substitutions "
            "   with the exact substitute drug name, dose, route, frequency, and a clear clinical "
            "   reason grounded in the patient's KG data. If SAFE, omit this section.\n\n"
            "Rules:\n"
            "- Ground every finding in the Knowledge Graph data provided.\n"
            "- Never fabricate drug interactions, allergies, or lab values.\n"
            "- For substitutions, only suggest real, evidence-based alternatives.\n"
            "- Be concise and action-oriented. If a finding is life-threatening, lead with it.\n\n"
            "Respond using EXACTLY these section headers:\n"
            "## VERDICT\nSAFE | CAUTION | DO NOT DISPENSE — [one sentence rationale]\n\n"
            "## DRUG-DRUG INTERACTIONS\n[List interactions with severity, or 'No significant interactions identified.']\n\n"
            "## ALLERGY & CROSS-REACTIVITY RISKS\n[List allergy risks, or 'No allergy concerns identified.']\n\n"
            "## DOSE ASSESSMENT\n[Dose appropriateness and renal/hepatic considerations.]\n\n"
            "## PHARMACIST RECOMMENDATIONS\n[Numbered action items for the pharmacist]\n\n"
            "## SUGGESTED SUBSTITUTIONS\n"
            "If verdict is CAUTION or DO NOT DISPENSE, list up to 3 safer alternatives in this format:\n"
            "1. [Drug Name Dose Route Frequency]\n"
            "   Reason: [Why safer for this patient based on KG data]\n"
            "Example:\n"
            "1. Doxycycline 100 mg PO BID\n"
            "   Reason: Lower QT prolongation risk; covers atypical organisms\n"
            "If SAFE or no suitable alternative, write: None required."
        )
        user = (
            f"=== Prescription Under Review ===\n"
            f"Medication: {rx.get('medication', 'Unknown')}\n"
            f"Dose: {rx.get('dose', 'Unknown')}\nRoute: {rx.get('route', 'Unknown')}\n"
            f"Frequency: {rx.get('frequency', 'Unknown')}\nSIG: {rx.get('sig', '')}\n"
            f"Indication: {rx.get('indication', 'Not specified')}\n\n"
            f"=== Patient Medication & Allergy Context (Knowledge Graph) ===\n{graph_context}\n\n"
            f"=== Drug Safety Analysis ===\n{drug_safety_context}\n\n"
            "Please review this prescription and provide your structured analysis."
        )
        raw = _call_llm_messages([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=1200)

        def _ext(text, header, nexts):
            sm = f"## {header}"; s = text.find(sm)
            if s == -1: return ""
            s = text.find("\n", s) + 1; e = len(text)
            for n in nexts:
                p = text.find(f"## {n}", s)
                if p != -1: e = min(e, p)
            return text[s:e].strip()

        all_headers = ["DRUG-DRUG", "ALLERGY", "DOSE", "PHARMACIST", "SUGGESTED"]
        verdict_raw = _ext(raw, "VERDICT", all_headers)
        v = "do_not_dispense" if "do not dispense" in verdict_raw.lower() else ("caution" if "caution" in verdict_raw.lower() else "safe")

        subs_raw = _ext(raw, "SUGGESTED SUBSTITUTIONS", [])
        substitution_list = _parse_substitutions(subs_raw)

        return {
            "verdict": v, "verdict_text": verdict_raw,
            "interactions": _ext(raw, "DRUG-DRUG INTERACTIONS", ["ALLERGY", "DOSE", "PHARMACIST", "SUGGESTED"]),
            "allergy_risks": _ext(raw, "ALLERGY & CROSS-REACTIVITY RISKS", ["DOSE", "PHARMACIST", "SUGGESTED"]),
            "dose_assessment": _ext(raw, "DOSE ASSESSMENT", ["PHARMACIST", "SUGGESTED"]),
            "recommendations": _ext(raw, "PHARMACIST RECOMMENDATIONS", ["SUGGESTED"]),
            "substitutions_raw": subs_raw,
            "substitution_list": substitution_list,
            "summary": verdict_raw, "raw": raw,
        }

    @staticmethod
    def suggest_lab_interpretation(patient_uuid: str, panel_name: str, results: list) -> dict:
        """AI-assisted lab result interpretation grounded in the patient KG."""
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        drug_safety_context = DrugKnowledgeService.get_full_patient_drug_safety_context(patient_uuid)
        logger.info("Lab AI interpretation — patient %s | panel %s | %d results", patient_uuid, panel_name, len(results))

        system = (
            "You are a Clinical Laboratory Medicine AI embedded in a hospital LIS. "
            "A lab technician has requested AI-assisted interpretation of completed lab results, "
            "with the patient's full clinical context from the hospital Knowledge Graph.\n\n"
            "Your task:\n"
            "1. Determine the overall assessment: NORMAL, ABNORMAL, or CRITICAL.\n"
            "2. Interpret each abnormal value in plain clinical language.\n"
            "3. Explain the clinical significance in the context of the patient's known diagnoses, medications, and history.\n"
            "4. Suggest specific follow-up actions.\n\n"
            "Rules:\n"
            "- Ground every interpretation in the Knowledge Graph and results provided.\n"
            "- Never fabricate values or diagnoses not present in the data.\n"
            "- If a value is critical, flag it prominently.\n\n"
            "Respond using EXACTLY these section headers:\n"
            "## OVERALL ASSESSMENT\nNORMAL | ABNORMAL | CRITICAL — [one sentence summary]\n\n"
            "## RESULT INTERPRETATION\n[Commentary on each abnormal/critical value]\n\n"
            "## CLINICAL CONTEXT\n[How these results relate to the patient's diagnoses, medications, and history]\n\n"
            "## RECOMMENDED FOLLOW-UP\n[Numbered follow-up actions]"
        )
        results_text = "\n".join(
            f"- {r.get('testName','?')}: {r.get('value','?')} {r.get('unit','')} (ref: {r.get('referenceRange','?')}) [flag: {r.get('flag','normal')}]"
            for r in results
        )
        user = (
            f"=== Lab Panel: {panel_name} ===\n{results_text}\n\n"
            f"=== Patient Knowledge Graph Context ===\n{graph_context}\n\n"
            f"=== Drug Safety Context ===\n{drug_safety_context}\n\n"
            "Please interpret these lab results in the context of this patient's full clinical picture."
        )
        raw = _call_llm_messages([{"role": "system", "content": system}, {"role": "user", "content": user}], max_tokens=900)

        def _ext(text, header, nexts):
            sm = f"## {header}"; s = text.find(sm)
            if s == -1: return ""
            s = text.find("\n", s) + 1; e = len(text)
            for n in nexts:
                p = text.find(f"## {n}", s)
                if p != -1: e = min(e, p)
            return text[s:e].strip()

        overall_raw = _ext(raw, "OVERALL ASSESSMENT", ["RESULT INTERPRETATION", "CLINICAL", "RECOMMENDED"])
        o = "critical" if "critical" in overall_raw.lower() else ("abnormal" if "abnormal" in overall_raw.lower() else "normal")
        return {
            "overall": o, "overall_text": overall_raw,
            "interpretation": _ext(raw, "RESULT INTERPRETATION", ["CLINICAL", "RECOMMENDED"]),
            "clinical_context": _ext(raw, "CLINICAL CONTEXT", ["RECOMMENDED"]),
            "follow_up": _ext(raw, "RECOMMENDED FOLLOW-UP", []),
            "summary": overall_raw, "raw": raw,
        }
