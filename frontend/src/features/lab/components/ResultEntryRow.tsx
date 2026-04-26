"use client";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { LabTestResult } from "@/types";
import { cn } from "@/lib/utils";

interface ResultEntryRowProps {
  result: LabTestResult;
  editable?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
}

const flagColors: Record<string, string> = {
  normal: "",
  high: "bg-amber-500/[0.06] border-amber-500/30",
  low: "bg-sky-500/[0.06] border-sky-500/30",
  "critical-high": "bg-red-500/[0.08] border-red-500/40",
  "critical-low": "bg-red-500/[0.08] border-red-500/40",
};

const flagTextColors: Record<string, string> = {
  normal: "text-foreground",
  high: "text-amber-700 font-bold",
  low: "text-sky-700 font-bold",
  "critical-high": "text-red-700 font-extrabold",
  "critical-low": "text-red-700 font-extrabold",
};

const flagBadgeColors: Record<string, string> = {
  normal: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  high: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  low: "bg-sky-500/10 text-sky-700 border-sky-500/30",
  "critical-high": "bg-red-500/15 text-red-700 border-red-500/40",
  "critical-low": "bg-red-500/15 text-red-700 border-red-500/40",
};

export function ResultEntryRow({ result, editable = false, value, onValueChange, className }: ResultEntryRowProps) {
  const isCritical = result.flag === "critical-high" || result.flag === "critical-low";
  const displayValue = value ?? result.value;

  return (
    <tr className={cn("border-b border-border/30 transition-colors", result.flag ? flagColors[result.flag] : "", isCritical && "animate-pulse-subtle", className)}>
      <td className="py-2 px-3 text-xs font-mono text-muted-foreground">{result.testCode}</td>
      <td className="py-2 px-3 text-sm font-medium">{result.testName}</td>
      <td className="py-2 px-3">
        {editable && result.status === "pending" ? (
          <Input
            className="h-7 w-24 text-xs font-mono"
            placeholder="-"
            value={value ?? ""}
            onChange={(event) => onValueChange?.(event.target.value)}
          />
        ) : (
          <span className={cn("font-mono text-sm", result.flag ? flagTextColors[result.flag] : "")}>
            {displayValue || "-"}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground">{result.unit}</td>
      <td className="py-2 px-3 text-xs text-muted-foreground font-mono">{result.referenceRange}</td>
      <td className="py-2 px-3">
        {displayValue && result.flag && (
          <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border capitalize", flagBadgeColors[result.flag])}>
            {isCritical && "⚠ "}{result.flag.replace("-", " ")}
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-xs text-muted-foreground">
        {result.previousValue && (
          <span className="flex items-center gap-1">
            {result.previousValue} <span className={cn("text-[10px]", result.delta?.startsWith("+") ? "text-red-600" : "text-emerald-600")}>{result.delta}</span>
          </span>
        )}
      </td>
      <td className="py-2 px-3">
        <Badge variant="outline" className="text-[10px] capitalize">{result.status}</Badge>
      </td>
    </tr>
  );
}
