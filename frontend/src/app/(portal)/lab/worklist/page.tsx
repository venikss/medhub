"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { listLabWorklist } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { LabPanel } from "@/types";
import { cn } from "@/lib/utils";

const statusFilters = ["all", "pending", "partial", "complete"] as const;
const priorityFilters = ["all", "stat", "urgent", "high", "normal"] as const;

export default function WorklistPage() {
  const token = useAuthStore((state) => state.token);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [orders, setOrders] = useState<LabPanel[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listLabWorklist({}, token ?? undefined)
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
  }, [token]);

  const filteredOrders = useMemo(
    () =>
      orders
        .filter((order) => statusFilter === "all" || order.status === statusFilter)
        .filter((order) => priorityFilter === "all" || order.priority === priorityFilter)
        .filter((order) => {
          if (!search.trim()) return true;
          const query = search.toLowerCase();
          return (
            order.patientName.toLowerCase().includes(query) ||
            order.name.toLowerCase().includes(query) ||
            order.id.toLowerCase().includes(query)
          );
        })
        .sort((a, b) => {
          const priorityOrder: Record<string, number> = { stat: 0, urgent: 1, high: 2, normal: 3, low: 4 };
          return (priorityOrder[a.priority ?? "normal"] ?? 3) - (priorityOrder[b.priority ?? "normal"] ?? 3);
        }),
    [orders, priorityFilter, search, statusFilter],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Lab Worklist</h1>
        <p className="text-sm text-muted-foreground mt-1">All incoming laboratory orders - sorted by priority</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search by patient, test, or order ID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground mr-1" />
          {statusFilters.map((status) => (
            <button key={status} onClick={() => setStatusFilter(status)} className={cn("px-2.5 py-1 rounded-full text-xs font-medium border transition-colors capitalize", statusFilter === status ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted")}>
              {status.replace("-", " ")}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {priorityFilters.map((priority) => (
            <button key={priority} onClick={() => setPriorityFilter(priority)} className={cn("px-2 py-1 rounded-full text-[10px] font-medium border transition-colors capitalize", priorityFilter === priority ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted")}>
              {priority}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground bg-muted/30">
                  <th className="text-left py-2.5 px-3 font-medium">Order ID</th>
                  <th className="text-left py-2.5 px-3 font-medium">Patient</th>
                  <th className="text-left py-2.5 px-3 font-medium">Test</th>
                  <th className="text-center py-2.5 px-3 font-medium">Priority</th>
                  <th className="text-center py-2.5 px-3 font-medium">Status</th>
                  <th className="text-left py-2.5 px-3 font-medium">Ordered By</th>
                  <th className="text-left py-2.5 px-3 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id} className={cn("border-b border-border/30 hover:bg-muted/40 transition-colors", order.priority === "stat" && "bg-red-500/[0.03]")}>
                    <td className="py-2.5 px-3 font-mono text-xs">{order.id}</td>
                    <td className="py-2.5 px-3 font-medium">{order.patientName}</td>
                    <td className="py-2.5 px-3">{order.name}</td>
                    <td className="py-2.5 px-3 text-center"><StatusBadge status={order.priority ?? "routine"} /></td>
                    <td className="py-2.5 px-3 text-center"><StatusBadge status={order.status} /></td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{order.orderedBy}</td>
                    <td className="py-2.5 px-3 text-muted-foreground text-xs">{new Date(order.orderedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredOrders.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No orders matching filter.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
