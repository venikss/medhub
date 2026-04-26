"use client";

import { useState } from "react";
import { BookOpen, ImageIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useCDSSModule } from "@/features/cdss/hooks/useCDSSModule";
import { AlertBanner } from "@/features/cdss/components/shared/AlertBanner";
import { RecommendationCard } from "@/features/cdss/components/shared/RecommendationCard";
import { ExplanationPanel } from "@/features/cdss/components/shared/ExplanationPanel";
import { EvidenceDrawer } from "@/features/cdss/components/shared/EvidenceDrawer";
import { ModuleGraphSummary } from "@/features/cdss/components/shared/ModuleGraphSummary";
import { OverrideReasonDialog } from "@/features/cdss/components/shared/OverrideReasonDialog";
import type { CDSSRecommendation } from "@/types";

interface RadiologyCDSSPanelProps {
  patientId: string;
  examName?: string;
  clinicianName?: string;
  clinicianRole?: string;
  className?: string;
}

const RADIOLOGY_PRIORITY_TYPES = new Set([
  "urgent_finding",
  "appropriateness_check",
  "follow_up_reminder",
]);

export function RadiologyCDSSPanel({
  patientId,
  examName,
  clinicianName = "Current Radiologist",
  clinicianRole = "Radiologist",
  className,
}: RadiologyCDSSPanelProps) {
  const cdss = useCDSSModule({ module: "radiology", patientId });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [evidenceRec, setEvidenceRec] = useState<CDSSRecommendation | null>(null);

  const examQuery = examName?.toLowerCase() ?? "";
  const primaryRecs = cdss.activeRecs.filter((rec) =>
    RADIOLOGY_PRIORITY_TYPES.has(rec.type) &&
    (examQuery.length === 0 ||
      rec.title.toLowerCase().includes(examQuery) ||
      rec.summary.toLowerCase().includes(examQuery) ||
      rec.triggeredBy.toLowerCase().includes(examQuery))
  );
  const otherRecs = cdss.activeRecs.filter((rec) => !primaryRecs.some((item) => item.id === rec.id));

  return (
    <div className={cn("rounded-xl border border-border/50 overflow-hidden", className)}>
      <div className="flex items-center justify-between bg-muted/20 px-4 py-2.5 border-b border-border/40">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-sky-600" />
          <span className="text-sm font-semibold">Radiology CDSS</span>
          {cdss.counts.critical > 0 && (
            <Badge className="bg-red-500 text-white text-[10px] h-5 px-1.5">
              {cdss.counts.critical} urgent
            </Badge>
          )}
        </div>
        <Link href={`/cdss/patient/${patientId}`}>
          <Button variant="ghost" size="sm" className="text-xs h-7 gap-1 text-muted-foreground">
            <BookOpen className="h-3 w-3" /> All
          </Button>
        </Link>
      </div>

      {cdss.counts.active === 0 ? (
        <div className="p-3 space-y-2">
          <ModuleGraphSummary patientId={patientId} module="radiology" />
          <div className="py-6 text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No active radiology recommendations for this patient</p>
          </div>
        </div>
      ) : (
        <div className="p-3 space-y-2">
          <ModuleGraphSummary patientId={patientId} module="radiology" />

          {primaryRecs
            .filter((rec) => rec.severity === "critical")
            .map((rec) => (
              <AlertBanner
                key={rec.id}
                rec={rec}
                onView={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
              />
            ))}

          {primaryRecs.length > 0 && (
            <>
              <Separator className="my-1" />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-1">
                {examName ? `Exam Focus: ${examName}` : "Urgent Findings"}
              </p>
            </>
          )}

          <ScrollArea className={primaryRecs.length + otherRecs.length > 3 ? "h-[320px]" : ""}>
            <div className="space-y-2 pr-1">
              {[...primaryRecs, ...otherRecs]
                .sort((a, b) => {
                  const order = { critical: 0, warning: 1, info: 2 };
                  return order[a.severity] - order[b.severity];
                })
                .map((rec) => (
                  <div key={rec.id}>
                    <RecommendationCard
                      rec={rec}
                      hidePatient
                      showModule
                      selected={expandedId === rec.id}
                      onSelect={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                      onExplain={() => setExpandedId(expandedId === rec.id ? null : rec.id)}
                      onOverride={() => cdss.openOverride(rec.id)}
                    />
                    {expandedId === rec.id && (
                      <div className="mt-2 rounded-xl border border-border/40 bg-muted/10 p-3">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Communication Guidance
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
        </div>
      )}

      <OverrideReasonDialog
        open={cdss.showOverride}
        onOpenChange={(open) => { if (!open) cdss.closeOverride(); }}
        rec={cdss.overrideTarget}
        clinicianName={clinicianName}
        clinicianRole={clinicianRole}
        sourceModule="radiology"
        onSubmit={cdss.submitOverride}
      />

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
