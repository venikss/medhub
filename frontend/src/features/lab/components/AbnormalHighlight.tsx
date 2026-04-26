"use client";

import type { LabResultFlag } from "@/types";
import { cn } from "@/lib/utils";
import { AlertTriangle } from "lucide-react";

interface AbnormalHighlightProps {
  flag: LabResultFlag;
  children: React.ReactNode;
  className?: string;
}

const bgColors: Record<LabResultFlag, string> = {
  normal: "",
  high: "bg-amber-500/[0.05] border-l-4 border-l-amber-500",
  low: "bg-sky-500/[0.05] border-l-4 border-l-sky-500",
  "critical-high": "bg-red-500/[0.08] border-l-4 border-l-red-600",
  "critical-low": "bg-red-500/[0.08] border-l-4 border-l-red-600",
};

export function AbnormalHighlight({ flag, children, className }: AbnormalHighlightProps) {
  const isCritical = flag === "critical-high" || flag === "critical-low";

  if (flag === "normal") return <div className={className}>{children}</div>;

  return (
    <div className={cn("rounded-lg px-3 py-2", bgColors[flag], className)}>
      {isCritical && (
        <div className="flex items-center gap-1.5 mb-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Panic Value</span>
        </div>
      )}
      {children}
    </div>
  );
}
