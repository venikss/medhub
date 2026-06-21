"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/molecules/StatCard";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import {
  getDoctorResultsInbox,
  reviewDoctorResult,
  type LabReportFromAPI,
  type RadiologyReportFromAPI,
  type LabTestResultItem,
} from "@/features/doctor/api";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Eye,
  FlaskConical,
  Scan,
} from "lucide-react";
import { cn } from "@/lib/utils";

const FLAG_CONFIG = {
  "critical-high": { label: "Critical High", color: "text-red-600", badgeCls: "border-red-400 text-red-600" },
  "critical-low":  { label: "Critical Low",  color: "text-red-600", badgeCls: "border-red-400 text-red-600" },
  critical:        { label: "Critical",       color: "text-red-600", badgeCls: "border-red-400 text-red-600" },
  high:            { label: "High",           color: "text-amber-600", badgeCls: "border-amber-400 text-amber-600" },
  low:             { label: "Low",            color: "text-sky-600",  badgeCls: "border-sky-400 text-sky-600" },
  normal:          { label: "Normal",         color: "text-emerald-600", badgeCls: "border-emerald-400 text-emerald-600" },
} as const;

function getFlagCfg(flag?: string) {
  if (!flag) return FLAG_CONFIG.normal;
  return FLAG_CONFIG[flag.toLowerCase() as keyof typeof FLAG_CONFIG] ?? FLAG_CONFIG.normal;
}

function isCritical(flag?: string) {
  return !!flag?.toLowerCase().includes("critical");
}

function normFlag(f?: string): "critical" | "high" | "low" | "normal" {
  if (!f) return "normal";
  const l = f.toLowerCase();
  if (l.includes("critical")) return "critical";
  if (l === "high") return "high";
  if (l === "low") return "low";
  return "normal";
}

interface LabReportCardProps {
  report: LabReportFromAPI;
  reviewedIds: Set<string>;
  reviewing: string | null;
  onReview: (id: string) => void;
}

function LabReportCard({ report, reviewedIds, reviewing, onReview }: LabReportCardProps) {
  const [open, setOpen] = useState(true);
  const results: LabTestResultItem[] = report.results ?? [];
  const hasUnreviewed = results.some((r) => !reviewedIds.has(r.id));
  const date = report.releasedAt ?? report.authorizedAt ?? report.orderedAt;

  return (
    <Card className={cn("overflow-hidden", report.hasCritical ? "border-red-500/40" : "border-border/50")}>
      {/* Panel header — click to expand/collapse */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none",
          report.hasCritical ? "bg-red-500/5" : "bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FlaskConical
            className={cn("h-4 w-4 shrink-0", report.hasCritical ? "text-red-600" : "text-sky-600")}
          />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{report.panelName ?? "Lab Panel"}</span>
              {report.hasCritical && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">CRITICAL</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">{report.patientName ?? "Unknown patient"}</span>
              {report.mrn && <span className="ml-1 opacity-60">· MRN {report.mrn}</span>}
              {date && <span className="ml-2">{new Date(date).toLocaleString()}</span>}
              {report.releasedByName && <span className="ml-2 opacity-70">· {report.releasedByName}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasUnreviewed && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-amber-600">
              <Clock className="h-3 w-3" /> Pending review
            </span>
          )}
          {open ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>

      {/* Individual test results */}
      {open && (
        <CardContent className="p-0">
          {results.length === 0 ? (
            <p className="text-xs text-muted-foreground px-4 py-3">No results attached to this panel.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {results.map((result) => {
                const cfg = getFlagCfg(result.flag);
                const reviewed = reviewedIds.has(result.id);
                const isReviewing = reviewing === result.id;
                const critical = isCritical(result.flag);

                return (
                  <div
                    key={result.id}
                    className={cn(
                      "flex items-center gap-4 px-4 py-2.5",
                      critical && "bg-red-500/5",
                    )}
                  >
                    {/* Test name */}
                    <p className="text-sm font-medium flex-1 min-w-0 truncate">{result.testName}</p>

                    {/* Value + unit */}
                    <div className="text-right shrink-0 w-24">
                      <span className={cn("text-sm font-bold tabular-nums", cfg.color)}>
                        {result.value ?? "—"}
                      </span>
                      {result.unit && (
                        <span className="text-xs text-muted-foreground ml-1">{result.unit}</span>
                      )}
                    </div>

                    {/* Reference range */}
                    <p className="text-xs text-muted-foreground shrink-0 hidden md:block w-28 text-right">
                      {result.referenceRange ? `Ref: ${result.referenceRange}` : ""}
                    </p>

                    {/* Flag badge */}
                    <div className="shrink-0 w-20 flex justify-center">
                      {critical ? (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                          {cfg.label}
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] px-1.5 py-0 h-4", cfg.badgeCls)}
                        >
                          {cfg.label}
                        </Badge>
                      )}
                    </div>

                    {/* Review action */}
                    <div className="shrink-0 w-28 flex justify-end">
                      {reviewed ? (
                        <span className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Reviewed
                        </span>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground"
                          disabled={isReviewing}
                          onClick={() => onReview(result.id)}
                        >
                          {isReviewing ? (
                            <>
                              <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin inline-block" />
                              Saving…
                            </>
                          ) : (
                            <>
                              <Eye className="h-3 w-3" /> Mark Reviewed
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {report.notes && (
            <p className="text-xs text-muted-foreground/70 italic px-4 py-2 border-t border-border/40">
              Note: {report.notes}
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function ImagingReportCard({ report }: { report: RadiologyReportFromAPI }) {
  const [open, setOpen] = useState(false);
  const date = report.signedAt ?? report.examDate ?? report.createdAt;

  return (
    <Card className={cn("overflow-hidden", report.hasCritical ? "border-red-500/40" : "border-border/50")}>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && setOpen((v) => !v)}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3 cursor-pointer select-none",
          report.hasCritical ? "bg-red-500/5" : "bg-muted/30",
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Scan className={cn("h-4 w-4 shrink-0", report.hasCritical ? "text-red-600" : "text-violet-600")} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{report.examName ?? "Imaging Study"}</span>
              {report.modality && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">{report.modality}</Badge>
              )}
              {report.hasCritical && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">CRITICAL</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              <span className="font-medium">{report.patientName ?? "Unknown patient"}</span>
              {report.mrn && <span className="ml-1 opacity-60">· MRN {report.mrn}</span>}
              {date && <span className="ml-2">{new Date(date).toLocaleString()}</span>}
              {report.radiologist && <span className="ml-2 opacity-70">· {report.radiologist}</span>}
            </p>
          </div>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {open && (
        <CardContent className="px-4 py-4 space-y-3">
          {report.indication && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Indication
              </p>
              <p className="text-sm">{report.indication}</p>
            </div>
          )}
          {report.technique && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Technique
              </p>
              <p className="text-sm">{report.technique}</p>
            </div>
          )}
          {report.findings && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Findings
              </p>
              <p className="text-sm leading-relaxed">{report.findings}</p>
            </div>
          )}
          {report.impression && (
            <div className="rounded-md bg-muted/40 px-3 py-2.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Impression
              </p>
              <p className="text-sm font-medium leading-relaxed">{report.impression}</p>
            </div>
          )}
          {report.recommendations && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Recommendations
              </p>
              <p className="text-sm leading-relaxed">{report.recommendations}</p>
            </div>
          )}
          {report.addendum && (
            <div className="border-t pt-3">
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1">Addendum</p>
              <p className="text-sm">{report.addendum}</p>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

const LAB_FILTERS = ["all", "critical", "high", "low", "normal", "unreviewed"] as const;

function LabFilterBar({ filter, onChange }: { filter: string; onChange: (f: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {LAB_FILTERS.map((item) => (
        <button
          key={item}
          onClick={() => onChange(item)}
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors",
            filter === item
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted",
          )}
        >
          {item.charAt(0).toUpperCase() + item.slice(1)}
        </button>
      ))}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-9 w-64 rounded-lg" />
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function ResultsReviewPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [labReports, setLabReports] = useState<LabReportFromAPI[]>([]);
  const [imagingReports, setImagingReports] = useState<RadiologyReportFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void getDoctorResultsInbox(user.id, token ?? undefined)
      .then((data) => {
        if (cancelled) return;
        const labs = data.labResults ?? [];
        const imgs = data.radiologyReports ?? [];
        setLabReports(labs);
        setImagingReports(imgs);

        const pre = new Set<string>();
        labs.forEach((r) =>
          (r.results ?? []).forEach((t) => {
            if (t.comment?.includes("[reviewed by")) pre.add(t.id);
          }),
        );
        setReviewedIds(pre);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load results. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.id]);

  const handleReview = (resultId: string) => {
    setReviewing(resultId);
    void reviewDoctorResult(resultId, "", token ?? undefined)
      .then(() => setReviewedIds((prev) => new Set([...prev, resultId])))
      .catch(() => {
        /* leave as unreviewed on failure */
      })
      .finally(() => setReviewing(null));
  };

  const totalTests = labReports.reduce((n, r) => n + (r.results?.length ?? 0), 0);
  const criticalPanels = labReports.filter((r) => r.hasCritical).length;
  const unreviewedTests = labReports.reduce(
    (n, r) => n + (r.results ?? []).filter((t) => !reviewedIds.has(t.id)).length,
    0,
  );

  const filteredLab = useMemo(() => {
    if (filter === "all") return labReports;
    if (filter === "unreviewed")
      return labReports.filter((r) => r.results?.some((t) => !reviewedIds.has(t.id)));
    if (filter === "critical")
      return labReports.filter(
        (r) => r.hasCritical || r.results?.some((t) => isCritical(t.flag)),
      );
    return labReports.filter((r) => r.results?.some((t) => normFlag(t.flag) === filter));
  }, [labReports, filter, reviewedIds]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Results Review</h1>
          <p className="text-sm text-muted-foreground mt-1">Lab and imaging results requiring physician review</p>
        </div>
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Results Review</h1>
        <p className="text-sm text-muted-foreground mt-1">Lab and imaging results requiring physician review</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          title="Lab Test Results"
          value={totalTests}
          icon={FlaskConical}
          iconClassName="bg-sky-500/10 text-sky-600"
        />
        <StatCard
          title="Critical Panels"
          value={criticalPanels}
          icon={AlertTriangle}
          iconClassName="bg-red-500/10 text-red-600"
        />
        <StatCard
          title="Unreviewed Tests"
          value={unreviewedTests}
          icon={Clock}
          iconClassName="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          title="Imaging Reports"
          value={imagingReports.length}
          icon={Scan}
          iconClassName="bg-violet-500/10 text-violet-600"
        />
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 py-3 px-4">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-700 flex-1">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs defaultValue="lab">
        <TabsList>
          <TabsTrigger value="lab" className="gap-1.5">
            <FlaskConical className="h-3.5 w-3.5" />
            Lab Results
            {criticalPanels > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {criticalPanels}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="imaging" className="gap-1.5">
            <Scan className="h-3.5 w-3.5" />
            Imaging
            {imagingReports.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                {imagingReports.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Lab Results tab */}
        <TabsContent value="lab" className="mt-4 space-y-4">
          <LabFilterBar filter={filter} onChange={setFilter} />

          {filteredLab.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {filter === "all"
                    ? "No lab results in your inbox."
                    : "No results match this filter."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredLab.map((report) => (
                <LabReportCard
                  key={report.id}
                  report={report}
                  reviewedIds={reviewedIds}
                  reviewing={reviewing}
                  onReview={handleReview}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Imaging tab */}
        <TabsContent value="imaging" className="mt-4 space-y-3">
          {imagingReports.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="py-12 text-center">
                <Scan className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No imaging reports available.</p>
              </CardContent>
            </Card>
          ) : (
            imagingReports.map((report) => (
              <ImagingReportCard key={report.id} report={report} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

