"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BrainCircuit, Loader2, ClipboardCopy, AlertTriangle, FlaskConical, Pill, PlusCircle, CheckCircle2 } from "lucide-react";
import { suggestEncounterAssessment, acceptAIDiagnosis, type EncounterSuggestion, type DifferentialItem, type AcceptedDiagnosis } from "@/features/cdss/api";
import { createDoctorOrder, createDoctorPrescription } from "@/features/doctor/api";
import { cn } from "@/lib/utils";

interface EncounterAISuggestProps {
  encounterId: string;
  patientId: string;
  soap: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  onApplyAssessment?: (text: string) => void;
  onApplyPlan?: (text: string) => void;
  onDiagnosisAccepted?: (diagnosis: AcceptedDiagnosis) => void;
  token?: string | null;
  className?: string;
}

type PlanBucket = "investigations" | "medications" | "other";
type ActionState = "idle" | "loading" | "success" | "error";

interface ActionStatus {
  state: ActionState;
  message?: string;
}

interface MedicationDraft {
  sourceText: string;
  medicationName: string;
  dose: string;
  route: "oral" | "iv" | "im" | "subcutaneous" | "topical" | "inhalation" | "ophthalmic" | "otic" | "rectal" | "other";
  frequency: string;
  quantity: number;
  sig: string;
  durationDays?: number;
  endDate?: string;
}

interface InvestigationDraft {
  sourceText: string;
  category: "lab" | "imaging";
  orderableName: string;
  priority: string;
  bodyPart?: string;
  specimenType?: string;
}

function normalizeHeading(line: string) {
  return line
    .trim()
    .replace(/^[-*\d.)\s]+/, "")
    .replace(/:$/, "")
    .trim()
    .toLowerCase();
}

function isPlanHeading(line: string) {
  const trimmed = line.trim();
  return /^\d+[\).]\s+/.test(trimmed) || trimmed.endsWith(":");
}

function splitPlan(plan: string) {
  const buckets: Record<PlanBucket, string[]> = {
    investigations: [],
    medications: [],
    other: [],
  };
  let activeBucket: PlanBucket = "other";

  plan.split(/\r?\n/).forEach((line) => {
    const heading = normalizeHeading(line);

    if (isPlanHeading(line)) {
      if (/investigation|diagnostic|workup|laborator|imaging|test/.test(heading)) {
        activeBucket = "investigations";
        return;
      }

      if (/medication|medicine|pharmacologic|pharmacological|antibiotic|drug|prescription/.test(heading)) {
        activeBucket = "medications";
        return;
      }

      activeBucket = "other";
    }

    if (line.trim()) {
      buckets[activeBucket].push(line.trim());
    }
  });

  return {
    investigations: buckets.investigations.join("\n"),
    medications: buckets.medications.join("\n"),
    other: buckets.other.join("\n"),
  };
}

function splitActionItems(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\s]+/, "").trim())
    .filter(Boolean);
}

function inferPriority(text: string) {
  const lower = text.toLowerCase();
  if (/\b(stat|immediate|emergent)\b/.test(lower)) return "stat";
  if (/\b(urgent|asap)\b/.test(lower)) return "urgent";
  return "routine";
}

function isImagingInvestigation(text: string) {
  return /\b(cxr|x-?ray|radiograph|ct|mri|ultrasound|us\b|echo|echocardiogram|dexa|mammogram|pet)\b/i.test(text);
}

function inferBodyPart(text: string) {
  const lower = text.toLowerCase();
  if (/\b(chest|cxr|lung|thorax)\b/.test(lower)) return "chest";
  if (/\b(head|brain|skull)\b/.test(lower)) return "head";
  if (/\b(neck)\b/.test(lower)) return "neck";
  if (/\b(abdomen|abdominal)\b/.test(lower)) return "abdomen";
  if (/\b(pelvis|pelvic)\b/.test(lower)) return "pelvis";
  if (/\b(spine|lumbar|cervical|thoracic)\b/.test(lower)) return "spine";
  if (/\b(shoulder|arm|hand|wrist|elbow)\b/.test(lower)) return "upper-extremity";
  if (/\b(hip|leg|knee|ankle|foot|femur)\b/.test(lower)) return "lower-extremity";
  if (/\b(breast)\b/.test(lower)) return "breast";
  return "other";
}

function extractOrderName(text: string) {
  const cleaned = text
    .replace(/^(consider|obtain|order|repeat|check|send|perform)\s+/i, "")
    .split(/\s+-\s+|:\s+/)[0]
    .replace(/\bto\s+(identify|assess|evaluate|guide|rule out|confirm)\b.*$/i, "")
    .replace(/\s+if\s+.*$/i, "")
    .trim();
  if (/^cxr$/i.test(cleaned)) return "Chest X-ray";
  return cleaned;
}

function inferSpecimenType(text: string) {
  const lower = text.toLowerCase();
  if (/\burine|urinalysis|\bua\b/.test(lower)) return "urine";
  if (/\bstool|fecal|c\.?\s*diff|ova|parasite/.test(lower)) return "stool";
  if (/\bsputum/.test(lower)) return "sputum";
  if (/\bswab|throat culture|nasal|wound culture/.test(lower)) return "swab";
  if (/\bbiopsy|pathology|tissue/.test(lower)) return "tissue";
  return "blood";
}

function toInvestigationDraft(item: string): InvestigationDraft {
  const category = isImagingInvestigation(item) ? "imaging" : "lab";
  return {
    sourceText: item,
    category,
    orderableName: extractOrderName(item),
    priority: inferPriority(item),
    bodyPart: category === "imaging" ? inferBodyPart(item) : undefined,
    specimenType: category === "lab" ? inferSpecimenType(item) : undefined,
  };
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

function inferRoute(text: string): MedicationDraft["route"] {
  const lower = text.toLowerCase();
  if (/\bpo\b|\boral\b|by mouth/.test(lower)) return "oral";
  if (/\biv\b|intravenous/.test(lower)) return "iv";
  if (/\bim\b|intramuscular/.test(lower)) return "im";
  if (/\bsc\b|\bsq\b|subcutaneous/.test(lower)) return "subcutaneous";
  if (/inhal/.test(lower)) return "inhalation";
  if (/topical/.test(lower)) return "topical";
  if (/ophthalmic|eye drop/.test(lower)) return "ophthalmic";
  if (/otic|ear drop/.test(lower)) return "otic";
  if (/rectal/.test(lower)) return "rectal";
  return "other";
}

function inferFrequency(text: string) {
  const lower = text.toLowerCase();
  if (/\bq4h\b|every 4 hours/.test(lower)) return "q4h";
  if (/\bq6h\b|every 6 hours/.test(lower)) return "q6h";
  if (/\bq8h\b|every 8 hours/.test(lower)) return "q8h";
  if (/\bq12h\b|every 12 hours/.test(lower)) return "q12h";
  if (/\bbid\b|twice daily/.test(lower)) return "BID";
  if (/\btid\b|three times daily/.test(lower)) return "TID";
  if (/\bqid\b|four times daily/.test(lower)) return "QID";
  if (/\bprn\b|as needed/.test(lower)) return "PRN";
  if (/\bonce daily\b|\bdaily\b|\bqd\b/.test(lower)) return "daily";
  if (/\bonce\b|\bstat\b/.test(lower)) return "once";
  return "daily";
}

function dosesPerDay(frequency: string) {
  switch (frequency.toLowerCase()) {
    case "bid":
    case "q12h":
      return 2;
    case "tid":
    case "q8h":
      return 3;
    case "qid":
    case "q6h":
      return 4;
    case "q4h":
      return 6;
    case "prn":
      return 1;
    case "once":
      return 1;
    default:
      return 1;
  }
}

function parseDurationDays(text: string) {
  const match = text.match(/\bfor\s+(\d+)\s*(day|days|week|weeks)\b/i);
  if (!match) return undefined;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return undefined;
  return match[2].toLowerCase().startsWith("week") ? amount * 7 : amount;
}

/**
 * Strip everything after the first parenthesis, comma-clause, or
 * explanatory phrase so we always store a clean drug name.
 */
function cleanMedicationName(raw: string): string {
  return raw
    // Remove action verbs at the start
    .replace(/^(continue|start|add|consider|prescribe|switch to|begin|administer|give|use|hold|resume|maintain|adjust)\s+/i, "")
    .replace(/^(adding|a|an|the)\s+/i, "")
    // Cut at first parenthesis (e.g. "Furosemide) to manage..." → "Furosemide")
    .replace(/\(.*$/, "")
    .replace(/\).*$/, "")
    // Cut at explanatory suffixes
    .replace(/\s+(to|for|in|if|as|with|by|due|per|via|which|when|unless|while|and|or)\b.*$/i, "")
    // Cut at dose (e.g. "Metoprolol 25mg" → keep both, handled later)
    // Remove trailing punctuation
    .replace(/[.,;:*]+$/, "")
    .trim();
}

function parseMedicationDraft(text: string): MedicationDraft {
  // ── Strategy 1: pipe-structured format "Drug | dose | route | frequency" ──
  const pipeParts = text.split("|").map((p) => p.trim());
  if (pipeParts.length >= 2) {
    const [rawName, rawDose, rawRoute, rawFreq, ...rest] = pipeParts;
    const medicationName = cleanMedicationName(rawName);
    const dose = rawDose || "as directed";
    const route = inferRoute(rawRoute ?? "");
    const frequency = inferFrequency(rawFreq ?? "");
    const durationDays = parseDurationDays(rest.join(" "));
    const sigParts = [dose, route !== "other" ? route.toUpperCase() : undefined, frequency]
      .filter(Boolean).join(" ");
    return {
      sourceText: text,
      medicationName: medicationName || rawName,
      dose,
      route,
      frequency,
      quantity: Math.max(1, (durationDays ?? 1) * dosesPerDay(frequency)),
      sig: durationDays ? `${sigParts} for ${durationDays} days` : sigParts || "Use as directed",
      durationDays,
      endDate: durationDays ? addDays(new Date(), durationDays - 1) : undefined,
    };
  }

  // ── Strategy 2: heuristic extraction ─────────────────────────────────────
  const doseMatch = text.match(/\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|gram|grams|ml|units?|iu|%)\b(?:\s*\/\s*\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|units?|iu|%))?/i);
  const dose = doseMatch?.[0].replace(/\s+/g, " ") ?? "as directed";
  const beforeDose = doseMatch ? text.slice(0, doseMatch.index).trim() : text;
  const medicationName = cleanMedicationName(beforeDose) || "Medication";
  const frequency = inferFrequency(text);
  const durationDays = parseDurationDays(text);
  const route = inferRoute(text);
  const sigParts = [dose, route !== "other" ? route.toUpperCase() : undefined, frequency]
    .filter(Boolean)
    .join(" ");

  return {
    sourceText: text,
    medicationName,
    dose,
    route,
    frequency,
    quantity: Math.max(1, (durationDays ?? 1) * dosesPerDay(frequency)),
    sig: durationDays ? `${sigParts} for ${durationDays} days` : sigParts || "Use as directed",
    durationDays,
    endDate: durationDays ? addDays(new Date(), durationDays - 1) : undefined,
  };
}

function PlanBlock({
  title,
  icon,
  text,
  emptyText,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  text: string;
  emptyText: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background p-3">
      <div className="mb-2 flex items-center gap-2">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      </div>
      {children || (
        text ? (
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
            {text}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )
      )}
    </div>
  );
}

export function EncounterAISuggest({
  encounterId,
  patientId,
  soap,
  onApplyAssessment,
  onApplyPlan,
  onDiagnosisAccepted,
  token,
  className,
}: EncounterAISuggestProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<EncounterSuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>({});
  const [diagnosisStatuses, setDiagnosisStatuses] = useState<Record<number, ActionStatus>>({});

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    setResult(null);
    setActionStatuses({});
    setDiagnosisStatuses({});
    try {
      const data = await suggestEncounterAssessment(encounterId, soap, token);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI suggestion failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAcceptDiagnosis(item: DifferentialItem, index: number) {
    setDiagnosisStatuses((prev) => ({ ...prev, [index]: { state: "loading" } }));
    try {
      const accepted = await acceptAIDiagnosis(
        encounterId,
        {
          diagnosis: item.diagnosis,
          icd10Code: item.icd10Code ?? null,
        },
        token,
      );
      setDiagnosisStatuses((prev) => ({
        ...prev,
        [index]: { state: "success", message: `Saved as ${accepted.icdCode}` },
      }));
      onDiagnosisAccepted?.(accepted);
    } catch (e: unknown) {
      setDiagnosisStatuses((prev) => ({
        ...prev,
        [index]: {
          state: "error",
          message: e instanceof Error ? e.message : "Could not save diagnosis",
        },
      }));
    }
  }

  function copyToClipboard(text: string, key: string) {
    void navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  function setActionStatus(key: string, status: ActionStatus) {
    setActionStatuses((prev) => ({ ...prev, [key]: status }));
  }

  async function handleCreateInvestigation(draft: InvestigationDraft) {
    const key = `${draft.category}:${draft.sourceText}`;
    setActionStatus(key, { state: "loading" });

    try {
      await createDoctorOrder(
        {
          patientId,
          encounterId: encounterId || undefined,
          category: draft.category,
          orderableName: draft.orderableName,
          priority: draft.priority,
          bodyPart: draft.bodyPart,
          specimenType: draft.specimenType,
          clinicalHistory: draft.category === "imaging" ? soap.objective || soap.subjective : undefined,
        },
        token ?? undefined,
      );
      setActionStatus(key, {
        state: "success",
        message: draft.category === "imaging" ? "Radiology order added" : "Lab order added",
      });
    } catch (e: unknown) {
      setActionStatus(key, {
        state: "error",
        message: e instanceof Error ? e.message : "Could not add order",
      });
    }
  }

  async function handleCreatePrescription(item: string) {
    const key = `rx:${item}`;
    const draft = parseMedicationDraft(item);
    setActionStatus(key, { state: "loading" });

    try {
      await createDoctorPrescription(
        {
          patientId,
          encounterId: encounterId || undefined,
          medicationName: draft.medicationName,
          dose: draft.dose,
          route: draft.route,
          frequency: draft.frequency,
          quantity: draft.quantity,
          refillsAllowed: 0,
          instructions: draft.sig,
          startDate: todayDate(),
          endDate: draft.endDate,
        },
        token ?? undefined,
      );
      setActionStatus(key, { state: "success", message: "Prescription added" });
    } catch (e: unknown) {
      setActionStatus(key, {
        state: "error",
        message: e instanceof Error ? e.message : "Could not add prescription",
      });
    }
  }

  const hasAlerts = result?.alerts && !/no urgent alerts/i.test(result.alerts) && result.alerts.trim().length > 0;
  const planParts = result ? splitPlan(result.plan) : null;
  const investigationItems = planParts ? splitActionItems(planParts.investigations) : [];
  const medicationItems = planParts ? splitActionItems(planParts.medications) : [];
  const investigationDrafts = investigationItems.map(toInvestigationDraft);
  const medicationDrafts = medicationItems.map(parseMedicationDraft);

  return (
    <Card className={cn("border-primary/20 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BrainCircuit className="h-4 w-4" />
          </span>
          AI Clinical Suggestion
          <Badge variant="outline" className="text-[10px] font-normal">MedGemma</Badge>
        </CardTitle>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => { void handleSuggest(); }}
          disabled={loading || (!soap.subjective && !soap.objective)}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Analysing…</>
          ) : result ? (
            <><BrainCircuit className="h-3 w-3" /> Regenerate</>
          ) : (
            <><BrainCircuit className="h-3 w-3" /> Suggest Assessment & Plan</>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {!result && !loading && !error && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Fill in the Subjective and Objective sections, then click &ldquo;Suggest Assessment &amp; Plan&rdquo;
            to get AI-generated differential diagnoses, assessment, and plan based on the patient&apos;s
            full clinical history.
          </p>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">MedGemma is analysing the SOAP note and patient history…</p>
            <p className="text-[10px] text-muted-foreground/70">This may take 30–60 seconds</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {result && !loading && (
          <div className="space-y-3">
            {hasAlerts && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                  {result.alerts}
                </div>
              </div>
            )}

            <Tabs defaultValue="diagnosis" className="space-y-3">
              <TabsList className="flex h-9 w-full items-center gap-0.5 rounded-lg bg-muted/70 p-1">
                <TabsTrigger
                  value="diagnosis"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs data-[state=active]:shadow-sm"
                >
                  Diagnosis
                  <Badge variant="secondary" className="h-4 min-w-[1rem] px-1 text-[10px] tabular-nums">
                    {result.differential.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger
                  value="assessment"
                  className="flex flex-1 items-center justify-center rounded-md px-2 py-1 text-xs data-[state=active]:shadow-sm"
                >
                  Assessment
                </TabsTrigger>
                <TabsTrigger
                  value="plan"
                  className="flex flex-1 items-center justify-center rounded-md px-2 py-1 text-xs data-[state=active]:shadow-sm"
                >
                  Plan
                </TabsTrigger>
                <TabsTrigger
                  value="orders"
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs data-[state=active]:shadow-sm"
                >
                  Orders
                  <Badge variant="secondary" className="h-4 min-w-[1rem] px-1 text-[10px] tabular-nums">
                    {investigationDrafts.length + medicationDrafts.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="diagnosis" className="mt-0">
                {result.differential.length > 0 ? (
                  <ol className="space-y-2">
                    {result.differential.map((item, i) => {
                      const diagStatus = diagnosisStatuses[i];
                      return (
                        <li key={i} className="rounded-lg border border-border/60 bg-background p-3 text-sm">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                              {i + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold text-foreground">{item.diagnosis}</span>
                                {item.icd10Code && (
                                  <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                                    {item.icd10Code}
                                  </Badge>
                                )}
                              </div>
                              {item.reasoning && (
                                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                                  {item.reasoning}
                                </p>
                              )}
                              {diagStatus && diagStatus.state !== "idle" && (
                                <p className={`mt-1 text-xs ${
                                  diagStatus.state === "success"
                                    ? "text-green-600 dark:text-green-400"
                                    : diagStatus.state === "error"
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}>
                                  {diagStatus.state === "loading"
                                    ? "Saving…"
                                    : diagStatus.message}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant={diagStatus?.state === "success" ? "outline" : "default"}
                              className="shrink-0 h-7 gap-1 text-xs"
                              disabled={diagStatus?.state === "loading" || diagStatus?.state === "success"}
                              onClick={() => { void handleAcceptDiagnosis(item, i); }}
                            >
                              {diagStatus?.state === "loading" ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : diagStatus?.state === "success" ? (
                                <><CheckCircle2 className="h-3 w-3 text-green-500" /> Accepted</>
                              ) : (
                                <><PlusCircle className="h-3 w-3" /> Accept</>
                              )}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                ) : (
                  <p className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                    No differential diagnoses were returned.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="assessment" className="mt-0 space-y-3">
                <div className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {result.assessment || "No suggested assessment was returned."}
                  </div>
                </div>
                {result.assessment && (
                  <div className="flex flex-wrap gap-2">
                    {onApplyAssessment && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 text-xs"
                        onClick={() => onApplyAssessment(result.assessment)}
                      >
                        Apply to Assessment
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => copyToClipboard(result.assessment, "assessment")}
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      {copied === "assessment" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="plan" className="mt-0 space-y-3">
                <div className="rounded-lg border border-border/60 bg-background p-3">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {result.plan || "No suggested plan was returned."}
                  </div>
                </div>
                {result.plan && (
                  <div className="flex flex-wrap gap-2">
                    {onApplyPlan && (
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1 text-xs"
                        onClick={() => onApplyPlan(result.plan)}
                      >
                        Apply to Plan
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs"
                      onClick={() => copyToClipboard(result.plan, "plan")}
                    >
                      <ClipboardCopy className="h-3.5 w-3.5" />
                      {copied === "plan" ? "Copied!" : "Copy"}
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="orders" className="mt-0 space-y-3">
                <div className="grid gap-2">
                  <PlanBlock
                    title="Investigations"
                    icon={<FlaskConical className="h-4 w-4 text-sky-600" />}
                    text=""
                    emptyText="No investigation items were separated from the plan."
                  >
                    {investigationDrafts.length > 0 ? (
                      <div className="space-y-2">
                        {investigationDrafts.map((draft) => {
                          const isImaging = draft.category === "imaging";
                          const key = `${draft.category}:${draft.sourceText}`;
                          const status = actionStatuses[key];
                          const isBusy = status?.state === "loading";
                          const isDone = status?.state === "success";

                          return (
                            <div key={key} className="rounded-md bg-muted/30 p-2">
                              <div className="space-y-2">
                                <div className="min-w-0">
                                  <p className="break-words text-xs font-semibold leading-snug text-foreground">
                                    {draft.orderableName}
                                  </p>
                                  <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground">
                                    {isImaging
                                      ? `Radiology · body part: ${draft.bodyPart}`
                                      : `Lab · specimen: ${draft.specimenType}`} · priority: {draft.priority}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={isDone ? "secondary" : "outline"}
                                  className="w-full gap-1 text-xs"
                                  disabled={isBusy || isDone}
                                  onClick={() => { void handleCreateInvestigation(draft); }}
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : isDone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <PlusCircle className="h-3.5 w-3.5" />
                                  )}
                                  {isImaging ? "Add radiology" : "Add lab"}
                                </Button>
                              </div>
                              {status?.message && (
                                <p className={cn(
                                  "mt-1 text-[11px]",
                                  status.state === "error" ? "text-destructive" : "text-muted-foreground",
                                )}>
                                  {status.message}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No investigation items were separated from the plan.</p>
                    )}
                  </PlanBlock>
                  <PlanBlock
                    title="Medication"
                    icon={<Pill className="h-4 w-4 text-emerald-600" />}
                    text=""
                    emptyText="No medication items were separated from the plan."
                  >
                    {medicationDrafts.length > 0 ? (
                      <div className="space-y-2">
                        {medicationDrafts.map((draft) => {
                          const key = `rx:${draft.sourceText}`;
                          const status = actionStatuses[key];
                          const isBusy = status?.state === "loading";
                          const isDone = status?.state === "success";

                          return (
                            <div key={key} className="rounded-md bg-muted/30 p-2">
                              <div className="space-y-2">
                                <div className="min-w-0">
                                  <p className="break-words text-xs font-semibold leading-snug text-foreground">
                                    {draft.medicationName}
                                  </p>
                                  <p className="mt-1 break-words text-[11px] leading-snug text-muted-foreground">
                                    {draft.dose} · {draft.route} · {draft.frequency} · qty {draft.quantity}
                                    {draft.durationDays ? ` · ${draft.durationDays} days` : ""}
                                  </p>
                                  <p className="break-words text-[11px] leading-snug text-muted-foreground">
                                    SIG: {draft.sig}
                                  </p>
                                </div>
                                <Button
                                  size="sm"
                                  variant={isDone ? "secondary" : "outline"}
                                  className="w-full gap-1 text-xs"
                                  disabled={isBusy || isDone}
                                  onClick={() => { void handleCreatePrescription(draft.sourceText); }}
                                >
                                  {isBusy ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : isDone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                  ) : (
                                    <PlusCircle className="h-3.5 w-3.5" />
                                  )}
                                  Prescribe
                                </Button>
                              </div>
                              {status?.message && (
                                <p className={cn(
                                  "mt-1 text-[11px]",
                                  status.state === "error" ? "text-destructive" : "text-muted-foreground",
                                )}>
                                  {status.message}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No medication items were separated from the plan.</p>
                    )}
                  </PlanBlock>
                  {planParts?.other && (
                    <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
                      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Other Plan Notes
                      </h4>
                      <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                        {planParts.other}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <p className="text-[10px] text-muted-foreground/60 text-center pt-1">
              AI suggestions are for clinical decision support only. Always apply professional judgement.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
