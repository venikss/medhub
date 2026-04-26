"use client";

import { useEffect, useState } from "react";
import { Pill, AlertTriangle, CheckCircle2, Clock, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/molecules/StatCard";
import { MARTimeline } from "@/features/nurse/components/MARTimeline";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listMarEntries, listNursePatients, administerMedication, updateMARStatus, type NurseWardPatient } from "@/features/nurse/api";
import type { MAREntry } from "@/types";
import { cn } from "@/lib/utils";

const statusFilters = ["all", "overdue", "scheduled", "given", "missed"] as const;

export default function MedAdminPage() {
  const token = useAuthStore((state) => state.token);
  const [selectedPatient, setSelectedPatient] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [patients, setPatients] = useState<NurseWardPatient[]>([]);
  const [marEntries, setMarEntries] = useState<MAREntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listNursePatients(token ?? undefined),
      listMarEntries({}, token ?? undefined),
    ])
      .then(([patientData, entries]) => {
        if (!cancelled) {
          setPatients(patientData);
          setMarEntries(entries);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatients([]);
          setMarEntries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const entries = marEntries
    .filter((entry) => selectedPatient === "all" || entry.patientId === selectedPatient)
    .filter((entry) => filterStatus === "all" || entry.status === filterStatus)
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      return a.scheduledTime.localeCompare(b.scheduledTime);
    });

  const overdue = marEntries.filter((entry) => entry.status === "overdue").length;
  const scheduled = marEntries.filter((entry) => entry.status === "scheduled").length;
  const given = marEntries.filter((entry) => entry.status === "given").length;
  const missed = marEntries.filter((entry) => entry.status === "missed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Medication Administration</h1>
          <p className="mt-1 text-sm text-muted-foreground">eMAR - scan, verify, and document medication delivery</p>
        </div>
        <Button variant="outline" className="gap-2">
          <ScanLine className="h-4 w-4" /> Open Barcode Scanner
        </Button>
      </div>

      {overdue > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <span className="font-semibold text-red-700">
            {overdue} medication{overdue > 1 ? "s" : ""} overdue - requires immediate attention
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard title="Given" value={given} icon={CheckCircle2} iconClassName="bg-emerald-500/10 text-emerald-600" />
        <StatCard title="Scheduled" value={scheduled} icon={Clock} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Overdue" value={overdue} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Missed/Refused" value={missed} icon={Pill} iconClassName="bg-amber-500/10 text-amber-600" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedPatient("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              selectedPatient === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            All Patients
          </button>
          {patients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => setSelectedPatient(patient.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                selectedPatient === patient.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {patient.roomNumber} - {patient.firstName}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {statusFilters.map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-medium capitalize transition-colors",
                filterStatus === status
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <MARTimeline
        entries={entries}
        onAdminister={async (id) => {
          await administerMedication(id, {}, token ?? undefined);
          const refreshed = await listMarEntries({}, token ?? undefined);
          setMarEntries(refreshed);
        }}
        onStatusChange={async (id, status, reason) => {
          await updateMARStatus(id, status, reason, token ?? undefined);
          const refreshed = await listMarEntries({}, token ?? undefined);
          setMarEntries(refreshed);
        }}
      />
    </div>
  );
}
