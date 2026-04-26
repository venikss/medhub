import { cn } from "@/lib/utils";
import type { PatientStatus, OrderStatus, AppointmentStatus } from "@/types";

const statusStyles: Record<string, string> = {
    // Patient statuses
    active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    discharged: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    critical: "bg-red-500/10 text-red-600 border-red-500/20",
    stable: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    admitted: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    // Appointment statuses
    scheduled: "bg-sky-500/10 text-sky-600 border-sky-500/20",
    "in-progress": "bg-amber-500/10 text-amber-600 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    cancelled: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    "no-show": "bg-red-500/10 text-red-500 border-red-500/20",
    // Order statuses
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    // Priority
    low: "bg-slate-500/10 text-slate-500 border-slate-500/20",
    normal: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    high: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    urgent: "bg-red-500/10 text-red-600 border-red-500/20",
    stat: "bg-red-600/15 text-red-700 border-red-600/30",
};

interface StatusBadgeProps {
    status: PatientStatus | OrderStatus | AppointmentStatus | string;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize",
                statusStyles[status] || "bg-muted text-muted-foreground border-border",
                className
            )}
        >
            {status.replace("-", " ")}
        </span>
    );
}
