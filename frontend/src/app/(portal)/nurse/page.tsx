"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BedDouble, Heart, AlertTriangle, ClipboardList, Pill, Sun, ArrowRight, Users } from "lucide-react";
import { StatCard } from "@/components/molecules/StatCard";
import { BedsideSummary } from "@/features/nurse/components/BedsideSummary";
import { TaskList } from "@/features/nurse/components/TaskList";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listMarEntries, listNursePatients, listNursingTasks, listVitals, completeTask, type NurseWardPatient } from "@/features/nurse/api";
import type { MAREntry, NursingTask, VitalEntry } from "@/types";

export default function NurseDashboard() {
  const token = useAuthStore((state) => state.token);
  const [patients, setPatients] = useState<NurseWardPatient[]>([]);
  const [tasks, setTasks] = useState<NursingTask[]>([]);
  const [marEntries, setMarEntries] = useState<MAREntry[]>([]);
  const [vitals, setVitals] = useState<VitalEntry[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listNursePatients(token ?? undefined),
      listNursingTasks({}, token ?? undefined),
      listMarEntries({}, token ?? undefined),
      listVitals({}, token ?? undefined),
    ])
      .then(([patientData, taskData, marData, vitalData]) => {
        if (!cancelled) {
          setPatients(patientData);
          setTasks(taskData);
          setMarEntries(marData);
          setVitals(vitalData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatients([]);
          setTasks([]);
          setMarEntries([]);
          setVitals([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const overdueTasks = useMemo(() => tasks.filter((task) => task.isOverdue), [tasks]);
  const overdueMeds = useMemo(() => marEntries.filter((entry) => entry.status === "overdue"), [marEntries]);
  const criticalPatients = useMemo(
    () => patients.filter((patient) => patient.acuity === "critical" || patient.status === "critical"),
    [patients],
  );
  const pendingTasks = useMemo(
    () => tasks.filter((task) => task.status === "pending" || task.status === "overdue"),
    [tasks],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nursing Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Clinical overview for your assigned patients</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700">
            <Sun className="h-3.5 w-3.5" /> Day Shift - 07:00-19:00
          </div>
        </div>
      </div>

      {(overdueTasks.length > 0 || overdueMeds.length > 0) && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <span className="font-semibold text-red-700">Attention Required: </span>
            {overdueTasks.length > 0 && (
              <span className="text-red-700">
                {overdueTasks.length} overdue task{overdueTasks.length > 1 ? "s" : ""}
              </span>
            )}
            {overdueTasks.length > 0 && overdueMeds.length > 0 && <span className="text-red-700"> - </span>}
            {overdueMeds.length > 0 && (
              <span className="text-red-700">
                {overdueMeds.length} overdue medication{overdueMeds.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="My Patients" value={patients.length} icon={BedDouble} iconClassName="bg-teal-500/10 text-teal-600" />
        <StatCard title="Critical" value={criticalPatients.length} icon={Heart} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Overdue Tasks" value={overdueTasks.length} icon={AlertTriangle} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="Pending Tasks" value={pendingTasks.length} icon={ClipboardList} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="Overdue Meds" value={overdueMeds.length} icon={Pill} iconClassName="bg-orange-500/10 text-orange-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <Users className="h-4 w-4 text-primary" /> My Patients
            </h2>
            <Link href="/nurse/ward" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Ward Census <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
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

              return (
                <BedsideSummary
                  key={patient.id}
                  patient={patient}
                  nextTask={nextTask}
                  overdueTasks={overdueCount}
                  lastVitals={lastVitalsTime}
                />
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          <TaskList
            tasks={tasks.filter((task) => task.status !== "completed").slice(0, 8)}
            title="Upcoming Tasks"
            onComplete={async (taskId) => {
              try {
                await completeTask(taskId, undefined, token ?? undefined);
                const refreshed = await listNursingTasks({}, token ?? undefined);
                setTasks(refreshed);
              } catch (err) {
                console.error("Failed to complete task:", err);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
