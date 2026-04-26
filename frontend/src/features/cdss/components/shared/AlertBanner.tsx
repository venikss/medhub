"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEVERITY_CONFIG, TYPE_LABELS } from "@/features/cdss/constants";
import type { CDSSRecommendation } from "@/types";

interface AlertBannerProps {
  rec: CDSSRecommendation;
  onView?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * A compact horizontal alert strip for embedding at the top of any module
 * workflow page. Shows severity icon + title + optional action buttons.
 *
 * Example usage:
 *   <AlertBanner rec={criticalRec} onView={() => openPanel(rec.id)} />
 */
export function AlertBanner({ rec, onView, onDismiss, className }: AlertBannerProps) {
  const cfg = SEVERITY_CONFIG[rec.severity];
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5",
        cfg.border,
        cfg.bg,
        className,
      )}
    >
      <Icon className={cn("h-4 w-4 shrink-0", cfg.iconColor)} />
      <div className="flex-1 min-w-0">
        <span className={cn("text-xs font-semibold mr-1.5 uppercase tracking-wide", cfg.iconColor)}>
          {cfg.label}
        </span>
        <span className="text-xs font-medium text-foreground/90 mr-1">
          {rec.title}
        </span>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          · {TYPE_LABELS[rec.type]}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onView && (
          <Button
            variant="ghost"
            size="sm"
            className={cn("h-7 text-xs font-medium", cfg.iconColor)}
            onClick={onView}
          >
            View →
          </Button>
        )}
        {onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
