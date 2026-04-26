"use client";

import { Badge } from "@/components/ui/badge";
import { ScanLine } from "lucide-react";
import type { SpecimenStatus } from "@/types";
import { cn } from "@/lib/utils";

interface SpecimenBadgeProps {
  barcode: string;
  status: SpecimenStatus;
  specimenType?: string;
  className?: string;
}

const statusColors: Record<SpecimenStatus, string> = {
  ordered: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  collected: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  "in-transit": "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  received: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  processing: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  analyzed: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  resulted: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function SpecimenBadge({ barcode, status, specimenType, className }: SpecimenBadgeProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted font-mono text-[11px] font-medium border border-border/50">
        <ScanLine className="h-3 w-3 text-muted-foreground" />
        {barcode}
      </span>
      {specimenType && (
        <Badge variant="outline" className="text-[10px] capitalize">{specimenType}</Badge>
      )}
      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize", statusColors[status])}>
        {status.replace("-", " ")}
      </span>
    </div>
  );
}
