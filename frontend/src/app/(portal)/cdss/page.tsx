"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, Search, SlidersHorizontal, ShieldCheck, Download, Users, Link as LinkIcon, Network } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/molecules/StatCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AlertCard } from "@/features/cdss/components/AlertCard";
import { ExplanationPanel } from "@/features/cdss/components/ExplanationPanel";
import { OverrideModal } from "@/features/cdss/components/OverrideModal";
import { getCDSSHospitalSummary, getCDSSStats, listCDSSRecommendations } from "@/features/cdss/api";
import { useCDSSStore } from "@/features/cdss/store";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { CDSSAlertSeverity, CDSSRecommendationType, CDSSAlertStatus } from "@/types";

const TYPE_OPTIONS: { value: CDSSRecommendationType | "all"; label: string }[] = [
  { value: "all",             label: "All Types" },
  { value: "drug_interaction", label: "Drug Interaction" },
  { value: "allergy",         label: "Allergy" },
  { value: "dosage_warning",  label: "Dosage Warning" },
  { value: "guideline",       label: "Guideline" },
  { value: "diagnostic",      label: "Diagnostic" },
  { value: "abnormal_result", label: "Abnormal Result" },
  { value: "preventive",      label: "Preventive Care" },
];

const STATUS_OPTIONS: { value: CDSSAlertStatus | "all"; label: string }[] = [
  { value: "all",          label: "All Statuses" },
  { value: "active",       label: "Active" },
  { value: "acknowledged", label: "Acknowledged" },
  { value: "overridden",   label: "Overridden" },
  { value: "followed",     label: "Followed" },
  { value: "dismissed",    label: "Dismissed" },
];

const SEVERITY_PILLS: { value: CDSSAlertSeverity | "all"; label: string; style: string; activeStyle: string }[] = [
  { value: "all",      label: "All",      style: "border-border text-muted-foreground",  activeStyle: "bg-primary text-primary-foreground border-primary" },
  { value: "critical", label: "Critical", style: "border-red-400/40 text-red-700",       activeStyle: "bg-red-500 text-white border-red-500" },
  { value: "warning",  label: "Warning",  style: "border-amber-400/40 text-amber-700",   activeStyle: "bg-amber-500 text-white border-amber-500" },
  { value: "info",     label: "Info",     style: "border-sky-400/40 text-sky-700",       activeStyle: "bg-sky-500 text-white border-sky-500" },
];

export default function CDSSDashboard() {
  const token = useAuthStore((state) => state.token);
  const {
    recommendations,
    setRecommendations,
    severityFilter, setSeverityFilter,
    typeFilter, setTypeFilter,
    statusFilter, setStatusFilter,
    patientSearch, setPatientSearch,
    selectedRecommendationId, selectRecommendation,
    showOverrideModal, overrideTargetId,
    openOverrideModal, closeOverrideModal,
  } = useCDSSStore();

  const [showFilters, setShowFilters] = useState(false);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getCDSSStats>> | null>(null);
  const [hospitalSummary, setHospitalSummary] = useState<Awaited<ReturnType<typeof getCDSSHospitalSummary>> | null>(null);

  function resetToAllPatients() {
    setSeverityFilter("all");
    setTypeFilter("all");
    setStatusFilter("all");
    setPatientSearch("");
    selectRecommendation(null);
  }

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getCDSSStats(token ?? undefined),
      getCDSSHospitalSummary(token ?? undefined),
      listCDSSRecommendations({}, token ?? undefined),
    ])
      .then(([nextStats, nextHospitalSummary, nextRecommendations]) => {
        if (cancelled) return;
        setStats(nextStats);
        setHospitalSummary(nextHospitalSummary);
        setRecommendations(nextRecommendations);
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null);
          setHospitalSummary(null);
          setRecommendations([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setRecommendations, token]);

  const filtered = recommendations.filter((r) => {
    const matchSeverity = severityFilter === "all" || r.severity === severityFilter;
    const matchType = typeFilter === "all" || r.type === typeFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    const matchSearch =
      patientSearch === "" ||
      r.patientName.toLowerCase().includes(patientSearch.toLowerCase()) ||
      r.patientMRN.toLowerCase().includes(patientSearch.toLowerCase()) ||
      r.title.toLowerCase().includes(patientSearch.toLowerCase());
    return matchSeverity && matchType && matchStatus && matchSearch;
  });

  const selected = recommendations.find((r) => r.id === selectedRecommendationId);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            Clinical Decision Support
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AI-powered alerts · Always verify before acting · Clinician judgment supersedes all recommendations
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/cdss/history">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <Download className="h-3.5 w-3.5" /> History
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={resetToAllPatients}>
            <Users className="h-3.5 w-3.5" /> All Patients
          </Button>
        </div>
      </div>

      {/* Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          title="Active Alerts"
          value={stats?.totalActive ?? 0}
          icon={BrainCircuit}
          iconClassName="bg-primary/10 text-primary"
          trend={{ value: 3, label: "since yesterday" }}
        />
        <StatCard
          title="Critical"
          value={stats?.critical ?? 0}
          icon={BrainCircuit}
          iconClassName="bg-red-500/10 text-red-600"
        />
        <StatCard
          title="Overridden Today"
          value={stats?.overriddenToday ?? 0}
          icon={ShieldCheck}
          iconClassName="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          title="AI Accuracy"
          value={`${stats?.accuracyRate ?? 0}%`}
          icon={ShieldCheck}
          iconClassName="bg-emerald-500/10 text-emerald-600"
          trend={{ value: 0.4, label: "vs last month" }}
        />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Hospital Knowledge Graph for CDSS
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {[
              { label: "Patients", value: hospitalSummary?.graphSummary.patients ?? 0 },
              { label: "Diagnoses", value: hospitalSummary?.graphSummary.diagnoses ?? 0 },
              { label: "Medications", value: hospitalSummary?.graphSummary.medications ?? 0 },
              { label: "Allergies", value: hospitalSummary?.graphSummary.allergies ?? 0 },
              { label: "Labs", value: hospitalSummary?.graphSummary.labs ?? 0 },
              { label: "Radiology", value: hospitalSummary?.graphSummary.radiology ?? 0 },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <p className="text-lg font-semibold">{item.value}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Top Graph Signals
            </p>
            <div className="flex flex-wrap gap-2">
              {(hospitalSummary?.topGraphSignals ?? []).slice(0, 8).map((signal) => (
                <Badge key={`${signal.group}-${signal.label}`} variant="outline" className="px-3 py-1 text-xs">
                  {signal.label}
                </Badge>
              ))}
              {(hospitalSummary?.topGraphSignals ?? []).length === 0 && (
                <p className="text-sm text-muted-foreground">No graph signals available yet.</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Severity Filter Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {SEVERITY_PILLS.map((pill) => (
          <button
            key={pill.value}
            onClick={() => setSeverityFilter(pill.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-all ${
              severityFilter === pill.value ? pill.activeStyle : pill.style
            }`}
          >
            {pill.label}
            {pill.value !== "all" && (
              <span className="ml-1.5 opacity-70">
                {recommendations.filter((r) => r.severity === pill.value && r.status === "active").length}
              </span>
            )}
          </button>
        ))}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> {showFilters ? "Hide" : "More Filters"}
        </button>
      </div>

      {/* Extra Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-3 rounded-xl bg-muted/30 border border-border/40">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-8 text-xs w-48"
              placeholder="Patient / MRN / title..."
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as CDSSRecommendationType | "all")}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as CDSSAlertStatus | "all")}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => { setSeverityFilter("all"); setTypeFilter("all"); setStatusFilter("all"); setPatientSearch(""); }}
          >
            Clear All
          </Button>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="flex gap-5 min-h-[600px]">
        {/* Alert List */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{filtered.length}</span> recommendation{filtered.length !== 1 ? "s" : ""}
            </p>
            <Badge variant="outline" className="text-xs">Sorted by severity</Badge>
          </div>
          <ScrollArea className="h-[640px] pr-1">
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <BrainCircuit className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No recommendations match the current filters</p>
                </div>
              ) : (
                filtered
                  .sort((a, b) => {
                    const order = { critical: 0, warning: 1, info: 2 };
                    const statusOrder = { active: 0, acknowledged: 1, followed: 2, overridden: 3, dismissed: 4, expired: 5 };
                    if (a.status !== b.status) return statusOrder[a.status] - statusOrder[b.status];
                    return order[a.severity] - order[b.severity];
                  })
                  .map((rec) => (
                    <AlertCard
                      key={rec.id}
                      rec={rec}
                      selected={selectedRecommendationId === rec.id}
                      onSelect={() => selectRecommendation(selectedRecommendationId === rec.id ? null : rec.id)}
                      onExplain={() => selectRecommendation(rec.id)}
                      onOverride={() => openOverrideModal(rec.id)}
                    />
                  ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Explanation Panel */}
        {selected ? (
          <div className="w-[420px] shrink-0">
            <Card className="border-border/50 shadow-sm sticky top-6">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-sm font-semibold leading-snug">{selected.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {selected.patientName} · {selected.patientMRN}
                    </p>
                  </div>
                  <div className="flex gap-1.5">
                    <Link href={`/cdss/patient/${selected.patientId}`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Patient CDSS view">
                        <LinkIcon className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => selectRecommendation(null)}
                    >
                      ✕
                    </Button>
                  </div>
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
          <div className="w-[420px] shrink-0 hidden lg:flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 text-center p-8 gap-3">
            <BrainCircuit className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium text-muted-foreground">Select an alert to view explanation</p>
            <p className="text-xs text-muted-foreground/60">Reasoning, evidence sources, clinical inputs, and suggested actions</p>
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
