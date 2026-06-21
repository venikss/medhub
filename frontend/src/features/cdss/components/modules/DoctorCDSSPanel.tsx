"use client";

import { BrainCircuit, BookOpen } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCDSSModule } from "@/features/cdss/hooks/useCDSSModule";
import { useAIAssistantStore } from "@/features/ai-assistant/store";
import { AlertBanner }         from "@/features/cdss/components/shared/AlertBanner";
import { RecommendationCard }  from "@/features/cdss/components/shared/RecommendationCard";
import { ExplanationPanel }    from "@/features/cdss/components/shared/ExplanationPanel";
import { EvidenceDrawer }      from "@/features/cdss/components/shared/EvidenceDrawer";
import { ModuleGraphSummary } from "@/features/cdss/components/shared/ModuleGraphSummary";
import { OverrideReasonDialog } from "@/features/cdss/components/shared/OverrideReasonDialog";

interface DoctorCDSSPanelProps {
  patientId: string;
  encounterId?:   string;
  clinicianName?: string;
  clinicianRole?: string;
  /** Compact mode: show only critical banners, no full card list */
  compact?:  boolean;
  className?: string;
}

/**
 * Embedded CDSS panel for the Doctor portal.
 * Drop into any encounter, patient chart, or order view.
 *
 * Example:
 *   <DoctorCDSSPanel patientId={patientId} encounterId={encounterId} />
 */
export function DoctorCDSSPanel({
  patientId,
  encounterId: _encounterId,
  clinicianName = "Current Clinician",
  clinicianRole = "Attending Physician",
  compact = false,
  className,
}: DoctorCDSSPanelProps) {
  void _encounterId;
  const cdss = useCDSSModule({ module: "doctor", patientId });
  const [expandedId, setExpandedId]       = useState<string | null>(null);
  const [evidenceRec, setEvidenceRec]     = useState<typeof cdss.recommendations[0] | null>(null);
  const openWithContext = useAIAssistantStore((s) => s.openWithContext);
  const patientNameFromStore = useAIAssistantStore((s) => s.patientName);

  function handleAskAI(rec: typeof cdss.recommendations[0]) {
    const name = patientNameFromStore ?? "this patient";
    const message =
      `Explain why you recommended: "${rec.title}"\n\n` +
      `Summary: ${rec.summary}\n\n` +
      `Severity: ${rec.severity} · Type: ${rec.type}\n\n` +
      `What is the clinical reasoning behind this recommendation for ${name}?`;
    openWithContext(patientId, name, message);
  }

  return (
    <div className={cn("rounded-xl border border-border/50 overflow-hidden", className)}>
      {/* Panel header */}
      <div className="flex items-center justify-between bg-muted/20 px-4 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Clinical Decision Support</span>
          {cdss.counts.critical > 0 && (
            <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5">
              {cdss.counts.critical} critical
            </Badge>
          )}
          {cdss.counts.warnings > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-400/30 text-[10px] h-5 px-1.5">
              {cdss.counts.warnings} warnings
            </Badge>
          )}
        </div>
        <Link href={`/cdss/patient/${patientId}`}>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground">
            <BookOpen className="h-3 w-3" /> All recs
          </Button>
        </Link>
      </div>

      <div className="p-3 space-y-2">
        <ModuleGraphSummary patientId={patientId} module="doctor" />

        {cdss.counts.active === 0 && (
          <div className="rounded-xl border border-dashed border-border/50 py-6 text-center">
            <BrainCircuit className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No active CDSS recommendations for this patient</p>
          </div>
        )}

        {/* Critical banners always visible */}
        {cdss.criticalRecs.map((rec) => (
          <AlertBanner
            key={rec.id}
            rec={rec}
            onView={() => {
              setExpandedId(expandedId === rec.id ? null : rec.id);
            }}
          />
        ))}

        {/* Compact mode: stop after banners */}
        {!compact && cdss.counts.active > 0 && (
          <>
            {cdss.counts.active > 0 && <Separator className="my-1" />}

            <ScrollArea className={cn(cdss.activeRecs.length > 3 ? "h-[320px]" : "")}>
              <div className="space-y-2 pr-1">
                {cdss.activeRecs
                  .sort((a, b) => {
                    const order = { critical: 0, warning: 1, info: 2 };
                    return order[a.severity] - order[b.severity];
                  })
                  .map((rec) => (
                    <div key={rec.id}>
                      <RecommendationCard
                        rec={rec}
                        hidePatient
                        selected={expandedId === rec.id}
                        onSelect={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                        onExplain={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                        onOverride={() => cdss.openOverride(rec.id)}
                        onAskAI={() => handleAskAI(rec)}
                      />
                      {/* Inline expandable explanation panel */}
                      {expandedId === rec.id && (
                        <div className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-3">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                              AI Explanation
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-muted-foreground gap-1"
                              onClick={() => {
                                setEvidenceRec(rec);
                                cdss.setShowEvidence(true);
                              }}
                            >
                              <BookOpen className="h-3 w-3" /> Evidence
                            </Button>
                          </div>
                          <ExplanationPanel rec={rec} />
                        </div>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </>
        )}
      </div>

      {/* Override dialog */}
      <OverrideReasonDialog
        open={cdss.showOverride}
        onOpenChange={(open) => { if (!open) cdss.closeOverride(); }}
        rec={cdss.overrideTarget}
        clinicianName={clinicianName}
        clinicianRole={clinicianRole}
        sourceModule="doctor"
        onSubmit={cdss.submitOverride}
      />

      {/* Evidence drawer */}
      {evidenceRec && (
        <EvidenceDrawer
          open={cdss.showEvidence}
          onOpenChange={(open) => { if (!open) cdss.setShowEvidence(false); }}
          title={evidenceRec.title}
          sources={evidenceRec.evidenceSources}
        />
      )}
    </div>
  );
}
