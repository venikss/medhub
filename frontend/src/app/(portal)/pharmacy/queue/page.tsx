"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Filter, Pill, Search, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listPharmacyPrescriptions } from "@/features/pharmacy/api";
import { cn } from "@/lib/utils";
import type { PharmacyPrescription } from "@/types";

const statusFilters = ["all", "ordered", "pending-verification", "verified", "dispensing", "dispensed"] as const;
const settingFilters = ["all", "inpatient", "outpatient", "discharge"] as const;
const priorityOrder: Record<string, number> = { stat: 0, urgent: 1, high: 2, normal: 3 };

export default function RxQueuePage() {
  const token = useAuthStore((state) => state.token);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [settingFilter, setSettingFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listPharmacyPrescriptions(
      {
        q: search || undefined,
        status: statusFilter,
        setting: settingFilter,
      },
      token ?? undefined,
    )
      .then((data) => {
        if (!cancelled) {
          setPrescriptions(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrescriptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search, settingFilter, statusFilter, token]);

  const rxs = useMemo(
    () => [...prescriptions].sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3)),
    [prescriptions],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Rx Queue</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          All prescriptions - ordered by priority · {rxs.length} result{rxs.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by patient, drug, Rx ID, MRN, or prescriber..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 pl-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="mr-1 text-xs text-muted-foreground">Status:</span>
            {statusFilters.map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  statusFilter === status
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {status.replace(/-/g, " ")}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="ml-2 mr-1 text-xs text-muted-foreground">Setting:</span>
            {settingFilters.map((setting) => (
              <button
                key={setting}
                onClick={() => setSettingFilter(setting)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                  settingFilter === setting
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {setting}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <th className="px-3 py-2.5 text-left font-medium">Rx ID</th>
                  <th className="px-3 py-2.5 text-left font-medium">Patient / MRN</th>
                  <th className="px-3 py-2.5 text-left font-medium">Medication</th>
                  <th className="px-3 py-2.5 text-left font-medium">Route · Freq</th>
                  <th className="px-3 py-2.5 text-center font-medium">Qty</th>
                  <th className="px-3 py-2.5 text-center font-medium">Priority</th>
                  <th className="px-3 py-2.5 text-center font-medium">Status</th>
                  <th className="px-3 py-2.5 text-left font-medium">Setting</th>
                  <th className="px-3 py-2.5 text-center font-medium">Alerts</th>
                  <th className="px-3 py-2.5 text-left font-medium">Prescriber</th>
                  <th className="px-3 py-2.5 text-left font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {rxs.map((rx) => {
                  const hasSevere = rx.warnings.some(
                    (warning) => warning.severity === "severe" || warning.severity === "contraindicated",
                  );

                  return (
                    <tr
                      key={rx.id}
                      className={cn(
                        "border-b border-border/30 transition-colors hover:bg-muted/40",
                        rx.priority === "stat" && "bg-red-500/[0.03]",
                        hasSevere && "border-l-2 border-l-red-500",
                      )}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs">{rx.id}</td>
                      <td className="px-3 py-2.5">
                        <p className="text-xs font-medium">{rx.patientName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{rx.mrn}</p>
                        {rx.allergies.length > 0 && (
                          <div className="mt-0.5 flex items-center gap-0.5">
                            <AlertTriangle className="h-2.5 w-2.5 shrink-0 text-red-500" />
                            <span className="text-[9px] font-medium text-red-600">{rx.allergies.map((a: any) => typeof a === "string" ? a : a.substance ?? a.reaction ?? JSON.stringify(a)).join(", ")}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="font-medium">{rx.medication}</span>{" "}
                        <span className="text-muted-foreground">{rx.dosage}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs capitalize text-muted-foreground">
                        {rx.route} · {rx.frequency}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Badge variant="secondary" className="text-xs">{rx.quantity}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge status={rx.priority} />
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge status={rx.status} />
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="outline" className="text-[10px] capitalize">{rx.setting}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {rx.warnings.length > 0 ? (
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              hasSevere ? "text-red-600" : "text-amber-600",
                            )}
                          >
                            Alert {rx.warnings.length}
                          </span>
                        ) : (
                          <ShieldCheck className="inline h-3.5 w-3.5 text-emerald-500" />
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{rx.prescribedBy}</td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {rx.prescribedAt
                            ? new Date(rx.prescribedAt).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "-"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rxs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground">
                <Pill className="h-8 w-8 text-muted-foreground/40" />
                No prescriptions matching the current filters.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
