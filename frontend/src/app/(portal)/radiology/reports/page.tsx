"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModalityBadge } from "@/features/radiology/components/ModalityBadge";
import { ReportEditor } from "@/features/radiology/components/ReportEditor";
import {
  listPriorStudies,
  listRadiologyReports,
  signRadiologyReport,
  updateRadiologyReport,
} from "@/features/radiology/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { PriorStudy, RadiologyReport, RadReportStatus } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_FILTERS: { label: string; value: RadReportStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Draft", value: "draft" },
  { label: "Preliminary", value: "preliminary" },
  { label: "Final", value: "final" },
  { label: "Amended", value: "amended" },
];

const STATUS_STYLES: Record<RadReportStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  preliminary: "bg-amber-100 text-amber-700",
  final: "bg-emerald-100 text-emerald-700",
  amended: "bg-cyan-100 text-cyan-700",
  addendum: "bg-purple-100 text-purple-700",
};

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <ReportsContent />
    </Suspense>
  );
}

function ReportsContent() {
  const token = useAuthStore((state) => state.token);
  const searchParams = useSearchParams();
  const reportIdFromUrl = searchParams.get("reportId");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatus] = useState<RadReportStatus | "all">("all");
  const [reports, setReports] = useState<RadiologyReport[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [priors, setPriors] = useState<PriorStudy[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listRadiologyReports(token ?? undefined)
      .then((data) => {
        if (cancelled) return;
        setReports(data);
        if (reportIdFromUrl && data.some((r) => r.id === reportIdFromUrl)) {
          setSelectedId(reportIdFromUrl);
        } else {
          const initial = data.find((r) => r.status !== "final")?.id ?? data[0]?.id ?? "";
          setSelectedId(initial);
        }
      })
      .catch(() => {
        if (!cancelled) setReports([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token, reportIdFromUrl]);

  const filtered = useMemo(() => {
    return reports.filter((report) => {
      const q = query.toLowerCase();
      const matchQ =
        !q ||
        report.patientName.toLowerCase().includes(q) ||
        report.examName.toLowerCase().includes(q) ||
        report.accessionNumber.toLowerCase().includes(q);
      const matchStatus = statusFilter === "all" || report.status === statusFilter;
      return matchQ && matchStatus;
    });
  }, [query, reports, statusFilter]);

  const selected = reports.find((report) => report.id === selectedId) ?? null;
  const visiblePriors = selected?.studyId ? priors : [];

  useEffect(() => {
    if (!selected?.studyId) {
      return;
    }

    let cancelled = false;
    void listPriorStudies(selected.studyId, token ?? undefined)
      .then((data) => {
        if (!cancelled) setPriors(data);
      })
      .catch(() => {
        if (!cancelled) setPriors([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.studyId, token]);

  function updateLocalReport(updated: RadiologyReport) {
    setReports((prev) => prev.map((report) => (report.id === updated.id ? updated : report)));
  }

  async function handleSaveDraft(id: string, data: Partial<RadiologyReport>) {
    const updated = await updateRadiologyReport(id, data, token ?? undefined);
    updateLocalReport(updated);
  }

  async function handleSignPreliminary(id: string) {
    const updated = await updateRadiologyReport(id, { status: "preliminary" }, token ?? undefined);
    updateLocalReport(updated);
  }

  async function handleSign(id: string) {
    const updated = await signRadiologyReport(id, token ?? undefined);
    updateLocalReport(updated);
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Radiology Reports</h1>
        <p className="text-sm text-muted-foreground">{reports.length} reports available</p>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex w-72 shrink-0 flex-col gap-3 overflow-hidden">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
          </div>

          <div className="flex flex-wrap gap-1">
            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                onClick={() => setStatus(filter.value)}
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs capitalize transition-colors",
                  statusFilter === filter.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-muted",
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <p className="p-2 text-sm text-muted-foreground">No reports match.</p>
            ) : (
              filtered.map((report) => (
                <div
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedId(report.id)}
                  onKeyDown={(event) => event.key === "Enter" && setSelectedId(report.id)}
                  className={cn(
                    "cursor-pointer space-y-1 rounded-lg border p-2.5 transition-colors",
                    selectedId === report.id ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                    report.hasCritical && "border-l-4 border-l-red-500",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <ModalityBadge modality={report.modality} />
                    <span className="flex-1 truncate text-sm font-medium">{report.patientName}</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{report.examName}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[11px] text-muted-foreground">{report.accessionNumber}</span>
                    <Badge variant="secondary" className={cn("text-[11px] capitalize", STATUS_STYLES[report.status])}>
                      {report.status}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <Separator orientation="vertical" />

        <div className="flex-1 overflow-hidden">
          {selected ? (
            <ReportEditor
              report={selected}
              priorStudies={visiblePriors}
              onSaveDraft={handleSaveDraft}
              onSignPreliminary={handleSignPreliminary}
              onSign={handleSign}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Select a report to view or edit.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
