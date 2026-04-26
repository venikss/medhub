"use client";

import { AlertTriangle, X, Merge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { DuplicateCandidate } from "@/types";

interface DuplicateWarningProps {
    candidates: DuplicateCandidate[];
    onDismiss?: (index: number) => void;
    onMerge?: (candidate: DuplicateCandidate) => void;
}

export function DuplicateWarning({ candidates, onDismiss, onMerge }: DuplicateWarningProps) {
    if (candidates.length === 0) return null;

    return (
        <div className="space-y-2">
            {candidates.map((dup, idx) => (
                <Card key={idx} className="border-amber-500/40 bg-amber-500/5 shadow-none">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/15 shrink-0 mt-0.5">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                                    Potential duplicate — {dup.matchScore}% match
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    Existing patient: <span className="font-medium text-foreground">{dup.patientB.firstName} {dup.patientB.lastName}</span> ({dup.patientB.mrn}) · DOB: {dup.patientB.dateOfBirth}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {dup.matchReasons.map((r) => (
                                        <span key={r} className="text-[10px] bg-amber-500/10 text-amber-700 border border-amber-500/20 px-1.5 py-0.5 rounded-full">{r}</span>
                                    ))}
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                {onMerge && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => onMerge(dup)}>
                                        <Merge className="h-3 w-3" /> Review
                                    </Button>
                                )}
                                {onDismiss && (
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDismiss(idx)}>
                                        <X className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
