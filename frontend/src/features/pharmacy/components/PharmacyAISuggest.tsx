"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  BrainCircuit, Loader2, ShieldCheck, AlertTriangle, XCircle,
  ChevronDown, ChevronUp, Flag, Clock, XOctagon, CheckCircle2, RefreshCw, Zap,
} from "lucide-react";
import { suggestRxVerification, type RxAISuggestion, type SubstitutionSuggestion } from "@/features/cdss/api";
import {
  createIntervention, createSubstitution,
  holdPharmacyPrescription, rejectPharmacyPrescription, verifyPharmacyPrescription,
} from "@/features/pharmacy/api";
import { cn } from "@/lib/utils";
import type { PharmacyPrescription } from "@/types";

interface PharmacyAISuggestProps {
  rx: PharmacyPrescription;
  token?: string | null;
  className?: string;
  onVerify?: (updated: PharmacyPrescription) => void;
  onHold?: (updated: PharmacyPrescription) => void;
  onReject?: (updated: PharmacyPrescription) => void;
}

const VERDICT_CONFIG = {
  safe: {
    label: "Safe to Dispense", icon: ShieldCheck,
    color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30",
    badgeCls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  },
  caution: {
    label: "Dispense with Caution", icon: AlertTriangle,
    color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30",
    badgeCls: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  },
  do_not_dispense: {
    label: "Do Not Dispense", icon: XCircle,
    color: "text-red-600", bg: "bg-red-500/10 border-red-500/30",
    badgeCls: "border-red-500/40 bg-red-500/10 text-red-700",
  },
} as const;

const INTERVENTION_TYPES = [
  { value: "dose-adjustment", label: "Dose Adjustment" },
  { value: "therapy-change", label: "Therapy Change" },
  { value: "drug-discontinuation", label: "Drug Discontinuation" },
  { value: "allergy-clarification", label: "Allergy Clarification" },
  { value: "brand-to-generic", label: "Brand to Generic" },
  { value: "formulary-substitution", label: "Formulary Substitution" },
  { value: "other", label: "Other" },
];

/** Auto-pick the most relevant intervention type from AI output */
function inferInterventionType(ai: RxAISuggestion): string {
  const text = (ai.interactions + ai.allergy_risks + ai.recommendations).toLowerCase();
  if (text.includes("allerg") || text.includes("cross-react")) return "allergy-clarification";
  if (text.includes("discontinu") || text.includes("do not dispense")) return "drug-discontinuation";
  if (text.includes("dose") || text.includes("renal") || text.includes("hepatic")) return "dose-adjustment";
  if (text.includes("substitut") || text.includes("alternative") || text.includes("generic")) return "formulary-substitution";
  if (text.includes("therapy") || text.includes("change")) return "therapy-change";
  return "other";
}

/** Build a concise pre-filled hold/reject note from AI output */
function buildNote(ai: RxAISuggestion): string {
  const lines = [`AI Rx Analysis — Verdict: ${ai.verdict.replace(/_/g, " ").toUpperCase()}`];
  if (ai.verdict_text) lines.push(ai.verdict_text);
  if (ai.interactions && ai.interactions !== "No significant interactions identified.") {
    lines.push(`DDI: ${ai.interactions.slice(0, 200)}`);
  }
  if (ai.allergy_risks && ai.allergy_risks !== "No allergy concerns identified.") {
    lines.push(`Allergy risk: ${ai.allergy_risks.slice(0, 200)}`);
  }
  return lines.join("\n");
}

function Section({ title, content, defaultOpen = false }: { title: string; content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;
  return (
    <div className="rounded-lg border border-border/50">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
        {title}
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="border-t border-border/40 px-3 pb-3 pt-2">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground">{content}</p>
        </div>
      )}
    </div>
  );
}

type ActionKey = "intervention" | "hold" | "reject" | "substitution" | "verify" | null;

interface ActionState {
  loading: boolean;
  done: boolean;
  error: string | null;
}

function useActionState() {
  const [state, setState] = useState<ActionState>({ loading: false, done: false, error: null });
  const start = () => setState({ loading: true, done: false, error: null });
  const succeed = () => setState({ loading: false, done: true, error: null });
  const fail = (msg: string) => setState({ loading: false, done: false, error: msg });
  const reset = () => setState({ loading: false, done: false, error: null });
  return { ...state, start, succeed, fail, reset };
}

export function PharmacyAISuggest({
  rx, token, className, onVerify, onHold, onReject,
}: PharmacyAISuggestProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RxAISuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeAction, setActiveAction] = useState<ActionKey>(null);

  // Per-action form state
  const [interventionType, setInterventionType] = useState("other");
  const [interventionReason, setInterventionReason] = useState("");
  const [interventionRec, setInterventionRec] = useState("");
  const [holdNote, setHoldNote] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [subMed, setSubMed] = useState("");
  const [subReason, setSubReason] = useState("");
  const [verifyNote, setVerifyNote] = useState("");

  const interventionState = useActionState();
  const holdState = useActionState();
  const rejectState = useActionState();
  const subState = useActionState();
  const verifyState = useActionState();
  // Per-card substitution loading state (keyed by index)
  const [subCardLoading, setSubCardLoading] = useState<Record<number, "loading" | "done" | "error">>({});

  async function handleAnalyse() {
    setLoading(true); setError(null); setResult(null); setActiveAction(null);
    try {
      const data = await suggestRxVerification(rx.id, rx.patientId, {
        medication: rx.medication ?? "", dose: rx.dosage ?? "",
        route: rx.route ?? "", frequency: rx.frequency ?? "",
        sig: rx.notes ?? "", indication: "",
      }, token);
      setResult(data);
      // Pre-fill forms from AI output
      setInterventionType(inferInterventionType(data));
      setInterventionReason(
        [data.interactions, data.allergy_risks].filter(Boolean).join("\n\n").slice(0, 500)
      );
      setInterventionRec(data.recommendations.slice(0, 500));
      setHoldNote(buildNote(data));
      setRejectNote(buildNote(data));
      setVerifyNote(`Reviewed via AI Rx Analysis (MedGemma). Verdict: ${data.verdict.replace(/_/g, " ")}.`);
      setSubReason(data.recommendations.slice(0, 300));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function toggleAction(key: ActionKey) {
    setActiveAction(prev => prev === key ? null : key);
  }

  async function submitSubstitutionDirect(sub: SubstitutionSuggestion, idx: number) {
    setSubCardLoading(prev => ({ ...prev, [idx]: "loading" }));
    try {
      await createSubstitution(
        { prescriptionId: rx.id, substituteMedication: sub.substitute, reason: sub.reason },
        token ?? undefined,
      );
      setSubCardLoading(prev => ({ ...prev, [idx]: "done" }));
    } catch {
      setSubCardLoading(prev => ({ ...prev, [idx]: "error" }));
    }
  }

  async function submitIntervention() {
    if (!interventionReason.trim() || !interventionRec.trim()) return;
    interventionState.start();
    try {
      await createIntervention(
        { prescriptionId: rx.id, type: interventionType, reason: interventionReason, recommendation: interventionRec },
        token ?? undefined,
      );
      interventionState.succeed();
      setActiveAction(null);
    } catch (e: unknown) {
      interventionState.fail(e instanceof Error ? e.message : "Failed to submit intervention.");
    }
  }

  async function submitHold() {
    if (!holdNote.trim()) return;
    holdState.start();
    try {
      const updated = await holdPharmacyPrescription(rx.id, holdNote, token ?? undefined);
      holdState.succeed();
      setActiveAction(null);
      onHold?.(updated as PharmacyPrescription);
    } catch (e: unknown) {
      holdState.fail(e instanceof Error ? e.message : "Failed to hold prescription.");
    }
  }

  async function submitReject() {
    if (!rejectNote.trim()) return;
    rejectState.start();
    try {
      const updated = await rejectPharmacyPrescription(rx.id, rejectNote, token ?? undefined);
      rejectState.succeed();
      setActiveAction(null);
      onReject?.(updated as PharmacyPrescription);
    } catch (e: unknown) {
      rejectState.fail(e instanceof Error ? e.message : "Failed to reject prescription.");
    }
  }

  async function submitSubstitution() {
    if (!subMed.trim() || !subReason.trim()) return;
    subState.start();
    try {
      await createSubstitution(
        { prescriptionId: rx.id, substituteMedication: subMed.trim(), reason: subReason.trim() },
        token ?? undefined,
      );
      subState.succeed();
      setActiveAction(null);
    } catch (e: unknown) {
      subState.fail(e instanceof Error ? e.message : "Failed to submit substitution.");
    }
  }

  async function submitVerify() {
    verifyState.start();
    try {
      const updated = await verifyPharmacyPrescription(rx.id, verifyNote, token ?? undefined);
      verifyState.succeed();
      setActiveAction(null);
      onVerify?.(updated as PharmacyPrescription);
    } catch (e: unknown) {
      verifyState.fail(e instanceof Error ? e.message : "Failed to verify prescription.");
    }
  }

  const verdict = result ? VERDICT_CONFIG[result.verdict] : null;
  const VerdictIcon = verdict?.icon;
  const canActOnRx = rx.status === "pending-verification" || rx.status === "ordered";

  return (
    <Card className={cn("border-primary/20 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BrainCircuit className="h-4 w-4" />
          </span>
          AI Rx Analysis
          <Badge variant="outline" className="text-[10px] font-normal">MedGemma</Badge>
        </CardTitle>
        <Button size="sm" className="h-7 text-xs gap-1.5"
          onClick={() => { void handleAnalyse(); }} disabled={loading}>
          {loading ? <><Loader2 className="h-3 w-3 animate-spin" /> Analysing…</>
            : result ? <><BrainCircuit className="h-3 w-3" /> Re-analyse</>
            : <><BrainCircuit className="h-3 w-3" /> Analyse Prescription</>}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {!result && !loading && !error && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            Click &ldquo;Analyse Prescription&rdquo; to get a MedGemma-powered safety review of{" "}
            <span className="font-medium text-foreground">{rx.medication}</span> for{" "}
            <span className="font-medium text-foreground">{rx.patientName}</span>.
          </p>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">MedGemma is reviewing {rx.medication} against the patient&apos;s KG…</p>
            <p className="text-[10px] text-muted-foreground/70">This may take 20–45 seconds</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}

        {result && !loading && verdict && VerdictIcon && (
          <div className="space-y-3">
            {/* Verdict banner */}
            <div className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", verdict.bg)}>
              <VerdictIcon className={cn("h-5 w-5 shrink-0 mt-0.5", verdict.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", verdict.color)}>{verdict.label}</span>
                  <Badge variant="outline" className={cn("text-[10px]", verdict.badgeCls)}>
                    {result.verdict.replace(/_/g, " ").toUpperCase()}
                  </Badge>
                </div>
                {result.verdict_text && (
                  <p className="mt-1 text-xs leading-relaxed text-foreground/80">{result.verdict_text}</p>
                )}
              </div>
            </div>

            {/* Collapsible analysis sections */}
            <Section title="🔗 Drug-Drug Interactions" content={result.interactions} defaultOpen={result.verdict !== "safe"} />
            <Section title="⚠️ Allergy & Cross-Reactivity Risks" content={result.allergy_risks} defaultOpen={result.verdict === "do_not_dispense"} />
            <Section title="💊 Dose Assessment" content={result.dose_assessment} />
            <Section title="✅ Pharmacist Recommendations" content={result.recommendations} defaultOpen />

            {/* ── AI Substitution Suggestions ── */}
            {result.substitution_list && result.substitution_list.length > 0 && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" /> AI-Suggested Substitutions ({result.substitution_list.length})
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Click &ldquo;Apply&rdquo; to submit the substitution request instantly — no typing required.
                </p>
                <div className="space-y-2">
                  {result.substitution_list.map((sub: SubstitutionSuggestion, idx: number) => {
                    const cardState = subCardLoading[idx];
                    return (
                      <div key={idx}
                        className={cn(
                          "flex items-start justify-between gap-3 rounded-md border px-3 py-2",
                          cardState === "done" ? "border-emerald-500/30 bg-emerald-500/5" :
                          cardState === "error" ? "border-red-500/30 bg-red-500/5" :
                          "border-violet-500/20 bg-background",
                        )}>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-foreground">{sub.substitute}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{sub.reason}</p>
                          {cardState === "done" && (
                            <p className="mt-1 text-[10px] font-medium text-emerald-600">✓ Substitution request submitted</p>
                          )}
                          {cardState === "error" && (
                            <p className="mt-1 text-[10px] text-red-600">Failed to submit — try again</p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className={cn(
                            "h-7 shrink-0 gap-1 text-xs",
                            cardState === "done"
                              ? "border-emerald-500/40 text-emerald-700 bg-emerald-500/10 cursor-default"
                              : "border-violet-500/40 text-violet-700 hover:bg-violet-500/10",
                          )}
                          disabled={cardState === "loading" || cardState === "done"}
                          onClick={() => { void submitSubstitutionDirect(sub, idx); }}
                        >
                          {cardState === "loading" ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : cardState === "done" ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <>→ Apply</>
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── AI-Powered Actions ── */}
            {canActOnRx && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                  <Zap className="h-3 w-3" /> AI-Powered Actions
                </p>

                {/* Action trigger buttons */}
                <div className="flex flex-wrap gap-2">
                  {/* Flag Intervention — always available */}
                  <Button size="sm" variant="outline"
                    className={cn("h-7 gap-1.5 text-xs",
                      interventionState.done ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                        : "border-amber-500/30 text-amber-700 hover:bg-amber-500/10")}
                    onClick={() => toggleAction("intervention")}>
                    <Flag className="h-3 w-3" />
                    {interventionState.done ? "Intervention Filed ✓" : "Flag Intervention"}
                  </Button>

                  {/* Hold — caution or do_not_dispense */}
                  {(result.verdict === "caution" || result.verdict === "do_not_dispense") && (
                    <Button size="sm" variant="outline"
                      className={cn("h-7 gap-1.5 text-xs",
                        holdState.done ? "border-blue-500/40 text-blue-700 bg-blue-500/10"
                          : "border-blue-500/30 text-blue-700 hover:bg-blue-500/10")}
                      onClick={() => toggleAction("hold")}>
                      <Clock className="h-3 w-3" />
                      {holdState.done ? "On Hold ✓" : "Hold Prescription"}
                    </Button>
                  )}

                  {/* Reject — do_not_dispense */}
                  {result.verdict === "do_not_dispense" && (
                    <Button size="sm" variant="outline"
                      className={cn("h-7 gap-1.5 text-xs",
                        rejectState.done ? "border-red-500/40 text-red-700 bg-red-500/10"
                          : "border-red-500/30 text-red-700 hover:bg-red-500/10")}
                      onClick={() => toggleAction("reject")}>
                      <XOctagon className="h-3 w-3" />
                      {rejectState.done ? "Rejected ✓" : "Reject Prescription"}
                    </Button>
                  )}

                  {/* Substitution — do_not_dispense or caution */}
                  {(result.verdict === "do_not_dispense" || result.verdict === "caution") && (
                    <Button size="sm" variant="outline"
                      className={cn("h-7 gap-1.5 text-xs",
                        subState.done ? "border-violet-500/40 text-violet-700 bg-violet-500/10"
                          : "border-violet-500/30 text-violet-700 hover:bg-violet-500/10")}
                      onClick={() => toggleAction("substitution")}>
                      <RefreshCw className="h-3 w-3" />
                      {subState.done ? "Substitution Requested ✓" : "Request Substitution"}
                    </Button>
                  )}

                  {/* Quick Verify — safe only */}
                  {result.verdict === "safe" && (
                    <Button size="sm"
                      className={cn("h-7 gap-1.5 text-xs",
                        verifyState.done ? "bg-emerald-600 hover:bg-emerald-700" : "")}
                      onClick={() => toggleAction("verify")}>
                      <CheckCircle2 className="h-3 w-3" />
                      {verifyState.done ? "Verified ✓" : "Quick Verify"}
                    </Button>
                  )}
                </div>

                {/* ── Intervention Form ── */}
                {activeAction === "intervention" && (
                  <div className="space-y-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Flag Clinical Intervention</p>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Intervention Type</label>
                      <select value={interventionType} onChange={e => setInterventionType(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary">
                        {INTERVENTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Reason / Clinical Concern</label>
                      <Textarea rows={3} className="text-xs resize-none" value={interventionReason}
                        onChange={e => setInterventionReason(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Recommendation</label>
                      <Textarea rows={3} className="text-xs resize-none" value={interventionRec}
                        onChange={e => setInterventionRec(e.target.value)} />
                    </div>
                    {interventionState.error && <p className="text-[11px] text-destructive">{interventionState.error}</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveAction(null)}>Cancel</Button>
                      <Button size="sm" className="h-7 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700"
                        disabled={interventionState.loading || !interventionReason.trim() || !interventionRec.trim()}
                        onClick={() => { void submitIntervention(); }}>
                        {interventionState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                        Submit Intervention
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Hold Form ── */}
                {activeAction === "hold" && (
                  <div className="space-y-2 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-700">Hold Prescription</p>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Hold Note (required)</label>
                      <Textarea rows={4} className="text-xs resize-none" value={holdNote}
                        onChange={e => setHoldNote(e.target.value)} />
                    </div>
                    {holdState.error && <p className="text-[11px] text-destructive">{holdState.error}</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveAction(null)}>Cancel</Button>
                      <Button size="sm" className="h-7 gap-1.5 text-xs bg-blue-600 hover:bg-blue-700"
                        disabled={holdState.loading || !holdNote.trim()}
                        onClick={() => { void submitHold(); }}>
                        {holdState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                        Confirm Hold
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Reject Form ── */}
                {activeAction === "reject" && (
                  <div className="space-y-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-red-700">Reject Prescription</p>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Rejection Reason (required)</label>
                      <Textarea rows={4} className="text-xs resize-none" value={rejectNote}
                        onChange={e => setRejectNote(e.target.value)} />
                    </div>
                    {rejectState.error && <p className="text-[11px] text-destructive">{rejectState.error}</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveAction(null)}>Cancel</Button>
                      <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs"
                        disabled={rejectState.loading || !rejectNote.trim()}
                        onClick={() => { void submitReject(); }}>
                        {rejectState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <XOctagon className="h-3 w-3" />}
                        Confirm Reject
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Substitution Form ── */}
                {activeAction === "substitution" && (
                  <div className="space-y-2 rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700">Request Therapeutic Substitution</p>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Substitute Medication</label>
                      <input type="text" placeholder="e.g. Paracetamol 500 mg (generic)"
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                        value={subMed} onChange={e => setSubMed(e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Reason</label>
                      <Textarea rows={3} className="text-xs resize-none" value={subReason}
                        onChange={e => setSubReason(e.target.value)} />
                    </div>
                    {subState.error && <p className="text-[11px] text-destructive">{subState.error}</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveAction(null)}>Cancel</Button>
                      <Button size="sm" className="h-7 gap-1.5 text-xs bg-violet-600 hover:bg-violet-700"
                        disabled={subState.loading || !subMed.trim() || !subReason.trim()}
                        onClick={() => { void submitSubstitution(); }}>
                        {subState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                        Submit Request
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Quick Verify Form ── */}
                {activeAction === "verify" && (
                  <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">Verify Prescription</p>
                    <div>
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground">Verification Note (optional)</label>
                      <Textarea rows={2} className="text-xs resize-none" value={verifyNote}
                        onChange={e => setVerifyNote(e.target.value)} />
                    </div>
                    {verifyState.error && <p className="text-[11px] text-destructive">{verifyState.error}</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActiveAction(null)}>Cancel</Button>
                      <Button size="sm" className="h-7 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700"
                        disabled={verifyState.loading}
                        onClick={() => { void submitVerify(); }}>
                        {verifyState.loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Confirm Verify
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <p className="text-center text-[10px] text-muted-foreground/60 pt-1">
              AI analysis is for clinical decision support only. Pharmacist judgement prevails.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
