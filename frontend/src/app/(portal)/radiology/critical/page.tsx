"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CriticalFindingBanner } from "@/features/radiology/components/CriticalFindingBanner";
import { ModalityBadge } from "@/features/radiology/components/ModalityBadge";
import { acknowledgeCriticalFinding, listCriticalFindings, notifyCriticalFinding } from "@/features/radiology/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { RadiologyCDSSPanel } from "@/features/cdss/components/modules/RadiologyCDSSPanel";
import { useCDSSDataHydration } from "@/features/cdss/hooks/useCDSSDataHydration";
import type { CriticalFinding } from "@/types";
import { cn } from "@/lib/utils";

export default function CriticalFindingsPage() {
  const token = useAuthStore((state) => state.token);
  const [findings, setFindings] = useState<CriticalFinding[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listCriticalFindings({}, token ?? undefined)
      .then((data) => {
        if (!cancelled) setFindings(data);
      })
      .catch(() => {
        if (!cancelled) setFindings([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleNotify(id: string) {
    const updated = await notifyCriticalFinding(
      id,
      { notifiedTo: "Ordering Physician", callbackNumber: "01000000000" },
      token ?? undefined,
    );
    setFindings((prev) => prev.map((finding) => (finding.id === id ? updated : finding)));
  }

  async function handleAcknowledge(id: string) {
    const updated = await acknowledgeCriticalFinding(id, token ?? undefined);
    setFindings((prev) => prev.map((finding) => (finding.id === id ? updated : finding)));
  }

  const pending = findings.filter((finding) => finding.status === "pending" || finding.status === "notified");
  const acknowledged = findings.filter((finding) => finding.status === "acknowledged");
  const { error: cdssFeedMessage } = useCDSSDataHydration({
    token,
    refreshPatientIds: Array.from(new Set(findings.map((finding) => finding.patientId))),
    refreshBeforeLoad: findings.length > 0,
    includeOverrides: true,
    useMockOnError: false,
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Critical Findings
          </h1>
          <p className="text-sm text-muted-foreground">
            Radiologist-identified findings requiring immediate communication
          </p>
        </div>
        <div className="flex gap-3">
          <Badge
            variant="secondary"
            className={cn(
              "gap-1 text-sm",
              pending.length > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600",
            )}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            {pending.length} Pending
          </Badge>
          <Badge variant="secondary" className="gap-1 bg-emerald-100 text-sm text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {acknowledged.length} Acknowledged
          </Badge>
        </div>
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
          Pending &amp; Notified
        </h2>

        {pending.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <p className="font-medium">All critical findings have been acknowledged.</p>
              <p className="text-sm">No pending actions required.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {cdssFeedMessage && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                {cdssFeedMessage}
              </div>
            )}
            {pending.map((finding) => (
              <div key={finding.id} className="space-y-3">
                <CriticalFindingBanner
                  finding={finding}
                  onNotify={handleNotify}
                  onAcknowledge={handleAcknowledge}
                />
                <RadiologyCDSSPanel patientId={finding.patientId} examName={finding.examName} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div>
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
          <History className="h-4 w-4 text-muted-foreground" />
          Acknowledged History
        </h2>

        {acknowledged.length === 0 ? (
          <p className="text-sm text-muted-foreground">No acknowledged findings yet.</p>
        ) : (
          <div className="space-y-2">
            {acknowledged.map((finding) => (
              <Card key={finding.id} className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
                <CardContent className="space-y-1 pb-3 pt-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <ModalityBadge modality={finding.modality} />
                    <span className="font-semibold">{finding.patientName}</span>
                    <span className="text-muted-foreground">{finding.mrn}</span>
                    <span className="text-muted-foreground">· {finding.examName}</span>
                    <Badge
                      variant="secondary"
                      className={finding.severity === "critical" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}
                    >
                      {finding.severity}
                    </Badge>
                    <Badge variant="secondary" className="ml-auto gap-1 bg-emerald-100 text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />
                      Acknowledged
                    </Badge>
                  </div>
                  <p className="font-medium">{finding.finding}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                    <span>Identified by {finding.identifiedBy}</span>
                    {finding.notifiedTo && <span>Notified: {finding.notifiedTo}</span>}
                    {finding.acknowledgedBy && <span>Acknowledged by {finding.acknowledgedBy}</span>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
