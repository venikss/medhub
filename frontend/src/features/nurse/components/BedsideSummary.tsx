"use client";

import Link from "next/link";
import { AlertTriangle, Clock, Heart, Droplets, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { cn } from "@/lib/utils";
import type { Patient, NursingTask } from "@/types";

interface BedsideSummaryProps {
  patient: Patient & { diagnosis?: string; acuity?: "low" | "medium" | "high" | "critical" };
  nextTask?: NursingTask;
  overdueTasks?: number;
  lastVitals?: string;
  className?: string;
}

const acuityColors = {
  low: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  medium: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  high: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  critical: "bg-red-500/10 text-red-700 border-red-500/20",
};

export function BedsideSummary({ patient, nextTask, overdueTasks, lastVitals, className }: BedsideSummaryProps) {
  return (
    <Link
      href={`/nurse/ward?patient=${patient.id}`}
      className={cn(
        "block rounded-lg border bg-card p-3 hover:shadow-md hover:border-primary/30 transition-all",
        overdueTasks && overdueTasks > 0 && "border-red-500/40 bg-red-500/[0.02]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold shrink-0",
            patient.status === "critical" ? "bg-red-500/15 text-red-600" : "bg-primary/10 text-primary"
          )}>
            {patient.firstName[0]}{patient.lastName[0]}
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight">{patient.firstName} {patient.lastName}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{patient.mrn}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold bg-muted px-1.5 py-0.5 rounded">{patient.roomNumber}</span>
          <StatusBadge status={patient.status} />
        </div>
      </div>

      {/* Acuity + allergies */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {patient.acuity && (
          <span className={cn("text-[10px] font-medium border px-1.5 py-0.5 rounded-full", acuityColors[patient.acuity])}>
            {patient.acuity.toUpperCase()}
          </span>
        )}
        {patient.allergies && patient.allergies.length > 0 ? (
          patient.allergies.map((a: any, i: number) => {
            const label = typeof a === "string" ? a : a.substance ?? a.reaction ?? JSON.stringify(a);
            return <Badge key={i} variant="destructive" className="text-[9px] px-1 py-0">{label}</Badge>;
          })
        ) : (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
            <Shield className="h-2.5 w-2.5" /> NKDA
          </span>
        )}
        {patient.diagnosis && (
          <span className="text-[10px] text-muted-foreground truncate max-w-[160px]">{patient.diagnosis}</span>
        )}
      </div>

      {/* Overdue warning */}
      {overdueTasks && overdueTasks > 0 ? (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-red-500/10 border border-red-500/25 mb-2">
          <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
          <span className="text-[10px] font-semibold text-red-700">{overdueTasks} overdue task{overdueTasks > 1 ? "s" : ""}</span>
        </div>
      ) : null}

      {/* Next task + last vitals */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        {nextTask ? (
          <span className="truncate flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" /> {nextTask.description}
          </span>
        ) : (
          <span>No pending tasks</span>
        )}
        {lastVitals && (
          <span className="flex items-center gap-0.5 shrink-0">
            <Heart className="h-2.5 w-2.5" /> {lastVitals}
          </span>
        )}
      </div>
    </Link>
  );
}
