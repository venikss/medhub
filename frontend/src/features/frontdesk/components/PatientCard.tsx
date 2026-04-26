"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Phone, Mail, Calendar, AlertTriangle, ChevronRight } from "lucide-react";
import type { ADTPatient } from "@/types";

interface PatientCardProps {
    patient: ADTPatient;
    className?: string;
    showActions?: boolean;
}

export function PatientCard({ patient, className, showActions = true }: PatientCardProps) {
    const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();

    return (
        <Link
            href={`/frontdesk/patients/${patient.id}`}
            className={cn(
                "group flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4 transition-all hover:shadow-md hover:border-primary/30",
                className
            )}
        >
            {/* Avatar */}
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold shrink-0">
                {patient.firstName[0]}{patient.lastName[0]}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate">{patient.firstName} {patient.lastName}</p>
                    {!patient.consentSigned && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="h-2.5 w-2.5" /> Consent pending
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">{patient.mrn}</span>
                    <span>{patient.gender === "male" ? "M" : patient.gender === "female" ? "F" : "O"} · {age}y</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{patient.dateOfBirth}</span>
                    <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>
                </div>
            </div>

            {/* Status + chevron */}
            <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={patient.status} />
                {showActions && <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />}
            </div>
        </Link>
    );
}
