"use client";

import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, User, Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCard } from "@/features/cdss/components/AlertCard";
import { ExplanationPanel } from "@/features/cdss/components/ExplanationPanel";
import { OverrideModal } from "@/features/cdss/components/OverrideModal";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getPatientCDSSSummary, listCDSSOverrides } from "@/features/cdss/api";
import { getPatient } from "@/features/frontdesk/api";
import { useCDSSStore } from "@/features/cdss/store";
import type { ADTPatient, CDSSOverrideRecord } from "@/types";

const ACTION_COLORS: Record<string, string> = {
  override:    "bg-amber-500/10 text-amber-700 border-amber-400/30",
  acknowledge: "bg-sky-500/10 text-sky-700 border-sky-400/30",
  follow:      "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  dismiss:     "bg-muted/40 text-muted-foreground border-border/40",
};

interface PatientCDSSPageProps {
  params: Promise<{ patientId: string }>;
}

export default function PatientCDSSPage({ params }: PatientCDSSPageProps) {
  const { patientId } = use(params);
  const token = useAuthStore((state) => state.token);

  const {
    recommendations,
    setRecommendations,
    selectedRecommendationId, selectRecommendation,
    showOverrideModal, overrideTargetId,
    openOverrideModal, closeOverrideModal,
  } = useCDSSStore();
  const [patientOverrides, setPatientOverrides] = useState<CDSSOverrideRecord[]>([]);
  const [patientRecord, setPatientRecord] = useState<ADTPatient | null>(null);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getPatientCDSSSummary(patientId, token ?? undefined),
      listCDSSOverrides(token ?? undefined),
      getPatient(patientId, token ?? undefined).catch(() => null),
    ])
      .then(([summary, overrides, patientData]) => {
        if (cancelled) return;
        setRecommendations(summary.data);
        setPatientOverrides(overrides.filter((item) => item.patientId === patientId));
        setPatientRecord(patientData);
      })
      .catch(() => {
        if (!cancelled) {
          setRecommendations([]);
          setPatientOverrides([]);
          setPatientRecord(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, setRecommendations, token]);

  const patientRecs = useMemo(
    () => recommendations.filter((r) => r.patientId === patientId),
    [patientId, recommendations],
  );
  const fallbackPatientName = patientRecord
    ? [patientRecord.firstName, patientRecord.lastName].filter(Boolean).join(" ").trim()
    : "";
  const patientName = (patientRecs[0]?.patientName ?? fallbackPatientName) || "Unknown patient";
  const patientMRN = patientRecs[0]?.patientMRN ?? patientRecord?.mrn ?? "—";

  const activeRecs = patientRecs.filter((r) => r.status === "active");
  const resolvedRecs = patientRecs.filter((r) => r.status !== "active");

  const selected = recommendations.find((r) => r.id === selectedRecommendationId && r.patientId === patientId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/cdss">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            {patientName}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{patientMRN} · CDSS Recommendations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs gap-1">
            <BrainCircuit className="h-3 w-3" />
            {patientRecs.length} total recommendations
          </Badge>
        </div>
      </div>

      {/* Patient Summary Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{activeRecs.filter((r) => r.severity === "critical").length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Critical Active</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{activeRecs.filter((r) => r.severity === "warning").length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Warnings</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-muted/20 p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{resolvedRecs.length}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Resolved</p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Left: Alerts + History */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Active Recommendations */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              Active Recommendations ({activeRecs.length})
            </h2>
            {activeRecs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/50 py-10 text-center">
                <BrainCircuit className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No active recommendations for this patient</p>
              </div>
            ) : (
              <div className="space-y-3">
                {activeRecs
                  .sort((a, b) => ({ critical: 0, warning: 1, info: 2 }[a.severity] - { critical: 0, warning: 1, info: 2 }[b.severity]))
                  .map((rec) => (
                    <AlertCard
                      key={rec.id}
                      rec={rec}
                      selected={selectedRecommendationId === rec.id}
                      onSelect={() => selectRecommendation(selectedRecommendationId === rec.id ? null : rec.id)}
                      onExplain={() => selectRecommendation(rec.id)}
                      onOverride={() => openOverrideModal(rec.id)}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Resolved / Historical */}
          {resolvedRecs.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 text-muted-foreground">
                Resolved / Historical ({resolvedRecs.length})
              </h2>
              <div className="space-y-2">
                {resolvedRecs.map((rec) => (
                  <AlertCard
                    key={rec.id}
                    rec={rec}
                    compact
                    selected={selectedRecommendationId === rec.id}
                    onSelect={() => selectRecommendation(selectedRecommendationId === rec.id ? null : rec.id)}
                    onExplain={() => selectRecommendation(rec.id)}
                    onOverride={() => openOverrideModal(rec.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Clinician Response History */}
          {patientOverrides.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  Clinician Response History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {patientOverrides.map((ov) => (
                    <div key={ov.id} className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] border capitalize ${ACTION_COLORS[ov.action]}`}>
                            {ov.action}
                          </Badge>
                          <span className="text-xs font-medium truncate">{ov.recommendationTitle}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{ov.reason}</p>
                        {ov.notes && (
                          <p className="text-xs text-muted-foreground/70 italic mt-0.5">{ov.notes}</p>
                        )}
                        <p className="text-[10px] text-muted-foreground/50 mt-1">
                          {ov.clinicianName} · {ov.timestamp.replace("T", " ").slice(0, 16)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Explanation Panel */}
        {selected ? (
          <div className="w-[400px] shrink-0">
            <Card className="border-border/50 shadow-sm sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-snug">{selected.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs shrink-0"
                    onClick={() => selectRecommendation(null)}
                  >
                    ✕
                  </Button>
                </div>
                <Separator className="mt-2" />
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[560px] pr-1">
                  <ExplanationPanel rec={selected} />
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="w-[400px] shrink-0 hidden lg:flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-center p-8 gap-3">
            <Calendar className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Select a recommendation</p>
            <p className="text-xs text-muted-foreground/60">View AI reasoning, evidence, and suggested actions</p>
          </div>
        )}
      </div>

      {/* Override Modal */}
      <OverrideModal
        open={showOverrideModal}
        onOpenChange={(open) => { if (!open) closeOverrideModal(); }}
        recommendationId={overrideTargetId}
      />
    </div>
  );
}
