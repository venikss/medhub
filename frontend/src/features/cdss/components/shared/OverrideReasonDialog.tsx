"use client";

import { useState } from "react";
import { BrainCircuit, ShieldOff, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SEVERITY_CONFIG, OVERRIDE_ACTION_CONFIG, REASON_CATEGORIES } from "@/features/cdss/constants";
import type {
  CDSSRecommendation, CDSSOverrideAction, CDSSOverrideReasonCategory, CDSSSourceModule,
} from "@/types";

interface OverridePayload {
  action: CDSSOverrideAction;
  reasonCategory: CDSSOverrideReasonCategory;
  reason: string;
  notes?: string;
  clinicianName: string;
  clinicianRole: string;
  sourceModule?: CDSSSourceModule;
}

interface OverrideReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rec: CDSSRecommendation | null;
  /** Name of the clinician submitting the response */
  clinicianName?: string;
  /** Role label for audit trail */
  clinicianRole?: string;
  /** Which module is originating this dialog (for audit) */
  sourceModule?: CDSSSourceModule;
  /** Called when the clinician submits their response */
  onSubmit: (payload: OverridePayload) => void;
}

/**
 * Store-free override/acknowledge/follow/dismiss dialog.
 * The parent is responsible for dispatching the payload to the store.
 *
 * Usage:
 *   <OverrideReasonDialog
 *     open={showOverride}
 *     onOpenChange={setShowOverride}
 *     rec={overrideTarget}
 *     clinicianName="Dr. Chen"
 *     clinicianRole="Attending"
 *     sourceModule="pharmacy"
 *     onSubmit={(payload) => cdss.submitOverride(payload)}
 *   />
 */
export function OverrideReasonDialog({
  open, onOpenChange, rec,
  clinicianName = "Current Clinician",
  clinicianRole = "Clinician",
  sourceModule,
  onSubmit,
}: OverrideReasonDialogProps) {
  const [selectedAction, setSelectedAction]       = useState<CDSSOverrideAction>("acknowledge");
  const [selectedCategory, setSelectedCategory]   = useState<CDSSOverrideReasonCategory>("clinical_judgment");
  const [reason, setReason]                       = useState("");
  const [notes, setNotes]                         = useState("");

  const needsReason = selectedAction === "override" || selectedAction === "dismiss";
  const isValid     = reason.trim().length >= 10 || !needsReason;

  function handleSubmit() {
    if (!isValid || !rec) return;
    onSubmit({
      action:         selectedAction,
      reasonCategory: selectedCategory,
      reason:         reason.trim() || `Clinician response: ${selectedAction}`,
      notes:          notes.trim() || undefined,
      clinicianName,
      clinicianRole,
      sourceModule,
    });
    setReason("");
    setNotes("");
    setSelectedAction("acknowledge");
  }

  if (!rec) return null;
  const svCfg = SEVERITY_CONFIG[rec.severity];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BrainCircuit className="h-4 w-4 text-primary" />
            Clinician Response
          </DialogTitle>
          <DialogDescription className="text-xs">
            Responding as{" "}
            <span className="font-medium text-foreground">{clinicianName}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Recommendation summary */}
        <div className={cn("rounded-lg border px-3 py-2.5 flex items-start gap-2", svCfg.border, svCfg.bg)}>
          <svCfg.icon className={cn("h-4 w-4 shrink-0 mt-0.5", svCfg.iconColor)} />
          <p className="text-xs font-medium leading-snug">{rec.title}</p>
        </div>

        {/* Action selection */}
        <div className="grid grid-cols-2 gap-2">
          {(["override", "acknowledge", "follow", "dismiss"] as CDSSOverrideAction[]).map((action) => {
            const cfg = OVERRIDE_ACTION_CONFIG[action];
            const Icon = cfg.icon;
            const isSelected = selectedAction === action;
            return (
              <button
                key={action}
                onClick={() => setSelectedAction(action)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-all",
                  cfg.border,
                  isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:shadow-sm",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span className="text-xs font-semibold">{cfg.label}</span>
                </div>
                <span className="text-[10px] text-muted-foreground leading-snug">{cfg.description}</span>
              </button>
            );
          })}
        </div>

        {/* Reason category — only for override / dismiss */}
        {needsReason && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Reason Category</Label>
            <div className="grid grid-cols-1 gap-1.5">
              {REASON_CATEGORIES.map((cat) => (
                <label
                  key={cat.value}
                  className={cn(
                    "flex items-start gap-2 rounded-lg border p-2.5 cursor-pointer transition-all",
                    selectedCategory === cat.value
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="reasonCategory"
                    value={cat.value}
                    checked={selectedCategory === cat.value}
                    onChange={() => setSelectedCategory(cat.value)}
                    className="mt-0.5 accent-primary"
                  />
                  <div>
                    <p className="text-xs font-medium">{cat.label}</p>
                    <p className="text-[10px] text-muted-foreground">{cat.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Reason text */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold">
            {needsReason ? "Reason" : "Notes (optional)"}
            {needsReason && <span className="text-red-500 ml-0.5">*</span>}
          </Label>
          <Textarea
            className="text-xs min-h-[72px] resize-none"
            placeholder={needsReason ? "Explain your clinical reasoning (min 10 characters)…" : "Additional notes…"}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {needsReason && reason.length > 0 && reason.length < 10 && (
            <p className="text-[10px] text-red-500">{10 - reason.length} more characters required</p>
          )}
        </div>

        {/* Audit warning */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/5 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-[10px] text-amber-700">
            This response is permanently logged in the clinical audit trail with your name,
            role, and timestamp.
          </p>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!isValid} onClick={handleSubmit}>
            Submit Response
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
