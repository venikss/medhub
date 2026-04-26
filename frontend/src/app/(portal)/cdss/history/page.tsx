"use client";

import { useEffect, useState } from "react";
import { History, Search, Download, Calendar } from "lucide-react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listCDSSOverrides } from "@/features/cdss/api";
import { useCDSSStore } from "@/features/cdss/store";
import type { CDSSOverrideAction } from "@/types";

const ACTION_COLORS: Record<CDSSOverrideAction, string> = {
  override:    "bg-amber-500/10 text-amber-700 border-amber-400/30",
  acknowledge: "bg-sky-500/10 text-sky-700 border-sky-400/30",
  follow:      "bg-emerald-500/10 text-emerald-700 border-emerald-400/30",
  dismiss:     "bg-muted/40 text-muted-foreground border-border/40",
};

const CATEGORY_LABELS: Record<string, string> = {
  clinical_judgment:        "Clinical Judgment",
  patient_preference:       "Patient Preference",
  contraindication_present: "Contraindication Present",
  already_ordered:          "Already Ordered",
  not_applicable:           "Not Applicable",
  other:                    "Other",
};

export default function CDSSHistoryPage() {
  const token = useAuthStore((state) => state.token);
  const {
    overrides,
    setOverrides,
    historyActionFilter,  setHistoryActionFilter,
    historyDateFrom,      setHistoryDateFrom,
    historyDateTo,        setHistoryDateTo,
    historyClinicianSearch, setHistoryClinicianSearch,
  } = useCDSSStore();

  const [patientSearch, setPatientSearch] = useState("");

  useEffect(() => {
    let cancelled = false;

    void listCDSSOverrides(token ?? undefined)
      .then((items) => {
        if (!cancelled) {
          setOverrides(items);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOverrides([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [setOverrides, token]);

  const filtered = overrides.filter((ov) => {
    const matchesAction   = historyActionFilter === "all" || ov.action === historyActionFilter;
    const matchesFrom     = !historyDateFrom || ov.timestamp >= historyDateFrom;
    const matchesTo       = !historyDateTo   || ov.timestamp <= historyDateTo + "T23:59:59";
    const matchesClinician = !historyClinicianSearch ||
      ov.clinicianName.toLowerCase().includes(historyClinicianSearch.toLowerCase());
    const matchesPatient  = !patientSearch ||
      ov.patientName.toLowerCase().includes(patientSearch.toLowerCase());
    return matchesAction && matchesFrom && matchesTo && matchesClinician && matchesPatient;
  }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const counts = {
    override:    overrides.filter((o) => o.action === "override").length,
    acknowledge: overrides.filter((o) => o.action === "acknowledge").length,
    follow:      overrides.filter((o) => o.action === "follow").length,
    dismiss:     overrides.filter((o) => o.action === "dismiss").length,
  };

  function handleExportCsv() {
    if (filtered.length === 0) {
      window.alert("There are no history rows to export yet.");
      return;
    }

    const rows = [
      ["recommendation", "patient", "clinician", "role", "timestamp", "action", "reasonCategory", "reason", "notes"],
      ...filtered.map((item) => [
        item.recommendationTitle,
        item.patientName,
        item.clinicianName,
        item.clinicianRole,
        item.timestamp,
        item.action,
        item.reasonCategory,
        item.reason,
        item.notes ?? "",
      ]),
    ];

    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cdss-history-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Link href="/cdss">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-8">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </Link>
        <Separator orientation="vertical" className="h-5" />
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Recommendation History
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Clinician responses to AI recommendations — full audit trail
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleExportCsv}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </div>

      {/* Action Summary Chips */}
      <div className="grid grid-cols-4 gap-3">
        {(["override", "acknowledge", "follow", "dismiss"] as CDSSOverrideAction[]).map((action) => (
          <div
            key={action}
            className={`rounded-xl border p-3 text-center cursor-pointer transition-all ${ACTION_COLORS[action]} ${historyActionFilter === action ? "ring-2 ring-offset-1 ring-primary" : ""}`}
            onClick={() => setHistoryActionFilter(historyActionFilter === action ? "all" : action)}
          >
            <p className="text-2xl font-bold">{counts[action]}</p>
            <p className="text-xs font-medium capitalize mt-0.5">
              {action === "follow" ? "Followed" : `${action}d`}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-border/50 bg-muted/10 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-xs"
              placeholder="Clinician name…"
              value={historyClinicianSearch}
              onChange={(e) => setHistoryClinicianSearch(e.target.value)}
            />
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              className="pl-8 h-9 text-xs"
              placeholder="Patient name…"
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <Input
              type="date"
              className="h-9 text-xs"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <Input
              type="date"
              className="h-9 text-xs"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3">
          <Select value={historyActionFilter} onValueChange={(v) => setHistoryActionFilter(v as CDSSOverrideAction | "all")}>
            <SelectTrigger className="w-36 h-9 text-xs">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="override">Override</SelectItem>
              <SelectItem value="acknowledge">Acknowledge</SelectItem>
              <SelectItem value="follow">Follow</SelectItem>
              <SelectItem value="dismiss">Dismiss</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-9"
            onClick={() => {
              setHistoryActionFilter("all");
              setHistoryClinicianSearch("");
              setPatientSearch("");
            }}
          >
            Clear all
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} record{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1.8fr_1.2fr_1fr_1fr_0.9fr_1.6fr] gap-0 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30 border-b border-border/50">
          <div className="px-4 py-2.5">Recommendation</div>
          <div className="px-4 py-2.5">Patient</div>
          <div className="px-4 py-2.5">Clinician</div>
          <div className="px-4 py-2.5">Timestamp</div>
          <div className="px-4 py-2.5">Action</div>
          <div className="px-4 py-2.5">Reason</div>
        </div>

        {/* Rows */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <History className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No records match your filters</p>
          </div>
        ) : (
          filtered.map((ov, idx) => (
            <div
              key={ov.id}
              className={`grid grid-cols-[1.8fr_1.2fr_1fr_1fr_0.9fr_1.6fr] gap-0 border-b border-border/30 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? "bg-transparent" : "bg-muted/5"}`}
            >
              <div className="px-4 py-3">
                <p className="text-xs font-medium leading-snug line-clamp-2">{ov.recommendationTitle}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs">{ov.patientName}</p>
                <p className="text-[10px] text-muted-foreground">{ov.patientId}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs">{ov.clinicianName}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{ov.clinicianRole}</p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs">{ov.timestamp.replace("T", " ").slice(0, 16)}</p>
              </div>
              <div className="px-4 py-3 flex items-start">
                <Badge
                  variant="outline"
                  className={`text-[10px] border capitalize ${ACTION_COLORS[ov.action]}`}
                >
                  {ov.action}
                </Badge>
              </div>
              <div className="px-4 py-3">
                <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                  {CATEGORY_LABELS[ov.reasonCategory] ?? ov.reasonCategory}
                </p>
                <p className="text-xs line-clamp-2">{ov.reason}</p>
                {ov.notes && (
                  <p className="text-[10px] text-muted-foreground/60 italic mt-1 line-clamp-1">{ov.notes}</p>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
