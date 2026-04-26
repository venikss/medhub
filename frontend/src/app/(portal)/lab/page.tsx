"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, Clock, CheckCircle2, AlertTriangle, Activity, ScanLine, ArrowRight, Timer } from "lucide-react";
import { StatCard } from "@/components/molecules/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { listCriticalValues, listLabReports, listLabWorklist, listRecollections } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { LabPanel, RecollectionRequest } from "@/types";

export default function LabDashboard() {
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [worklist, setWorklist] = useState<LabPanel[]>([]);
  const [criticalCount, setCriticalCount] = useState(0);
  const [recollections, setRecollections] = useState<RecollectionRequest[]>([]);
  const [completedToday, setCompletedToday] = useState(0);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listLabWorklist({}, token ?? undefined),
      listCriticalValues({ unacknowledged: "true" }, token ?? undefined),
      listRecollections(token ?? undefined),
      listLabReports({}, token ?? undefined),
    ])
      .then(([panels, criticalValues, recollectionItems, reports]) => {
        if (cancelled) return;
        setWorklist(panels);
        setCriticalCount(criticalValues.length);
        setRecollections(recollectionItems);
        const today = new Date().toISOString().slice(0, 10);
        setCompletedToday(reports.filter((report) => report.releasedAt?.slice(0, 10) === today).length);
      })
      .catch(() => {
        if (cancelled) return;
        setWorklist([]);
        setCriticalCount(0);
        setRecollections([]);
        setCompletedToday(0);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const activePanels = worklist.filter((panel) => panel.status !== "complete" && panel.status !== "verified" && panel.status !== "released");
  const statOrders = worklist.filter((panel) => panel.priority === "stat");
  const urgentOrders = worklist.filter((panel) => panel.priority === "stat" || panel.priority === "urgent");
  const avgTat = useMemo(() => {
    const values = worklist.map((panel) => panel.turnaroundMinutes).filter((value): value is number => typeof value === "number");
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }, [worklist]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Laboratory Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Clinical Laboratory Information System</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 font-medium">
            <Timer className="h-3.5 w-3.5" /> Avg TAT: {avgTat} min
          </div>
        </div>
      </div>

      {criticalCount > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg border bg-red-500/[0.06] border-red-500/30 text-sm">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold text-red-700">{criticalCount} critical result{criticalCount > 1 ? "s" : ""} require notification</span>
          </div>
          <Link href="/lab/critical">
            <Button size="sm" variant="outline" className="text-xs text-red-600 border-red-500/30 hover:bg-red-500/10">View Critical Queue</Button>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Pending Orders" value={activePanels.length} icon={Clock} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="In Progress" value={worklist.filter((panel) => panel.status === "partial").length} icon={FlaskConical} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Completed Today" value={completedToday} icon={CheckCircle2} iconClassName="bg-emerald-500/10 text-emerald-600" />
        <StatCard title="STAT Orders" value={statOrders.length} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Recollections" value={recollections.filter((item) => !item.resolved).length} icon={Activity} iconClassName="bg-orange-500/10 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" /> STAT &amp; Urgent Orders
                </CardTitle>
                <Link href="/lab/worklist" className="text-xs text-primary hover:underline flex items-center gap-1">Full Worklist <ArrowRight className="h-3 w-3" /></Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="text-left py-2 px-3 font-medium">Order</th>
                      <th className="text-left py-2 px-3 font-medium">Patient</th>
                      <th className="text-left py-2 px-3 font-medium">Test</th>
                      <th className="text-center py-2 px-3 font-medium">Priority</th>
                      <th className="text-center py-2 px-3 font-medium">Status</th>
                      <th className="text-left py-2 px-3 font-medium">Ordered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                        <td className="py-2 px-3 font-mono text-xs">{order.id}</td>
                        <td className="py-2 px-3 font-medium text-xs">{order.patientName}</td>
                        <td className="py-2 px-3 text-xs">{order.name}</td>
                        <td className="py-2 px-3 text-center"><StatusBadge status={order.priority ?? "routine"} /></td>
                        <td className="py-2 px-3 text-center"><StatusBadge status={order.status} /></td>
                        <td className="py-2 px-3 text-xs text-muted-foreground">{new Date(order.orderedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start gap-2 text-xs h-9" onClick={() => router.push("/lab/accessioning")}><ScanLine className="h-3.5 w-3.5" /> Accession Specimen</Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-xs h-9" onClick={() => router.push("/lab/results")}><FlaskConical className="h-3.5 w-3.5" /> Enter Results</Button>
              <Button variant="outline" className="w-full justify-start gap-2 text-xs h-9" onClick={() => router.push("/lab/verification")}><CheckCircle2 className="h-3.5 w-3.5" /> Verify Results</Button>
            </CardContent>
          </Card>

          {recollections.filter((item) => !item.resolved).length > 0 && (
            <Card className="border-orange-500/30 shadow-sm bg-orange-500/[0.03]">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-orange-700">
                  <Activity className="h-4 w-4" /> Recollection Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {recollections.filter((item) => !item.resolved).map((request) => (
                  <div key={request.id} className="p-2 rounded border border-orange-500/20 bg-orange-500/[0.04] text-xs">
                    <p className="font-medium">{request.patientName}</p>
                    <p className="text-muted-foreground capitalize">{request.reason} - {request.notes}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
