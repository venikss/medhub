"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FlaskConical,
  Package,
  Pill,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  XOctagon,
} from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { StatCard } from "@/components/molecules/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { type PharmacyDashboardResponse, getPharmacyDashboard, listPharmacyInterventions, listPharmacyPrescriptions } from "@/features/pharmacy/api";
import type { InterventionRecord, PharmacyPrescription } from "@/types";
import { DrugWarningBanner } from "@/features/pharmacy/components/DrugWarningBanner";
import { cn } from "@/lib/utils";

export default function PharmacyDashboard() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState<PharmacyDashboardResponse | null>(null);
  const [pendingVerification, setPendingVerification] = useState<PharmacyPrescription[]>([]);
  const [pendingInterventions, setPendingInterventions] = useState<InterventionRecord[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [data, verificationQueue, interventionQueue] = await Promise.all([
        getPharmacyDashboard(token ?? undefined),
        listPharmacyPrescriptions({ status: "verification" }, token ?? undefined),
        listPharmacyInterventions({ pendingOnly: true }, token ?? undefined),
      ]);
      setDashboard(data);
      const PENDING_STATUSES = new Set(["ordered", "pending-verification"]);
      setPendingVerification(verificationQueue.filter(rx => PENDING_STATUSES.has(rx.status)));
      setPendingInterventions(interventionQueue);
    } catch {
      setDashboard(null);
      setPendingVerification([]);
      setPendingInterventions([]);
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void load().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [load, refreshKey]);

  function handleRefresh() {
    setRefreshKey(k => k + 1);
    void load(true);
  }

  const stats = dashboard?.stats;

  const severeWarnings = useMemo(() => {
    const all = dashboard?.severeWarnings ?? [];
    if (pendingVerification.length === 0) return [];
    return all;
  }, [dashboard, pendingVerification]);

  const lowStockItems = useMemo(() => dashboard?.lowStockItems ?? [], [dashboard]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pharmacy Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Clinical Pharmacy{user?.firstName ? ` - Pharm. ${user.firstName} ${user.lastName ?? ""}`.trim() : ""}</p>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="border-teal-500/30 bg-teal-500/5 text-xs text-teal-700">
            Inpatient + Outpatient
          </Badge>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RotateCcw className={cn("h-3 w-3", refreshing && "animate-spin")} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
      </div>

      {severeWarnings.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3">
          <XOctagon className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">
              {severeWarnings.length} severe drug warning{severeWarnings.length > 1 ? "s" : ""} require pharmacist review
            </p>
            <p className="mt-0.5 text-xs text-red-600/80">
              {severeWarnings.map((warning) => warning.title).join(" - ")}
            </p>
          </div>
          <Link href="/pharmacy/verification">
            <Button size="sm" variant="outline" className="shrink-0 border-red-500/30 text-xs text-red-600 hover:bg-red-500/10">
              Review Now
            </Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        <StatCard title="Pending Verification" value={pendingVerification.length} icon={Clock} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="Verified / Ready" value={stats?.verified ?? 0} icon={ShieldCheck} iconClassName="bg-teal-500/10 text-teal-600" />
        <StatCard title="Dispensing" value={stats?.dispensing ?? 0} icon={Pill} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Dispensed Today" value={stats?.dispensedToday ?? 0} icon={CheckCircle2} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Active Warnings" value={stats?.activeWarnings ?? 0} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Pending Interventions" value={pendingInterventions.length} icon={Activity} iconClassName="bg-orange-500/10 text-orange-600" />
        <StatCard title="Low Stock Items" value={stats?.lowStockItems ?? 0} icon={Package} iconClassName="bg-rose-500/10 text-rose-600" />
        <StatCard title="Pending Substitutions" value={stats?.pendingSubstitutions ?? 0} icon={RefreshCw} iconClassName="bg-violet-500/10 text-violet-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Clock className="h-4 w-4 text-amber-600" /> Pending Verification
                </CardTitle>
                <Link href="/pharmacy/verification" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  Full Queue <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-3 py-2.5 text-left font-medium">Rx ID</th>
                      <th className="px-3 py-2.5 text-left font-medium">Patient</th>
                      <th className="px-3 py-2.5 text-left font-medium">Medication</th>
                      <th className="px-3 py-2.5 text-center font-medium">Priority</th>
                      <th className="px-3 py-2.5 text-center font-medium">Warnings</th>
                      <th className="px-3 py-2.5 text-left font-medium">Setting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingVerification.map((rx) => (
                      <tr
                        key={rx.id}
                        className={cn(
                          "border-b border-border/30 transition-colors hover:bg-muted/40",
                          rx.priority === "stat" && "bg-red-500/[0.03]",
                        )}
                      >
                        <td className="px-3 py-2.5 font-mono text-xs">{rx.id}</td>
                        <td className="px-3 py-2.5 text-xs font-medium">{rx.patientName}</td>
                        <td className="px-3 py-2.5 text-xs">
                          {rx.medication} <span className="text-muted-foreground">{rx.dosage}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <StatusBadge status={rx.priority} />
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {rx.warnings.length > 0 ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                rx.warnings.some((warning) => warning.severity === "severe" || warning.severity === "contraindicated")
                                  ? "border-red-500/40 text-red-600"
                                  : "border-amber-500/40 text-amber-600",
                              )}
                            >
                              {rx.warnings.length} alert{rx.warnings.length > 1 ? "s" : ""}
                            </Badge>
                          ) : (
                            <span className="text-[10px] text-emerald-600">Clear</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge variant="outline" className="text-[10px] capitalize">{rx.setting}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pendingVerification.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">All prescriptions verified.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {severeWarnings.length > 0 && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> Active Drug Warnings
                  </CardTitle>
                  <Link href="/pharmacy/verification" className="flex items-center gap-1 text-xs text-primary hover:underline">
                    Review <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {severeWarnings.map((warning) => (
                  <DrugWarningBanner key={warning.id} warning={warning} compact />
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => router.push("/pharmacy/queue")}>
                  <Pill className="h-3.5 w-3.5" /> Rx Queue
              </Button>
              <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => router.push("/pharmacy/verification")}>
                  <ShieldCheck className="h-3.5 w-3.5" /> Verify Prescriptions
              </Button>
              <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => router.push("/pharmacy/dispense")}>
                  <FlaskConical className="h-3.5 w-3.5" /> Dispense
              </Button>
              <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => router.push("/pharmacy/formulary")}>
                  <Package className="h-3.5 w-3.5" /> Formulary
              </Button>
              <Button variant="outline" className="h-9 w-full justify-start gap-2 text-xs" onClick={() => router.push("/pharmacy/interventions")}>
                  <Activity className="h-3.5 w-3.5" /> Interventions
              </Button>
            </CardContent>
          </Card>

          {pendingInterventions.length > 0 && (
            <Card className="border-orange-500/30 bg-orange-500/[0.02] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                  <Activity className="h-4 w-4" /> Pending Interventions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingInterventions.map((intervention) => (
                  <div key={intervention.id} className="rounded border border-orange-500/20 bg-orange-500/[0.04] p-2.5 text-xs">
                    <p className="font-medium">{intervention.patientName}</p>
                    <p className="capitalize text-muted-foreground">{intervention.type} - {intervention.medication}</p>
                    <p className="mt-0.5 text-[10px] text-orange-700">{intervention.reason}</p>
                  </div>
                ))}
                <Link href="/pharmacy/interventions">
                  <Button variant="outline" size="sm" className="mt-1 w-full border-orange-500/30 text-xs text-orange-700 hover:bg-orange-500/10">
                    View All Interventions
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {lowStockItems.length > 0 && (
            <Card className="border-rose-500/30 bg-rose-500/[0.02] shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-rose-700">
                  <Package className="h-4 w-4" /> Low Stock Alert
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded border border-rose-500/20 p-2 text-xs">
                    <span className="font-medium">{item.genericName}</span>
                    <Badge variant="outline" className="border-rose-500/30 text-[10px] text-rose-700">
                      {item.stockLevel} left
                    </Badge>
                  </div>
                ))}
                <Link href="/pharmacy/formulary">
                  <Button variant="outline" size="sm" className="mt-1 w-full border-rose-500/30 text-xs text-rose-700 hover:bg-rose-500/10">
                    View Formulary
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
