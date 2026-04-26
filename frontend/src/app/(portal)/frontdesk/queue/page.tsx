"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Users, Clock, Timer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/molecules/StatCard";
import { QueueTicket } from "@/features/frontdesk/components/QueueTicket";
import { callQueueTicket, listQueue, updateQueueStatus } from "@/features/frontdesk/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { QueueEntry } from "@/types";

const serviceFilters: Array<{ label: string; value: string }> = [
  { label: "All Services", value: "all" },
  { label: "Registration", value: "registration" },
  { label: "Insurance", value: "insurance" },
  { label: "Consultation", value: "consultation" },
  { label: "Lab", value: "lab" },
  { label: "Radiology", value: "radiology" },
  { label: "Pharmacy", value: "pharmacy" },
  { label: "Billing", value: "billing" },
];

const statusFilters: Array<{ label: string; value: string }> = [
  { label: "Active", value: "active" },
  { label: "All", value: "all" },
  { label: "Completed", value: "completed" },
];

export default function QueuePage() {
  const token = useAuthStore((state) => state.token);
  const [serviceFilter, setServiceFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("active");
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listQueue({}, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setQueue(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQueue([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(
    () =>
      queue.filter((entry) => {
        const serviceMatch = serviceFilter === "all" || entry.service === serviceFilter;
        const statusMatch =
          statusFilter === "all"
            ? true
            : statusFilter === "active"
              ? ["waiting", "serving", "called"].includes(entry.status)
              : entry.status === statusFilter;
        return serviceMatch && statusMatch;
      }),
    [queue, serviceFilter, statusFilter],
  );

  const waiting = queue.filter((entry) => entry.status === "waiting").length;
  const serving = queue.filter((entry) => entry.status === "serving" || entry.status === "called").length;
  const completed = queue.filter((entry) => entry.status === "completed").length;
  const avgWait =
    queue
      .filter((entry) => entry.status === "waiting" && typeof entry.estimatedWait === "number")
      .reduce((sum, entry) => sum + (entry.estimatedWait ?? 0), 0) / Math.max(waiting, 1);

  const handleCall = (id: string) => {
    void callQueueTicket(id, token ?? undefined)
      .then((updated) => {
        setQueue((current) => current.map((entry) => (entry.id === id ? updated : entry)));
      })
      .catch(() => {});
  };

  const handleComplete = (id: string) => {
    void updateQueueStatus(id, "completed", token ?? undefined)
      .then((updated) => {
        setQueue((current) => current.map((entry) => (entry.id === id ? updated : entry)));
      })
      .catch(() => {});
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage patient service window assignments and wait times</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Waiting" value={waiting} icon={Users} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="Being Served" value={serving} icon={Activity} iconClassName="bg-cyan-500/10 text-cyan-600" />
        <StatCard title="Completed" value={completed} icon={Clock} iconClassName="bg-emerald-500/10 text-emerald-600" />
        <StatCard title="Avg Wait" value={`${Math.round(avgWait || 0)} min`} icon={Timer} iconClassName="bg-sky-500/10 text-sky-600" />
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          {statusFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                statusFilter === filter.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 flex-wrap">
          {serviceFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setServiceFilter(filter.value)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                serviceFilter === filter.value
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Queue ({filtered.length} {statusFilter === "active" ? "active" : "total"})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No entries matching current filters.</p>
          ) : (
            <div className="space-y-2">
              {filtered
                .sort((a, b) => {
                  const priorityOrder = { stat: 0, urgent: 1, high: 2, normal: 3, low: 4 };
                  const aPriority = priorityOrder[a.priority] ?? 3;
                  const bPriority = priorityOrder[b.priority] ?? 3;
                  if (aPriority !== bPriority) return aPriority - bPriority;
                  return new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime();
                })
                .map((entry) => (
                  <QueueTicket
                    key={entry.id}
                    entry={entry}
                    onCall={handleCall}
                    onComplete={handleComplete}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
