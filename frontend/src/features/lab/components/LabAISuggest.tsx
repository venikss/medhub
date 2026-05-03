"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BrainCircuit, Loader2, CheckCircle2, AlertTriangle, XOctagon, ChevronDown, ChevronUp } from "lucide-react";
import { suggestLabInterpretation, type LabAISuggestion, type LabResultInput } from "@/features/cdss/api";
import { cn } from "@/lib/utils";

interface LabAISuggestProps {
  panelId: string;
  patientId: string;
  patientName?: string;
  panelName: string;
  results: LabResultInput[];
  token?: string | null;
  className?: string;
}

const OVERALL_CONFIG = {
  normal: {
    label: "All Results Normal",
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-500/10 border-emerald-500/30",
    badgeCls: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  },
  abnormal: {
    label: "Abnormal Values Present",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-500/10 border-amber-500/30",
    badgeCls: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  },
  critical: {
    label: "Critical Values Detected",
    icon: XOctagon,
    color: "text-red-600",
    bg: "bg-red-500/10 border-red-500/30",
    badgeCls: "border-red-500/40 bg-red-500/10 text-red-700",
  },
} as const;

function Section({ title, content, defaultOpen = false }: { title: string; content: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  if (!content) return null;
  return (
    <div className="rounded-lg border border-border/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
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

export function LabAISuggest({
  panelId,
  patientId,
  patientName,
  panelName,
  results,
  token,
  className,
}: LabAISuggestProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LabAISuggestion | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasValues = results.some((r) => r.value && r.value.trim() !== "");

  async function handleInterpret() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await suggestLabInterpretation(panelId, patientId, panelName, results, token);
      setResult(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "AI interpretation failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const overall = result ? OVERALL_CONFIG[result.overall] : null;
  const OverallIcon = overall?.icon;

  return (
    <Card className={cn("border-primary/20 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <BrainCircuit className="h-4 w-4" />
          </span>
          AI Lab Interpretation
          <Badge variant="outline" className="text-[10px] font-normal">MedGemma</Badge>
        </CardTitle>
        <Button
          size="sm"
          className="h-7 text-xs gap-1.5"
          onClick={() => { void handleInterpret(); }}
          disabled={loading || !hasValues}
          title={!hasValues ? "Enter result values first" : undefined}
        >
          {loading ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Interpreting…</>
          ) : result ? (
            <><BrainCircuit className="h-3 w-3" /> Re-interpret</>
          ) : (
            <><BrainCircuit className="h-3 w-3" /> Interpret Results</>
          )}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {!result && !loading && !error && (
          <p className="py-4 text-center text-xs text-muted-foreground">
            {hasValues ? (
              <>
                Click &ldquo;Interpret Results&rdquo; to get a MedGemma-powered clinical interpretation of{" "}
                <span className="font-medium text-foreground">{panelName}</span>
                {patientName && (
                  <> for <span className="font-medium text-foreground">{patientName}</span></>
                )}{" "}
                grounded in their Knowledge Graph context.
              </>
            ) : (
              "Enter lab result values before requesting AI interpretation."
            )}
          </p>
        )}

        {loading && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-xs text-muted-foreground">
              MedGemma is interpreting {panelName} results against the patient&apos;s KG…
            </p>
            <p className="text-[10px] text-muted-foreground/70">This may take 20–45 seconds</p>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {result && !loading && overall && OverallIcon && (
          <div className="space-y-3">
            {/* Overall assessment banner */}
            <div className={cn("flex items-start gap-3 rounded-lg border px-3 py-2.5", overall.bg)}>
              <OverallIcon className={cn("h-5 w-5 shrink-0 mt-0.5", overall.color)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn("text-sm font-semibold", overall.color)}>{overall.label}</span>
                  <Badge variant="outline" className={cn("text-[10px]", overall.badgeCls)}>
                    {result.overall.toUpperCase()}
                  </Badge>
                </div>
                {result.overall_text && (
                  <p className="mt-1 text-xs leading-relaxed text-foreground/80">{result.overall_text}</p>
                )}
              </div>
            </div>

            {/* Collapsible sections */}
            <Section
              title="🔬 Result Interpretation"
              content={result.interpretation}
              defaultOpen={result.overall !== "normal"}
            />
            <Section
              title="🧠 Clinical Context (Knowledge Graph)"
              content={result.clinical_context}
              defaultOpen
            />
            <Section
              title="📋 Recommended Follow-Up"
              content={result.follow_up}
              defaultOpen={result.overall === "critical"}
            />

            <p className="text-center text-[10px] text-muted-foreground/60 pt-1">
              AI interpretation is for clinical decision support only. Always apply professional judgement.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
