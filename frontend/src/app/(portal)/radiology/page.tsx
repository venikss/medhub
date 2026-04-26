"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  FileCheck,
  FilePen,
  ScanLine,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/molecules/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { type RadiologyDashboardResponse, getRadiologyDashboard, notifyCriticalFinding, acknowledgeCriticalFinding, listCriticalFindings } from "@/features/radiology/api";
import { CriticalFindingBanner } from "@/features/radiology/components/CriticalFindingBanner";
import { ModalityBadge } from "@/features/radiology/components/ModalityBadge";
import type { CriticalFinding } from "@/types";

export default function RadiologyPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState<RadiologyDashboardResponse | null>(null);
  const [criticals, setCriticals] = useState<CriticalFinding[]>([]);
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim();

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getRadiologyDashboard(token ?? undefined),
      listCriticalFindings({ unacknowledged: "true" }, token ?? undefined),
    ])
      .then(([data, pendingCriticals]) => {
        if (cancelled) {
          return;
        }

        setDashboard(data);
        setCriticals(pendingCriticals);
      })
      .catch(() => {
        if (!cancelled) {
          setDashboard(null);
          setCriticals([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const stats = dashboard?.stats;
  const statOrders = dashboard?.statOrders ?? [];
  const recentSigned = dashboard?.recentSignedReports ?? [];
  const pending = useMemo(
    () => criticals.filter((finding) => finding.status === "pending" || finding.status === "notified"),
    [criticals],
  );

  function handleNotify(id: string) {
    void notifyCriticalFinding(id, { notifiedTo: user?.id ?? "" }, token ?? undefined)
      .then((updated) => {
        setCriticals((prev) =>
          prev.map((finding) => (finding.id === id ? updated : finding)),
        );
      })
      .catch((err) => {
        console.error("Failed to notify critical finding:", err);
      });
  }

  function handleAcknowledge(id: string) {
    void acknowledgeCriticalFinding(id, token ?? undefined)
      .then((updated) => {
        setCriticals((prev) =>
          prev.map((finding) => (finding.id === id ? updated : finding)),
        );
      })
      .catch((err) => {
        console.error("Failed to acknowledge critical finding:", err);
      });
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Radiology Dashboard</h1>
          <p className="text-sm text-muted-foreground">RIS-PACS Overview</p>
        </div>
        <Badge variant="outline" className="gap-1 text-sm">
          <Activity className="h-3.5 w-3.5 text-emerald-500" />
          {displayName || "Radiology Staff"}
        </Badge>
      </div>

      {pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((finding) => (
            <CriticalFindingBanner
              key={finding.id}
              finding={finding}
              onNotify={handleNotify}
              onAcknowledge={handleAcknowledge}
            />
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard title="Pending Orders" value={stats?.pendingOrders ?? 0} icon={ClipboardList} iconClassName="bg-blue-500/10 text-blue-600" />
        <StatCard title="In-Progress" value={stats?.inProgress ?? 0} icon={Activity} iconClassName="bg-indigo-500/10 text-indigo-600" />
        <StatCard title="Awaiting Read" value={stats?.awaitingRead ?? 0} icon={ScanLine} iconClassName="bg-violet-500/10 text-violet-600" />
        <StatCard title="Pending Sign" value={stats?.pendingSign ?? 0} icon={FilePen} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="Signed Today" value={stats?.signedToday ?? 0} icon={FileCheck} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-red-500" />
                STAT &amp; Urgent Queue
              </CardTitle>
              <Link href="/radiology/worklist">
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs">
                  Full Worklist <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {statOrders.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No STAT or urgent orders.</p>
            ) : (
              <div className="divide-y">
                {statOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ModalityBadge modality={order.modality} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{order.patientName}</p>
                      <p className="truncate text-xs text-muted-foreground">{order.examName}</p>
                    </div>
                    <Badge
                      variant="secondary"
                      className={order.priority === "stat" ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"}
                    >
                      {order.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">{order.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Recently Signed Reports
              </CardTitle>
              <Link href="/radiology/reports">
                <Button variant="ghost" size="sm" className="flex items-center gap-1 text-xs">
                  All Reports <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {recentSigned.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No reports signed today.</p>
            ) : (
              <div className="divide-y">
                {recentSigned.map((report) => (
                  <div key={report.id} className="flex items-center gap-3 px-4 py-2.5">
                    <ModalityBadge modality={report.modality} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{report.patientName}</p>
                      <p className="truncate text-xs text-muted-foreground">{report.examName}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {report.signedAt
                        ? new Date(report.signedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {([
          { label: "Orders Board", href: "/radiology/orders", icon: ClipboardList, desc: "View & protocol orders" },
          { label: "Modality Worklist", href: "/radiology/worklist", icon: ScanLine, desc: "Ready to read" },
          { label: "Reports", href: "/radiology/reports", icon: FilePen, desc: "Draft & sign reports" },
          { label: "Critical Findings", href: "/radiology/critical", icon: AlertTriangle, desc: `${pending.length} pending` },
        ] as const).map(({ label, href, icon: Icon, desc }) => (
          <Link key={href} href={href}>
            <Card className="h-full cursor-pointer transition-colors hover:bg-muted/40">
              <CardContent className="flex flex-col gap-1 p-4">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
