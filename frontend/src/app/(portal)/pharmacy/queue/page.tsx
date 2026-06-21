"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Clock, Filter, Pill, Search, ShieldCheck, User } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listPharmacyPrescriptions } from "@/features/pharmacy/api";
import { cn } from "@/lib/utils";
import type { PharmacyPrescription } from "@/types";

const statusFilters = ["all", "ordered", "pending-verification", "verified", "dispensing", "dispensed"] as const;
const settingFilters = ["all", "inpatient", "outpatient", "discharge"] as const;
const priorityOrder: Record<string, number> = { stat: 0, urgent: 1, high: 2, normal: 3, routine: 4 };

/** Group an array of prescriptions into encounter bundles. */
function groupByEncounter(rxs: PharmacyPrescription[]) {
  const grouped = new Map<string, PharmacyPrescription[]>();
  for (const rx of rxs) {
    const key = rx.encounterId ?? `no-encounter-${rx.patientId}`;
    const existing = grouped.get(key) ?? [];
    existing.push(rx);
    grouped.set(key, existing);
  }
  return [...grouped.entries()]
    .map(([key, items]) => ({
      encounterId: key.startsWith("no-encounter-") ? null : key,
      items: [...items].sort((a, b) => (priorityOrder[a.priority] ?? 4) - (priorityOrder[b.priority] ?? 4)),
    }))
    .sort((a, b) => {
      const ap = priorityOrder[a.items[0]?.priority] ?? 4;
      const bp = priorityOrder[b.items[0]?.priority] ?? 4;
      return ap - bp;
    });
}

export default function RxQueuePage() {
  const token = useAuthStore((state) => state.token);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [settingFilter, setSettingFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void listPharmacyPrescriptions(
      { q: search || undefined, status: statusFilter, setting: settingFilter },
      token ?? undefined,
    )
      .then((data) => { if (!cancelled) setPrescriptions(data); })
      .catch(() => { if (!cancelled) setPrescriptions([]); });
    return () => { cancelled = true; };
  }, [search, settingFilter, statusFilter, token]);

  const groups = useMemo(() => groupByEncounter(prescriptions), [prescriptions]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rx Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Prescriptions grouped by encounter · {groups.length} encounter{groups.length !== 1 ? "s" : ""} · {prescriptions.length} item{prescriptions.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient, drug, Rx ID, MRN, or prescriber..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="mr-1 text-xs text-muted-foreground">Status:</span>
            {statusFilters.map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  statusFilter === s ? "border-primary bg-primary text-primary-foreground" : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted")}>
                {s.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="ml-2 mr-1 text-xs text-muted-foreground">Setting:</span>
            {settingFilters.map((s) => (
              <button key={s} onClick={() => setSettingFilter(s)}
                className={cn("rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  settingFilter === s ? "border-primary bg-primary text-primary-foreground" : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted")}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Encounter bundles */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
          <Pill className="h-8 w-8 text-muted-foreground/40" />
          No prescriptions matching the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ encounterId, items }) => {
            const groupKey = encounterId ?? `no-encounter-${items[0]?.patientId}`;
            const isCollapsed = collapsed.has(groupKey);
            const patient = items[0];
            const hasSevereAny = items.some((rx) => rx.warnings.some((w) => w.severity === "severe" || w.severity === "contraindicated"));
            const topPriority = items[0]?.priority;
            const allSameStatus = items.every((rx) => rx.status === items[0]?.status);
            const totalWarnings = items.reduce((n, rx) => n + rx.warnings.length, 0);

            return (
              <Card key={groupKey}
                className={cn("border overflow-hidden",
                  hasSevereAny && "border-l-4 border-l-red-500",
                  topPriority === "stat" && "bg-red-500/[0.02]")}>

                {/* Encounter header — click to collapse */}
                <CardHeader className="py-2.5 px-4 cursor-pointer select-none"
                  onClick={() => toggleGroup(groupKey)}>
                  <div className="flex items-center gap-3 flex-wrap">
                    {isCollapsed
                      ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}

                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-semibold text-sm truncate">{patient?.patientName}</span>
                      <span className="font-mono text-xs text-muted-foreground">{patient?.mrn}</span>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2 flex-wrap">
                      <Badge variant="outline" className="text-[10px]">
                        {items.length} drug{items.length !== 1 ? "s" : ""}
                      </Badge>
                      {encounterId && (
                        <Badge variant="secondary" className="font-mono text-[9px]">
                          Enc: {encounterId.slice(0, 8)}…
                        </Badge>
                      )}
                      <StatusBadge status={topPriority} />
                      {allSameStatus && <StatusBadge status={items[0]?.status} />}
                      <Badge variant="outline" className="text-[10px] capitalize">{patient?.setting}</Badge>
                    </div>

                    <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                      {totalWarnings > 0 && (
                        <span className={cn("font-semibold text-[11px]", hasSevereAny ? "text-red-600" : "text-amber-600")}>
                          <AlertTriangle className="inline h-3 w-3 mr-0.5" />{totalWarnings} alert{totalWarnings !== 1 ? "s" : ""}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {patient?.prescribedAt ? new Date(patient.prescribedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-"}
                      </span>
                      <span>{patient?.prescribedBy}</span>
                    </div>
                  </div>
                </CardHeader>

                {/* Drug rows */}
                {!isCollapsed && (
                  <CardContent className="p-0 border-t">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/20 text-[11px] text-muted-foreground border-b">
                          <th className="px-4 py-2 text-left font-medium">Medication</th>
                          <th className="px-3 py-2 text-left font-medium">Dosage</th>
                          <th className="px-3 py-2 text-left font-medium">Route · Freq</th>
                          <th className="px-3 py-2 text-center font-medium">Qty</th>
                          <th className="px-3 py-2 text-center font-medium">Refills</th>
                          <th className="px-3 py-2 text-center font-medium">Priority</th>
                          <th className="px-3 py-2 text-center font-medium">Status</th>
                          <th className="px-3 py-2 text-center font-medium">Alerts</th>
                          <th className="px-3 py-2 text-left font-medium">SIG</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((rx) => {
                          const hasSevere = rx.warnings.some((w) => w.severity === "severe" || w.severity === "contraindicated");
                          return (
                            <tr key={rx.id}
                              className={cn("border-b border-border/30 hover:bg-muted/30 transition-colors",
                                hasSevere && "bg-red-50/50")}>
                              <td className="px-4 py-2.5">
                                <p className="font-medium text-sm">{rx.medication}</p>
                                {rx.genericName && rx.genericName !== rx.medication && (
                                  <p className="text-[11px] text-muted-foreground">{rx.genericName}</p>
                                )}
                                {rx.allergies.length > 0 && (
                                  <div className="flex items-center gap-0.5 mt-0.5">
                                    <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />
                                    <span className="text-[9px] font-medium text-red-600">{rx.allergies.slice(0, 2).join(", ")}</span>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs">{rx.dosage}</td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground capitalize">{rx.route} · {rx.frequency}</td>
                              <td className="px-3 py-2.5 text-center">
                                <Badge variant="secondary" className="text-xs">{rx.quantity}</Badge>
                              </td>
                              <td className="px-3 py-2.5 text-center text-xs text-muted-foreground">{rx.refillsRemaining}/{rx.refillsAllowed}</td>
                              <td className="px-3 py-2.5 text-center"><StatusBadge status={rx.priority} /></td>
                              <td className="px-3 py-2.5 text-center"><StatusBadge status={rx.status} /></td>
                              <td className="px-3 py-2.5 text-center">
                                {rx.warnings.length > 0 ? (
                                  <span className={cn("text-[10px] font-semibold", hasSevere ? "text-red-600" : "text-amber-600")}>
                                    {rx.warnings.length}
                                  </span>
                                ) : (
                                  <ShieldCheck className="inline h-3.5 w-3.5 text-emerald-500" />
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[200px] truncate" title={rx.notes ?? ""}>
                                {rx.notes ?? "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
