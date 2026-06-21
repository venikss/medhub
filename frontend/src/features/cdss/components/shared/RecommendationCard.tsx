"use client";

import { BrainCircuit, Eye, MessageSquare, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  SEVERITY_CONFIG, TYPE_LABELS, STATUS_DISPLAY,
  CONFIDENCE_BADGE, MODULE_LABELS, MODULE_COLORS,
} from "@/features/cdss/constants";
import type { CDSSRecommendation } from "@/types";

interface RecommendationCardProps {
  rec: CDSSRecommendation;
  selected?: boolean;
  /** Hide the patient row — use when already in a patient-scoped page */
  hidePatient?: boolean;
  /** Show module source badge */
  showModule?: boolean;
  /** Compact layout for dense lists (no summary text, smaller actions) */
  compact?: boolean;
  onSelect?: () => void;
  onExplain?: () => void;
  onOverride?: () => void;
  onAskAI?: () => void;
  className?: string;
}

/**
 * Generic, store-free recommendation card.
 * Suitable for embedding inside any module portal.
 * All actions are callbacks — the parent manages store interaction.
 */
export function RecommendationCard({
  rec, selected, hidePatient, showModule, compact,
  onSelect, onExplain, onOverride, onAskAI, className,
}: RecommendationCardProps) {
  const cfg         = SEVERITY_CONFIG[rec.severity];
  const Icon        = cfg.icon;
  const statusDisp  = STATUS_DISPLAY[rec.status];
  const isResolved  = rec.status !== "active";

  return (
    <div
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-3 cursor-pointer transition-all",
        cfg.border, cfg.bg,
        selected && "ring-2 ring-primary ring-offset-1",
        isResolved && "opacity-65",
        !selected && "hover:shadow-sm hover:ring-1 hover:ring-border/60",
        className,
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={cn("text-[10px] font-semibold border", cfg.badge)}>
              {cfg.label}
            </Badge>
            <span className="text-xs text-muted-foreground">{TYPE_LABELS[rec.type]}</span>
            {showModule && rec.sourceModule && (
              <Badge
                variant="outline"
                className={cn("text-[10px] border", MODULE_COLORS[rec.sourceModule])}
              >
                {MODULE_LABELS[rec.sourceModule]}
              </Badge>
            )}
            <span className={cn("text-xs font-medium ml-auto", statusDisp.color)}>
              {statusDisp.label}
            </span>
          </div>
          <p className="text-sm font-semibold mt-1 leading-snug">{rec.title}</p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {rec.summary}
            </p>
          )}
        </div>
      </div>

      {/* Metadata row */}
      {!compact && (
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {!hidePatient && (
            <>
              <span className="text-xs font-medium text-foreground/80">{rec.patientName}</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-xs text-muted-foreground font-mono">{rec.patientMRN}</span>
            </>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            <BrainCircuit className="h-3 w-3 text-muted-foreground" />
            <Badge
              variant="outline"
              className={cn("text-[10px] border", CONFIDENCE_BADGE[rec.explanation.confidence])}
            >
              {rec.explanation.confidenceScore}% · {rec.explanation.confidence}
            </Badge>
          </span>
        </div>
      )}

      {/* Override reason snippet */}
      {isResolved && rec.overrideReason && (
        <p className="text-xs text-muted-foreground mt-1.5 italic line-clamp-1">
          &quot;{rec.overrideReason}&quot;
        </p>
      )}

      {/* Action buttons */}
      {(onExplain || onOverride || onAskAI) && !compact && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/30">
          {onExplain && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={(e) => { e.stopPropagation(); onExplain(); }}
            >
              <Eye className="h-3 w-3" /> Explain
            </Button>
          )}
          {onOverride && !isResolved && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={(e) => { e.stopPropagation(); onOverride(); }}
            >
              <MessageSquare className="h-3 w-3" /> Respond
            </Button>
          )}
          {onAskAI && (
            <Button
              variant="outline"
              size="sm"
              className="ml-auto h-7 text-xs gap-1 border-sky-500/40 text-sky-600 hover:bg-sky-50 hover:text-sky-700 dark:text-sky-400 dark:hover:bg-sky-950/40"
              onClick={(e) => { e.stopPropagation(); onAskAI(); }}
            >
              <Sparkles className="h-3 w-3" /> Ask AI
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
