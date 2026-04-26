"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import type { NursingTask } from "@/types";
import { cn } from "@/lib/utils";

interface TaskListProps {
  tasks: NursingTask[];
  title?: string;
  className?: string;
  onComplete?: (taskId: string) => Promise<void>;
}

const typeIcons: Record<string, string> = {
  vitals: "💓", medication: "💊", assessment: "🩺", "wound-care": "🩹",
  "io-check": "💧", ambulation: "🚶", education: "📋", discharge: "📤", other: "📝",
};

const priorityColors: Record<string, string> = {
  low: "text-emerald-600", normal: "text-sky-600", high: "text-amber-600", urgent: "text-red-600", stat: "text-red-700",
};

export function TaskList({ tasks, title = "Nursing Tasks", className, onComplete }: TaskListProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleComplete(taskId: string) {
    if (!onComplete) return;
    setBusyId(taskId);
    try { await onComplete(taskId); } finally { setBusyId(null); }
  }

  const sorted = [...tasks].sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    const pOrder = { stat: 0, urgent: 1, high: 2, normal: 3, low: 4 };
    return (pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3);
  });

  return (
    <Card className={cn("border-border/50 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {sorted.map((task) => {
            const dueTime = new Date(task.dueTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const isBusy = busyId === task.id;
            return (
              <div key={task.id} className={cn(
                "flex items-center gap-3 p-2.5 rounded-lg border transition-colors",
                task.isOverdue ? "bg-red-500/[0.06] border-red-500/30" : task.status === "completed" ? "bg-muted/30 border-border/30 opacity-60" : "border-border/50 hover:bg-muted/40"
              )}>
                <span className="text-sm shrink-0">{typeIcons[task.type] || "📝"}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-medium", task.isOverdue && "text-red-700")}>{task.description}</p>
                    {task.isOverdue && <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span>{task.patientName}</span>
                    <span>·</span>
                    <span>Rm {task.room}</span>
                    <span>·</span>
                    <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{dueTime}</span>
                  </div>
                </div>
                <Badge variant="outline" className={cn("text-[10px]", priorityColors[task.priority])}>{task.priority}</Badge>
                {task.status === "completed" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs shrink-0"
                    disabled={isBusy}
                    onClick={() => void handleComplete(task.id)}
                  >
                    {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Done"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
