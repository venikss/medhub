"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, XCircle, Pill, Clock, AlertTriangle, Loader2, ChevronDown, ChevronUp, User, History, Flag, RefreshCw } from "lucide-react";
import { DrugWarningBanner } from "./DrugWarningBanner";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import {
  verifyPharmacyPrescription,
  holdPharmacyPrescription,
  rejectPharmacyPrescription,
  getPharmacyProfile,
  createIntervention,
  createSubstitution,
  type PharmacyProfileResponse,
} from "@/features/pharmacy/api";
import type { PharmacyPrescription } from "@/types";
import { cn } from "@/lib/utils";

const INTERVENTION_TYPES = [
  { value: "dose-adjustment",        label: "Dose Adjustment" },
  { value: "therapy-change",         label: "Therapy Change" },
  { value: "drug-discontinuation",   label: "Drug Discontinuation" },
  { value: "allergy-clarification",  label: "Allergy Clarification" },
  { value: "brand-to-generic",       label: "Brand to Generic" },
  { value: "formulary-substitution", label: "Formulary Substitution" },
  { value: "other",                  label: "Other" },
];

interface RxVerificationCardProps {
  rx: PharmacyPrescription;
  token?: string | null;
  onVerify?: (updated: PharmacyPrescription) => void;
  onHold?: (updated: PharmacyPrescription) => void;
  onReject?: (updated: PharmacyPrescription) => void;
  className?: string;
}

export function RxVerificationCard({ rx, token, onVerify, onHold, onReject, className }: RxVerificationCardProps) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState<"verify" | "hold" | "reject" | null>(null);
  const [showHistory, setShowHistory] = useState(true);
  const [profile, setProfile] = useState<PharmacyProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showIntervention, setShowIntervention] = useState(false);
  const [interventionType, setInterventionType] = useState(INTERVENTION_TYPES[0].value);
  const [interventionReason, setInterventionReason] = useState("");
  const [interventionRec, setInterventionRec] = useState("");
  const [interventionLoading, setInterventionLoading] = useState(false);
  const [interventionDone, setInterventionDone] = useState(false);
  const [interventionError, setInterventionError] = useState<string | null>(null);
  const [showSubstitution, setShowSubstitution] = useState(false);
  const [subMedication, setSubMedication] = useState("");
  const [subReason, setSubReason] = useState("");
  const [subLoading, setSubLoading] = useState(false);
  const [subDone, setSubDone] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);

  const handleRequestSubstitution = async () => {
    if (!subMedication.trim() || !subReason.trim()) return;
    setSubLoading(true);
    setSubError(null);
    try {
      await createSubstitution(
        { prescriptionId: rx.id, substituteMedication: subMedication.trim(), reason: subReason.trim() },
        token ?? undefined,
      );
      setSubDone(true);
      setShowSubstitution(false);
      setSubMedication("");
      setSubReason("");
    } catch (err: unknown) {
      setSubError(err instanceof Error ? err.message : "Failed to submit substitution request.");
    } finally {
      setSubLoading(false);
    }
  };

  const handleFlagIntervention = async () => {
    if (!interventionReason.trim() || !interventionRec.trim()) return;
    setInterventionLoading(true);
    setInterventionError(null);
    try {
      await createIntervention(
        { prescriptionId: rx.id, type: interventionType, reason: interventionReason, recommendation: interventionRec },
        token ?? undefined,
      );
      setInterventionDone(true);
      setShowIntervention(false);
      setInterventionReason("");
      setInterventionRec("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit intervention. Please try again.";
      setInterventionError(msg);
    } finally {
      setInterventionLoading(false);
    }
  };

  useEffect(() => {
    if (!rx.patientId) return;
    setProfile(null);
    setProfileLoading(true);
    getPharmacyProfile(rx.patientId, token ?? undefined)
      .then((data) => setProfile(data as PharmacyProfileResponse))
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [rx.patientId, token]);

  const otherActiveMeds = profile?.activeMedications?.filter((m) => m.id !== rx.id) ?? [];
  const recentRefills = profile?.refills?.slice(0, 4) ?? [];

  const hasWarnings = rx.warnings.length > 0;
  const hasSevere = rx.warnings.some((w) => w.severity === "severe" || w.severity === "contraindicated");

  const handleVerify = async () => {
    setLoading("verify");
    try {
      const updated = await verifyPharmacyPrescription(rx.id, notes, token ?? undefined);
      setNotes("");
      onVerify?.(updated as PharmacyPrescription);
    } finally {
      setLoading(null);
    }
  };

  const handleHold = async () => {
    if (!notes.trim()) return;
    setLoading("hold");
    try {
      const updated = await holdPharmacyPrescription(rx.id, notes, token ?? undefined);
      setNotes("");
      onHold?.(updated as PharmacyPrescription);
    } finally {
      setLoading(null);
    }
  };

  const handleReject = async () => {
    if (!notes.trim()) return;
    setLoading("reject");
    try {
      const updated = await rejectPharmacyPrescription(rx.id, notes, token ?? undefined);
      setNotes("");
      onReject?.(updated as PharmacyPrescription);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className={cn("border-border/50 shadow-sm", hasSevere && "border-red-500/40", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" />
            {rx.medication} {rx.dosage}
          </CardTitle>
          <div className="flex items-center gap-2">
            <StatusBadge status={rx.priority} />
            <StatusBadge status={rx.status} />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs mt-2">
          <div><span className="text-muted-foreground">Patient: </span><span className="font-medium">{rx.patientName}</span></div>
          <div><span className="text-muted-foreground">MRN: </span><span className="font-mono">{rx.mrn}</span></div>
          <div><span className="text-muted-foreground">Route: </span><span>{rx.route}</span></div>
          <div><span className="text-muted-foreground">Freq: </span><span>{rx.frequency}</span></div>
          <div><span className="text-muted-foreground">Qty: </span><span className="font-medium">{rx.quantity}</span></div>
          <div><span className="text-muted-foreground">Refills: </span><span>{rx.refillsRemaining}/{rx.refillsAllowed}</span></div>
          <div><span className="text-muted-foreground">Setting: </span><Badge variant="outline" className="text-[10px] capitalize">{rx.setting}</Badge></div>
          <div><span className="text-muted-foreground">Prescriber: </span><span>{rx.prescribedBy}</span></div>
        </div>
        {rx.allergies.length > 0 && (
          <div className="flex items-center gap-1.5 mt-2">
            <AlertTriangle className="h-3 w-3 text-red-600" />
            <span className="text-[10px] text-red-700 font-semibold">Allergies:</span>
            {rx.allergies.map((a: any) => (
              <Badge key={typeof a === "string" ? a : a.substance ?? a.reaction ?? JSON.stringify(a)} variant="destructive" className="text-[9px] px-1 py-0">
                {typeof a === "string" ? a : a.substance ?? a.reaction ?? JSON.stringify(a)}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {hasWarnings && (
          <div className="space-y-2">
            {rx.warnings.map((w) => (
              <DrugWarningBanner key={w.id} warning={w} />
            ))}
          </div>
        )}

        {/* Patient History Panel */}
        <div className="rounded-lg border border-border/50 bg-muted/20">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Patient Medication History
            </span>
            {showHistory ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showHistory && (
            <div className="border-t border-border/40 px-3 pb-3 pt-2 space-y-3">
              {profileLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading patient history…
                </div>
              )}

              {!profileLoading && (
                <>
                  {/* Active medications */}
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <Pill className="h-3 w-3" /> Active Medications ({otherActiveMeds.length})
                    </p>
                    {otherActiveMeds.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70">No other active medications on file.</p>
                    ) : (
                      <div className="space-y-1">
                        {otherActiveMeds.map((med) => (
                          <div key={med.id} className="flex items-start justify-between rounded border border-border/40 bg-background px-2.5 py-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-tight">{med.medication} <span className="text-muted-foreground font-normal">{med.dosage}</span></p>
                              <p className="text-[10px] text-muted-foreground">{med.route} · {med.frequency}</p>
                            </div>
                            <StatusBadge status={med.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent dispense / refill history */}
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <History className="h-3 w-3" /> Recent Dispenses ({recentRefills.length})
                    </p>
                    {recentRefills.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/70">No dispense history on file.</p>
                    ) : (
                      <div className="space-y-1">
                        {recentRefills.map((r) => (
                          <div key={r.id} className="flex items-center justify-between rounded border border-border/40 bg-background px-2.5 py-1.5">
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-tight">{r.medication} <span className="text-muted-foreground font-normal">{r.dosage}</span></p>
                              <p className="text-[10px] text-muted-foreground">Qty {r.quantity} · Refill {r.refillNumber}/{r.totalRefills} · {r.pharmacist}</p>
                            </div>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {new Date(r.dispensedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Request Substitution */}
        <div className="rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => setShowSubstitution((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/40"
          >
            <span className={cn("flex items-center gap-1.5", subDone ? "text-violet-600" : "text-muted-foreground hover:text-foreground")}>
              <RefreshCw className="h-3.5 w-3.5" />
              {subDone ? "Substitution Requested ✓" : "Request Therapeutic Substitution"}
            </span>
            {showSubstitution ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {showSubstitution && (
            <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Substitute Medication</label>
                <input
                  type="text"
                  placeholder="e.g. Paracetamol 500 mg Tablet (generic)"
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  value={subMedication}
                  onChange={(e) => setSubMedication(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reason for Substitution</label>
                <Textarea
                  placeholder="e.g. Non-formulary brand — therapeutically equivalent generic available at lower cost…"
                  rows={2}
                  className="text-xs resize-none"
                  value={subReason}
                  onChange={(e) => setSubReason(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-violet-700 border-violet-500/40 hover:bg-violet-500/10"
                  disabled={subLoading || !subMedication.trim() || !subReason.trim()}
                  onClick={handleRequestSubstitution}
                >
                  {subLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  Submit Request
                </Button>
              </div>
              {subError && (
                <p className="text-[11px] text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {subError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Flag Intervention */}
        <div className="rounded-lg border border-border/50">
          <button
            type="button"
            onClick={() => setShowIntervention((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted/40"
          >
            <span className={cn("flex items-center gap-1.5", interventionDone ? "text-amber-600" : "text-muted-foreground hover:text-foreground")}>
              <Flag className="h-3.5 w-3.5" />
              {interventionDone ? "Intervention Flagged ✓" : "Flag Clinical Intervention"}
            </span>
            {showIntervention ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          </button>
          {showIntervention && (
            <div className="space-y-2 border-t border-border/40 px-3 pb-3 pt-2">
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Intervention Type</label>
                <select
                  value={interventionType}
                  onChange={(e) => setInterventionType(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {INTERVENTION_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reason / Clinical Concern</label>
                <Textarea
                  placeholder="Describe the clinical concern…"
                  rows={2}
                  className="text-xs resize-none"
                  value={interventionReason}
                  onChange={(e) => setInterventionReason(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Recommendation</label>
                <Textarea
                  placeholder="Recommended action for the prescriber…"
                  rows={2}
                  className="text-xs resize-none"
                  value={interventionRec}
                  onChange={(e) => setInterventionRec(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-xs text-amber-700 border-amber-500/40 hover:bg-amber-500/10"
                  disabled={interventionLoading || !interventionReason.trim() || !interventionRec.trim()}
                  onClick={handleFlagIntervention}
                >
                  {interventionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                  Submit Intervention
                </Button>
              </div>
              {interventionError && (
                <p className="text-[11px] text-red-600 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  {interventionError}
                </p>
              )}
            </div>
          )}
        </div>

        <Textarea
          placeholder="Pharmacist verification notes (required for Hold / Reject)…"
          rows={2}
          className="text-xs resize-none"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {rx.verifiedBy && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground border-t pt-2">
            <ShieldCheck className="h-2.5 w-2.5 text-emerald-600" />
            <span>Verified by {rx.verifiedBy} at {rx.verifiedAt ? new Date(rx.verifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}</span>
          </div>
        )}

        {(rx.status === "pending-verification" || rx.status === "ordered") && (
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
              disabled={loading !== null || !notes.trim()}
              onClick={handleHold}
            >
              {loading === "hold" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Clock className="h-3.5 w-3.5" />}
              Hold
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-red-600 border-red-500/30 hover:bg-red-500/10"
              disabled={loading !== null || !notes.trim()}
              onClick={handleReject}
            >
              {loading === "reject" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
              Reject
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              disabled={loading !== null}
              onClick={handleVerify}
            >
              {loading === "verify" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              Verify
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

