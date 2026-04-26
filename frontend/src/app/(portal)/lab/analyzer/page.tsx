"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, CheckCircle2, AlertTriangle, Loader2, Play, Square, Timer } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { listAnalyzerQueue, updateAnalyzerQueueStatus } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { AnalyzerQueueItem } from "@/types";
import { cn } from "@/lib/utils";

const statusIcons: Record<string, typeof Clock> = {
  queued: Clock,
  loading: Loader2,
  running: Activity,
  completed: CheckCircle2,
  error: AlertTriangle,
};

const statusColors: Record<string, string> = {
  queued: "border-border/50",
  loading: "border-amber-500/40 bg-amber-500/[0.03]",
  running: "border-sky-500/40 bg-sky-500/[0.03]",
  completed: "border-emerald-500/40 bg-emerald-500/[0.03]",
  error: "border-red-500/40 bg-red-500/[0.03]",
};

function useCountdown(items: AnalyzerQueueItem[]) {
  const [now, setNow] = useState(Date.now());
  const hasRunning = items.some((i) => i.status === "running" && i.startedAt);

  useEffect(() => {
    if (!hasRunning) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasRunning]);

  return useCallback(
    (item: AnalyzerQueueItem) => {
      if (!item.startedAt || !item.estimatedMinutes) return null;
      const elapsed = (now - new Date(item.startedAt).getTime()) / 1000;
      const total = item.estimatedMinutes * 60;
      const remaining = Math.max(0, total - elapsed);
      const progress = Math.min(100, (elapsed / total) * 100);
      return { remaining, progress, elapsed, total, overdue: elapsed > total };
    },
    [now],
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function AnalyzerQueuePage() {
  const token = useAuthStore((state) => state.token);
  const [queue, setQueue] = useState<AnalyzerQueueItem[]>([]);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const getCountdown = useCountdown(queue);

  const refresh = useCallback(() => {
    void listAnalyzerQueue({}, token ?? undefined)
      .then(setQueue)
      .catch(() => setQueue([]));
  }, [token]);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleStatusChange(item: AnalyzerQueueItem, newStatus: string) {
    if (!token) return;
    setLoadingIds((prev) => new Set(prev).add(item.id));
    try {
      const updated = await updateAnalyzerQueueStatus(item.id, { status: newStatus }, token);
      setQueue((prev) => prev.map((q) => (q.id === updated.id ? { ...q, ...updated } : q)));
    } catch {
      refresh();
    } finally {
      setLoadingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  }

  const instruments = useMemo(() => Array.from(new Set(queue.map((item) => item.instrument))), [queue]);

  const stats = useMemo(() => {
    const queued = queue.filter((i) => i.status === "queued").length;
    const running = queue.filter((i) => i.status === "running").length;
    const completed = queue.filter((i) => i.status === "completed").length;
    return { queued, running, completed, total: queue.length };
  }, [queue]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analyzer Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage instrument analysis — start runs, track progress, mark complete</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"><Timer className="h-4 w-4 text-muted-foreground" /></div>
          <div><p className="text-lg font-bold">{stats.total}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center"><Clock className="h-4 w-4 text-amber-600" /></div>
          <div><p className="text-lg font-bold">{stats.queued}</p><p className="text-[10px] text-muted-foreground">Waiting</p></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="h-8 w-8 rounded-full bg-sky-500/10 flex items-center justify-center"><Activity className="h-4 w-4 text-sky-600" /></div>
          <div><p className="text-lg font-bold">{stats.running}</p><p className="text-[10px] text-muted-foreground">Running</p></div>
        </div>
        <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
          <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
          <div><p className="text-lg font-bold">{stats.completed}</p><p className="text-[10px] text-muted-foreground">Completed</p></div>
        </div>
      </div>

      {instruments.map((instrument) => {
        const items = queue.filter((item) => item.instrument === instrument).sort((a, b) => {
          const order = { running: 0, queued: 1, loading: 1, error: 2, completed: 3 };
          return (order[a.status] ?? 9) - (order[b.status] ?? 9);
        });
        const runningCount = items.filter((i) => i.status === "running").length;
        const queuedCount = items.filter((i) => i.status === "queued").length;

        return (
          <Card key={instrument} className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {instrument}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{items.length} specimen{items.length > 1 ? "s" : ""}</Badge>
                  {runningCount > 0 && <Badge className="text-[10px] bg-sky-500/10 text-sky-700 border-sky-500/30">{runningCount} Running</Badge>}
                  {queuedCount > 0 && <Badge className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">{queuedCount} Waiting</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((item) => {
                  const Icon = statusIcons[item.status] || Clock;
                  const countdown = item.status === "running" ? getCountdown(item) : null;
                  const isLoading = loadingIds.has(item.id);

                  return (
                    <div key={item.id} className={cn("flex items-center gap-3 p-3 rounded-lg border transition-colors", statusColors[item.status])}>
                      {/* Position */}
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-bold shrink-0">
                        #{item.queuePosition}
                      </div>

                      {/* Status icon */}
                      <Icon className={cn("h-4 w-4 shrink-0", item.status === "running" && "animate-spin text-sky-600", item.status === "error" && "text-red-600", item.status === "completed" && "text-emerald-600", item.status === "queued" && "text-muted-foreground")} />

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{item.testName || "Pending"}</p>
                          <StatusBadge status={item.priority} />
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          <span>{item.patientName}</span>
                          <span>·</span>
                          <span className="font-mono">{item.specimenBarcode}</span>
                          {item.startedAt && <><span>·</span><span>Started: {new Date(item.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></>}
                          {item.completedAt && <><span>·</span><span>Completed: {new Date(item.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></>}
                        </div>

                        {/* Progress bar for running items */}
                        {countdown && (
                          <div className="mt-2 space-y-1">
                            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all duration-1000", countdown.overdue ? "bg-red-500" : "bg-sky-500")}
                                style={{ width: `${Math.min(countdown.progress, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[10px]">
                              <span className="text-muted-foreground">Elapsed: {formatTime(countdown.elapsed)}</span>
                              <span className={cn("font-medium", countdown.overdue ? "text-red-600" : "text-sky-600")}>
                                {countdown.overdue ? `Overdue by ${formatTime(countdown.elapsed - countdown.total)}` : `${formatTime(countdown.remaining)} remaining`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* ETA */}
                      {item.estimatedMinutes && item.status !== "completed" && (
                        <div className="text-right shrink-0">
                          <p className="text-xs font-medium">{item.estimatedMinutes} min</p>
                          <p className="text-[10px] text-muted-foreground">Est. Duration</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="shrink-0">
                        {item.status === "queued" && (
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs h-8 bg-sky-600 hover:bg-sky-700"
                            disabled={isLoading}
                            onClick={() => void handleStatusChange(item, "running")}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                            Start
                          </Button>
                        )}
                        {item.status === "running" && (
                          <Button
                            size="sm"
                            className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700"
                            disabled={isLoading}
                            onClick={() => void handleStatusChange(item, "completed")}
                          >
                            {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
                            Complete
                          </Button>
                        )}
                        {item.status === "completed" && (
                          <Badge className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Done
                          </Badge>
                        )}
                        {item.status === "error" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8 border-red-500/30 text-red-600"
                            disabled={isLoading}
                            onClick={() => void handleStatusChange(item, "running")}
                          >
                            Retry
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {queue.length === 0 && (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No specimens in the analyzer queue.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
