import { UserRole } from "@/types";
import type {
  CDSSRecommendation,
  CDSSOverrideRecord,
  CDSSStats,
} from "@/types";

// ── Evidence Source Library ──────────────────────────────────────────────────

const ADA_GUIDELINE = {
  id: "ev-ada-2026",
  title: "ADA Standards of Medical Care in Diabetes – 2026",
  shortName: "ADA 2026",
  sourceType: "guideline" as const,
  url: "https://diabetesjournals.org/care",
  publishedYear: 2026,
  evidenceGrade: "Level A",
  excerpt:
    "For patients with T2DM and established ASCVD, an SGLT-2 inhibitor or GLP-1 RA with proven CV benefit is recommended.",
};

const ACCP_VTE = {
  id: "ev-accp-vte",
  title: "ACCP Antithrombotic Therapy and Prevention of Thrombosis, 9th ed.",
  shortName: "ACCP 9th",
  sourceType: "guideline" as const,
  publishedYear: 2022,
  evidenceGrade: "Grade 1B",
  excerpt:
    "For major orthopaedic surgery, use LMWH for≥10 days and up to 35 days (Grade 1B).",
};

const DRUGS_COM = {
  id: "ev-drug-db",
  title: "Clinical Drug Interaction Database",
  shortName: "Drug DB v14",
  sourceType: "drug_database" as const,
  publishedYear: 2026,
  evidenceGrade: "Class I",
  excerpt: "Concomitant use of anticoagulants and NSAIDs significantly increases the risk of GI bleeding.",
};

const MICROMEDEX = {
  id: "ev-micromedex",
  title: "Micromedex Drug Interactions",
  shortName: "Micromedex 2026",
  sourceType: "drug_database" as const,
  publishedYear: 2026,
  evidenceGrade: "Major",
  excerpt: "The combination of warfarin and metronidazole significantly increases the anticoagulant effect of warfarin, elevating the risk of bleeding.",
};

const ACOG_PRENATAL = {
  id: "ev-acog-prenatal",
  title: "ACOG Practice Bulletin No. 226 – Fetal Growth Restriction",
  shortName: "ACOG PB-226",
  sourceType: "guideline" as const,
  publishedYear: 2021,
  evidenceGrade: "Level B",
  excerpt: "Anatomy survey ultrasound is recommended for all patients at 18–22 weeks.",
};

const KDIGO_CKD = {
  id: "ev-kdigo-ckd",
  title: "KDIGO 2022 Clinical Practice Guideline for Diabetes Management in CKD",
  shortName: "KDIGO CKD 2022",
  sourceType: "guideline" as const,
  publishedYear: 2022,
  evidenceGrade: "Level A",
  excerpt:
    "Metformin should be discontinued or dose-adjusted when eGFR falls below 30 mL/min/1.73m².",
};

const SURVIVING_SEPSIS = {
  id: "ev-sepsis-2021",
  title: "Surviving Sepsis Campaign: International Guidelines 2021",
  shortName: "SSC 2021",
  sourceType: "guideline" as const,
  publishedYear: 2021,
  evidenceGrade: "Strong",
  excerpt:
    "We recommend that resuscitation of patients with sepsis-induced hypoperfusion with at least 30 mL/kg of IV crystalloid fluid be given within the first 3 hours (Strong recommendation).",
};

const AI_EHR_MODEL = {
  id: "ev-ai-model",
  title: "Hospital EHR Pattern Recognition Model v3.2",
  shortName: "AI Model v3.2",
  sourceType: "ai_model" as const,
  publishedYear: 2026,
  excerpt:
    "Model trained on 2.1M de-identified patient records. AUC 0.94 for 30-day readmission prediction.",
};

const USPSTF_COLON = {
  id: "ev-uspstf-colon",
  title: "USPSTF Recommendation: Colorectal Cancer Screening (2021)",
  shortName: "USPSTF 2021",
  sourceType: "guideline" as const,
  publishedYear: 2021,
  evidenceGrade: "Grade A",
  excerpt: "The USPSTF recommends screening for colorectal cancer in all adults aged 45–75 years.",
};

// ── Mock Recommendations ─────────────────────────────────────────────────────

export const mockCDSSRecommendations: CDSSRecommendation[] = [
  {
    id: "cdss-001",
    patientId: "pat-002",
    patientName: "Robert Williams",
    patientMRN: "MRN-10022",
    encounterId: "enc-002",
    sourceModule: "doctor",
    targetRoles: [UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.NURSE],
    type: "drug_interaction",
    severity: "critical",
    status: "active",
    title: "Major Drug Interaction: Heparin + Ketorolac",
    summary:
      "Concurrent use of unfractionated heparin and ketorolac (NSAID) substantially increases GI and systemic bleeding risk. Ketorolac was ordered in the post-STEMI care plan.",
    triggeredBy: "Ketorolac order placed",
    affectedMedications: ["Heparin 25,000U/250mL", "Ketorolac 30mg IV"],
    suggestedActions: [
      "Discontinue ketorolac; use acetaminophen 1g IV q6h for analgesia",
      "If NSAID is clinically necessary, consult pharmacy for risk-benefit assessment",
      "Monitor CBC and stool guaiac if co-administration is unavoidable",
    ],
    explanation: {
      summary:
        "Heparin inhibits thrombin and factor Xa; NSAIDs inhibit COX-1-mediated platelet aggregation. The combined antiplatelet and anticoagulant effect creates a synergistic bleeding risk, especially in post-MI patients with compromised gastric mucosa.",
      reasoning: [
        "Patient is actively anticoagulated with UFH for post-STEMI management",
        "Ketorolac was ordered for post-procedure chest pain by covering intern",
        "COX-1 inhibition reduces thromboxane A₂, impairing platelet plug formation",
        "Post-infarction gastric mucosal integrity is often compromised, raising GI bleed risk",
        "Severity rated MAJOR in Micromedex and Drug Interaction Database",
      ],
      clinicalInputs: [
        { label: "Current anticoagulant", value: "Heparin gtt active", flag: "high" },
        { label: "New order", value: "Ketorolac 30mg IV × 1", flag: "critical" },
        { label: "Platelet count", value: "142 ×10³/µL", flag: "normal" },
        { label: "Hgb", value: "10.8 g/dL", flag: "low" },
        { label: "Cardiac history", value: "STEMI 48h ago" },
      ],
      limitations: [
        "Cannot assess full analgesia context; clinical need may justify short-term use",
        "GI bleed risk modelling based on population data, not individual risk score",
      ],
      confidence: "high",
      confidenceScore: 97,
      modelVersion: "PharmAlert v2.4",
    },
    evidenceSources: [DRUGS_COM, MICROMEDEX],
    generatedAt: "2026-03-16T08:14:22",
  },
  {
    id: "cdss-002",
    patientId: "pat-002",
    patientName: "Robert Williams",
    patientMRN: "MRN-10022",
    sourceModule: "doctor",
    targetRoles: [UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.NURSE],
    type: "allergy",
    severity: "critical",
    status: "active",
    title: "Documented Sulfa Allergy — Sulfamethoxazole Not Safe",
    summary:
      "Patient has a documented allergy to sulfonamides (reaction: anaphylaxis). No sulfa-containing drugs should be ordered without allergy work-up.",
    triggeredBy: "Patient allergy profile",
    affectedMedications: ["Sulfamethoxazole-trimethoprim"],
    suggestedActions: [
      "Do not order any sulfonamide-containing medications",
      "For UTI coverage, use nitrofurantoin or fosfomycin as alternatives",
      "Document allergy confirmation in allergy list",
    ],
    explanation: {
      summary:
        "Sulfonamide allergy is present in the patient's chart with a recorded reaction of anaphylaxis. Any sulfa-class medications carry significant risk of life-threatening hypersensitivity.",
      reasoning: [
        "EHR allergy list documents Sulfa → Anaphylaxis (entered 2024-07-12)",
        "No desensitization protocol on record",
        "Anaphylaxis category overrides standard cross-reactivity tolerability",
      ],
      clinicalInputs: [
        { label: "Allergy: Sulfa", value: "Anaphylaxis", flag: "critical" },
        { label: "Allergy documented", value: "2024-07-12" },
        { label: "Desensitization", value: "None on record" },
      ],
      limitations: ["Cross-reactivity with non-sulfonamide drugs is low but not zero"],
      confidence: "high",
      confidenceScore: 99,
      modelVersion: "AllergyGuard v1.8",
    },
    evidenceSources: [DRUGS_COM],
    generatedAt: "2026-03-16T07:55:01",
  },
  {
    id: "cdss-003",
    patientId: "pat-001",
    patientName: "Emily Johnson",
    patientMRN: "MRN-10011",
    encounterId: "enc-001",
    sourceModule: "doctor",
    targetRoles: [UserRole.DOCTOR],
    type: "guideline",
    severity: "info",
    status: "active",
    title: "Consider Statin + SGLT-2 Inhibitor for T2DM with ASCVD",
    summary:
      "LDL 142 mg/dL at last check (target < 100). ADA 2026 recommends high-intensity statin and SGLT-2 inhibitor for this risk profile. Empagliflozin not yet on medication list.",
    triggeredBy: "LDL result + diagnosis of T2DM with ASCVD",
    affectedMedications: ["Metformin 1000mg", "Atorvastatin 10mg"],
    suggestedActions: [
      "Escalate atorvastatin to 40–80mg high-intensity dosing",
      "Initiate empagliflozin 10mg daily (CV mortality benefit per EMPA-REG)",
      "Repeat LDL in 6–8 weeks after statin intensification",
    ],
    explanation: {
      summary:
        "Emily has T2DM with documented ASCVD (prior MI). ADA 2026 mandates both high-intensity statin therapy (LDL < 70 mg/dL for very high risk) and a cardioprotective SGLT-2 inhibitor or GLP-1 RA.",
      reasoning: [
        "Active diagnoses: T2DM (HbA1c 8.4%) + CAD with prior MI",
        "Current atorvastatin 10mg is low-intensity — below ADA recommended threshold",
        "LDL 142 mg/dL is 72 mg/dL above the < 70 target for very high CV risk",
        "No SGLT-2 inhibitor or GLP-1 RA in current medication list",
        "Empagliflozin has proven 38% relative reduction in CV death (EMPA-REG OUTCOME trial)",
      ],
      clinicalInputs: [
        { label: "HbA1c", value: "8.4%", flag: "high" },
        { label: "LDL-C", value: "142 mg/dL", flag: "high" },
        { label: "Current statin", value: "Atorvastatin 10mg (low-intensity)", flag: "low" },
        { label: "SGLT-2 inhibitor", value: "None", flag: "high" },
        { label: "eGFR", value: "62 mL/min" },
      ],
      limitations: [
        "Dose escalation requires assessment of hepatic function and statin tolerability",
        "SGLT-2 safety depends on eGFR (≥30) and absence of recurrent UTIs",
      ],
      confidence: "high",
      confidenceScore: 92,
      modelVersion: "GuidelineSync v4.1",
    },
    evidenceSources: [ADA_GUIDELINE],
    generatedAt: "2026-03-16T09:02:10",
  },
  {
    id: "cdss-004",
    patientId: "pat-004",
    patientName: "Michael Lee",
    patientMRN: "MRN-10044",
    encounterId: "enc-004",
    sourceModule: "lab",
    targetRoles: [UserRole.DOCTOR, UserRole.PHARMACIST],
    type: "dosage_warning",
    severity: "warning",
    status: "active",
    title: "Metformin Dose Unsafe for Current eGFR",
    summary:
      "eGFR has declined to 28 mL/min (CKD stage 4). KDIGO and FDA labeling require metformin discontinuation when eGFR < 30. Current order for metformin 1000mg BID should be reviewed.",
    triggeredBy: "eGFR 28 mL/min result",
    affectedMedications: ["Metformin 1000mg BID"],
    suggestedActions: [
      "Hold metformin pending nephrology consultation",
      "Consider switching to insulin or GLP-1 RA for glycemic control",
      "Recheck renal panel in 48–72 hours to confirm trend",
    ],
    explanation: {
      summary:
        "Metformin is renally cleared; impaired excretion leads to accumulation and risk of lactic acidosis, a rare but potentially fatal complication. FDA labeling and KDIGO 2022 both prohibit use when eGFR < 30.",
      reasoning: [
        "eGFR decreased from 44 → 28 mL/min over past 3 weeks",
        "Metformin 1000mg BID (full dose) remains active in medication list",
        "Risk of metformin-associated lactic acidosis (MALA) increases significantly at eGFR < 30",
        "KDIGO 2022 mandates discontinuation; FDA label updated 2016 confirms threshold",
      ],
      clinicalInputs: [
        { label: "eGFR (today)", value: "28 mL/min", flag: "critical" },
        { label: "eGFR (3 weeks ago)", value: "44 mL/min", flag: "low" },
        { label: "Serum creatinine", value: "2.4 mg/dL", flag: "high" },
        { label: "BUN", value: "34 mg/dL", flag: "high" },
        { label: "Current metformin dose", value: "1000mg BID" },
      ],
      limitations: [
        "Acute eGFR change may be transient; confirm with repeat testing",
        "Risk model does not account for volume status or concurrent nephrotoxins",
      ],
      confidence: "high",
      confidenceScore: 95,
      modelVersion: "RenalSafe v2.1",
    },
    evidenceSources: [KDIGO_CKD],
    generatedAt: "2026-03-16T10:48:33",
  },
  {
    id: "cdss-005",
    patientId: "pat-004",
    patientName: "Michael Lee",
    patientMRN: "MRN-10044",
    sourceModule: "doctor",
    targetRoles: [UserRole.DOCTOR, UserRole.NURSE],
    type: "guideline",
    severity: "warning",
    status: "acknowledged",
    title: "DVT Prophylaxis Not Documented – Post-Surgical Day 3",
    summary:
      "Michael is post-op day 3 following abdominal surgery. ACCP guidelines mandate chemical or mechanical VTE prophylaxis. No enoxaparin or compression device order found.",
    triggeredBy: "Post-op day 3 + no VTE prophylaxis order",
    suggestedActions: [
      "Order enoxaparin 40mg SC daily if no contraindication",
      "If anticoagulation contraindicated, apply sequential compression devices",
      "Assess Caprini VTE risk score (likely ≥3)",
    ],
    explanation: {
      summary:
        "Post-surgical patients are at high VTE risk. ACCP 9th edition recommends pharmacologic prophylaxis for major abdominal surgery. The absence of any prophylaxis order on post-op day 3 is a care gap.",
      reasoning: [
        "Surgery date: 2026-03-13 (abdominal — risk category: high)",
        "No enoxaparin, heparin, or fondaparinux in active medication list",
        "No compression device orders in nursing flowsheet",
        "Mobility documented as: bed-rest with assistance",
      ],
      clinicalInputs: [
        { label: "Surgery type", value: "Laparotomy (abdominal)" },
        { label: "Post-op day", value: "3" },
        { label: "VTE prophylaxis", value: "None ordered", flag: "critical" },
        { label: "Mobility status", value: "Bed-rest" },
        { label: "Platelet count", value: "218 ×10³/µL", flag: "normal" },
      ],
      limitations: [
        "Cannot verify if verbal order was given without documentation",
        "Renal dose adjustment required if eGFR < 30 (see Rec cdss-004)",
      ],
      confidence: "moderate",
      confidenceScore: 78,
      modelVersion: "GuidelineSync v4.1",
    },
    evidenceSources: [ACCP_VTE],
    generatedAt: "2026-03-15T16:22:00",
    acknowledgedBy: "Dr. David Chen",
    acknowledgedAt: "2026-03-16T08:00:00",
  },
  {
    id: "cdss-006",
    patientId: "pat-005",
    patientName: "Aisha Patel",
    patientMRN: "MRN-10055",
    sourceModule: "doctor",
    targetRoles: [UserRole.DOCTOR],
    type: "preventive",
    severity: "info",
    status: "active",
    title: "Week-20 Anatomy Ultrasound Due",
    summary:
      "Aisha is at 21 weeks gestation. ACOG recommends anatomy survey ultrasound between 18–22 weeks. No anatomy scan is documented in the chart.",
    triggeredBy: "Gestational age 21 weeks + no anatomy scan on file",
    suggestedActions: [
      "Order anatomy survey ultrasound (18–22 weeks)",
      "Order quad-screen maternal serum markers if not already drawn",
      "Schedule OB follow-up in 2 weeks",
    ],
    explanation: {
      summary:
        "The 18–22 week anatomy scan is the standard of care per ACOG PB-226 to detect structural fetal anomalies. Gestational age is within the recommended window.",
      reasoning: [
        "LMP documented as 2025-10-08; gestational age 21+3 weeks",
        "No radiology order for anatomy ultrasound in chart",
        "Quad screen not yet resulted",
      ],
      clinicalInputs: [
        { label: "Gestational age", value: "21 weeks 3 days" },
        { label: "Anatomy scan", value: "Not on file", flag: "high" },
        { label: "Quad screen", value: "Not resulted", flag: "high" },
      ],
      limitations: ["Cannot determine if scan was done at outside facility"],
      confidence: "moderate",
      confidenceScore: 81,
      modelVersion: "OBGuide v1.3",
    },
    evidenceSources: [ACOG_PRENATAL],
    generatedAt: "2026-03-16T11:30:00",
  },
  {
    id: "cdss-007",
    patientId: "pat-003",
    patientName: "Linda Thompson",
    patientMRN: "MRN-10033",
    encounterId: "enc-003",
    sourceModule: "pharmacy",
    targetRoles: [UserRole.DOCTOR, UserRole.PHARMACIST],
    type: "drug_interaction",
    severity: "critical",
    status: "overridden",
    title: "Drug Interaction: Warfarin + Metronidazole (INR Risk)",
    summary:
      "Metronidazole was ordered for C. diff prophylaxis. It inhibits CYP2C9, markedly potentiating warfarin's anticoagulant effect. INR may rise to dangerous levels within 48–72h.",
    triggeredBy: "Metronidazole ordered while on warfarin",
    affectedMedications: ["Warfarin 5mg OD", "Metronidazole 500mg TID"],
    suggestedActions: [
      "Hold warfarin or reduce dose by 25–50% empirically",
      "Check INR every 48h during metronidazole course",
      "Consider oral vancomycin as an alternative with fewer CYP interactions",
    ],
    explanation: {
      summary:
        "Metronidazole potently inhibits CYP2C9, the primary enzyme responsible for S-warfarin metabolism. This leads to significantly elevated warfarin plasma levels and INR. The combination carries a Major severity rating.",
      reasoning: [
        "Warfarin 5mg OD active; INR was 2.1 (in range) as of 2026-03-14",
        "Metronidazole 500mg TID ordered 2026-03-16 for C. diff coverage",
        "CYP2C9 inhibition by metronidazole is well-documented (Major interaction, Micromedex)",
        "Expected INR rise: 1.5–2× within 48–72 hours",
      ],
      clinicalInputs: [
        { label: "Current INR", value: "2.1", flag: "normal" },
        { label: "Warfarin dose", value: "5mg OD" },
        { label: "New order", value: "Metronidazole 500mg TID", flag: "critical" },
        { label: "Target INR range", value: "2.0–3.0" },
      ],
      limitations: [
        "CYP2C9 interaction magnitude varies by genetic polymorphism (*2, *3 alleles)",
        "Clinical monitoring can mitigate but not eliminate risk",
      ],
      confidence: "high",
      confidenceScore: 96,
      modelVersion: "PharmAlert v2.4",
    },
    evidenceSources: [MICROMEDEX, DRUGS_COM],
    generatedAt: "2026-03-16T13:05:00",
    overrideReason:
      "Only effective C. diff treatment option; will monitor INR daily and hold warfarin for 48h",
    overrideReasonCategory: "clinical_judgment",
    overriddenBy: "Dr. David Chen",
    overriddenAt: "2026-03-16T13:15:00",
  },
  {
    id: "cdss-008",
    patientId: "pat-006",
    patientName: "James Okafor",
    patientMRN: "MRN-10066",
    sourceModule: "nursing",
    targetRoles: [UserRole.DOCTOR, UserRole.NURSE],
    type: "sepsis_alert",
    severity: "critical",
    status: "active",
    title: "Sepsis Risk: qSOFA Score 2 — Initiate Sepsis Protocol",
    summary:
      "Patient meets qSOFA criteria (RR ≥22, altered mentation, SBP ≤100). AI model additionally flags 89% probability of sepsis based on EHR trends. Initiate Sepsis-3 protocol.",
    triggeredBy: "qSOFA ≥2 + AI sepsis probability 89%",
    suggestedActions: [
      "Draw blood cultures ×2 before antibiotics (within 1 hour)",
      "Administer IV piperacillin-tazobactam 3.375g q6h empirically",
      "Give 30 mL/kg IV crystalloid bolus within 3 hours",
      "Obtain serum lactate; repeat in 2h if ≥2 mmol/L",
      "Page ICU attending for disposition evaluation",
    ],
    explanation: {
      summary:
        "James meets Sepsis-3 qSOFA criteria: respiratory rate 24/min, GCS 13 (acute change), SBP 92 mmHg. AI pattern model corroborates with 89% sepsis probability. SSC 2021 mandates immediate bundle activation.",
      reasoning: [
        "RR: 24/min (≥22 — qSOFA point 1)",
        "GCS: 13 — change from baseline 15 (≥2 — qSOFA point 2)",
        "SBP: 92 mmHg (≤100 — qSOFA point 3)",
        "Temperature: 38.9°C, WBC: 18.4k, Lactate: 2.6 mmol/L (trending up)",
        "AI model: 89% sepsis probability (trained on 2.1M patient records, AUC 0.94)",
      ],
      clinicalInputs: [
        { label: "RR", value: "24/min", flag: "high" },
        { label: "GCS", value: "13 (baseline 15)", flag: "critical" },
        { label: "SBP", value: "92 mmHg", flag: "critical" },
        { label: "Temperature", value: "38.9 °C", flag: "high" },
        { label: "WBC", value: "18.4 ×10³/µL", flag: "high" },
        { label: "Lactate", value: "2.6 mmol/L", flag: "high" },
        { label: "AI Sepsis Probability", value: "89%", flag: "critical" },
      ],
      limitations: [
        "qSOFA is a screening tool, not diagnostic — SOFA score needs full assessment",
        "AI model may overweight lactate trend; clinical gestalt is essential",
        "Source of infection not yet identified",
      ],
      confidence: "high",
      confidenceScore: 89,
      modelVersion: "SepsisAlert v1.7 + AI EHR Model v3.2",
    },
    evidenceSources: [SURVIVING_SEPSIS, AI_EHR_MODEL],
    generatedAt: "2026-03-16T14:02:55",
  },
  {
    id: "cdss-009",
    patientId: "pat-007",
    patientName: "Carol Nguyen",
    patientMRN: "MRN-10077",
    sourceModule: "lab",
    targetRoles: [UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH],
    type: "panic_value",
    severity: "warning",
    status: "active",
    title: "Critical Troponin I — Rule Out ACS",
    summary:
      "Troponin I 1.82 ng/mL (ref < 0.04). Delta troponin pending. High-sensitivity troponin pattern suggests NSTEMI. Cardiology consult and serial ECGs recommended.",
    triggeredBy: "Troponin I 1.82 ng/mL (ref < 0.04)",
    suggestedActions: [
      "Order repeat hsTnI at 3 hours for delta troponin",
      "12-lead ECG immediately and again at 30 minutes",
      "Stat cardiology consult",
      "Initiate dual antiplatelet therapy per ACS protocol unless contraindicated",
      "Hold NSAIDs and anticoagulation pending cardiology review",
    ],
    explanation: {
      summary:
        "Troponin I of 1.82 ng/mL is 45× the upper reference limit. Combined with chest pain and ST-segment changes, this pattern is consistent with NSTEMI by 4th Universal Definition. Urgent risk stratification required.",
      reasoning: [
        "hsTnI: 1.82 ng/mL — 45× URL (URL = 0.04 ng/mL)",
        "Symptom onset: ~4 hours ago (chest tightness, dyspnea)",
        "ECG: ST depression leads V4–V6",
        "HEART Score (preliminary): 6 — high risk",
      ],
      clinicalInputs: [
        { label: "hsTnI", value: "1.82 ng/mL (ref < 0.04)", flag: "critical" },
        { label: "ECG", value: "ST depression V4-V6", flag: "high" },
        { label: "Chest pain onset", value: "~4 hours ago" },
        { label: "HEART Score", value: "6 (High)" },
      ],
      limitations: [
        "Troponin elevation is not pathognomonic for ACS — myocarditis, PE must be excluded",
        "Delta troponin required to confirm acute vs. chronic elevation",
      ],
      confidence: "moderate",
      confidenceScore: 83,
      modelVersion: "CardioAlert v2.0",
    },
    evidenceSources: [AI_EHR_MODEL],
    generatedAt: "2026-03-16T12:20:44",
  },
  {
    id: "cdss-010",
    patientId: "pat-008",
    patientName: "George Hamilton",
    patientMRN: "MRN-10088",
    sourceModule: "doctor",
    targetRoles: [UserRole.DOCTOR],
    type: "preventive",
    severity: "info",
    status: "followed",
    title: "Overdue Colorectal Cancer Screening – Age 52",
    summary:
      "George is 52 years old with no prior colonoscopy on record. USPSTF Grade A recommendation for CRC screening starting age 45. Last GI visit 2023.",
    triggeredBy: "Age 52 + no CRC screening on file",
    suggestedActions: [
      "Order colonoscopy or offer stool-based FIT/FOBT test",
      "Discuss family history to determine if earlier/more frequent screening warranted",
    ],
    explanation: {
      summary:
        "Colorectal cancer screening has Grade A evidence for adults aged 45–75. George has not had any documented CRC screening; colonoscopy or annual FIT is overdue.",
      reasoning: [
        "Date of birth: 1973-11-04 (age 52)",
        "No colonoscopy or FIT/FOBT in chart history",
        "No contraindication on record",
      ],
      clinicalInputs: [
        { label: "Age", value: "52" },
        { label: "Last colonoscopy", value: "None on record", flag: "high" },
        { label: "Family CRC history", value: "Unknown" },
      ],
      limitations: ["Outside records may contain prior screening not imported into EHR"],
      confidence: "moderate",
      confidenceScore: 74,
      modelVersion: "PreventiveCare v1.5",
    },
    evidenceSources: [USPSTF_COLON],
    generatedAt: "2026-03-14T08:00:00",
    acknowledgedBy: "Dr. Sarah Kim",
    acknowledgedAt: "2026-03-14T09:30:00",
  },

  // ── Lab module: Hemoglobin delta check ─────────────────────────────────────
  {
    id: "cdss-011",
    patientId: "pat-003",
    patientName: "Linda Thompson",
    patientMRN: "MRN-10033",
    encounterId: "enc-003",
    sourceModule: "lab",
    targetRoles: [UserRole.DOCTOR, UserRole.NURSE, UserRole.LAB_TECH],
    type: "delta_check",
    severity: "warning",
    status: "active",
    title: "Hemoglobin Delta Alert: 3.2 g/dL Drop in 24 Hours",
    summary:
      "Hemoglobin decreased from 11.4 g/dL (yesterday) to 8.2 g/dL (today). A drop ≥ 2 g/dL in 24 hours triggers a delta check alert. Active anticoagulation may be contributing.",
    triggeredBy: "Delta Hgb −3.2 g/dL in 24h",
    suggestedActions: [
      "Repeat CBC with peripheral smear to confirm result and exclude lab error",
      "Assess for occult bleeding given active warfarin therapy",
      "Notify attending physician immediately",
      "Type and screen if Hgb < 7 or haemodynamically unstable",
    ],
    explanation: {
      summary:
        "A 3.2 g/dL haemoglobin drop in 24h exceeds the validated delta check threshold (2 g/dL/24h). In the context of active anticoagulation with warfarin for AF, occult GI haemorrhage or internal bleeding must be excluded.",
      reasoning: [
        "Hgb yesterday (2026-03-15): 11.4 g/dL",
        "Hgb today (2026-03-16): 8.2 g/dL → delta: −3.2 g/dL",
        "Delta check rule: Δ > 2.0 g/dL in 24h = clinically significant flag",
        "Patient is on warfarin; INR was supratherapeutic (see cdss-007)",
        "Algorithm excludes known haemodilution in this case (no IV fluids ≥ 500 mL recorded)",
      ],
      clinicalInputs: [
        { label: "Hgb today",      value: "8.2 g/dL",   flag: "critical" },
        { label: "Hgb yesterday",  value: "11.4 g/dL",  flag: "low" },
        { label: "Delta Hgb",      value: "−3.2 g/dL",  flag: "critical" },
        { label: "INR (last)",     value: "2.1",         flag: "normal" },
        { label: "Active anticoag", value: "Warfarin 5mg OD" },
      ],
      limitations: [
        "Lab error (haemolysis, wrong tube) not fully excluded without repeat",
        "Acute fluid shifts can cause artificial Hgb drop",
      ],
      confidence: "high",
      confidenceScore: 91,
      modelVersion: "LIS DeltaCheck v2.0",
    },
    evidenceSources: [AI_EHR_MODEL],
    generatedAt: "2026-03-16T06:45:00",
  },

  // ── Pharmacy module: Duplicate opioid therapy ──────────────────────────────
  {
    id: "cdss-012",
    patientId: "pat-006",
    patientName: "James Okafor",
    patientMRN: "MRN-10066",
    encounterId: "enc-006",
    sourceModule: "pharmacy",
    targetRoles: [UserRole.DOCTOR, UserRole.PHARMACIST, UserRole.NURSE],
    type: "duplicate_therapy",
    severity: "critical",
    status: "active",
    title: "Duplicate Opioid Therapy: Fentanyl Patch + Oxycodone PRN",
    summary:
      "Fentanyl 25 mcg/hr patch (long-acting) and oxycodone 10mg PRN q4h (short-acting) are both active. Two concurrent opioids create high risk of respiratory depression, especially in a sedated patient.",
    triggeredBy: "Two concurrent opioid orders detected",
    affectedMedications: ["Fentanyl 25 mcg/hr patch", "Oxycodone 10mg PO PRN"],
    suggestedActions: [
      "Hold oxycodone PRN until fentanyl dose titration is complete",
      "If breakthrough analgesia is needed, use a fentanyl-based IV PRN at lower conversion dose",
      "Assess sedation level (RASS) before any opioid administration",
      "Consider pharmacist consultation for opioid conversion if both orders are clinically indicated",
    ],
    explanation: {
      summary:
        "Both a long-acting and a short-acting opioid are simultaneously ordered and active. This combination substantially increases the risk of respiratory depression, unintended sedation, and opioid-related adverse events.",
      reasoning: [
        "Fentanyl 25 mcg/hr patch applied 2026-03-16 06:00 (active)",
        "Oxycodone 10mg PRN ordered 2026-03-16 14:30 (active, not yet administered)",
        "Long-acting + short-acting opioid combination requires explicit clinical intent",
        "No note documenting dual-opioid plan in current chart",
        "RASS: −1 (mildly sedated) at last nursing assessment 14:00",
      ],
      clinicalInputs: [
        { label: "Fentanyl patch",  value: "25 mcg/hr (active)",   flag: "high" },
        { label: "Oxycodone PRN",   value: "10mg PO q4h",          flag: "high" },
        { label: "RASS score",      value: "−1 (mildly sedated)",   flag: "high" },
        { label: "Pain score",      value: "6/10" },
        { label: "SpO₂",           value: "96% (room air)",        flag: "normal" },
      ],
      limitations: [
        "Clinical intent for dual opioid may be intentional (palliative context); verify with prescriber",
        "SpO₂ monitoring does not reliably detect early opioid-induced hypoventilation",
      ],
      confidence: "high",
      confidenceScore: 94,
      modelVersion: "PharmAlert v2.4",
    },
    evidenceSources: [MICROMEDEX],
    generatedAt: "2026-03-16T14:35:00",
  },

  // ── Nursing module: NEWS2 deterioration alert ──────────────────────────────
  {
    id: "cdss-013",
    patientId: "pat-007",
    patientName: "Carol Nguyen",
    patientMRN: "MRN-10077",
    encounterId: "enc-007",
    sourceModule: "nursing",
    targetRoles: [UserRole.DOCTOR, UserRole.NURSE],
    type: "deterioration_alert",
    severity: "warning",
    status: "active",
    title: "NEWS2 Score 7 — Escalate to Medical Team Within 30 Minutes",
    summary:
      "NEWS2 aggregated score is 7 (high range). Per NICE NG38, a score ≥ 7 requires urgent clinical review by a medical team within 30 minutes and consideration of critical care admission.",
    triggeredBy: "NEWS2 score 7 (RR 22, SpO₂ 93%, HR 112, T 38.6°C)",
    suggestedActions: [
      "Notify medical team immediately (NEWS2 ≥7 = urgent escalation)",
      "Increase vital sign monitoring frequency to every 30 minutes",
      "Apply supplemental oxygen to target SpO₂ 94–98%",
      "Prepare for bedside assessment and consider ICU/HDU referral",
    ],
    explanation: {
      summary:
        "NEWS2 is a validated early warning score. A score of 7 indicates clinical deterioration requiring urgent medical review. This patient's score has risen from 3 (4 hours ago) to 7 at the latest vital set, with tachycardia, tachypnoea, hypoxaemia, and low-grade fever.",
      reasoning: [
        "RR: 22/min → NEWS2 contribution: 2",
        "SpO₂: 93% (room air) → NEWS2 contribution: 3",
        "HR: 112 bpm → NEWS2 contribution: 1",
        "Temperature: 38.6°C → NEWS2 contribution: 1",
        "Total NEWS2: 7 (previous score 4 hours ago: 3)",
        "Rate of rise (Δ4 = +4) is itself a clinical concern",
      ],
      clinicalInputs: [
        { label: "RR",          value: "22/min",               flag: "high" },
        { label: "SpO₂",        value: "93% (RA)",             flag: "critical" },
        { label: "HR",          value: "112 bpm",              flag: "high" },
        { label: "Temperature", value: "38.6°C",               flag: "high" },
        { label: "BP",          value: "108/72 mmHg",          flag: "normal" },
        { label: "NEWS2 now",   value: "7 (high range)",       flag: "critical" },
        { label: "NEWS2 4h ago", value: "3 (low-medium range)", flag: "low" },
      ],
      limitations: [
        "NEWS2 is validated for adult ward inpatients; may be less accurate post-operatively",
        "Chronic respiratory or cardiac disease can cause elevated baseline scores",
      ],
      confidence: "high",
      confidenceScore: 88,
      modelVersion: "NEWS2Monitor v1.2",
    },
    evidenceSources: [AI_EHR_MODEL],
    generatedAt: "2026-03-16T15:10:00",
  },

  // ── Radiology module: Incidental PE on CT ─────────────────────────────────
  {
    id: "cdss-014",
    patientId: "pat-008",
    patientName: "George Hamilton",
    patientMRN: "MRN-10088",
    sourceModule: "radiology",
    targetRoles: [UserRole.DOCTOR, UserRole.RADIOLOGIST, UserRole.NURSE],
    type: "urgent_finding",
    severity: "critical",
    status: "active",
    title: "Incidental PE on CT Chest — Urgent Clinical Escalation Required",
    summary:
      "CT Chest ordered for lung cancer screening (LDCT) shows filling defects in the right main pulmonary artery consistent with pulmonary embolism. This is an incidental but life-threatening finding requiring immediate clinical response.",
    triggeredBy: "Incidental PE identified on LDCT report",
    suggestedActions: [
      "Notify ordering clinician immediately via phone (do not rely on EHR notification alone)",
      "Order CT pulmonary angiogram (CTPA) for definitive characterisation",
      "Initiate anticoagulation per PE protocol pending haemodynamic assessment",
      "Request echocardiography if RV dysfunction suspected",
      "Mark as 'Critical Finding — Urgent' in radiology report per ACR guidelines",
    ],
    explanation: {
      summary:
        "An incidental partial filling defect was identified in the right main pulmonary artery on a low-dose CT chest ordered for lung cancer screening. ACR policy mandates immediate verbal communication of critical incidental findings to the ordering clinician.",
      reasoning: [
        "Finding: hypodense filling defect in right main PA on axial CT (series 3, image 47)",
        "LDCT ordered for: lung cancer screening (no PE workup requested)",
        "Differential: PE (most likely), artifact, mass (less likely given morphology)",
        "Patient is ambulatory outpatient — not currently on anticoagulation",
        "No prior PE history on record",
      ],
      clinicalInputs: [
        { label: "CT finding",         value: "Filling defect, R main PA",    flag: "critical" },
        { label: "Study ordered for",  value: "Lung cancer screening" },
        { label: "Anticoagulation",    value: "None",                         flag: "high" },
        { label: "HR",                 value: "88 bpm",                       flag: "normal" },
        { label: "SpO₂ (pre-scan)",    value: "97% (RA)",                     flag: "normal" },
      ],
      limitations: [
        "LDCT is not optimised for pulmonary vasculature; CTPA required for definitive diagnosis",
        "Cannot assess RV strain or haemodynamic significance from LDCT alone",
      ],
      confidence: "moderate",
      confidenceScore: 79,
      modelVersion: "RadFlag v1.0",
    },
    evidenceSources: [AI_EHR_MODEL],
    generatedAt: "2026-03-16T13:55:00",
  },
];

// ── Override / Feedback Records ──────────────────────────────────────────────

export const mockCDSSOverrides: CDSSOverrideRecord[] = [
  {
    id: "ov-001",
    recommendationId: "cdss-007",
    recommendationTitle: "Drug Interaction: Warfarin + Metronidazole",
    patientId: "pat-003",
    patientName: "Linda Thompson",
    clinicianId: "doc-001",
    clinicianName: "Dr. David Chen",
    clinicianRole: "Attending Physician",
    action: "override",
    reasonCategory: "clinical_judgment",
    reason:
      "Metronidazole is the only effective option for C. diff; will hold warfarin for 48h and monitor INR daily.",
    timestamp: "2026-03-16T13:15:00",
  },
  {
    id: "ov-002",
    recommendationId: "cdss-005",
    recommendationTitle: "DVT Prophylaxis Not Documented",
    patientId: "pat-004",
    patientName: "Michael Lee",
    clinicianId: "doc-001",
    clinicianName: "Dr. David Chen",
    clinicianRole: "Attending Physician",
    action: "acknowledge",
    reasonCategory: "already_ordered",
    reason: "Verbal order placed for enoxaparin this morning; pharmacy confirmed. Written order to follow.",
    timestamp: "2026-03-16T08:00:00",
  },
  {
    id: "ov-003",
    recommendationId: "cdss-010",
    recommendationTitle: "Overdue Colorectal Cancer Screening",
    patientId: "pat-008",
    patientName: "George Hamilton",
    clinicianId: "doc-002",
    clinicianName: "Dr. Sarah Kim",
    clinicianRole: "Attending Physician",
    action: "follow",
    reasonCategory: "clinical_judgment",
    reason: "Referral placed to GI for colonoscopy. Patient counselled on CRC screening importance.",
    timestamp: "2026-03-14T09:30:00",
  },
  {
    id: "ov-004",
    recommendationId: "cdss-003",
    recommendationTitle: "Consider Statin + SGLT-2 Inhibitor",
    patientId: "pat-001",
    patientName: "Emily Johnson",
    clinicianId: "doc-001",
    clinicianName: "Dr. David Chen",
    clinicianRole: "Attending Physician",
    action: "override",
    reasonCategory: "patient_preference",
    reason:
      "Patient declined SGLT-2 inhibitor due to prior recurrent UTI history. Statin escalation to 40mg accepted.",
    timestamp: "2026-03-15T15:40:00",
    notes: "Counselled patient on UTI risk with empagliflozin. Will revisit in 3 months.",
  },
  {
    id: "ov-005",
    recommendationId: "cdss-006",
    recommendationTitle: "Week-20 Anatomy Ultrasound Due",
    patientId: "pat-005",
    patientName: "Aisha Patel",
    clinicianId: "doc-003",
    clinicianName: "Dr. Priya Mehta",
    clinicianRole: "OB/GYN",
    action: "acknowledge",
    reasonCategory: "already_ordered",
    reason: "Anatomy scan ordered outpatient 2 days ago; appointment set for 2026-03-18.",
    timestamp: "2026-03-16T11:45:00",
  },
];

// ── Computed Stats ────────────────────────────────────────────────────────────

export const mockCDSSStats: CDSSStats = {
  totalActive: mockCDSSRecommendations.filter((r) => r.status === "active").length,
  critical: mockCDSSRecommendations.filter((r) => r.severity === "critical" && r.status === "active").length,
  warnings: mockCDSSRecommendations.filter((r) => r.severity === "warning" && r.status === "active").length,
  info: mockCDSSRecommendations.filter((r) => r.severity === "info" && r.status === "active").length,
  overriddenToday: mockCDSSOverrides.filter((o) => o.action === "override" && o.timestamp.startsWith("2026-03-16")).length,
  followedToday: mockCDSSOverrides.filter((o) => o.action === "follow" && o.timestamp.startsWith("2026-03-16")).length,
  acknowledgedToday: mockCDSSOverrides.filter((o) => o.action === "acknowledge" && o.timestamp.startsWith("2026-03-16")).length,
  accuracyRate: 96.3,
};
