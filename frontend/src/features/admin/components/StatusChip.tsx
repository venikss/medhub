import { Badge } from "@/components/ui/badge";
import type { AdminUserStatus, DepartmentStatus, BedStatus, CatalogItemStatus, AuditSeverity } from "@/types";
import { cn } from "@/lib/utils";

type AnyStatus = AdminUserStatus | DepartmentStatus | BedStatus | CatalogItemStatus | AuditSeverity | "active" | "inactive" | string;

const STATUS_MAP: Record<string, string> = {
  // user / dept / catalog
  active:       "bg-emerald-500/15 text-emerald-700 border-emerald-300/40",
  inactive:     "bg-slate-500/15 text-slate-600 border-slate-300/40",
  suspended:    "bg-red-500/15 text-red-700 border-red-300/40",
  pending:      "bg-amber-500/15 text-amber-700 border-amber-300/40",
  discontinued: "bg-rose-500/15 text-rose-700 border-rose-300/40",
  // bed
  available:    "bg-emerald-500/15 text-emerald-700 border-emerald-300/40",
  occupied:     "bg-blue-500/15 text-blue-700 border-blue-300/40",
  reserved:     "bg-violet-500/15 text-violet-700 border-violet-300/40",
  maintenance:  "bg-orange-500/15 text-orange-700 border-orange-300/40",
  cleaning:     "bg-amber-500/15 text-amber-700 border-amber-300/40",
  // audit severity
  info:         "bg-sky-500/15 text-sky-700 border-sky-300/40",
  warning:      "bg-amber-500/15 text-amber-700 border-amber-300/40",
  critical:     "bg-red-500/15 text-red-700 border-red-300/40",
  // ward
  under_maintenance: "bg-orange-500/15 text-orange-700 border-orange-300/40",
};

const LABEL_MAP: Record<string, string> = {
  active: "Active", inactive: "Inactive", suspended: "Suspended", pending: "Pending",
  discontinued: "Discontinued", available: "Available", occupied: "Occupied",
  reserved: "Reserved", maintenance: "Maintenance", cleaning: "Cleaning",
  info: "Info", warning: "Warning", critical: "Critical",
  under_maintenance: "Under Maintenance",
};

interface StatusChipProps {
  status: AnyStatus;
  className?: string;
}

export function StatusChip({ status, className }: StatusChipProps) {
  const colorClass = STATUS_MAP[status] ?? "bg-slate-500/15 text-slate-600 border-slate-300/40";
  const label = LABEL_MAP[status] ?? status;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium capitalize", colorClass, className)}>
      {label}
    </Badge>
  );
}
