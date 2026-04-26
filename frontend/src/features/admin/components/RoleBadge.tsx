import { Badge } from "@/components/ui/badge";
import type { AdminUserRole } from "@/types";

const ROLE_CONFIG: Record<AdminUserRole, { label: string; className: string }> = {
  admin:         { label: "Admin",         className: "bg-violet-500/15 text-violet-700 border-violet-300/40" },
  doctor:        { label: "Doctor",        className: "bg-blue-500/15 text-blue-700 border-blue-300/40" },
  nurse:         { label: "Nurse",         className: "bg-teal-500/15 text-teal-700 border-teal-300/40" },
  lab_tech:      { label: "Lab Tech",      className: "bg-amber-500/15 text-amber-700 border-amber-300/40" },
  radiologist:   { label: "Radiologist",   className: "bg-sky-500/15 text-sky-700 border-sky-300/40" },
  pharmacist:    { label: "Pharmacist",    className: "bg-indigo-500/15 text-indigo-700 border-indigo-300/40" },
  billing_staff: { label: "Billing",       className: "bg-emerald-500/15 text-emerald-700 border-emerald-300/40" },
  front_desk:    { label: "Front Desk",    className: "bg-orange-500/15 text-orange-700 border-orange-300/40" },
  patient:       { label: "Patient",       className: "bg-slate-500/15 text-slate-600 border-slate-300/40" },
};

interface RoleBadgeProps {
  role: AdminUserRole;
  className?: string;
}

export function RoleBadge({ role, className }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role] ?? { label: role, className: "bg-slate-500/15 text-slate-600" };
  return (
    <Badge variant="outline" className={`text-xs font-medium ${config.className} ${className ?? ""}`}>
      {config.label}
    </Badge>
  );
}
