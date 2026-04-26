"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BedDouble, Search, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/molecules/StatCard";
import { BedsideSummary } from "@/features/nurse/components/BedsideSummary";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listNursePatients, listNursingTasks, listVitals, type NurseWardPatient } from "@/features/nurse/api";
import { NursingCDSSPanel } from "@/features/cdss/components/modules/NursingCDSSPanel";
import { useCDSSDataHydration } from "@/features/cdss/hooks/useCDSSDataHydration";
import type { NursingTask, VitalEntry } from "@/types";
import { cn } from "@/lib/utils";

const acuityFilters = ["all", "critical", "high", "medium", "low"] as const;

export default function WardCensusPage() {
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const [selectedWard, setSelectedWard] = useState("All");
  const [acuityFilter, setAcuityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [patientsData, setPatientsData] = useState<NurseWardPatient[]>([]);
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [vitals, setVitals] = useState<VitalEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listNursePatients(token ?? undefined),
      listNursingTasks({}, token ?? undefined),
      listVitals({}, token ?? undefined),
    ])
      .then(([patients, taskData, vitalsData]) => {
        if (!cancelled) {
          setPatientsData(patients);
          setTasks(taskData);
          setVitals(vitalsData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatientsData([]);
          setTasks([]);
          setVitals([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const wards = ["All", ...Array.from(new Set(patientsData.map((p) => p.ward).filter((w): w is string => Boolean(w)))).sort()];

  const patients = patientsData
    .filter((patient) => selectedWard === "All" || patient.ward === selectedWard)
    .filter((patient) => acuityFilter === "all" || patient.acuity === acuityFilter)
    .filter((patient) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        patient.firstName.toLowerCase().includes(q) ||
        patient.lastName.toLowerCase().includes(q) ||
        patient.roomNumber?.toLowerCase().includes(q) ||
        patient.mrn.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const roomA = a.roomNumber || "";
      const roomB = b.roomNumber || "";
      return roomA.localeCompare(roomB);
    });

  const total = patientsData.length;
  const critical = patientsData.filter((patient) => patient.acuity === "critical").length;
  const selectedPatientId = searchParams.get("patient");
  const selectedPatient = useMemo(
    () => patients.find((patient) => patient.id === selectedPatientId) ?? patients[0] ?? null,
    [patients, selectedPatientId],
  );
  const { error: cdssFeedMessage } = useCDSSDataHydration({
    token,
    patientId: selectedPatient?.id,
    refreshPatientIds: selectedPatient?.id ? [selectedPatient.id] : [],
    refreshBeforeLoad: Boolean(selectedPatient?.id),
    includeOverrides: true,
    useMockOnError: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Ward Census</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bed-based patient overview for your assigned wards</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard title="Total Census" value={total} icon={BedDouble} iconClassName="bg-teal-500/10 text-teal-600" />
        <StatCard title="Critical Acuity" value={critical} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search by name, room, or MRN..." value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 pl-10" />
        </div>
        <div className="flex items-center gap-1.5">
          {wards.map((ward) => (
            <button
              key={ward}
              onClick={() => setSelectedWard(ward)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                selectedWard === ward
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {ward}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {acuityFilters.map((acuity) => (
            <button
              key={acuity}
              onClick={() => setAcuityFilter(acuity)}
              className={cn(
                "rounded-full border px-2 py-1 text-[10px] font-medium uppercase transition-colors",
                acuityFilter === acuity
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {acuity}
            </button>
          ))}
        </div>
      </div>

      {patients.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No patients matching filter.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {patients.map((patient) => {
              const patientTasks = tasks.filter((task) => task.patientId === patient.id);
              const overdueCount = patientTasks.filter((task) => task.isOverdue).length;
              const nextTask = patientTasks.find((task) => task.status === "pending" || task.status === "overdue");
              const latestVital = vitals
                .filter((entry) => entry.patientId === patient.id)
                .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
              const lastVitalsTime = latestVital
                ? new Date(latestVital.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : undefined;
              const isSelected = selectedPatient?.id === patient.id;

              return (
                <BedsideSummary
                  key={patient.id}
                  patient={patient}
                  nextTask={nextTask}
                  overdueTasks={overdueCount}
                  lastVitals={lastVitalsTime}
                  className={cn(isSelected && "ring-2 ring-primary/30 border-primary/40")}
                />
              );
            })}
          </div>

          <div className="space-y-3">
            {cdssFeedMessage && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                {cdssFeedMessage}
              </div>
            )}
            {selectedPatient ? (
              <>
                <Card className="border-border/50">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {selectedPatient.firstName} {selectedPatient.lastName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {selectedPatient.mrn} {selectedPatient.roomNumber ? `| Room ${selectedPatient.roomNumber}` : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Acuity</p>
                        <p className="text-xs font-medium capitalize">{selectedPatient.acuity ?? "unknown"}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <NursingCDSSPanel patientId={selectedPatient.id} />
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
