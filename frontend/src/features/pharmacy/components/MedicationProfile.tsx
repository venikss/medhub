"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Clock, RefreshCw, XCircle, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import type { PharmacyPrescription, RefillRecord } from "@/types";
import { cn } from "@/lib/utils";

type AllergyEntry = string | { substance?: string; reaction?: string; severity?: string };

interface MedicationProfileProps {
  patientName: string;
  allergies: AllergyEntry[];
  activeMeds: PharmacyPrescription[];
  onHoldMeds?: PharmacyPrescription[];
  historyMeds?: PharmacyPrescription[];
  refills: RefillRecord[];
  className?: string;
}

function allergyLabel(a: AllergyEntry): string {
  if (typeof a === "string") return a;
  return a.substance ?? a.reaction ?? JSON.stringify(a);
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

export function MedicationProfile({ patientName, allergies, activeMeds, onHoldMeds = [], historyMeds = [], refills, className }: MedicationProfileProps) {
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
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
            Active Medications
            <span className="font-normal normal-case text-[10px]">({activeMeds.length})</span>
          </h4>
          <div className="space-y-1.5">
            {activeMeds.map((med) => (
              <div key={med.id} className="flex items-center gap-3 p-2 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                <Pill className="h-3.5 w-3.5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{med.medication} {med.dosage}</p>
                  <p className="text-[10px] text-muted-foreground">{med.route} · {med.frequency} · {med.prescribedBy}</p>
                  {med.prescribedAt && (
                    <p className="text-[10px] text-muted-foreground">Started: {formatDate(med.prescribedAt)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <StatusBadge status={med.status} />
                  <p className="text-[10px] text-muted-foreground mt-0.5">Refills: {med.refillsRemaining}/{med.refillsAllowed}</p>
                </div>
              </div>
            ))}
            {activeMeds.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">No active medications</p>}
          </div>
        </div>

        {/* On-hold medications */}
        {onHoldMeds.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Clock className="h-3 w-3 text-amber-500" />
              On Hold
              <span className="font-normal normal-case text-[10px]">({onHoldMeds.length})</span>
            </h4>
            <div className="space-y-1.5">
              {onHoldMeds.map((med) => (
                <div key={med.id} className="flex items-start gap-3 p-2 rounded-lg border border-amber-300/40 bg-amber-50/40">
                  <Clock className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{med.medication} {med.dosage}</p>
                    <p className="text-[10px] text-muted-foreground">{med.route} · {med.frequency} · {med.prescribedBy}</p>
                    {((med as any).holdReason || med.notes) && (
                      <p className="text-[10px] text-amber-700 mt-0.5">Hold reason: {(med as any).holdReason || med.notes}</p>
                    )}
                    {med.prescribedAt && (
                      <p className="text-[10px] text-muted-foreground">Prescribed: {formatDate(med.prescribedAt)}</p>
                    )}
                  </div>
                  <StatusBadge status={med.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Medication history (cancelled / returned) */}
        {historyMeds.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <XCircle className="h-3 w-3 text-slate-400" />
              Medication History
              <span className="font-normal normal-case text-[10px]">({historyMeds.length})</span>
            </h4>
            <div className="space-y-1.5">
              {historyMeds.map((med) => (
                <div key={med.id} className="flex items-start gap-3 p-2 rounded-lg border border-border/30 bg-muted/20 opacity-80">
                  <XCircle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground">{med.medication} {med.dosage}</p>
                    <p className="text-[10px] text-muted-foreground">{med.route} · {med.frequency} · {med.prescribedBy}</p>
                    {((med as any).holdReason || med.notes) && (
                      <p className="text-[10px] text-slate-500 mt-0.5">Reason: {(med as any).holdReason || med.notes}</p>
                    )}
                    <div className="flex items-center gap-3 mt-0.5">
                      {med.prescribedAt && (
                        <p className="text-[10px] text-muted-foreground">Ordered: {formatDate(med.prescribedAt)}</p>
                      )}
                      {(med.verifiedAt || med.dispensedAt) && (
                        <p className="text-[10px] text-muted-foreground">
                          Resolved: {formatDate(med.verifiedAt ?? med.dispensedAt)}
                        </p>
                      )}
                    </div>
                  </div>
                  <StatusBadge status={med.status} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Refill history */}
        {refills.length > 0 && (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <RefreshCw className="h-3 w-3" />
              Refill History
            </h4>
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
