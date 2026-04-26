"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/molecules/StatCard";
import { ResultCard } from "@/features/doctor/components/ResultCard";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getDoctorResultsInbox, reviewDoctorResult, type DoctorChartResult } from "@/features/doctor/api";
import type { ResultItem } from "@/types";
import { Activity, AlertTriangle, CheckCircle2, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";

const filters = ["all", "critical", "high", "low", "normal", "unreviewed"] as const;

function toResultItem(result: DoctorChartResult): ResultItem {
  const rawFlag = (result.flag ?? "normal").toLowerCase();
  const flag =
    rawFlag === "critical-high" || rawFlag === "critical-low"
      ? "critical"
      : rawFlag === "high" || rawFlag === "low" || rawFlag === "critical"
      ? rawFlag
      : "normal";

  return {
    id: result.id,
    patientId: result.patientId ?? "",
    patientName: result.patientName ?? "",
    orderId: result.orderId ?? result.id,
    category: result.category ?? "lab",
    testName: result.testName ?? result.examName ?? "Result",
    value: result.value ?? result.impression ?? result.findings ?? "-",
    unit: result.unit ?? "",
    referenceRange: result.referenceRange ?? "",
    flag,
    reportedAt: result.reportedAt ?? new Date().toISOString(),
    reviewedBy: result.reviewedBy,
    notes: result.notes,
  };
}

export default function ResultsReviewPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [filter, setFilter] = useState<string>("all");
  const [results, setResults] = useState<ResultItem[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    void getDoctorResultsInbox(user.id, token ?? undefined)
      .then((data) => {
        if (cancelled) return;
        const labResults = (data.labResults ?? []).map((item) => toResultItem({ ...item, category: "lab" }));
        const imagingResults = (data.radiologyReports ?? []).map((item) => toResultItem({ ...item, category: "imaging", flag: item.flag ?? "normal" }));
        setResults([...labResults, ...imagingResults].sort((a, b) => b.reportedAt.localeCompare(a.reportedAt)));
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  const filteredResults = useMemo(() => {
    return results.filter((result) => {
      if (filter === "all") return true;
      if (filter === "unreviewed") return !result.reviewedBy;
      return result.flag === filter;
    });
  }, [filter, results]);

  const critical = results.filter((result) => result.flag === "critical").length;
  const high = results.filter((result) => result.flag === "high").length;
  const unreviewed = results.filter((result) => !result.reviewedBy).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Lab and imaging results requiring physician review</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Total Results" value={results.length} icon={Activity} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Critical" value={critical} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Flagged High" value={high} icon={AlertTriangle} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="Unreviewed" value={unreviewed} icon={Clock} iconClassName="bg-violet-500/10 text-violet-600" />
      </div>

      <div className="flex items-center gap-1.5">
        {filters.map((item) => (
          <button
            key={item}
            onClick={() => setFilter(item)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
              filter === item ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted",
            )}
          >
            {item.charAt(0).toUpperCase() + item.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredResults.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">All results reviewed - nothing to show for this filter.</p>
            </CardContent>
          </Card>
        ) : (
          filteredResults.map((result) => (
            <div key={result.id} className="flex items-start gap-3">
              <div className="flex-1">
                <ResultCard result={result} />
              </div>
              {!result.reviewedBy && result.category === "lab" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1 mt-4 shrink-0"
                  onClick={() => {
                    void reviewDoctorResult(result.id, "", token ?? undefined)
                      .then(() => {
                        setResults((current) =>
                          current.map((item) =>
                            item.id === result.id
                              ? { ...item, reviewedBy: user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : user?.email ?? "Doctor" }
                              : item,
                          ),
                        );
                      })
                      .catch(() => {
                        // Keep the current result list stable on failed review.
                      });
                  }}
                >
                  <Eye className="h-3 w-3" /> Mark Reviewed
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
