import json
import logging
import re
from typing import Any
from urllib import error, request

from apps.cdss.services.graph_service import GraphService
from apps.cdss.services.drug_knowledge_service import DrugKnowledgeService

logger = logging.getLogger(__name__)

_ARTIFACT_RE = re.compile(r"<unused\d+>.*?<unused\d+>", re.DOTALL | re.IGNORECASE)
_LONE_TAG_RE = re.compile(r"<unused\d+>", re.IGNORECASE)
_PIPE_TAG_RE = re.compile(r"<\|[^|>]+\|>")
_THINKING_LEAD_RE = re.compile(
    r"^\s*thought\b.*?(?=\n{2,}|\Z)",
    re.DOTALL | re.IGNORECASE,
)

def _strip_artifacts(text: str) -> str:
    """Remove model-internal thinking tokens and chain-of-thought from any LLM response."""
    text = _ARTIFACT_RE.sub("", text)
    text = _LONE_TAG_RE.sub("", text)
    text = _PIPE_TAG_RE.sub("", text)
    text = text.strip()
    text = re.sub(r"(?:\n?```)+\s*$", "", text).strip()
    if re.match(r"^thought\b", text, re.IGNORECASE):
        parts = re.split(r"\n{2,}", text, maxsplit=1)
        if len(parts) == 2 and parts[1].strip():
            text = parts[1].strip()
        else:
            clean_lines = [
                ln for ln in text.splitlines()
                if ln.strip()
                and not re.match(r"^\s*(\d+[\.\)]|[*•\-])\s", ln)
                and not re.match(r"^\s*thought\b", ln, re.IGNORECASE)
            ]
            text = " ".join(clean_lines).strip()
    return text

def context_sentences(text: str):
    return [line for line in text.split("\n") if line.strip().startswith("-")]

def _clean_report(text: str, report_datetime: str) -> str:
    """
    Post-process LLM report output:
    - Replace literal [Current Time] / [Date] / [Time] placeholders with the real value.
    - Remove duplicate section headings (## ...).
    - Remove repeated bullet lines (looping content at end of report).
    """
    import re as _re
    text = _re.sub(r"\[Current Time\]", report_datetime, text, flags=_re.IGNORECASE)
    text = _re.sub(r"\[Date\]", report_datetime.split()[0], text, flags=_re.IGNORECASE)
    text = _re.sub(r"\[Time\]", report_datetime.split()[1], text, flags=_re.IGNORECASE)
    text = _re.sub(r"\[Current Date\]", report_datetime.split()[0], text, flags=_re.IGNORECASE)

    seen_headings: set = set()
    seen_bullets: set = set()
    cleaned_lines = []
    for line in text.split("\n"):
        stripped = line.strip()
        if stripped.startswith("## ") or stripped.startswith("### "):
            key = stripped.lower()
            if key in seen_headings:
                continue
            seen_headings.add(key)
            seen_bullets.clear()  
        elif stripped.startswith("- ") or stripped.startswith("* "):
            bullet_key = stripped.lower()
            if bullet_key in seen_bullets:
                continue
            seen_bullets.add(bullet_key)
        cleaned_lines.append(line)

    return "\n".join(cleaned_lines).strip()

def _dedup_chat_response(text: str) -> str:
    """
    Truncate chat response at the first repeated sentence.
    Truncating (not filtering) gives a clean, natural ending.
    """
    import re as _re

    text = text.strip()
    parts = _re.split(r'(?<=[.!?])[ \t]*\n?[ \t]*', text)

    seen: set = set()
    unique: list = []
    for part in parts:
        key = part.strip().lower()
        if not key:
            continue
        if key in seen:
            break 
        seen.add(key)
        unique.append(part.strip())

    return " ".join(unique).strip()


def _call_llm(system: str, user: str) -> str:
    """
    Call the local MedGemma server (mlx_vlm OpenAI-compatible API).
    """
    return _call_llm_messages([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])

def _call_llm_messages(messages: list[dict], max_tokens: int = 1500, extra_payload: dict | None = None) -> str:
    """
    Call MedGemma with an arbitrary messages list.
    Each message content can be a string OR a list of content parts
    (OpenAI vision format) to support image inputs.
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
        "repetition_penalty": 1.3,
    }
    if extra_payload:
        payload.update(extra_payload)

    try:
        req = request.Request(
            llm_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with request.urlopen(req, timeout=llm_timeout) as response:
            result = json.loads(response.read().decode("utf-8"))
            raw = (
                result.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "[Error: No response from MedGemma]")
            )
            return _strip_artifacts(raw)

    except error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        logger.error("MedGemma HTTP %s from %s: %s", exc.code, llm_url, body)
        return (
            f"[MedGemma Unavailable — HTTP {exc.code}]\n"
            f"Endpoint: {llm_url}  Model: {model_name}\n"
            "Verify mlx_vlm server is running: "
            "python3 -m mlx_vlm.server --model .models/medgemma-1_5-4b-it-4bit --port 8081"
        )
    except error.URLError as exc:
        logger.error("MedGemma connection error at %s: %s", llm_url, exc)
        return (
            f"[MedGemma Unavailable — Connection Error]\n"
            f"Could not reach: {llm_url}\n"
            "Start the server with: "
            "python3 -m mlx_vlm.server --model .models/medgemma-1_5-4b-it-4bit --port 8081"
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

    lines = subs_raw.split("\n")
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        m = _re.match(r"^\d+[\.\)]\s+(.+)$", line)
        if m:
            drug = m.group(1).strip()
            reason = ""
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                reason_m = _re.match(r"(?i)reason\s*:\s*(.+)", next_line)
                if reason_m:
                    reason = reason_m.group(1).strip()
                    i += 1
            if not reason:
                inline = _re.split(r"\s[—\-]\s", drug, maxsplit=1)
                if len(inline) == 2:
                    drug, reason = inline[0].strip(), inline[1].strip()
            if drug and len(drug) > 3:
                results.append({"substitute": drug, "reason": reason or "See AI recommendations above."})
        i += 1

    if results:
        return results

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

    for line in lines:
        line = _re.sub(r"^[-•*]\s*", "", line.strip())
        if not line or len(line) < 5:
            continue
        parts = line.split(":", 1)
        if len(parts) == 2 and len(parts[0]) < 80:
            results.append({"substitute": parts[0].strip(), "reason": parts[1].strip()})
        elif " — " in line or " - " in line:
            parts = _re.split(r"\s[—\-]\s", line, maxsplit=1)
            if len(parts) == 2:
                results.append({"substitute": parts[0].strip(), "reason": parts[1].strip()})

    return results[:3]

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

        symptom_terms = GraphService._extract_symptom_terms(prompt_query)
        kg_differential = GraphService.get_kg_differential(symptom_terms) if symptom_terms else ""

        logger.info(
            "CDSS AI consult — patient %s | role %s | graph %d chars | drug safety %d chars | "
            "symptom terms %s | kg_differential %d chars",
            patient_uuid, role, len(graph_context), len(drug_safety_context),
            symptom_terms, len(kg_differential),
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
                + (f"{kg_differential}\n\n" if kg_differential else "")
                + "=== Pharmacist Query ===\n"
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
                + (f"{kg_differential}\n\n" if kg_differential else "")
                + "=== Doctor Query ===\n"
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

        demographics_block = ""
        try:
            from apps.patients.models import Patient
            from datetime import date
            patient = Patient.objects.filter(id=patient_uuid).first()
            if patient:
                dob = patient.date_of_birth
                age = (
                    (date.today() - dob).days // 365
                    if dob else None
                )
                parts = [
                    f"Name: {patient.first_name} {patient.last_name}",
                    f"MRN: {patient.mrn}",
                ]
                if age is not None:
                    parts.append(f"Age: {age} years")
                if patient.gender:
                    parts.append(f"Sex: {patient.gender}")
                if patient.blood_type:
                    parts.append(f"Blood type: {patient.blood_type}")
                if patient.status:
                    parts.append(f"Status: {patient.status}")
                demographics_block = "=== Patient Demographics ===\n" + "\n".join(parts) + "\n\n"
        except Exception:
            pass

        from datetime import datetime
        report_datetime = datetime.now().strftime("%Y-%m-%d %H:%M")

        if role == "pharmacist":
            system = (
                "You are a Clinical Pharmacist AI. Write a professional medication safety report "
                "for this patient based solely on the Knowledge Graph data provided.\n\n"
                "STRICT OUTPUT RULES:\n"
                "- Start immediately with '## Medication Safety Report' — no preamble, no date line, no disclaimer.\n"
                "- Write each section ONCE. Never repeat a section heading.\n"
                "- Never include placeholders like [Current Time] or [Date].\n"
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
                f"{demographics_block}"
                "=== Patient Medication & Allergy Context (Knowledge Graph) ===\n"
                f"{graph_context}\n\n"
                "=== Drug Safety Analysis ===\n"
                f"{drug_safety_context}\n\n"
                f"Report date/time: {report_datetime}\n"
                "Generate the medication safety report now."
            )
        else:
            system = (
                "You are an expert Clinical Decision Support AI. Write a comprehensive clinical "
                "summary report for this patient based solely on the Knowledge Graph data provided.\n\n"
                "STRICT OUTPUT RULES:\n"
                "- Start immediately with '## Clinical Summary Report' — no preamble, no date line, no disclaimer.\n"
                "- Write each section ONCE. Never repeat a section heading.\n"
                "- Never include placeholders like [Current Time] or [Date].\n"
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
                f"{demographics_block}"
                "=== Patient Knowledge Graph Context ===\n"
                f"{graph_context}\n\n"
                "=== Drug Safety Analysis ===\n"
                f"{drug_safety_context}\n\n"
                f"Report date/time: {report_datetime}\n"
                "Generate the clinical summary report now."
            )

        raw = _call_llm_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=2000,
            extra_payload={"repetition_penalty": 1.5},
        )
        return _clean_report(raw, report_datetime)

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
                "You are a Clinical Pharmacist AI in a hospital EHR.\n\n"
                "STRICT RULES:\n"
                "1. Start your reply IMMEDIATELY with the clinical answer. Never acknowledge, greet, or repeat the question.\n"
                "2. Answer ONLY what was asked. Do not list all patient data.\n"
                "3. Synthesise the context — never copy-paste raw data lines verbatim.\n"
                "4. Keep every reply to 2-3 sentences maximum unless the user explicitly asks for more.\n"
                "5. If there is a CRITICAL drug safety issue, lead with it in one sentence.\n"
                "6. Never fabricate drug names, doses, or interactions.\n\n"
                f"=== Patient Medication & Allergy Context ===\n{graph_context}\n\n"
                f"=== Drug Safety Analysis ===\n{drug_safety_context}"
            )
        else:
            system_content = (
                "You are a Clinical Decision Support AI in a hospital EHR.\n\n"
                "STRICT RULES:\n"
                "1. Start your reply IMMEDIATELY with the clinical answer. Never acknowledge, greet, or repeat the question.\n"
                "2. Answer ONLY what was asked. Do not list all patient data.\n"
                "3. Synthesise the context into a direct clinical answer — never copy-paste raw data lines verbatim.\n"
                "4. Keep every reply to 2-3 sentences maximum unless the user explicitly asks for more detail.\n"
                "5. If there is a CRITICAL safety issue, lead with it in one sentence.\n"
                "6. Never fabricate diagnoses, medications, or lab values.\n\n"
                f"=== Patient Knowledge Graph Context ===\n{graph_context}\n\n"
                f"=== Drug Safety Analysis ===\n{drug_safety_context}"
            )

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

        response = _call_llm_messages(messages, max_tokens=600, extra_payload={"repetition_penalty": 1.5})

        if user_message and user_message in response:
            idx = response.find(user_message)
            after = response[idx + len(user_message):].strip()
            before = response[:idx].strip()
            response = after if after else (before if before else response.replace(user_message, "").strip())

        _THINKING_PATTERN = re.compile(
            r"^(\d+\.\s+\*\*|\*\*Initial thought|\*\*Draft|Formulate a|"
            r"Identify the core|Recall standard|Consider the patient)",
            re.IGNORECASE | re.MULTILINE,
        )
        if _THINKING_PATTERN.search(response):
            logger.info("Chat: thinking-mode detected — issuing minimal re-prompt")
            response = _call_llm_messages(
                [
                    {
                        "role": "user",
                        "content": (
                            f"You were asked: \"{user_message}\"\n\n"
                            f"Your reasoning so far:\n{response}\n\n"
                            "Write your final answer in 2 sentences. "
                            "Plain prose only — no numbered steps, no bullet points, no headings."
                        ),
                    }
                ],
                max_tokens=150,
            )

        updated_history = [
            *safe_history,
            {"role": "user", "content": user_message},
            {"role": "assistant", "content": response},
        ]

        return _dedup_chat_response(response), updated_history

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
            "You are a Clinical Decision Support AI embedded in a hospital EHR.\n\n"
            "TASK: Analyse the SOAP note and patient context, then output EXACTLY the four sections below.\n\n"
            "=== STRICT FORMAT RULES ===\n"
            "1. Write each section header on its own line: ## DIFFERENTIAL DIAGNOSIS, etc.\n"
            "2. DIFFERENTIAL: list exactly 3 to 5 diagnoses ordered by clinical probability.\n"
            "   Each diagnosis on its OWN line in this EXACT format:\n"
            "   N. [LIKELIHOOD] Diagnosis Name (ICD-10: X00.0) — finding that supports OR excludes this\n"
            "   LIKELIHOOD must be ONE of: [MOST LIKELY] | [POSSIBLE] | [RULE OUT]\n"
            "   - [MOST LIKELY]: strongly supported by the specific ECG, labs, and exam findings present\n"
            "   - [POSSIBLE]: cannot be excluded yet but less supported by the specific data\n"
            "   - [RULE OUT]: common mimic — state the specific finding that argues against it\n"
            "3. PLAN medications: ONE drug per line, format: DrugName | dose | route | frequency\n"
            "   NEVER add parenthetical notes — ONLY the four fields above.\n"
            "4. PLAN investigations: list at most 5 tests, ONE per line. No explanations.\n"
            "5. Base ALL content only on the data provided. Never invent lab values, drugs, or findings.\n"
            "6. STOP writing immediately after the CLINICAL ALERTS section. No closing remarks.\n\n"
            "=== EXAMPLE OUTPUT (copy this structure exactly) ===\n"
            "## DIFFERENTIAL DIAGNOSIS\n"
            "1. [MOST LIKELY] NSTEMI (ICD-10: I21.4) — ST depression V4-V6 with exertional chest pressure and diaphoresis.\n"
            "2. [POSSIBLE] Unstable Angina (ICD-10: I20.0) — exertional symptoms but ST changes suggest active ischaemia.\n"
            "3. [RULE OUT] Pericarditis (ICD-10: I30.9) — ST depression is localised V4-V6, not diffuse saddle-shape; pain is exertional not positional.\n\n"
            "## SUGGESTED ASSESSMENT\n"
            "Patient presents with high-probability ACS. ECG changes and risk factors require urgent cardiology review.\n\n"
            "## SUGGESTED PLAN\n"
            "Medications:\n"
            "Aspirin | 300 mg | PO | stat then 75 mg daily\n"
            "Investigations:\n"
            "Serial 12-lead ECG\n"
            "Troponin I stat and 3h\n"
            "Chest X-ray\n\n"
            "## CLINICAL ALERTS\n"
            "No urgent alerts detected.\n"
            "=== END OF EXAMPLE ===\n\n"
            "Now write the actual output for the patient below. "
            "Do not copy the example values — use only the real patient data.\n\n"
            "CRITICAL: Write ALL four sections completely. "
            "Do NOT repeat any line. Each investigation on its own line, maximum 5 total.\n"
            "MEDICATION FORMAT IS STRICT: DrugName | dose | route | frequency — nothing else on that line.\n\n"
            "STRICT RULES for CLINICAL ALERTS:\n"
            "  - Do NOT copy or paraphrase lines from the Drug Safety Analysis block.\n"
            "  - Each alert must state the specific mechanism for that drug pair.\n"
            "  - Maximum 3 alerts. If none, write: No urgent alerts detected."
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
            "suggested plan (with medications AND investigations), and any clinical alerts."
        )

        raw = _call_llm_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=1200,
        )

        def _extract_section(text: str, header: str, next_headers: list[str]) -> str:
            markers = [
                f"## {header}",
                f"=== {header} ===",
                f"=== {header}===",
                f"==={header} ===",
                f"==={header}===",
            ]
            start = -1
            for m in markers:
                pos = text.find(m)
                if pos != -1:
                    start = pos
                    break
            if start == -1:
                return ""
            start = text.find("\n", start) + 1
            end = len(text)
            for nxt in next_headers:
                for nm in [
                    f"## {nxt}",
                    f"=== {nxt} ===",
                    f"=== {nxt}===",
                    f"==={nxt} ===",
                    f"==={nxt}===",
                ]:
                    pos = text.find(nm, start)
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

        def _dedup_plan(text: str) -> str:
            seen: set[str] = set()
            out: list[str] = []
            section_item_counts: dict[str, int] = {}
            current_section = "other"
            MAX_ITEMS_PER_SECTION = 6
            for line in text.splitlines():
                stripped = line.strip()
                key = stripped.lower()
                if stripped.endswith(":") or not stripped:
                    if stripped:
                        current_section = key
                        section_item_counts.setdefault(current_section, 0)
                    out.append(line)
                    continue
                if key in seen:
                    continue
                count = section_item_counts.get(current_section, 0)
                if count >= MAX_ITEMS_PER_SECTION:
                    continue
                seen.add(key)
                section_item_counts[current_section] = count + 1
                out.append(line)
            return "\n".join(out)

        plan_text = _dedup_plan(plan_text)

        _likelihood_re = re.compile(
            r"\[(MOST\s+LIKELY|POSSIBLE|RULE\s+OUT)\]",
            re.IGNORECASE,
        )

        def _trim_reasoning(text: str, max_len: int = 120) -> str:
            text = re.sub(r"\s+", " ", text).strip()
            m = re.match(r"^(.{20,}?[.!?])(?:\s|$)", text)
            if m and len(m.group(1)) <= max_len:
                return m.group(1)
            if len(text) <= max_len:
                return text
            return text[:max_len].rsplit(" ", 1)[0].rstrip(".,;") + "\u2026"

        def _extract_name_and_likelihood(chunk: str):
            chunk = re.sub(r"\s+", " ", chunk).strip()
            lm = _likelihood_re.search(chunk)
            likelihood = lm.group(1).upper().replace("  ", " ") if lm else None
            if likelihood:
                if "MOST" in likelihood:
                    likelihood = "MOST LIKELY"
                elif "RULE" in likelihood:
                    likelihood = "RULE OUT"
                else:
                    likelihood = "POSSIBLE"
            chunk = _likelihood_re.sub("", chunk).strip()
            chunk = re.sub(r"^\d+[\.)]\s*", "", chunk)
            frags = re.split(r"[.!?]\s+", chunk)
            name = frags[-1].strip()
            name = re.sub(r"^\d+[\.)]\s*", "", name).strip()
            return name.rstrip(".,: "), likelihood

        _anchor = re.compile(
            r"\(ICD-10:\s*([A-Z]\d[\w.]{0,6})\)\s*[\u2014\u2013\-]\s*",
            re.IGNORECASE,
        )
        pieces = _anchor.split(differential_text)

        differential_list = []
        i = 0
        while i + 1 < len(pieces):
            name, likelihood = _extract_name_and_likelihood(pieces[i])
            code = pieces[i + 1].upper()
            reasoning_raw = pieces[i + 2] if i + 2 < len(pieces) else ""
            reasoning = _trim_reasoning(reasoning_raw)
            if name and len(name) >= 3:
                differential_list.append({
                    "diagnosis": name,
                    "icd10Code": code,
                    "reasoning": reasoning,
                    "likelihood": likelihood,
                })
            i += 2

        if not differential_list:
            for line in differential_text.split("\n"):
                line = line.strip()
                if not line or not (line[0].isdigit() or line.startswith("-") or line.startswith("\u2022")):
                    continue
                cleaned = line.lstrip("0123456789.-\u2022) ").strip()
                if not cleaned:
                    continue
                lm = _likelihood_re.search(cleaned)
                likelihood = None
                if lm:
                    raw_l = lm.group(1).upper()
                    likelihood = "MOST LIKELY" if "MOST" in raw_l else ("RULE OUT" if "RULE" in raw_l else "POSSIBLE")
                    cleaned = _likelihood_re.sub("", cleaned).strip()
                parts = re.split(r"\s+[\u2014\u2013\-]\s+", cleaned, maxsplit=1)
                differential_list.append({
                    "diagnosis": parts[0].rstrip(".,: "),
                    "icd10Code": None,
                    "reasoning": _trim_reasoning(parts[1]) if len(parts) > 1 else "",
                    "likelihood": likelihood,
                })

        _TEMPLATE_NAMES = {"diagnosis name", "n. diagnosis name"}
        _TEMPLATE_CODES = {"x00.0", "x00", "x000"}
        differential_list = [
            d for d in differential_list
            if d["diagnosis"].lower().strip() not in _TEMPLATE_NAMES
            and (d.get("icd10Code") or "").lower() not in _TEMPLATE_CODES
            and d.get("likelihood") != "RULE OUT"
        ]

        differential_list = differential_list[:5]

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

            _seen_summaries: set[str] = set()
            for alert_line in alert_lines:
                if len(alert_line) < 10:
                    continue

                if alert_line in _seen_summaries:
                    continue
                _seen_summaries.add(alert_line)
                if CDSSRecommendation.objects.filter(
                    patient=patient,
                    encounter=encounter,
                    summary=alert_line,
                ).exists():
                    continue

                _title_match = re.match(r'^(.+?)\s*[:\-]\s*\[', alert_line)
                if _title_match:
                    title = _title_match.group(1).strip()[:120]
                else:
                    title = (alert_line[:77] + "\u2026") if len(alert_line) > 80 else alert_line
                severity = (
                    CDSSSeverity.CRITICAL
                    if _CRITICAL_KEYWORDS.search(alert_line)
                    else CDSSSeverity.WARNING
                )
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
                        "confidence": "low",
                    },
                )

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
                    pass

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
    def analyze_dicom_study(
        patient_uuid: str,
        metadata: dict,
        modality: str = "",
        body_part: str = "",
        indication: str = "",
        clinical_history: str = "",
        pixel_images_b64: list[str] | None = None,
    ) -> dict:
        """
        Generate a structured radiology report from DICOM images + metadata + patient KG.

        When pixel_images_b64 is provided (list of base64-encoded PNG strings extracted
        from the DICOM pixel array), MedGemma receives the actual image slices and can
        make real visual observations.  Falls back to metadata-only analysis if no
        pixel data is available.

        Returns:
            { technique, comparison, findings, impression,
              recommendations, alerts, aiSource, raw }
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        has_images = bool(pixel_images_b64)
        logger.info(
            "DICOM AI analysis — patient %s | %s %s | images=%d",
            patient_uuid, modality, body_part, len(pixel_images_b64 or []),
        )

        meta_parts = []
        for label, key in [
            ("Modality",             "modality"),
            ("Body Part",            "bodyPartExamined"),
            ("Study Description",    "studyDescription"),
            ("Series Description",   "seriesDescription"),
            ("Slice Thickness",      "sliceThickness"),
            ("Pixel Spacing",        "pixelSpacing"),
            ("KVP",                  "kvp"),
            ("Tube Current (mAs)",   "tubeCurrent"),
            ("Exposure Time (ms)",   "exposureTime"),
            ("Window Center",        "windowCenter"),
            ("Window Width",         "windowWidth"),
            ("Contrast Agent",       "contrastBolusAgent"),
            ("Number of Frames",     "numberOfFrames"),
            ("Image Type",           "imageType"),
            ("Study Date",           "studyDate"),
            ("Institution",          "institutionName"),
        ]:
            val = metadata.get(key) or (body_part if key == "bodyPartExamined" else None)
            if val:
                meta_parts.append(f"{label}: {val}")
        if metadata.get("manufacturer") or metadata.get("manufacturerModel"):
            scanner = " ".join(filter(None, [metadata.get("manufacturer"), metadata.get("manufacturerModel")]))
            meta_parts.append(f"Scanner: {scanner}")
        if metadata.get("rows") and metadata.get("columns"):
            meta_parts.append(f"Matrix: {metadata['rows']} × {metadata['columns']}")

        metadata_block = "\n".join(meta_parts) if meta_parts else "Metadata not available."

        if has_images:
            system = (
                "You are an expert radiologist AI assistant embedded in a hospital PACS/RIS system. "
                "You are provided with representative DICOM image slices (axial/sagittal/coronal views "
                "rendered as PNG) alongside acquisition metadata and the patient's clinical Knowledge Graph.\n\n"
                "TASK: Perform a visual analysis of the images and generate a structured radiology report.\n\n"
                "Rules:\n"
                "- Describe what you ACTUALLY SEE in the images (density, size, shape, location of structures).\n"
                "- Identify any abnormalities: masses, lesions, opacities, consolidations, effusions, fractures, "
                "  foreign bodies, asymmetries, or other findings.\n"
                "- Use Hounsfield unit ranges when relevant (e.g. fat -100 to -50 HU, soft tissue 20–80 HU, "
                "  bone >400 HU) if CT.\n"
                "- Reference the patient's KG context (diagnoses, symptoms, allergies, prior imaging) when "
                "  forming your IMPRESSION.\n"
                "- Ground your IMPRESSION and RECOMMENDATIONS in the Clinical Indication and Clinical History "
                "  provided — tailor your report to the specific clinical question being asked.\n"
                "- Flag CRITICAL ALERTS for: contrast allergy risk, implant contraindications, "
                "  urgent or life-threatening findings.\n"
                "- Be concise and use standard radiological reporting language.\n\n"
                "Respond using EXACTLY these section headers:\n"
                "## TECHNIQUE\n## COMPARISON\n## FINDINGS\n## IMPRESSION\n"
                "## RECOMMENDATIONS\n## CLINICAL ALERTS"
            )
        else:
            system = (
                "You are an expert radiologist AI assistant embedded in a hospital PACS/RIS system. "
                "You have received DICOM acquisition metadata and the patient's clinical Knowledge Graph. "
                "No pixel images are available — generate a metadata-grounded report draft.\n\n"
                "Rules:\n"
                "- Write an accurate TECHNIQUE from acquisition parameters.\n"
                "- Ground your IMPRESSION in the Clinical Indication and Clinical History provided.\n"
                "- In FINDINGS note that direct image review is required by the radiologist, then list "
                "  anatomical structures that should be systematically evaluated.\n"
                "- Use patient KG for IMPRESSION and CLINICAL ALERTS.\n\n"
                "Respond using EXACTLY these section headers:\n"
                "## TECHNIQUE\n## COMPARISON\n## FINDINGS\n## IMPRESSION\n"
                "## RECOMMENDATIONS\n## CLINICAL ALERTS"
            )

        text_content = (
            f"=== DICOM Acquisition Parameters ===\n{metadata_block}\n\n"
            f"=== Clinical Indication ===\n{indication or 'Not specified'}\n\n"
            f"=== Clinical History ===\n{clinical_history or 'Not provided'}\n\n"
            f"=== Patient Knowledge Graph Context ===\n{graph_context}\n\n"
        )
        if has_images:
            text_content += (
                f"{len(pixel_images_b64)} representative slice(s) are attached as images. "
                "Please analyse them and report your visual findings."
            )
        else:
            text_content += "No pixel images available. Generate a metadata-based report draft."

        if has_images:
            user_content: list[dict] = [{"type": "text", "text": text_content}]
            for b64 in pixel_images_b64:
                user_content.append({
                    "type": "image_url",
                    "image_url": {"url": f"data:image/png;base64,{b64}"},
                })
            messages = [
                {"role": "system", "content": system},
                {"role": "user",   "content": user_content},
            ]
        else:
            messages = [
                {"role": "system", "content": system},
                {"role": "user",   "content": text_content},
            ]

        raw = _call_llm_messages(messages, max_tokens=1200)

        def _ext(text: str, header: str, nexts: list) -> str:
            """
            Extract a report section from MedGemma output.

            Handles all output formats the model may use:
              ## TECHNIQUE        (markdown heading, content on next line)
              **TECHNIQUE**       (bold, content on next line)
              TECHNIQUE:          (colon suffix, content on same OR next line)
              TECHNIQUE           (bare word on its own line)
            """
            import re as _re

            def _build_header_pat(h: str) -> str:
                """Regex alternation that matches a single section header in any format."""
                esc = _re.escape(h)
                return (
                    rf"##\s+{esc}"
                    rf"|\*\*{esc}\*\*"
                    rf"|{esc}"
                )

            def _make_boundary_pat(headers: list) -> _re.Pattern:
                """Pattern that matches the start of any of the given section headers.
                Covers both standalone (header alone on a line) and inline
                (HEADER: content on same line) formats.
                """
                alts = "|".join(_build_header_pat(n) for n in headers)
                return _re.compile(
                    rf"(?:^(?:{alts})[:\s]*?[ \t]*$)"
                    rf"|(?:^(?:{alts})\s*:\s*(?=\S))",
                    _re.MULTILINE,
                )

            h_standalone = _re.compile(
                rf"(?m)^(?:{_build_header_pat(header)})[:\s]*?[ \t]*$"
            )
            m = h_standalone.search(text)
            if m:
                s = m.end()
                if s < len(text) and text[s] == "\n":
                    s += 1
                e = _make_boundary_pat(nexts).search(text, s).start() if nexts and _make_boundary_pat(nexts).search(text, s) else len(text)
                result = text[s:e].strip()
                result = _re.sub(r"^(?:```[a-z]*\n?)+", "", result)
                result = _re.sub(r"(?:\n?```)+$", "", result)
                return result.strip()

            h_inline = _re.compile(
                rf"(?m)^(?:{_build_header_pat(header)})\s*:\s*(?=\S)"
            )
            m = h_inline.search(text)
            if not m:
                return ""

            s = m.end()
            e = _make_boundary_pat(nexts).search(text, s).start() if nexts and _make_boundary_pat(nexts).search(text, s) else len(text)
            result = text[s:e].strip()
            result = _re.sub(r"^(?:```[a-z]*\n?)+", "", result)
            result = _re.sub(r"(?:\n?```)+$", "", result)
            return result.strip()

        technique       = _ext(raw, "TECHNIQUE",      ["COMPARISON", "FINDINGS", "IMPRESSION", "RECOMMENDATIONS", "CLINICAL ALERTS"])
        comparison      = _ext(raw, "COMPARISON",     ["FINDINGS", "IMPRESSION", "RECOMMENDATIONS", "CLINICAL ALERTS"])
        findings        = _ext(raw, "FINDINGS",        ["IMPRESSION", "RECOMMENDATIONS", "CLINICAL ALERTS"])
        impression      = _ext(raw, "IMPRESSION",      ["RECOMMENDATIONS", "CLINICAL ALERTS"])
        recommendations = _ext(raw, "RECOMMENDATIONS", ["CLINICAL ALERTS"])
        alerts          = _ext(raw, "CLINICAL ALERTS", [])

        if not findings and not impression:
            cleaned = raw.strip().lstrip("```").rstrip("```").strip()
            findings = cleaned

        return {
            "technique":       technique,
            "comparison":      comparison,
            "findings":        findings,
            "impression":      impression,
            "recommendations": recommendations,
            "alerts":          alerts,
            "aiSource":        "dicom_vision" if has_images else "dicom_metadata_text",
            "raw":             raw,
        }

    @staticmethod
    def suggest_imaging_appropriateness(
        patient_uuid: str,
        modality: str,
        body_part: str,
        indication: str,
        clinical_history: str = "",
    ) -> dict:
        """
        Assess whether the requested imaging study is appropriate for the clinical indication.

        Uses MedGemma + patient KG context (allergies, contrast history, diagnoses) to
        evaluate appropriateness following ACR Appropriateness Criteria principles.

        Returns:
            {
              "appropriate": True | False | None,
              "verdict":     "appropriate" | "inappropriate" | "uncertain",
              "reasoning":   str,
              "alternatives": str,
              "precautions":  str,
              "raw":         str,
            }
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        logger.info(
            "Imaging appropriateness check — patient %s | %s %s | indication: %.80s",
            patient_uuid, modality, body_part, indication,
        )

        system = (
            "You are a radiologist AI embedded in a hospital CDSS, specialised in imaging appropriateness. "
            "Your role is to assess whether a requested imaging study follows ACR Appropriateness Criteria.\n\n"
            "Rules:\n"
            "- Consider modality, body part, and clinical indication together.\n"
            "- Cross-check the patient's KG data for allergies (especially contrast agents), "
            "  implants (MRI contraindications), pregnancy, renal function (iodinated contrast), and existing imaging.\n"
            "- If a more appropriate modality exists for the indication, suggest it clearly.\n"
            "- If the study is appropriate, state so and list any precautions.\n"
            "- Be concise and action-oriented. Radiologists need a fast decision.\n\n"
            "Respond using EXACTLY these section headers:\n"
            "## APPROPRIATENESS VERDICT\n"
            "APPROPRIATE | INAPPROPRIATE | UNCERTAIN — [one sentence rationale]\n\n"
            "## CLINICAL REASONING\n"
            "[Evidence-based reasoning for the verdict. Reference specific ACR criteria or guidelines.]\n\n"
            "## ALTERNATIVE MODALITIES\n"
            "[If inappropriate or uncertain: list up to 3 better alternatives with reason. "
            "If appropriate: write 'No alternative needed.']\n\n"
            "## PRECAUTIONS\n"
            "[Safety precautions specific to this patient — allergies, contrast risks, implants, etc. "
            "If none: write 'No specific precautions identified.']"
        )
        user = (
            "=== Patient Clinical Context (Knowledge Graph) ===\n"
            f"{graph_context}\n\n"
            "=== Imaging Request ===\n"
            f"Modality: {modality}\n"
            f"Body Part: {body_part}\n"
            f"Indication: {indication or 'Not provided'}\n"
            f"Clinical History: {clinical_history or 'Not provided'}\n\n"
            "Assess whether this imaging study is appropriate for the indication. "
            "Suggest safer or more appropriate alternatives if they exist."
        )
        raw = _call_llm_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=900,
        )

        def _ext(text, header, nexts):
            sm = f"## {header}"
            s = text.find(sm)
            if s == -1:
                return ""
            s = text.find("\n", s) + 1
            e = len(text)
            for n in nexts:
                p = text.find(f"## {n}", s)
                if p != -1:
                    e = min(e, p)
            return text[s:e].strip()

        verdict_raw = _ext(raw, "APPROPRIATENESS VERDICT", ["CLINICAL REASONING", "ALTERNATIVE", "PRECAUTIONS"])
        vl = verdict_raw.lower()
        if "inappropriate" in vl:
            verdict = "inappropriate"
            appropriate = False
        elif "appropriate" in vl and "inappropriate" not in vl:
            verdict = "appropriate"
            appropriate = True
        else:
            verdict = "uncertain"
            appropriate = None

        return {
            "appropriate": appropriate,
            "verdict": verdict,
            "verdict_text": verdict_raw,
            "reasoning": _ext(raw, "CLINICAL REASONING", ["ALTERNATIVE", "PRECAUTIONS"]),
            "alternatives": _ext(raw, "ALTERNATIVE MODALITIES", ["PRECAUTIONS"]),
            "precautions": _ext(raw, "PRECAUTIONS", []),
            "raw": raw,
        }

    @staticmethod
    def suggest_radiology_report(
        patient_uuid: str,
        modality: str,
        body_part: str,
        indication: str,
        technique: str,
        findings: str,
    ) -> dict:
        """
        AI-assisted radiology report generation.

        Given the radiologist's findings text, generates a structured impression and
        follow-up recommendations, cross-referenced with the patient's clinical KG.

        Returns:
            {
              "impression":       str,
              "recommendations":  str,
              "alerts":           str,
              "raw":              str,
            }
        """
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        logger.info(
            "Radiology report AI assist — patient %s | %s %s | findings %.60s…",
            patient_uuid, modality, body_part, findings[:60],
        )

        system = (
            "You are an expert radiologist AI assistant embedded in a hospital RIS/PACS system. "
            "A radiologist has drafted their findings and needs help structuring the report impression.\n\n"
            "Rules:\n"
            "- Base the impression STRICTLY on the radiologist's findings text provided.\n"
            "- Never fabricate findings, measurements, or pathology not stated in the findings.\n"
            "- Cross-reference with the patient's clinical context from the Knowledge Graph.\n"
            "- Use precise radiology reporting language (density, signal, echogenicity, etc.).\n"
            "- If the findings contain a critical/urgent finding (e.g. PE, aortic dissection, "
            "  pneumothorax, fracture, mass), flag it in CRITICAL ALERTS.\n"
            "- Keep the impression concise and clinically actionable.\n\n"
            "Respond using EXACTLY these section headers:\n"
            "## IMPRESSION\n"
            "[Structured impression in standard radiology language. Number each finding.]\n\n"
            "## FOLLOW-UP RECOMMENDATIONS\n"
            "[Up to 4 numbered clinical recommendations based on the findings — "
            "e.g. additional views, follow-up imaging, clinical correlation, specialist referral. "
            "If no follow-up needed, write 'No immediate follow-up required.']\n\n"
            "## CRITICAL ALERTS\n"
            "[Any urgent/critical findings requiring immediate physician notification. "
            "If none, write 'No critical findings.']"
        )
        user = (
            "=== Patient Clinical Context (Knowledge Graph) ===\n"
            f"{graph_context}\n\n"
            "=== Study Information ===\n"
            f"Modality: {modality}\n"
            f"Body Part: {body_part}\n"
            f"Indication: {indication or 'Not provided'}\n"
            f"Technique: {technique or 'Standard protocol'}\n\n"
            "=== Radiologist's Findings ===\n"
            f"{findings}\n\n"
            "Based on the findings above and the patient's clinical context, "
            "draft a structured radiology report impression and follow-up recommendations."
        )
        raw = _call_llm_messages(
            [{"role": "system", "content": system}, {"role": "user", "content": user}],
            max_tokens=900,
        )

        def _ext(text, header, nexts):
            sm = f"## {header}"
            s = text.find(sm)
            if s == -1:
                return ""
            s = text.find("\n", s) + 1
            e = len(text)
            for n in nexts:
                p = text.find(f"## {n}", s)
                if p != -1:
                    e = min(e, p)
            return text[s:e].strip()

        impression = _ext(raw, "IMPRESSION", ["FOLLOW-UP", "CRITICAL"])
        recommendations = _ext(raw, "FOLLOW-UP RECOMMENDATIONS", ["CRITICAL"])
        alerts = _ext(raw, "CRITICAL ALERTS", [])

        return {
            "impression": impression or raw,
            "recommendations": recommendations,
            "alerts": alerts,
            "raw": raw,
        }

    @staticmethod
    def suggest_lab_interpretation(patient_uuid: str, panel_name: str, results: list) -> dict:
        """AI-assisted lab result interpretation grounded in the patient KG."""
        graph_context = GraphService.get_patient_subgraph_context(patient_uuid)
        logger.info("Lab AI interpretation — patient %s | panel %s | %d results", patient_uuid, panel_name, len(results))

        system = (
            "You are a Clinical Laboratory Medicine AI embedded in a hospital LIS. "
            "A lab technician has requested AI-assisted interpretation of completed lab results, "
            "with the patient's full clinical context from the hospital Knowledge Graph.\n\n"
            "Your task:\n"
            "1. Determine the overall assessment: NORMAL, ABNORMAL, or CRITICAL.\n"
            "2. Interpret each abnormal value in plain clinical language.\n"
            "3. Explain the clinical significance in the context of the patient's known diagnoses, medications, and history.\n"
            "4. Suggest specific follow-up actions based only on the lab results shown.\n\n"
            "Rules:\n"
            "- Ground every interpretation in the Knowledge Graph and results provided.\n"
            "- Never fabricate values or diagnoses not present in the data.\n"
            "- If a value is critical, flag it prominently.\n"
            "- RECOMMENDED FOLLOW-UP: write at most 5 numbered items, each specific to the actual results above.\n"
            "  Do NOT write generic drug monitoring reminders — those belong in a separate drug safety report.\n"
            "  Each item must directly relate to an abnormal or critical test value from this panel.\n\n"
            "Respond using EXACTLY these section headers:\n"
            "## OVERALL ASSESSMENT\nNORMAL | ABNORMAL | CRITICAL — [one sentence summary]\n\n"
            "## RESULT INTERPRETATION\n[Commentary on each abnormal/critical value]\n\n"
            "## CLINICAL CONTEXT\n[How these results relate to the patient's diagnoses and history]\n\n"
            "## RECOMMENDED FOLLOW-UP\n[Up to 5 numbered follow-up actions specific to the lab values above]"
        )
        results_text = "\n".join(
            f"- {r.get('testName','?')}: {r.get('value','?')} {r.get('unit','')} (ref: {r.get('referenceRange','?')}) [flag: {r.get('flag','normal')}]"
            for r in results
        )
        user = (
            f"=== Lab Panel: {panel_name} ===\n{results_text}\n\n"
            f"=== Patient Knowledge Graph Context ===\n{graph_context}\n\n"
            "Please interpret these lab results in the context of this patient's clinical picture."
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
