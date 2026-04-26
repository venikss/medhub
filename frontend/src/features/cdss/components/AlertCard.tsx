"use client";

import { ShieldAlert, AlertTriangle, Lightbulb, BrainCircuit, CheckCircle2, XCircle, Eye, MessageSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CDSSRecommendation, CDSSAlertSeverity, CDSSRecommendationType } from "@/types";

const SEVERITY_CONFIG: Record<CDSSAlertSeverity, {
  border: string; bg: string; badge: string; icon: React.ElementType; iconColor: string; label: string;
}> = {
  critical: {
    border: "border-red-400/50",
    bg: "bg-red-500/5",
    badge: "bg-red-500/10 text-red-700 border-red-400/30",
    icon: ShieldAlert,
    iconColor: "text-red-600",
    label: "Critical",
  },
  warning: {
    border: "border-amber-400/50",
    bg: "bg-amber-500/5",
    badge: "bg-amber-500/10 text-amber-700 border-amber-400/30",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    label: "Warning",
  },
  info: {
    border: "border-sky-400/40",
    bg: "bg-sky-500/5",
    badge: "bg-sky-500/10 text-sky-700 border-sky-400/30",
    icon: Lightbulb,
    iconColor: "text-sky-600",
    label: "Info",
  },
};

const TYPE_LABELS: Record<CDSSRecommendationType, string> = {
  // Original 8
  drug_interaction:      "Drug Interaction",
  allergy:               "Allergy Alert",
  dosage_warning:        "Dosage Warning",
  guideline:             "Clinical Guideline",
  diagnostic:            "Diagnostic Suggestion",
  preventive:            "Preventive Care",
  order_set:             "Order Set",
  abnormal_result:       "Abnormal Result",
  // New types
  duplicate_therapy:     "Duplicate Therapy",
  contraindication:      "Contraindication",
  appropriateness_check: "Appropriateness Check",
  panic_value:           "Panic Value",
  delta_check:           "Delta Check",
  critical_result:       "Critical Result",
  care_gap:              "Care Gap",
  follow_up_reminder:    "Follow-up Reminder",
  deterioration_alert:   "Deterioration Alert",
  overdue_task:          "Overdue Task",
  risk_score:            "Risk Score",
  urgent_finding:        "Urgent Finding",
  triage_support:        "Triage Support",
  sepsis_alert:          "Sepsis Alert",
  trauma_alert:          "Trauma Alert",
  perioperative_warning: "Perioperative Warning",
  checklist_gap:         "Checklist Gap",
  care_plan_deviation:   "Care Plan Deviation",
};

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  active:       { label: "Active",       color: "text-emerald-600" },
  acknowledged: { label: "Acknowledged", color: "text-sky-600" },
  overridden:   { label: "Overridden",   color: "text-amber-600" },
  dismissed:    { label: "Dismissed",    color: "text-muted-foreground" },
  expired:      { label: "Expired",      color: "text-muted-foreground" },
  followed:     { label: "Followed",     color: "text-emerald-600" },
};

const CONFIDENCE_COLORS = {
  high:     "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  moderate: "bg-amber-500/10 text-amber-700 border-amber-400/30",
  low:      "bg-red-500/10 text-red-700 border-red-400/30",
};

interface AlertCardProps {
  rec: CDSSRecommendation;
  selected?: boolean;
  compact?: boolean;
  onSelect?: () => void;
  onExplain?: () => void;
  onOverride?: () => void;
}

export function AlertCard({ rec, selected, compact, onSelect, onExplain, onOverride }: AlertCardProps) {
  const cfg = SEVERITY_CONFIG[rec.severity];
  const Icon = cfg.icon;
  const statusDisplay = STATUS_DISPLAY[rec.status];
  const isResolved = rec.status !== "active";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-4 cursor-pointer transition-all",
        cfg.border,
        cfg.bg,
        selected && "ring-2 ring-primary ring-offset-1",
        isResolved && "opacity-70",
        !selected && "hover:shadow-sm hover:ring-1 hover:ring-border/60"
      )}
    >
      {/* Header Row */}
      <div className="flex items-start gap-3">
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] font-semibold border", cfg.badge)}>
              {cfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{TYPE_LABELS[rec.type]}</span>
            <span className={cn("text-xs font-medium ml-auto", statusDisplay.color)}>
              {statusDisplay.label}
            </span>
          </div>
          <p className="text-sm font-semibold mt-1 leading-snug">{rec.title}</p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {rec.summary}
            </p>
          )}
        </div>
      </div>

      {/* Patient + Confidence + Time */}
      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
        <span className="text-xs font-medium text-foreground/80">{rec.patientName}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-xs text-muted-foreground font-mono">{rec.patientMRN}</span>
        <span className="ml-auto flex items-center gap-1.5">
          <BrainCircuit className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className={cn("text-[10px] border", CONFIDENCE_COLORS[rec.explanation.confidence])}>
            {rec.explanation.confidenceScore}% {rec.explanation.confidence}
          </Badge>
        </span>
      </div>

      {/* Triggered by */}
      {!compact && (
        <p className="text-[11px] text-muted-foreground/70 mt-1.5 italic">
          Triggered by: {rec.triggeredBy}
        </p>
      )}

      {/* Override note */}
      {rec.overrideReason && (
        <p className="text-[11px] text-amber-700/80 mt-1.5 italic line-clamp-1">
          Override: {rec.overrideReason}
        </p>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-muted-foreground/60 mt-1.5">
        {rec.generatedAt.replace("T", " ").slice(0, 16)}
      </p>

      {/* Action Buttons */}
      {!compact && !isResolved && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 flex-1"
            onClick={onExplain}
          >
            <Eye className="h-3.5 w-3.5" /> Explain
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 flex-1 border-amber-400/40 text-amber-700 hover:bg-amber-500/5"
            onClick={onOverride}
          >
            <MessageSquare className="h-3.5 w-3.5" /> Override
          </Button>
          <Button
            size="sm"
            className="h-7 text-xs gap-1 flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            onClick={() => onOverride?.()}
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Follow
          </Button>
        </div>
      )}
      {!compact && isResolved && (
        <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1"
            onClick={onExplain}
          >
            <Eye className="h-3.5 w-3.5" /> View Explanation
          </Button>
          <XCircle className="h-4 w-4 text-muted-foreground/50 ml-auto mt-1.5" />
        </div>
      )}
    </div>
  );
}
