"use client";

import { cn } from "@/lib/utils";
import { AlertTriangle, ArrowUp, ArrowDown, Minus, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ResultItem } from "@/types";

const flagConfig = {
    normal: { color: "text-emerald-600", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle2, label: "Normal" },
    high: { color: "text-amber-600", bg: "bg-amber-500/10 border-amber-500/30", icon: ArrowUp, label: "High" },
    low: { color: "text-sky-600", bg: "bg-sky-500/10 border-sky-500/30", icon: ArrowDown, label: "Low" },
    critical: { color: "text-red-600", bg: "bg-red-500/10 border-red-500/30", icon: AlertTriangle, label: "Critical" },
};

interface ResultCardProps {
    result: ResultItem;
    className?: string;
    compact?: boolean;
}

export function ResultCard({ result, className, compact = false }: ResultCardProps) {
    const cfg = flagConfig[result.flag];
    const Icon = cfg.icon;

    if (compact) {
        return (
            <div className={cn("flex items-center gap-3 p-2.5 rounded-lg border", cfg.bg, className)}>
                <Icon className={cn("h-4 w-4 shrink-0", cfg.color)} />
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{result.testName}</p>
                    <p className="text-xs text-muted-foreground">{result.patientName}</p>
                </div>
                <div className="text-right shrink-0">
                    <p className={cn("text-sm font-bold", cfg.color)}>{result.value} <span className="text-xs font-normal text-muted-foreground">{result.unit}</span></p>
                    <p className="text-[10px] text-muted-foreground">{result.referenceRange}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={cn("rounded-lg border p-4 space-y-2", cfg.bg, className)}>
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={cn("h-4 w-4", cfg.color)} />
                    <div>
                        <p className="text-sm font-semibold">{result.testName}</p>
                        <p className="text-xs text-muted-foreground">{result.patientName} · {new Date(result.reportedAt).toLocaleString()}</p>
                    </div>
                </div>
                <Badge variant="outline" className={cn("text-[10px]", cfg.color)}>{cfg.label}</Badge>
            </div>
            <div className="flex items-baseline gap-2">
                <span className={cn("text-2xl font-bold", cfg.color)}>{result.value}</span>
                <span className="text-sm text-muted-foreground">{result.unit}</span>
                <span className="text-xs text-muted-foreground ml-2">Ref: {result.referenceRange}</span>
            </div>
            {result.notes && (
                <p className="text-xs text-muted-foreground italic border-t pt-2 mt-1">{result.notes}</p>
            )}
            {!result.reviewedBy && (
                <div className="flex items-center gap-1 text-xs text-amber-600">
                    <Clock className="h-3 w-3" /> Awaiting review
                </div>
            )}
        </div>
    );
}
