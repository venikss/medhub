"use client";

import { cn } from "@/lib/utils";
import { Clock, User, ArrowRight, Timer } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Button } from "@/components/ui/button";
import type { QueueEntry } from "@/types";

const serviceColors: Record<string, string> = {
    registration: "bg-blue-500",
    insurance: "bg-violet-500",
    lab: "bg-teal-500",
    radiology: "bg-indigo-500",
    pharmacy: "bg-emerald-500",
    consultation: "bg-cyan-500",
    billing: "bg-amber-500",
};

interface QueueTicketProps {
    entry: QueueEntry;
    onCall?: (id: string) => void;
    onComplete?: (id: string) => void;
    className?: string;
}

export function QueueTicket({ entry, onCall, onComplete, className }: QueueTicketProps) {
    const displayWait = entry.status === "completed" ? "—" : `${entry.estimatedWait ?? 0} min`;

    return (
        <div
            className={cn(
                "flex items-center gap-3 rounded-lg border p-3 transition-all",
                entry.status === "serving" && "border-primary/40 bg-primary/5",
                entry.status === "called" && "border-amber-500/40 bg-amber-500/5 animate-pulse",
                entry.status === "waiting" && "border-border/50 bg-card hover:border-border",
                entry.status === "completed" && "border-border/30 bg-muted/30 opacity-60",
                entry.status === "no-show" && "border-red-500/30 bg-red-500/5 opacity-60",
                className
            )}
        >
            {/* Ticket number */}
            <div className="flex flex-col items-center justify-center min-w-[52px]">
                <span className="text-lg font-bold tracking-tight">{entry.ticketNo}</span>
                <span className={cn("h-1 w-8 rounded-full mt-1", serviceColors[entry.service] || "bg-muted")} />
            </div>

            <div className="h-10 w-px bg-border/60" />

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-0.5">
                <p className="text-sm font-medium truncate">{entry.patientName}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="capitalize">{entry.service}</span>
                    {entry.window && (
                        <span className="font-medium text-foreground">· {entry.window}</span>
                    )}
                </div>
            </div>

            {/* Wait time */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Timer className="h-3 w-3" />
                <span>{displayWait}</span>
            </div>

            {/* Status */}
            <StatusBadge status={entry.status} />

            {/* Actions */}
            {entry.status === "waiting" && onCall && (
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => onCall(entry.id)}>
                    Call <ArrowRight className="h-3 w-3" />
                </Button>
            )}
            {(entry.status === "serving" || entry.status === "called") && onComplete && (
                <Button size="sm" className="h-7 text-xs shrink-0" onClick={() => onComplete(entry.id)}>
                    Done
                </Button>
            )}
        </div>
    );
}
