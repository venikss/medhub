/**
 * Centralised CDSS display configuration.
 * Import from here — do not duplicate these maps in individual components.
 */
import {
  ShieldAlert, AlertTriangle, Lightbulb,
  BookOpen, Database, FileText, BrainCircuit, FlaskConical,
  ShieldOff, CheckCircle2, XCircle,
  type LucideIcon,
} from "lucide-react";
import type {
  CDSSAlertSeverity, CDSSRecommendationType, CDSSAlertStatus,
  CDSSConfidenceLevel, CDSSEvidenceSourceType, CDSSOverrideAction,
  CDSSOverrideReasonCategory, CDSSSourceModule,
} from "@/types";

// ── Severity ──────────────────────────────────────────────────────────────────

export const SEVERITY_CONFIG: Record<CDSSAlertSeverity, {
  border: string; bg: string; badge: string;
  icon: LucideIcon; iconColor: string; label: string; pill: string;
}> = {
  critical: {
    border: "border-red-400/50",
    bg: "bg-red-500/5",
    badge: "bg-red-500/10 text-red-700 border-red-400/30",
    icon: ShieldAlert,
    iconColor: "text-red-600",
    label: "Critical",
    pill: "bg-red-500 text-white border-red-500",
  },
  warning: {
    border: "border-amber-400/50",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-700 border-amber-400/30",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    label: "Warning",
    pill: "bg-amber-500 text-white border-amber-500",
  },
  info: {
    border: "border-sky-400/40",
    bg: "bg-sky-500/5",
    badge: "bg-sky-500/10 text-sky-700 border-sky-400/30",
    icon: Lightbulb,
    iconColor: "text-sky-600",
    label: "Info",
    pill: "bg-sky-500 text-white border-sky-500",
  },
};

// ── Recommendation types ───────────────────────────────────────────────────────

export const TYPE_LABELS: Record<CDSSRecommendationType, string> = {
  // Medication / Safety
  drug_interaction:      "Drug Interaction",
  allergy:               "Allergy Alert",
  dosage_warning:        "Dosage Warning",
  duplicate_therapy:     "Duplicate Therapy",
  contraindication:      "Contraindication",
  // Order / Guideline
  guideline:             "Clinical Guideline",
  order_set:             "Order Set",
  appropriateness_check: "Appropriateness Check",
  // Diagnostic / Results
  diagnostic:            "Diagnostic Suggestion",
  abnormal_result:       "Abnormal Result",
  panic_value:           "Panic Value",
  delta_check:           "Delta Check",
  critical_result:       "Critical Result",
  // Preventive / Screening
  preventive:            "Preventive Care",
  care_gap:              "Care Gap",
  follow_up_reminder:    "Follow-Up Reminder",
  // Nursing / Deterioration
  deterioration_alert:   "Deterioration Alert",
  overdue_task:          "Overdue Task",
  risk_score:            "Risk Score",
  // Radiology
  urgent_finding:        "Urgent Finding",
  // Emergency
  triage_support:        "Triage Support",
  sepsis_alert:          "Sepsis Alert",
  trauma_alert:          "Trauma Alert",
  // Surgery
  perioperative_warning: "Perioperative Warning",
  checklist_gap:         "Checklist Gap",
  // Cross-cutting
  care_plan_deviation:   "Care Plan Deviation",
};

// ── Status ────────────────────────────────────────────────────────────────────

export const STATUS_DISPLAY: Record<CDSSAlertStatus, { label: string; color: string }> = {
  active:       { label: "Active",       color: "text-emerald-600" },
  acknowledged: { label: "Acknowledged", color: "text-sky-600" },
  overridden:   { label: "Overridden",   color: "text-amber-600" },
  dismissed:    { label: "Dismissed",    color: "text-muted-foreground" },
  expired:      { label: "Expired",      color: "text-muted-foreground" },
  followed:     { label: "Followed",     color: "text-emerald-600" },
};

// ── Confidence ────────────────────────────────────────────────────────────────

export const CONFIDENCE_BADGE: Record<CDSSConfidenceLevel, string> = {
  high:     "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  moderate: "bg-amber-500/10 text-amber-700 border-amber-400/30",
  low:      "bg-red-500/10 text-red-700 border-red-400/30",
};

export const CONFIDENCE_METER: Record<CDSSConfidenceLevel, {
  color: string; trackColor: string; label: string;
}> = {
  high:     { color: "text-emerald-600", trackColor: "stroke-emerald-500", label: "High Confidence" },
  moderate: { color: "text-amber-600",   trackColor: "stroke-amber-500",   label: "Moderate Confidence" },
  low:      { color: "text-red-600",     trackColor: "stroke-red-500",     label: "Low Confidence" },
};

// ── Evidence source ───────────────────────────────────────────────────────────

export const SOURCE_ICONS: Record<CDSSEvidenceSourceType, LucideIcon> = {
  guideline:     BookOpen,
  drug_database: Database,
  literature:    FileText,
  ai_model:      BrainCircuit,
  ehr_pattern:   FlaskConical,
};

export const SOURCE_COLORS: Record<CDSSEvidenceSourceType, string> = {
  guideline:     "bg-sky-500/10 text-sky-700 border-sky-400/30",
  drug_database: "bg-purple-500/10 text-purple-700 border-purple-400/30",
  literature:    "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  ai_model:      "bg-violet-500/10 text-violet-700 border-violet-400/30",
  ehr_pattern:   "bg-amber-500/10 text-amber-700 border-amber-400/30",
};

export const SOURCE_TYPE_LABELS: Record<CDSSEvidenceSourceType, string> = {
  guideline:     "Clinical Guideline",
  drug_database: "Drug Database",
  literature:    "Literature",
  ai_model:      "AI Model",
  ehr_pattern:   "EHR Pattern",
};

// ── Override / clinician response ─────────────────────────────────────────────

export const OVERRIDE_ACTION_CONFIG: Record<CDSSOverrideAction, {
  label: string; description: string; border: string; icon: LucideIcon;
}> = {
  override:    { label: "Override",    description: "Consciously deviate from this recommendation", border: "border-amber-400 bg-amber-500/5 text-amber-700",        icon: ShieldOff    },
  acknowledge: { label: "Acknowledge", description: "Noted — no immediate action required",         border: "border-sky-400 bg-sky-500/5 text-sky-700",            icon: CheckCircle2 },
  follow:      { label: "Follow",      description: "I am implementing this recommendation",         border: "border-emerald-400 bg-emerald-500/5 text-emerald-700", icon: CheckCircle2 },
  dismiss:     { label: "Dismiss",     description: "Remove from alert list — not relevant",         border: "border-muted bg-muted/20 text-muted-foreground",       icon: XCircle      },
};

export const OVERRIDE_ACTION_COLORS: Record<CDSSOverrideAction, string> = {
  override:    "bg-amber-500/10 text-amber-700 border-amber-400/30",
  acknowledge: "bg-sky-500/10 text-sky-700 border-sky-400/30",
  follow:      "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  dismiss:     "bg-muted/40 text-muted-foreground border-border/40",
};

export const REASON_CATEGORIES: {
  value: CDSSOverrideReasonCategory; label: string; description: string;
}[] = [
  { value: "clinical_judgment",        label: "Clinical Judgment",        description: "My assessment of this patient differs from the AI recommendation" },
  { value: "patient_preference",       label: "Patient Preference",       description: "Patient has made an informed decision about their care" },
  { value: "contraindication_present", label: "Contraindication Present", description: "A contraindication exists that makes the suggestion unsafe here" },
  { value: "already_ordered",          label: "Already Done",             description: "This intervention is already in place or has been ordered" },
  { value: "not_applicable",           label: "Not Applicable",           description: "This recommendation does not apply to this clinical context" },
  { value: "other",                    label: "Other",                    description: "Explain in the comments below" },
];

export const CATEGORY_LABELS: Record<CDSSOverrideReasonCategory, string> = {
  clinical_judgment:        "Clinical Judgment",
  patient_preference:       "Patient Preference",
  contraindication_present: "Contraindication Present",
  already_ordered:          "Already Ordered",
  not_applicable:           "Not Applicable",
  other:                    "Other",
};

// ── Source module ─────────────────────────────────────────────────────────────

export const MODULE_LABELS: Record<CDSSSourceModule, string> = {
  doctor:    "Doctor",
  nursing:   "Nursing",
  lab:       "Laboratory",
  pharmacy:  "Pharmacy",
  radiology: "Radiology",
  emergency: "Emergency",
  surgery:   "Surgery",
  system:    "System",
};

export const MODULE_COLORS: Record<CDSSSourceModule, string> = {
  doctor:    "bg-sky-500/10 text-sky-700 border-sky-400/30",
  nursing:   "bg-rose-500/10 text-rose-700 border-rose-400/30",
  lab:       "bg-purple-500/10 text-purple-700 border-purple-400/30",
  pharmacy:  "bg-amber-500/10 text-amber-700 border-amber-400/30",
  radiology: "bg-blue-500/10 text-blue-700 border-blue-400/30",
  emergency: "bg-red-500/10 text-red-700 border-red-400/30",
  surgery:   "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  system:    "bg-muted/40 text-muted-foreground border-border/50",
};
