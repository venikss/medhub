"use client";

import { AlertTriangle, Lightbulb, ShieldAlert, Info, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface CDSSSuggestion {
    id: string;
    type: "alert" | "recommendation";
    severity: "critical" | "warning" | "info";
    title: string;
    message: string;
    source: string;
}

interface CDSSSidebarProps {
    suggestions: CDSSSuggestion[];
    className?: string;
}

const severityConfig = {
    critical: { icon: ShieldAlert, bg: "bg-red-500/10 border-red-500/30", titleColor: "text-red-700 dark:text-red-400", iconColor: "text-red-600" },
    warning: { icon: AlertTriangle, bg: "bg-amber-500/10 border-amber-500/30", titleColor: "text-amber-700 dark:text-amber-400", iconColor: "text-amber-600" },
    info: { icon: Lightbulb, bg: "bg-sky-500/10 border-sky-500/30", titleColor: "text-sky-700 dark:text-sky-400", iconColor: "text-sky-600" },
};

export function CDSSSidebar({ suggestions, className }: CDSSSidebarProps) {
    return (
        <Card className={cn("border-border/50 shadow-sm", className)}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    Clinical Decision Support
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
                {suggestions.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No active suggestions</p>
                ) : (
                    suggestions.map((item) => {
                        const cfg = severityConfig[item.severity];
                        const Icon = cfg.icon;
                        return (
                            <div key={item.id} className={cn("rounded-lg border p-3 space-y-1", cfg.bg)}>
                                <div className="flex items-start gap-2">
                                    <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", cfg.iconColor)} />
                                    <div className="flex-1 min-w-0">
                                        <p className={cn("text-xs font-semibold", cfg.titleColor)}>{item.title}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.message}</p>
                                        <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{item.source}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </CardContent>
        </Card>
    );
}
