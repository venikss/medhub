"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Clock, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import type { PharmacyPrescription, RefillRecord } from "@/types";
import { cn } from "@/lib/utils";

type AllergyEntry = string | { substance?: string; reaction?: string; severity?: string };

interface MedicationProfileProps {
  patientName: string;
  allergies: AllergyEntry[];
  activeMeds: PharmacyPrescription[];
  refills: RefillRecord[];
  className?: string;
}

function allergyLabel(a: AllergyEntry): string {
  if (typeof a === "string") return a;
  return a.substance ?? a.reaction ?? JSON.stringify(a);
}

export function MedicationProfile({ patientName, allergies, activeMeds, refills, className }: MedicationProfileProps) {
  return (
    <Card className={cn("border-border/50 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Pill className="h-4 w-4 text-primary" /> {patientName}
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {allergies.length > 0 ? (
              allergies.map((a, i) => <Badge key={i} variant="destructive" className="text-[9px] px-1 py-0">{allergyLabel(a)}</Badge>)
            ) : (
              <Badge variant="outline" className="text-[9px] text-emerald-600">NKDA</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Active medications */}
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Active Medications</h4>
          <div className="space-y-1.5">
            {activeMeds.map((med) => (
              <div key={med.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{med.medication} {med.dosage}</p>
                  <p className="text-[10px] text-muted-foreground">{med.route} · {med.frequency} · {med.prescribedBy}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-[10px] capitalize">{med.setting}</Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Refills: {med.refillsRemaining}/{med.refillsAllowed}</p>
                </div>
              </div>
            ))}
            {activeMeds.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No active medications</p>}
          </div>
        </div>

        {/* Refill history */}
        {refills.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Refill History</h4>
            <div className="space-y-1">
              {refills.map((rf) => (
                <div key={rf.id} className="flex items-center gap-2 py-1.5 px-2 rounded text-xs border border-border/30 hover:bg-muted/30 transition-colors">
                  <RefreshCw className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                  <span className="font-medium">{rf.medication} {rf.dosage}</span>
                  <span className="text-muted-foreground">· Refill #{rf.refillNumber}/{rf.totalRefills}</span>
                  <span className="text-muted-foreground">· {rf.dispensedDate}</span>
                  <span className="text-muted-foreground">· Qty: {rf.quantity}</span>
                  {rf.nextRefillDate && (
                    <span className="text-muted-foreground ml-auto flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> Next: {rf.nextRefillDate}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
