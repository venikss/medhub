"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Phone, CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/molecules/StatCard";
import { ReportPreview } from "@/features/lab/components/ReportPreview";
import { listCriticalValues, listLabReports, notifyCriticalValue } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { LabCDSSPanel } from "@/features/cdss/components/modules/LabCDSSPanel";
import { useCDSSDataHydration } from "@/features/cdss/hooks/useCDSSDataHydration";
import type { LabReport } from "@/types";

type CriticalQueueEntry = {
  id: string;
  report: LabReport | null;
  patientId: string;
  patientName: string;
  orderedBy: string;
  focusedTests: string[];
  pendingResultIds: string[];
  notifiedResultIds: string[];
};

export default function CriticalResultsPage() {
  const token = useAuthStore((state) => state.token);
  const [entries, setEntries] = useState<CriticalQueueEntry[]>([]);
  const [pendingValueCount, setPendingValueCount] = useState(0);
  const [notifiedValueCount, setNotifiedValueCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listLabReports({}, token ?? undefined),
      listCriticalValues({ unacknowledged: "true" }, token ?? undefined),
    ])
      .then(([labReports, criticalValues]) => {
        if (cancelled) return;
        const reportByResultId = new Map<string, LabReport>();
        labReports.forEach((report) => {
          report.results.forEach((result) => {
            reportByResultId.set(result.id, report);
          });
        });

        const groupedEntries = new Map<string, CriticalQueueEntry>();
        criticalValues.forEach((criticalValue) => {
          const report = reportByResultId.get(criticalValue.resultId) ?? null;
          const entryId = report?.id ?? `result-${criticalValue.resultId}`;
          const existingEntry = groupedEntries.get(entryId);

          if (existingEntry) {
            if (!existingEntry.focusedTests.includes(criticalValue.testName)) {
              existingEntry.focusedTests.push(criticalValue.testName);
            }
            if (criticalValue.notifiedTo) {
              existingEntry.notifiedResultIds.push(criticalValue.resultId);
            } else {
              existingEntry.pendingResultIds.push(criticalValue.resultId);
            }
            return;
          }

          groupedEntries.set(entryId, {
            id: entryId,
            report,
            patientId: criticalValue.patientId,
            patientName: criticalValue.patientName,
            orderedBy: report?.orderedBy ?? "Ordering physician",
            focusedTests: [criticalValue.testName],
            pendingResultIds: criticalValue.notifiedTo ? [] : [criticalValue.resultId],
            notifiedResultIds: criticalValue.notifiedTo ? [criticalValue.resultId] : [],
          });
        });

        const queueEntries = Array.from(groupedEntries.values());
        setEntries(queueEntries);
        setPendingValueCount(criticalValues.filter((item) => !item.notifiedTo).length);
        setNotifiedValueCount(criticalValues.filter((item) => Boolean(item.notifiedTo)).length);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setPendingValueCount(0);
        setNotifiedValueCount(0);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const { error: cdssFeedMessage } = useCDSSDataHydration({
    token,
    refreshPatientIds: Array.from(new Set(entries.map((entry) => entry.patientId))),
    refreshBeforeLoad: entries.length > 0,
    includeOverrides: true,
    useMockOnError: false,
  });

  const handleNotify = (entry: CriticalQueueEntry) => {
    const criticalResultId = entry.pendingResultIds[0];
    if (!criticalResultId) return;

    void notifyCriticalValue(
      criticalResultId,
      {
        notifiedTo: entry.orderedBy,
        notificationMethod: "phone",
        readbackProvided: true,
      },
      token ?? undefined,
    )
      .then(() => {
        setEntries((current) =>
          current.map((item) =>
            item.id === entry.id
              ? {
                  ...item,
                  pendingResultIds: item.pendingResultIds.filter((resultId) => resultId !== criticalResultId),
                  notifiedResultIds: item.notifiedResultIds.includes(criticalResultId)
                    ? item.notifiedResultIds
                    : [...item.notifiedResultIds, criticalResultId],
                }
              : item,
          ),
        );
        setPendingValueCount((current) => Math.max(0, current - 1));
        setNotifiedValueCount((current) => current + 1);
      })
      .catch((err) => { console.error("Failed to notify critical value:", err); });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Critical Results</h1>
        <p className="text-sm text-muted-foreground mt-1">Panic-value queue - requires physician notification and documentation</p>
      </div>

      {pendingValueCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-red-500/[0.08] border-red-500/40 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 animate-pulse" />
          <span className="font-semibold text-red-700">{pendingValueCount} critical result{pendingValueCount > 1 ? "s" : ""} awaiting physician notification</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Queue Entries" value={entries.length} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Notified Results" value={notifiedValueCount} icon={CheckCircle2} iconClassName="bg-emerald-500/10 text-emerald-600" />
        <StatCard title="Pending Notification" value={pendingValueCount} icon={Phone} iconClassName="bg-amber-500/10 text-amber-600" />
      </div>

      <div className="space-y-4">
        {cdssFeedMessage && entries.length > 0 && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
            {cdssFeedMessage}
          </div>
        )}
        {entries.map((entry) => {
          const report = entry.report;
          const hasPendingNotification = entry.pendingResultIds.length > 0;
          const hasAnyNotified = entry.notifiedResultIds.length > 0;
          return (
            <div key={entry.id} className="space-y-3">
              {hasPendingNotification && (
                <Card className="border-red-500/40 shadow-sm mb-2">
                  <CardContent className="py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-red-600" />
                      <span className="font-medium text-red-700">Notify ordering physician: {entry.orderedBy}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="gap-1.5 text-xs bg-red-600 hover:bg-red-700" onClick={() => handleNotify(entry)}>
                        <Phone className="h-3 w-3" /> Mark Notified
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              {report ? (
                <ReportPreview
                  report={{
                    ...report,
                    hasCritical: true,
                    criticalNotifiedTo: hasAnyNotified ? entry.orderedBy : report.criticalNotifiedTo,
                    criticalNotifiedAt: hasAnyNotified ? new Date().toISOString() : report.criticalNotifiedAt,
                  }}
                />
              ) : (
                <Card className="border-red-500/30 shadow-sm">
                  <CardContent className="py-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                      <AlertTriangle className="h-4 w-4" />
                      Critical result awaiting full report linkage
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">{entry.patientName}</p>
                      <p className="text-muted-foreground">Critical tests: {entry.focusedTests.join(", ")}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              <LabCDSSPanel patientId={entry.patientId} focusedTests={entry.focusedTests} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
