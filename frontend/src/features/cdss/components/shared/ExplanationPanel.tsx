"use client";

import {
  BrainCircuit, BookOpen, Database, FileText, FlaskConical,
  ExternalLink, TrendingUp, TrendingDown, Minus, AlertCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_METER, SOURCE_ICONS, SOURCE_COLORS, SOURCE_TYPE_LABELS,
} from "@/features/cdss/constants";
import type { CDSSRecommendation, CDSSEvidenceSourceType, CDSSConfidenceLevel } from "@/types";

// ── Confidence Meter ──────────────────────────────────────────────────────────

function ConfidenceMeter({ score, level }: { score: number; level: CDSSConfidenceLevel }) {
  const cfg = CONFIDENCE_METER[level];
  const circumference = 2 * Math.PI * 15.9;
  const dashArray = `${(score / 100) * circumference} ${circumference}`;
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 shrink-0">
        <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.5" className="text-muted/30 stroke-current" />
          <circle
            cx="18" cy="18" r="15.9"
            fill="none"
            strokeWidth="3.5"
            strokeDasharray={dashArray}
            strokeLinecap="round"
            className={cfg.trackColor}
          />
        </svg>
        <span className={cn("absolute inset-0 flex items-center justify-center text-[11px] font-bold", cfg.color)}>
          {score}%
        </span>
      </div>
      <div>
        <p className={cn("text-sm font-semibold", cfg.color)}>{cfg.label}</p>
        <p className="text-xs text-muted-foreground">AI confidence score</p>
      </div>
    </div>
  );
}

// ── Flag Icons ────────────────────────────────────────────────────────────────

function FlagIcon({ flag }: { flag?: string }) {
  if (!flag || flag === "normal") return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (flag === "high")     return <TrendingUp className="h-3 w-3 text-amber-600" />;
  if (flag === "low")      return <TrendingDown className="h-3 w-3 text-sky-600" />;
  if (flag === "critical") return <AlertCircle className="h-3 w-3 text-red-600" />;
  return null;
}

const FLAG_ROW: Record<string, string> = {
  critical: "bg-red-500/5 border-l-2 border-red-400/40",
  high:     "bg-amber-500/5",
  low:      "bg-sky-500/5",
  normal:   "",
};

// ── Source-type icon helper ───────────────────────────────────────────────────

function SourceIcon({ sourceType }: { sourceType: CDSSEvidenceSourceType }) {
  const Icon = SOURCE_ICONS[sourceType] ?? BookOpen;
  return <Icon className="h-4 w-4 shrink-0" />;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface ExplanationPanelProps {
  rec: CDSSRecommendation;
}

/**
 * Generic, store-free explanation panel.
 * Same interface as the hub version — use in any module context.
 */
export function ExplanationPanel({ rec }: ExplanationPanelProps) {
  const { explanation, evidenceSources, suggestedActions } = rec;

  return (
    <div className="space-y-4">
      {/* AI disclaimer */}
      <div className="rounded-lg border border-violet-400/30 bg-violet-500/5 px-3 py-2 flex items-start gap-2">
        <BrainCircuit className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 leading-relaxed">
          <span className="font-semibold">AI-assisted recommendation.</span>{" "}
          This suggestion is generated to support — not replace — clinical judgment.
          All recommendations require clinician review before action.
        </p>
      </div>

      <Tabs defaultValue="reasoning" className="space-y-3">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="reasoning" className="text-xs h-7">Reasoning</TabsTrigger>
          <TabsTrigger value="inputs"    className="text-xs h-7">Clinical Inputs</TabsTrigger>
          <TabsTrigger value="evidence"  className="text-xs h-7">Evidence ({evidenceSources.length})</TabsTrigger>
          <TabsTrigger value="actions"   className="text-xs h-7">Actions</TabsTrigger>
        </TabsList>

        {/* Reasoning */}
        <TabsContent value="reasoning" className="space-y-3 mt-3">
          <Card className="border-border/40">
            <CardContent className="pt-4 pb-4 space-y-2">
              <ConfidenceMeter score={explanation.confidenceScore} level={explanation.confidence} />
              {explanation.modelVersion && (
                <p className="text-[10px] text-muted-foreground italic">
                  Model: {explanation.modelVersion}
                </p>
              )}
            </CardContent>
          </Card>
          <div className="text-xs text-muted-foreground leading-relaxed">
            {explanation.summary}
          </div>
          <ol className="space-y-1.5">
            {explanation.reasoning.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="text-foreground/80 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          {explanation.limitations.length > 0 && (
            <div className="rounded-lg bg-muted/30 px-3 py-2 space-y-1">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Limitations
              </p>
              {explanation.limitations.map((lim, i) => (
                <p key={i} className="text-xs text-muted-foreground">• {lim}</p>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Clinical Inputs */}
        <TabsContent value="inputs" className="mt-3">
          <div className="rounded-xl border border-border/50 overflow-hidden text-xs">
            <div className="grid grid-cols-[1fr_1fr_auto] bg-muted/30 border-b border-border/40 px-3 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              <span>Parameter</span>
              <span>Value</span>
              <span>Flag</span>
            </div>
            {explanation.clinicalInputs.map((inp, i) => (
              <div
                key={i}
                className={cn(
                  "grid grid-cols-[1fr_1fr_auto] px-3 py-2 border-b border-border/20 last:border-0",
                  FLAG_ROW[inp.flag ?? "normal"],
                )}
              >
                <span className="font-medium text-foreground/70">{inp.label}</span>
                <span>{inp.value}</span>
                <span className="flex items-center justify-end w-6">
                  <FlagIcon flag={inp.flag} />
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Evidence */}
        <TabsContent value="evidence" className="space-y-3 mt-3">
          {evidenceSources.map((src) => {
            const SrcIcon = SOURCE_ICONS[src.sourceType] ?? FileText;
            return (
              <div key={src.id} className="rounded-xl border border-border/50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <SrcIcon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold">{src.shortName}</span>
                      <Badge
                        variant="outline"
                        className={cn("text-[10px] border", SOURCE_COLORS[src.sourceType])}
                      >
                        {SOURCE_TYPE_LABELS[src.sourceType]}
                      </Badge>
                      {src.evidenceGrade && (
                        <Badge variant="outline" className="text-[10px] border border-border/50 text-muted-foreground">
                          {src.evidenceGrade}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{src.title}</p>
                    {src.publishedYear && (
                      <p className="text-[10px] text-muted-foreground/60">{src.publishedYear}</p>
                    )}
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-muted-foreground hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {src.excerpt && (
                  <p className="text-xs text-muted-foreground/80 italic border-l-2 border-border/40 pl-2.5 leading-relaxed">
                    &quot;{src.excerpt}&quot;
                  </p>
                )}
              </div>
            );
          })}
        </TabsContent>

        {/* Actions */}
        <TabsContent value="actions" className="space-y-3 mt-3">
          <ol className="space-y-2">
            {suggestedActions.map((action, i) => (
              <li key={i} className="flex gap-2 items-start text-xs">
                <span className="h-5 w-5 shrink-0 rounded-full bg-emerald-500/10 text-emerald-700 text-[10px] font-bold flex items-center justify-center mt-0.5">
                  {i + 1}
                </span>
                <span className="leading-relaxed text-foreground/80">{action}</span>
              </li>
            ))}
          </ol>
          <div className="rounded-lg border border-violet-400/20 bg-violet-500/5 px-3 py-2">
            <p className="text-[10px] text-violet-700 leading-relaxed">
              These actions are AI suggestions only. Clinician judgment and patient context
              must always guide final care decisions.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
