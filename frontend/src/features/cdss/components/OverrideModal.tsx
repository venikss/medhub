"use client";

import { useState } from "react";
import { AlertTriangle, ShieldOff, CheckCircle2, XCircle, MessageCircle, BrainCircuit } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCDSSStore } from "../store";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { CDSSOverrideAction, CDSSOverrideReasonCategory } from "@/types";

const REASON_CATEGORIES: { value: CDSSOverrideReasonCategory; label: string; description: string }[] = [
  { value: "clinical_judgment",       label: "Clinical Judgment",       description: "My assessment of this patient differs from the AI recommendation" },
  { value: "patient_preference",      label: "Patient Preference",      description: "Patient has made an informed decision about their care" },
  { value: "contraindication_present", label: "Contraindication Present", description: "A contraindication exists that makes the suggestion unsafe here" },
  { value: "already_ordered",         label: "Already Done",             description: "This intervention is already in place or has been ordered" },
  { value: "not_applicable",          label: "Not Applicable",           description: "This recommendation does not apply to this clinical context" },
  { value: "other",                   label: "Other",                    description: "Explain in the comments below" },
];

const ACTION_CONFIG: Record<CDSSOverrideAction, {
  label: string; description: string; color: string; icon: React.ElementType;
}> = {
  override:     { label: "Override",     description: "Consciously deviate from this recommendation", color: "border-amber-400 bg-amber-500/5 text-amber-700",   icon: ShieldOff    },
  acknowledge:  { label: "Acknowledge",  description: "Noted — no immediate action required",         color: "border-sky-400 bg-sky-500/5 text-sky-700",         icon: CheckCircle2 },
  follow:       { label: "Follow",       description: "I am implementing this recommendation",         color: "border-emerald-400 bg-emerald-500/5 text-emerald-700", icon: CheckCircle2 },
  dismiss:      { label: "Dismiss",      description: "Remove from alert list — not relevant",         color: "border-muted bg-muted/20 text-muted-foreground",    icon: XCircle      },
};

interface OverrideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recommendationId: string | null;
}

export function OverrideModal({ open, onOpenChange, recommendationId }: OverrideModalProps) {
  const { recommendations, submitOverride } = useCDSSStore();
  const token = useAuthStore((state) => state.token);
  const rec = recommendations.find((r) => r.id === recommendationId);

  const [selectedAction, setSelectedAction] = useState<CDSSOverrideAction>("acknowledge");
  const [selectedCategory, setSelectedCategory] = useState<CDSSOverrideReasonCategory>("clinical_judgment");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const needsReason = selectedAction === "override" || selectedAction === "dismiss";
  const isValid = reason.trim().length >= 10 || !needsReason;

  const handleSubmit = () => {
    if (!isValid) return;
    void submitOverride({
      action: selectedAction,
      reasonCategory: selectedCategory,
      reason: reason.trim() || ACTION_CONFIG[selectedAction].description,
      notes: notes.trim() || undefined,
      clinicianName: "Dr. David Chen",
      clinicianRole: "Attending Physician",
      token,
    });
    setReason("");
    setNotes("");
    onOpenChange(false);
  };

  if (!rec) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4 text-primary" />
            Clinical Response to AI Recommendation
          </DialogTitle>
          <DialogDescription className="text-xs">
            Your response will be recorded in the audit trail as part of AI governance monitoring.
          </DialogDescription>
        </DialogHeader>

        {/* Recommendation Summary */}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1">
          <div className="flex items-center gap-2">
            <BrainCircuit className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">{rec.title}</span>
          </div>
          <p className="text-xs text-muted-foreground">{rec.patientName} · {rec.patientMRN}</p>
          <p className="text-xs text-muted-foreground line-clamp-2">{rec.summary}</p>
        </div>

        {/* Action Selection */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your Decision
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(ACTION_CONFIG) as [CDSSOverrideAction, typeof ACTION_CONFIG[CDSSOverrideAction]][]).map(([action, cfg]) => {
              const Icon = cfg.icon;
              const isSelected = selectedAction === action;
              return (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-all",
                    cfg.color,
                    isSelected ? "ring-2 ring-offset-1 ring-primary" : "opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold">{cfg.label}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-relaxed">{cfg.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Reason Category (required for override/dismiss) */}
        {(selectedAction === "override" || selectedAction === "dismiss") && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reason Category
              <span className="text-red-500 ml-1">*</span>
            </Label>
            <div className="space-y-1.5">
              {REASON_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setSelectedCategory(cat.value)}
                  className={cn(
                    "w-full rounded-lg border px-3 py-2 text-left text-xs transition-all",
                    selectedCategory === cat.value
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border/50 hover:bg-muted/40"
                  )}
                >
                  <p className="font-semibold">{cat.label}</p>
                  <p className="text-muted-foreground mt-0.5">{cat.description}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reason Text */}
        <div className="space-y-1.5">
          <Label htmlFor="reason" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Clinical Rationale
            {needsReason && <span className="text-red-500 ml-1">* (min 10 chars)</span>}
          </Label>
          <Textarea
            id="reason"
            rows={3}
            className="text-sm resize-none"
            placeholder={
              selectedAction === "override"
                ? "Explain why you are overriding this recommendation..."
                : selectedAction === "follow"
                ? "Optionally note implementation details..."
                : "Any relevant clinical context..."
            }
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {needsReason && reason.trim().length > 0 && reason.trim().length < 10 && (
            <p className="text-xs text-red-600">Please provide at least 10 characters.</p>
          )}
        </div>

        {/* Optional Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Additional Notes (optional)
          </Label>
          <Textarea
            id="notes"
            rows={2}
            className="text-sm resize-none"
            placeholder="Follow-up plan, monitoring parameters, etc."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Audit Warning */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700">
            This action will be permanently recorded in the CDSS audit trail with your name, timestamp, and rationale. It cannot be deleted.
          </p>
        </div>

        {/* Footer */}
        <div className="flex gap-3 pt-1">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 gap-1.5"
            disabled={!isValid}
            onClick={handleSubmit}
          >
            {ACTION_CONFIG[selectedAction].icon && (() => {
              const Icon = ACTION_CONFIG[selectedAction].icon;
              return <Icon className="h-4 w-4" />;
            })()}
            Confirm {ACTION_CONFIG[selectedAction].label}
          </Button>
        </div>

        {/* Provider stamp */}
        <p className="text-[10px] text-muted-foreground/50 text-center">
          Responding as: Dr. David Chen · Attending Physician · 2026-03-16
        </p>
      </DialogContent>
    </Dialog>
  );
}
