"use client";

import { BrainCircuit, BookOpen, Database, FileText, FlaskConical, ExternalLink, TrendingUp, TrendingDown, Minus, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { CDSSRecommendation, CDSSEvidenceSourceType, CDSSConfidenceLevel } from "@/types";

// ── Confidence Meter ──────────────────────────────────────────────────────────
const CONFIDENCE_CONFIG: Record<CDSSConfidenceLevel, { color: string; ring: string; label: string }> = {
  high:     { color: "text-emerald-600", ring: "bg-emerald-500", label: "High Confidence" },
  moderate: { color: "text-amber-600",   ring: "bg-amber-500",   label: "Moderate Confidence" },
  low:      { color: "text-red-600",     ring: "bg-red-500",     label: "Low Confidence" },
};

function ConfidenceMeter({ score, level }: { score: number; level: CDSSConfidenceLevel }) {
  const cfg = CONFIDENCE_CONFIG[level];
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-12 w-12 shrink-0">
        <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90">
          <circle cx="18" cy="18" r="15.9" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-muted/30" />
          <circle
            cx="18" cy="18" r="15.9"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.5"
            strokeDasharray={`${(score / 100) * 100} 100`}
            strokeLinecap="round"
            className={cfg.color}
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

// ── Evidence Source Type Icons ────────────────────────────────────────────────
const SOURCE_ICONS: Record<CDSSEvidenceSourceType, React.ElementType> = {
  guideline:    BookOpen,
  drug_database: Database,
  literature:   FileText,
  ai_model:     BrainCircuit,
  ehr_pattern:  FlaskConical,
};

const SOURCE_COLORS: Record<CDSSEvidenceSourceType, string> = {
  guideline:    "bg-sky-500/10 text-sky-700 border-sky-400/30",
  drug_database: "bg-purple-500/10 text-purple-700 border-purple-400/30",
  literature:   "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  ai_model:     "bg-violet-500/10 text-violet-700 border-violet-400/30",
  ehr_pattern:  "bg-amber-500/10 text-amber-700 border-amber-400/30",
};

const SOURCE_TYPE_LABELS: Record<CDSSEvidenceSourceType, string> = {
  guideline:    "Clinical Guideline",
  drug_database: "Drug Database",
  literature:   "Literature",
  ai_model:     "AI Model",
  ehr_pattern:  "EHR Pattern",
};

// ── Flag Icons ────────────────────────────────────────────────────────────────
function FlagIcon({ flag }: { flag?: string }) {
  if (!flag || flag === "normal") return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (flag === "high") return <TrendingUp className="h-3 w-3 text-amber-600" />;
  if (flag === "low") return <TrendingDown className="h-3 w-3 text-sky-600" />;
  if (flag === "critical") return <AlertCircle className="h-3 w-3 text-red-600" />;
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
interface ExplanationPanelProps {
  rec: CDSSRecommendation;
}

export function ExplanationPanel({ rec }: ExplanationPanelProps) {
  const { explanation, evidenceSources, suggestedActions } = rec;

  return (
    <div className="space-y-4">
      {/* AI Disclaimer Banner */}
      <div className="rounded-lg border border-violet-400/30 bg-violet-500/5 px-3 py-2 flex items-start gap-2">
        <BrainCircuit className="h-4 w-4 text-violet-600 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-700 leading-relaxed">
          <span className="font-semibold">AI-assisted recommendation.</span> This suggestion is
          generated to support — not replace — clinical judgment. All recommendations require
          clinician review before action.
        </p>
      </div>

      <Tabs defaultValue="explanation" className="space-y-3">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="explanation" className="text-xs h-7">Reasoning</TabsTrigger>
          <TabsTrigger value="inputs" className="text-xs h-7">Clinical Inputs</TabsTrigger>
          <TabsTrigger value="evidence" className="text-xs h-7">Evidence ({evidenceSources.length})</TabsTrigger>
          <TabsTrigger value="actions" className="text-xs h-7">Actions</TabsTrigger>
        </TabsList>

        {/* Reasoning Tab */}
        <TabsContent value="explanation" className="space-y-3 mt-3">
          {/* Confidence Meter */}
          <Card className="border-border/40">
            <CardContent className="pt-4 pb-4">
              <ConfidenceMeter score={explanation.confidenceScore} level={explanation.confidence} />
              {explanation.modelVersion && (
                <p className="text-[10px] text-muted-foreground mt-2 italic">
                  Model: {explanation.modelVersion}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Why this recommendation</p>
            <p className="text-sm leading-relaxed text-foreground/90">{explanation.summary}</p>
          </div>

          {/* Reasoning bullets */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Reasoning Chain</p>
            <ul className="space-y-1.5">
              {explanation.reasoning.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed text-foreground/85">{r}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Limitations */}
          {explanation.limitations.length > 0 && (
            <div className="rounded-lg border border-amber-400/30 bg-amber-500/5 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1.5">Known Limitations</p>
              <ul className="space-y-1">
                {explanation.limitations.map((l, i) => (
                  <li key={i} className="text-xs text-amber-700/80 flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0">•</span>
                    {l}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>

        {/* Clinical Inputs Tab */}
        <TabsContent value="inputs" className="mt-3">
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border/40">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Parameter</th>
                  <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground">Value</th>
                  <th className="w-8 py-2 px-3" />
                </tr>
              </thead>
              <tbody>
                {explanation.clinicalInputs.map((inp, i) => (
                  <tr key={i} className={cn(
                    "border-b border-border/20",
                    inp.flag === "critical" && "bg-red-500/5",
                    inp.flag === "high" && "bg-amber-500/5",
                  )}>
                    <td className="py-2 px-3 text-xs text-muted-foreground font-medium">{inp.label}</td>
                    <td className={cn(
                      "py-2 px-3 text-sm font-semibold",
                      inp.flag === "critical" && "text-red-700",
                      inp.flag === "high" && "text-amber-700",
                      inp.flag === "low" && "text-sky-700",
                    )}>
                      {inp.value}
                    </td>
                    <td className="py-2 px-3"><FlagIcon flag={inp.flag} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence" className="space-y-3 mt-3">
          {evidenceSources.map((ev) => {
            const EvidIcon = SOURCE_ICONS[ev.sourceType];
            return (
              <Card key={ev.id} className="border-border/40">
                <CardHeader className="pb-2 pt-3">
                  <div className="flex items-start gap-2.5">
                    <div className={cn("rounded-lg p-1.5 border shrink-0", SOURCE_COLORS[ev.sourceType])}>
                      <EvidIcon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-xs font-semibold">{ev.shortName}</CardTitle>
                        <Badge variant="outline" className={cn("text-[10px] border", SOURCE_COLORS[ev.sourceType])}>
                          {SOURCE_TYPE_LABELS[ev.sourceType]}
                        </Badge>
                        {ev.evidenceGrade && (
                          <Badge variant="secondary" className="text-[10px]">{ev.evidenceGrade}</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{ev.title}</p>
                      {ev.publishedYear && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">{ev.publishedYear}</p>
                      )}
                    </div>
                    {ev.url && (
                      <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary shrink-0">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </CardHeader>
                {ev.excerpt && (
                  <CardContent className="pb-3">
                    <p className="text-xs text-muted-foreground italic leading-relaxed border-l-2 border-border/60 pl-2.5">
                      &quot;{ev.excerpt}&quot;
                    </p>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </TabsContent>

        {/* Suggested Actions Tab */}
        <TabsContent value="actions" className="mt-3">
          <div className="space-y-2">
            {suggestedActions.map((action, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm leading-relaxed">{action}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/60 mt-3 italic">
            These are AI-generated suggestions. Clinical decisions remain solely the responsibility of the treating clinician.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
