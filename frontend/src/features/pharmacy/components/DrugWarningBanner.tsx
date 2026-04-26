"use client";

import { AlertTriangle, ShieldAlert, Info, XOctagon, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DrugWarning } from "@/types";
import { cn } from "@/lib/utils";

interface DrugWarningBannerProps {
  warning: DrugWarning;
  compact?: boolean;
  className?: string;
}

const severityConfig = {
  info: { icon: Info, bg: "bg-sky-500/[0.06] border-sky-500/30", text: "text-sky-700", badge: "bg-sky-500/10 text-sky-600" },
  moderate: { icon: AlertTriangle, bg: "bg-amber-500/[0.06] border-amber-500/30", text: "text-amber-700", badge: "bg-amber-500/10 text-amber-700" },
  severe: { icon: ShieldAlert, bg: "bg-red-500/[0.08] border-red-500/40", text: "text-red-700", badge: "bg-red-500/15 text-red-700" },
  contraindicated: { icon: XOctagon, bg: "bg-red-600/[0.1] border-red-600/50", text: "text-red-800", badge: "bg-red-600/20 text-red-800" },
};

const typeLabels: Record<string, string> = {
  interaction: "Drug Interaction",
  allergy: "Allergy Alert",
  duplication: "Therapeutic Duplication",
  "dose-range": "Dose Range",
  renal: "Renal Dose",
  pregnancy: "Pregnancy",
  pediatric: "Pediatric",
};

export function DrugWarningBanner({ warning, compact = false, className }: DrugWarningBannerProps) {
  const cfg = severityConfig[warning.severity];
  const Icon = cfg.icon;
  const isOverridden = !!warning.overriddenBy;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs", cfg.bg, isOverridden && "opacity-60", className)}>
        <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg.text)} />
        <span className={cn("font-medium", cfg.text)}>{warning.title}</span>
        {isOverridden && <ShieldCheck className="h-3 w-3 text-emerald-600 shrink-0" />}
      </div>
    );
  }

  return (
    <div className={cn("p-3 rounded-lg border", cfg.bg, isOverridden && "opacity-70", className)}>
      <div className="flex items-start gap-2.5">
        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.text)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded", cfg.badge)}>
              {typeLabels[warning.type] || warning.type}
            </span>
            <span className={cn("text-[10px] font-medium uppercase", cfg.text)}>{warning.severity}</span>
          </div>
          <p className={cn("text-sm font-medium", cfg.text)}>{warning.title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{warning.description}</p>
          {isOverridden && (
            <p className="text-[10px] text-emerald-700 mt-1 flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" /> Overridden by {warning.overriddenBy} at {warning.overriddenAt ? new Date(warning.overriddenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
            </p>
          )}
        </div>
        {warning.overridable && !isOverridden && (
          <Button size="sm" variant="outline" className={cn("text-xs h-7 shrink-0", cfg.text)}>
            Override
          </Button>
        )}
      </div>
    </div>
  );
}
