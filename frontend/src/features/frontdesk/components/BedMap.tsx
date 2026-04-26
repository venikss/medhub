"use client";

import { cn } from "@/lib/utils";
import { BedDouble, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BedInfo } from "@/types";

const statusConfig: Record<string, { color: string; label: string }> = {
    available: { color: "bg-emerald-500", label: "Available" },
    occupied: { color: "bg-sky-500", label: "Occupied" },
    reserved: { color: "bg-amber-500", label: "Reserved" },
    maintenance: { color: "bg-slate-400", label: "Maintenance" },
};

interface BedMapProps {
    beds: BedInfo[];
    wardFilter?: string | null;
    onBedClick?: (bed: BedInfo) => void;
    className?: string;
}

export function BedMap({ beds, wardFilter, onBedClick, className }: BedMapProps) {
    const wards = [...new Set(beds.map((b) => b.ward))];
    const filteredWards = wardFilter ? wards.filter((w) => w === wardFilter) : wards;

    return (
        <div className={cn("space-y-5", className)}>
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
                {Object.entries(statusConfig).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-1.5">
                        <span className={cn("h-2.5 w-2.5 rounded-full", val.color)} />
                        <span className="text-muted-foreground">{val.label}</span>
                    </div>
                ))}
            </div>

            {filteredWards.map((ward) => {
                const wardBeds = beds.filter((b) => b.ward === ward);
                const summary = {
                    total: wardBeds.length,
                    available: wardBeds.filter((b) => b.status === "available").length,
                    occupied: wardBeds.filter((b) => b.status === "occupied").length,
                };
                return (
                    <div key={ward} className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">{ward}</h4>
                            <span className="text-xs text-muted-foreground">
                                {summary.available} available / {summary.total} total
                            </span>
                        </div>
                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                            {wardBeds.map((bed) => {
                                const cfg = statusConfig[bed.status];
                                return (
                                    <button
                                        key={bed.bedId}
                                        onClick={() => onBedClick?.(bed)}
                                        disabled={bed.status === "maintenance"}
                                        className={cn(
                                            "relative flex flex-col items-center justify-center rounded-lg border p-2.5 text-center transition-all min-h-[72px]",
                                            bed.status === "available" && "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/60 cursor-pointer",
                                            bed.status === "occupied" && "border-sky-500/40 bg-sky-500/5 hover:bg-sky-500/10 cursor-pointer",
                                            bed.status === "reserved" && "border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer",
                                            bed.status === "maintenance" && "border-slate-300/40 bg-slate-100/50 opacity-50 cursor-not-allowed"
                                        )}
                                    >
                                        <span className={cn("h-1.5 w-1.5 rounded-full absolute top-1.5 right-1.5", cfg.color)} />
                                        <BedDouble className="h-4 w-4 text-muted-foreground mb-1" />
                                        <span className="text-[11px] font-semibold">{bed.roomNumber}-{bed.bedNumber}</span>
                                        {bed.patientName && (
                                            <span className="text-[9px] text-muted-foreground truncate w-full mt-0.5">
                                                {bed.patientName.split(" ")[0]}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
