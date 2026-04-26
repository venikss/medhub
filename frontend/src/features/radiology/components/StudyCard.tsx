"use client";

import { Images, Clock, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ModalityBadge } from "./ModalityBadge";
import type { ImagingStudy } from "@/types";

const PRIORITY_STYLES: Record<string, string> = {
  stat:   "bg-red-100 text-red-700 border-red-300",
  urgent: "bg-orange-100 text-orange-700 border-orange-300",
  high:   "bg-amber-100 text-amber-700 border-amber-300",
  normal: "bg-slate-100 text-slate-600 border-slate-300",
};

const STATUS_STYLES: Record<string, string> = {
  ordered:      "bg-slate-100 text-slate-600",
  protocoled:   "bg-sky-100 text-sky-700",
  scheduled:    "bg-blue-100 text-blue-700",
  arrived:      "bg-teal-100 text-teal-700",
  "in-progress":"bg-indigo-100 text-indigo-700",
  acquired:     "bg-violet-100 text-violet-700",
  reading:      "bg-purple-100 text-purple-700",
  reported:     "bg-amber-100 text-amber-700",
  signed:       "bg-emerald-100 text-emerald-700",
  amended:      "bg-cyan-100 text-cyan-700",
  cancelled:    "bg-rose-100 text-rose-700",
};

interface StudyCardProps {
  study: ImagingStudy;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function StudyCard({ study, selected, onClick, className }: StudyCardProps) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3 text-sm transition-colors",
        onClick && "cursor-pointer hover:bg-muted/50",
        selected && "border-primary bg-primary/5",
        study.hasCritical && "border-l-4 border-l-red-500",
        className,
      )}
    >
      {/* Row 1 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ModalityBadge modality={study.modality} />
          <span className="font-semibold truncate">{study.patientName}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {study.mrn}
          </span>
        </div>
        <span
          className={cn(
            "shrink-0 rounded border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
            PRIORITY_STYLES[study.priority] ?? PRIORITY_STYLES.normal,
          )}
        >
          {study.priority}
        </span>
      </div>

      {/* Row 2 */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground truncate">{study.examName}</span>
        <Badge
          variant="secondary"
          className={cn("shrink-0 capitalize", STATUS_STYLES[study.status])}
        >
          {study.status}
        </Badge>
      </div>

      {/* Row 3 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {study.examTime}
          {study.room && <> · {study.room}</>}
        </span>
        {study.radiologist && (
          <span className="flex items-center gap-1">
            <User className="h-3 w-3" />
            {study.radiologist}
          </span>
        )}
        {study.imagesCount !== undefined && (
          <span className="flex items-center gap-1">
            <Images className="h-3 w-3" />
            {study.imagesCount} images
            {study.seriesCount !== undefined && ` / ${study.seriesCount} series`}
          </span>
        )}
      </div>
    </div>
  );
}
