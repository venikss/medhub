"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { StatCard } from "@/components/molecules/StatCard";
import { OrderComposer } from "@/features/doctor/components/OrderComposer";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createDoctorOrder, type DoctorAdmission, type DoctorChartPatient, type DoctorOrder, getDoctorPatientChart, listAdmissions, listDoctorOrders } from "@/features/doctor/api";
import { BedDouble, ClipboardList, Clock, CheckCircle2, AlertTriangle, Plus, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderCategory, Priority } from "@/types";

function OrdersPageInner() {
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const urlPatientId = searchParams.get("patientId") ?? undefined;
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [patients, setPatients] = useState<DoctorAdmission[]>([]);
  const patientId = urlPatientId ?? selectedPatientId;
  const [orders, setOrders] = useState<DoctorOrder[]>([]);
  const [patient, setPatient] = useState<DoctorChartPatient | null>(null);

  useEffect(() => {
    if (urlPatientId) return;
    if (!user?.id) return;
    let cancelled = false;
    void listAdmissions({ status: "admitted", doctorId: user.id }, token ?? undefined)
      .then((data) => { if (!cancelled) setPatients(data); })
      .catch(() => { if (!cancelled) setPatients([]); });
    return () => { cancelled = true; };
  }, [urlPatientId, token, user?.id]);

  useEffect(() => {
    let cancelled = false;

    void listDoctorOrders(patientId ? { patientId } : {}, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setOrders(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrders([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, token]);

  useEffect(() => {
    if (!patientId) return;

    let cancelled = false;

    void getDoctorPatientChart(patientId, token ?? undefined)
      .then((chart) => {
        if (!cancelled) {
          setPatient(chart.patient);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatient(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [patientId, token]);

  const pending = useMemo(() => orders.filter((order) => order.status === "pending").length, [orders]);
  const inProgress = useMemo(() => orders.filter((order) => order.status === "in-progress").length, [orders]);
  const completed = useMemo(() => orders.filter((order) => order.status === "completed").length, [orders]);
  const selectedPatient = patientId ? patient : null;
  const patientNameFromChart = selectedPatient ? `${selectedPatient.firstName} ${selectedPatient.lastName}` : undefined;
  const patientNameFromList = patients.find((p) => p.patientId === patientId)?.patientName;
  const patientName = patientNameFromChart ?? patientNameFromList;
  const [showComposer, setShowComposer] = useState(false);

  async function handleSubmitOrders(
    items: Array<{ category: OrderCategory; name: string; priority: Priority; notes: string }>,
  ) {
    if (!patientId) {
      throw new Error("Open orders from a patient chart or pass a patient first.");
    }

    const created = await Promise.all(
      items.map((item) => {
        const payload: {
          patientId: string;
          category: string;
          orderableName?: string;
          priority: string;
          instructions?: string;
          bodyPart?: string;
          examCode?: string;
        } = {
          patientId,
          category: item.category,
          priority: item.priority,
          instructions: item.notes || undefined,
        };

        if (item.category === "imaging") {
          payload.orderableName = item.name;
          payload.bodyPart = "general";
        } else {
          payload.orderableName = item.name;
        }

        return createDoctorOrder(payload, token ?? undefined);
      }),
    );

    setOrders((prev) => [...created, ...prev]);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Lab, imaging, and consult order entry and management</p>
        </div>
        <Button className="gap-2" onClick={() => setShowComposer(!showComposer)}>
          <Plus className="h-4 w-4" /> New Order
        </Button>
      </div>

      {!urlPatientId && patients.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Select a patient to manage their orders</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {patients.map((p) => {
              const isSelected = selectedPatientId === p.patientId;
              const initials = p.patientName
                .split(" ")
                .map((n) => n[0] ?? "")
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <button
                  key={p.patientId}
                  onClick={() => setSelectedPatientId(p.patientId)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                      : "border-border/50 bg-card hover:border-primary/30 hover:shadow-sm",
                  )}
                >
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className={cn("text-xs font-bold", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.patientName}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{p.mrn}</p>
                    {p.ward && (
                      <div className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                        <BedDouble className="h-3 w-3 text-sky-500" />
                        <span>{p.ward}{p.bed ? ` · ${p.bed}` : ""}</span>
                      </div>
                    )}
                  </div>
                  {isSelected && <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!urlPatientId && patients.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <UserRound className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm">No admitted patients assigned to you yet</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Pending" value={pending} icon={Clock} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="In Progress" value={inProgress} icon={AlertTriangle} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {showComposer && (
          <div className="lg:col-span-2">
            <OrderComposer patientId={patientId} patientName={patientName} onSubmit={handleSubmitOrders} />
          </div>
        )}

        <Card className={cn("border-border/50 shadow-sm", showComposer ? "lg:col-span-3" : "lg:col-span-5")}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Recent Orders
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left py-2 font-medium">Order</th>
                    <th className="text-left py-2 font-medium">Patient</th>
                    <th className="text-left py-2 font-medium">Type</th>
                    <th className="text-left py-2 font-medium">Priority</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-left py-2 font-medium">Ordered</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 font-medium">{order.orderableName ?? order.name ?? "Order"}</td>
                      <td className="py-2.5 text-muted-foreground">{order.patientName}</td>
                      <td className="py-2.5"><Badge variant="outline" className="text-[10px] capitalize">{order.category}</Badge></td>
                      <td className="py-2.5">
                        <Badge variant={order.priority === "stat" ? "destructive" : order.priority === "urgent" ? "default" : "secondary"} className="text-[10px]">
                          {order.priority}
                        </Badge>
                      </td>
                      <td className="py-2.5"><StatusBadge status={order.status} /></td>
                      <td className="py-2.5 text-xs text-muted-foreground">{new Date(order.orderedAt ?? order.createdAt ?? "").toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {orders.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">No orders available.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Loading...</p></div>}>
      <OrdersPageInner />
    </Suspense>
  );
}
