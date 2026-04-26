"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlaskConical, Save } from "lucide-react";
import { ResultEntryRow } from "@/features/lab/components/ResultEntryRow";
import { AbnormalHighlight } from "@/features/lab/components/AbnormalHighlight";
import { listLabWorklist, submitPanelResults } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { LabPanel } from "@/types";
import { cn } from "@/lib/utils";

const statusFilters = ["all", "pending", "partial", "complete"] as const;

export default function ResultEntryPage() {
  const token = useAuthStore((state) => state.token);
  const [filter, setFilter] = useState<string>("all");
  const [panels, setPanels] = useState<LabPanel[]>([]);
  const [entryValues, setEntryValues] = useState<Record<string, string>>({});
  const [savingPanelId, setSavingPanelId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const data = await listLabWorklist({}, token ?? undefined);
        if (!cancelled) {
          setPanels(data);
        }
      } catch {
        if (!cancelled) {
          setPanels([]);
        }
      }
    };

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filteredPanels = useMemo(() => {
    return panels
      .filter((panel) => filter === "all" || panel.status === filter)
      .filter((panel) => panel.status !== "released");
  }, [filter, panels]);

  async function handleSavePanel(panel: LabPanel) {
    if (!token || savingPanelId) return;

    const resultsPayload = (panel.results ?? []).map((result) => ({
      testCode: result.testCode,
      testName: result.testName,
      value: (entryValues[result.id] ?? result.value ?? "").toString().trim(),
      unit: result.unit,
      referenceRange: result.referenceRange,
      flag: result.flag,
      previousValue: result.previousValue,
      delta: result.delta,
      comment: result.comment,
    }));

    const resultsToSubmit = resultsPayload.filter((item) => item.value !== "");
    if (resultsToSubmit.length === 0) {
      window.alert("Enter at least one result value before saving.");
      return;
    }

    try {
      setSavingPanelId(panel.id);
      await submitPanelResults(panel.id, resultsToSubmit, token);
      const data = await listLabWorklist({}, token);
      setPanels(data);
      setEntryValues((current) => {
        const next = { ...current };
        (panel.results ?? []).forEach((result) => {
          delete next[result.id];
        });
        return next;
      });
      window.alert("Results saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save lab results.";
      window.alert(message);
    } finally {
      setSavingPanelId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Result Entry</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter and review test results with automatic abnormal flagging
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {statusFilters.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
              filter === status
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            {status}
          </button>
        ))}
      </div>

      {filteredPanels.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No panels matching filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPanels.map((panel) => {
            const panelResults = panel.results ?? [];
            const hasCritical = panelResults.some(
              (result) => result.flag === "critical-high" || result.flag === "critical-low",
            );
            const hasPending = panelResults.some((result) => result.status === "pending");

            return (
              <AbnormalHighlight key={panel.id} flag={hasCritical ? "critical-high" : "normal"}>
                <Card className={cn("border-border/50 shadow-sm", hasCritical && "border-red-500/30")}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                        <FlaskConical className="h-4 w-4 text-primary" />
                        {panel.name}
                        <span className="text-xs font-normal text-muted-foreground">({panel.code})</span>
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{panel.patientName}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {panel.status}
                        </Badge>
                        {hasPending && (
                          <Button
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => void handleSavePanel(panel)}
                            disabled={savingPanelId === panel.id}
                          >
                            <Save className="h-3 w-3" /> {savingPanelId === panel.id ? "Saving..." : "Save"}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="px-3 py-2 text-left font-medium">Code</th>
                            <th className="px-3 py-2 text-left font-medium">Test</th>
                            <th className="px-3 py-2 text-left font-medium">Value</th>
                            <th className="px-3 py-2 text-left font-medium">Unit</th>
                            <th className="px-3 py-2 text-left font-medium">Ref Range</th>
                            <th className="px-3 py-2 text-left font-medium">Flag</th>
                            <th className="px-3 py-2 text-left font-medium">Delta</th>
                            <th className="px-3 py-2 text-left font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {panelResults.map((result) => (
                            <ResultEntryRow
                              key={result.id}
                              result={result}
                              editable={hasPending}
                              value={entryValues[result.id] ?? result.value ?? ""}
                              onValueChange={(value) =>
                                setEntryValues((current) => ({ ...current, [result.id]: value }))
                              }
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </AbnormalHighlight>
            );
          })}
        </div>
      )}
    </div>
  );
}
