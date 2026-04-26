"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImagingStudyStatus } from "@/types";

const STEPS: { key: ImagingStudyStatus; label: string }[] = [
  { key: "ordered",    label: "Ordered" },
  { key: "protocoled", label: "Protocoled" },
  { key: "scheduled",  label: "Scheduled" },
  { key: "arrived",    label: "Arrived" },
  { key: "in-progress",label: "In Progress" },
  { key: "acquired",   label: "Acquired" },
  { key: "reading",    label: "Reading" },
  { key: "reported",   label: "Reported" },
  { key: "signed",     label: "Signed" },
];

const STATUS_ORDER: Record<ImagingStudyStatus, number> = {
  ordered: 0, protocoled: 1, scheduled: 2, arrived: 3,
  "in-progress": 4, acquired: 5, reading: 6, reported: 7,
  signed: 8, amended: 8, cancelled: -1,
};

interface StudyStatusPipelineProps {
  status: ImagingStudyStatus;
  className?: string;
}

export function StudyStatusPipeline({ status, className }: StudyStatusPipelineProps) {
  const currentIdx = STATUS_ORDER[status] ?? -1;

  return (
    <div className={cn("flex items-center gap-0", className)}>
      {STEPS.map((step, idx) => {
        const done    = currentIdx > idx;
        const active  = currentIdx === idx;
        const pending = currentIdx < idx;

        return (
          <div key={step.key} className="flex items-center">
            {/* Connector */}
            {idx > 0 && (
              <div
                className={cn(
                  "h-0.5 w-4 transition-colors",
                  done ? "bg-emerald-500" : "bg-muted",
                )}
              />
            )}
            {/* Node */}
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                  done   && "border-emerald-500 bg-emerald-500 text-white",
                  active && "border-blue-600 bg-blue-600 text-white ring-2 ring-blue-300",
                  pending && "border-muted bg-background text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "hidden lg:block text-[10px] leading-none font-medium",
                  done    && "text-emerald-600",
                  active  && "text-blue-600",
                  pending && "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
