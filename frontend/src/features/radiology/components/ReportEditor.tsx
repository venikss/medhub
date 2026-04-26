"use client";

import { useState } from "react";
import { SaveIcon, Send, FileCheck, PenLine, ChevronDown, ChevronUp, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ModalityBadge } from "./ModalityBadge";
import type { RadiologyReport, PriorStudy } from "@/types";

const STATUS_STYLES: Record<string, string> = {
  draft:       "bg-slate-100 text-slate-700",
  preliminary: "bg-amber-100 text-amber-700",
  final:       "bg-emerald-100 text-emerald-700",
  amended:     "bg-cyan-100 text-cyan-700",
  addendum:    "bg-purple-100 text-purple-700",
};

interface ReportEditorProps {
  report: RadiologyReport;
  priorStudies?: PriorStudy[];
  readOnly?: boolean;
  onSaveDraft?: (id: string, data: Partial<RadiologyReport>) => void;
  onSignPreliminary?: (id: string) => void;
  onSign?: (id: string) => void;
  className?: string;
}

export function ReportEditor({
  report,
  priorStudies = [],
  readOnly = false,
  onSaveDraft,
  onSignPreliminary,
  onSign,
  className,
}: ReportEditorProps) {
  const [technique, setTechnique]           = useState(report.technique);
  const [comparison, setComparison]         = useState(report.comparison ?? "");
  const [findings, setFindings]             = useState(report.findings);
  const [impression, setImpression]         = useState(report.impression);
  const [recommendations, setRecommendations] = useState(report.recommendations ?? "");
  const [showPriors, setShowPriors]         = useState(false);

  const isFinalised = report.status === "final" || report.status === "amended";
  const isEditable  = !readOnly && !isFinalised;

  function handleSave() {
    onSaveDraft?.(report.id, { technique, comparison, findings, impression, recommendations });
  }

  return (
    <Card className={cn("h-full flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ModalityBadge modality={report.modality} />
              <CardTitle className="text-base">{report.examName}</CardTitle>
              <Badge
                variant="secondary"
                className={cn("capitalize", STATUS_STYLES[report.status])}
              >
                {report.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {report.patientName} · {report.mrn} · {report.examDate}
            </p>
            <p className="text-xs text-muted-foreground">
              Acc#: {report.accessionNumber} · Radiologist: {report.radiologist}
            </p>
          </div>
          {/* Actions */}
          {isEditable && (
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={handleSave}>
                <SaveIcon className="h-3.5 w-3.5" />
                Save Draft
              </Button>
              {report.status === "draft" && onSignPreliminary && (
                <Button size="sm" variant="secondary" className="gap-1" onClick={() => onSignPreliminary(report.id)}>
                  <Send className="h-3.5 w-3.5" />
                  Release Prelim
                </Button>
              )}
              {(report.status === "preliminary" || report.status === "draft") && onSign && (
                <Button size="sm" className="gap-1" onClick={() => onSign(report.id)}>
                  <FileCheck className="h-3.5 w-3.5" />
                  Sign Final
                </Button>
              )}
              {(report.status === "final") && (
                <Button size="sm" variant="outline" className="gap-1">
                  <PenLine className="h-3.5 w-3.5" />
                  Addendum
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      {/* Body */}
      <CardContent className="flex-1 overflow-y-auto pt-4 space-y-4">
        {/* Indication (read-only) */}
        <div className="space-y-1">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Clinical History / Indication</Label>
          <p className="rounded bg-muted/50 p-2 text-sm">{report.indication}</p>
        </div>

        <Separator />

        {/* Technique */}
        <div className="space-y-1">
          <Label htmlFor="technique" className="text-xs uppercase tracking-wide text-muted-foreground">Technique</Label>
          {isEditable ? (
            <Textarea
              id="technique"
              value={technique}
              onChange={(e) => setTechnique(e.target.value)}
              rows={2}
              className="text-sm resize-none"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{technique}</p>
          )}
        </div>

        {/* Comparison */}
        <div className="space-y-1">
          <Label htmlFor="comparison" className="text-xs uppercase tracking-wide text-muted-foreground">Comparison</Label>
          {isEditable ? (
            <Textarea
              id="comparison"
              value={comparison}
              onChange={(e) => setComparison(e.target.value)}
              rows={1}
              className="text-sm resize-none"
              placeholder="No prior studies available."
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{comparison || "—"}</p>
          )}
        </div>

        <Separator />

        {/* Findings */}
        <div className="space-y-1">
          <Label htmlFor="findings" className="text-xs uppercase tracking-wide text-muted-foreground">Findings</Label>
          {isEditable ? (
            <Textarea
              id="findings"
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              rows={6}
              className="text-sm"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{findings}</p>
          )}
        </div>

        {/* Impression */}
        <div className="space-y-1">
          <Label htmlFor="impression" className="text-xs uppercase tracking-wide text-muted-foreground">Impression</Label>
          {isEditable ? (
            <Textarea
              id="impression"
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              rows={4}
              className="text-sm"
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{impression}</p>
          )}
        </div>

        {/* Recommendations */}
        <div className="space-y-1">
          <Label htmlFor="recommendations" className="text-xs uppercase tracking-wide text-muted-foreground">Recommendations</Label>
          {isEditable ? (
            <Textarea
              id="recommendations"
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              rows={2}
              className="text-sm resize-none"
              placeholder="Optional follow-up recommendation..."
            />
          ) : (
            <p className="text-sm whitespace-pre-wrap">{recommendations || "—"}</p>
          )}
        </div>

        {/* Addendum */}
        {report.addendum && (
          <>
            <Separator />
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-amber-600">Addendum</Label>
              <p className="text-xs text-muted-foreground">
                By {report.addendumBy}{report.addendumAt ? ` · ${new Date(report.addendumAt).toLocaleString()}` : ""}
              </p>
              <p className="text-sm whitespace-pre-wrap">{report.addendum}</p>
            </div>
          </>
        )}

        {/* Prior Studies */}
        {priorStudies.length > 0 && (
          <>
            <Separator />
            <div>
              <button
                type="button"
                className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                onClick={() => setShowPriors((p) => !p)}
              >
                <History className="h-3 w-3" />
                Prior Studies ({priorStudies.length})
                {showPriors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {showPriors && (
                <div className="mt-2 space-y-2">
                  {priorStudies.map((ps) => (
                    <div key={ps.id} className="rounded border p-2 text-xs">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{ps.examName}</span>
                        <span className="text-muted-foreground">{ps.examDate}</span>
                        <span className="text-muted-foreground">· {ps.radiologist}</span>
                      </div>
                      {ps.impression && (
                        <p className="text-muted-foreground italic">{ps.impression}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
