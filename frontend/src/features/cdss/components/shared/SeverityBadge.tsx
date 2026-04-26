import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SEVERITY_CONFIG } from "@/features/cdss/constants";
import type { CDSSAlertSeverity } from "@/types";

interface SeverityBadgeProps {
  severity: CDSSAlertSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const cfg = SEVERITY_CONFIG[severity];
  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] font-semibold border", cfg.badge, className)}
    >
      {cfg.label}
    </Badge>
  );
}
