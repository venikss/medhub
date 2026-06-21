"use client";

import { useEffect, useState } from "react";
import { Pill, AlertTriangle, CheckCircle2, Clock, ScanLine, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

      {/* Patient selector — mini cards */}
      <div className={patients.length > 0 ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : ""}>
        {patients.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
              <BedDouble className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm">No patients currently in your ward</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* All-patients card */}
            <button
              onClick={() => setSelectedPatient("all")}
              className={cn(
                "flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-all",
                selectedPatient === "all"
                  ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                  : "border-border/50 bg-card hover:border-primary/30 hover:shadow-sm",
              )}
            >
              <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold", selectedPatient === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                All
              </div>
              <div>
                <p className="text-xs font-semibold">All Patients</p>
                <p className="text-[10px] text-muted-foreground">{patients.length} patients</p>
              </div>
            </button>

            {patients.map((patient) => {
              const isSelected = selectedPatient === patient.id;
              const patientEntries = marEntries.filter((e) => e.patientId === patient.id);
              const overdueCount = patientEntries.filter((e) => e.status === "overdue").length;
              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatient(patient.id)}
                  className={cn(
                    "flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                      : overdueCount > 0
                        ? "border-red-300 bg-red-50 dark:bg-red-950/20 hover:border-red-400"
                        : "border-border/50 bg-card hover:border-primary/30 hover:shadow-sm",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold shrink-0", isSelected ? "bg-primary text-primary-foreground" : overdueCount > 0 ? "bg-red-500 text-white" : "bg-muted text-muted-foreground")}>
                        {patient.roomNumber ?? "?"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight">{patient.firstName} {patient.lastName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{patient.mrn}</p>
                      </div>
                    </div>
                    {overdueCount > 0 && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                        {overdueCount} overdue
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Pill className="h-3 w-3 shrink-0 text-indigo-400" />
                    <span>{patientEntries.length} medication{patientEntries.length !== 1 ? "s" : ""}</span>
                    {patient.diagnosis && <><span>·</span><span className="line-clamp-1 flex-1">{patient.diagnosis}</span></>}
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
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
