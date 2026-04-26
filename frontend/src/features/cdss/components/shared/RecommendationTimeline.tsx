"use client";

import { Clock, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  SEVERITY_CONFIG, TYPE_LABELS, STATUS_DISPLAY,
  OVERRIDE_ACTION_COLORS, CATEGORY_LABELS,
} from "@/features/cdss/constants";
import type { CDSSRecommendation, CDSSOverrideRecord } from "@/types";

interface TimelineEvent {
  id: string;
  timestamp: string;
  type: "recommendation" | "response";
  rec?: CDSSRecommendation;
  override?: CDSSOverrideRecord;
}

interface RecommendationTimelineProps {
  recommendations: CDSSRecommendation[];
  overrides?: CDSSOverrideRecord[];
  onSelectRec?: (id: string) => void;
  className?: string;
}

/**
 * Chronological timeline of recommendations and clinician responses for a patient.
 * Used in patient-scope views and audit displays.
 */
export function RecommendationTimeline({
  recommendations,
  overrides = [],
  onSelectRec,
  className,
}: RecommendationTimelineProps) {
  // Merge recs + overrides into a sorted timeline
  const events: TimelineEvent[] = [
    ...recommendations.map((rec): TimelineEvent => ({
      id: `rec-${rec.id}`,
      timestamp: rec.generatedAt,
      type: "recommendation",
      rec,
    })),
    ...overrides.map((ov): TimelineEvent => ({
      id: `ov-${ov.id}`,
      timestamp: ov.timestamp,
      type: "response",
      override: ov,
    })),
  ].sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-sm text-muted-foreground">
        No timeline events found.
      </div>
    );
  }

  return (
    <div className={cn("relative space-y-0", className)}>
      {/* Vertical timeline line */}
      <div className="absolute left-[22px] top-5 bottom-5 w-px bg-border/50" />

      {events.map((event) => {
        if (event.type === "recommendation" && event.rec) {
          const rec = event.rec;
          const svCfg = SEVERITY_CONFIG[rec.severity];
          const Icon = svCfg.icon;
          const stDisp = STATUS_DISPLAY[rec.status];
          return (
            <div key={event.id} className="flex gap-3 items-start pb-5 relative">
              {/* Node */}
              <div className={cn(
                "h-11 w-11 rounded-full border-2 shrink-0 flex items-center justify-center bg-background z-10",
                svCfg.border,
              )}>
                <Icon className={cn("h-4 w-4", svCfg.iconColor)} />
              </div>
              {/* Content */}
              <div
                className={cn(
                  "flex-1 min-w-0 rounded-xl border p-3",
                  svCfg.border, svCfg.bg,
                  onSelectRec && "cursor-pointer hover:shadow-sm",
                )}
                onClick={() => onSelectRec?.(rec.id)}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={cn("text-[10px] font-semibold border", svCfg.badge)}>
                    {svCfg.label}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{TYPE_LABELS[rec.type]}</span>
                  <span className={cn("text-xs font-medium ml-auto", stDisp.color)}>
                    {stDisp.label}
                  </span>
                </div>
                <p className="text-xs font-semibold mt-1 leading-snug">{rec.title}</p>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {rec.generatedAt.replace("T", " ").slice(0, 16)}
                  {onSelectRec && <ArrowRight className="h-3 w-3 ml-auto" />}
                </p>
              </div>
            </div>
          );
        }

        if (event.type === "response" && event.override) {
          const ov = event.override;
          return (
            <div key={event.id} className="flex gap-3 items-start pb-5 relative">
              {/* Node */}
              <div className="h-11 w-11 rounded-full border-2 border-border/50 shrink-0 flex items-center justify-center bg-background z-10">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0 rounded-xl border border-border/40 p-3 bg-muted/10">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] border capitalize", OVERRIDE_ACTION_COLORS[ov.action])}
                  >
                    {ov.action}
                  </Badge>
                  <span className="text-xs text-muted-foreground line-clamp-1">{ov.recommendationTitle}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{ov.reason}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">
                  {ov.clinicianName} · {CATEGORY_LABELS[ov.reasonCategory]} ·{" "}
                  {ov.timestamp.replace("T", " ").slice(0, 16)}
                </p>
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
