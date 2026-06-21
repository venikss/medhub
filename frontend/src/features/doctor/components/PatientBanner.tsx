"use client";

import { AlertTriangle, Phone, Calendar, Droplets, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { cn } from "@/lib/utils";
import type { Patient } from "@/types";

interface PatientBannerProps {
    patient: Patient & { diagnosis?: string };
    className?: string;
}

export function PatientBanner({ patient, className }: PatientBannerProps) {
    const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();

    return (
        <div className={cn("rounded-lg border bg-card p-4", className)}>
            <div className="flex items-start gap-4 flex-wrap">
                {/* Avatar + Name */}
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold shrink-0",
                        patient.status === "critical" ? "bg-red-500/15 text-red-600" : "bg-primary/10 text-primary"
                    )}>
                        {patient.firstName[0]}{patient.lastName[0]}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-base font-bold">{patient.firstName} {patient.lastName}</h2>
                            <StatusBadge status={patient.status} />
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-mono">{patient.mrn}</span>
                            <span>·</span>
                            <span>{patient.gender === "male" ? "M" : patient.gender === "female" ? "F" : "O"} · {age}y</span>
                            <span>·</span>
                            <span className="flex items-center gap-0.5"><Calendar className="h-3 w-3" />{patient.dateOfBirth}</span>
                        </div>
                    </div>
                </div>

                <div className="h-10 w-px bg-border/60 hidden sm:block" />

                {/* Info chips */}
                <div className="flex flex-wrap items-center gap-2 flex-1">
                    {patient.bloodType && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-red-500/10 text-red-700 border border-red-500/20 px-2 py-0.5 rounded-full">
                            <Droplets className="h-3 w-3" /> {patient.bloodType}
                        </span>
                    )}
                    {patient.ward && (
                        <span className="text-[11px] font-medium bg-sky-500/10 text-sky-700 border border-sky-500/20 px-2 py-0.5 rounded-full">
                            {patient.ward} · Rm {patient.roomNumber}
                        </span>
                    )}
                    {patient.diagnosis && (
                        <span className="text-[11px] font-medium bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 px-2 py-0.5 rounded-full max-w-[240px] truncate">
                            {patient.diagnosis}
                        </span>
                    )}
                </div>

                {/* Allergies — always visible */}
                <div className="shrink-0">
                    {(() => { const al = Array.isArray(patient.allergies) ? patient.allergies : typeof patient.allergies === "string" && patient.allergies ? patient.allergies.split(",").map((s: string) => s.trim()).filter(Boolean) : []; return al.length > 0 ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/25">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                            <div className="flex flex-wrap gap-1">
                                {al.map((a: any, i: number) => (
                                    <Badge key={i} variant="destructive" className="text-[10px] px-1.5 py-0">
                                        {typeof a === "string" ? a : (a.substance ?? a.reaction ?? String(a))}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                            <Shield className="h-3 w-3" /> NKDA
                        </span>
                    ); })()}
                </div>
            </div>
        </div>
    );
}
