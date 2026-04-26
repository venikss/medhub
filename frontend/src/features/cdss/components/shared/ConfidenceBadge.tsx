import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CONFIDENCE_BADGE } from "@/features/cdss/constants";
import type { CDSSConfidenceLevel } from "@/types";

interface ConfidenceBadgeProps {
  level: CDSSConfidenceLevel;
  score?: number;
  className?: string;
}

export function ConfidenceBadge({ level, score, className }: ConfidenceBadgeProps) {
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] border", CONFIDENCE_BADGE[level], className)}
    >
      {score !== undefined ? `${score}%` : label}
    </Badge>
  );
}
