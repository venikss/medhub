"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listDischargeChecklist, listNursePatients, type NurseWardPatient, updateDischargeChecklistItem } from "@/features/nurse/api";
import type { DischargeChecklistItem } from "@/types";
import { cn } from "@/lib/utils";

const categoryEmoji: Record<string, string> = {
  medical: "",
  nursing: "",
  pharmacy: "",
  education: "",
  social: "",
  transport: "",
};

export default function DischargeChecklistPage() {
  const token = useAuthStore((state) => state.token);
  const [patients, setPatients] = useState<NurseWardPatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [checklist, setChecklist] = useState<DischargeChecklistItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listNursePatients(token ?? undefined)
      .then(async (patientData) => {
        if (cancelled) return;
        setPatients(patientData);

        const patientId = patientData[0]?.id ?? "";
        setSelectedPatientId(patientId);

        if (patientId) {
          const items = await listDischargeChecklist(patientId, token ?? undefined);
          if (!cancelled) {
            setChecklist(items);
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatients([]);
          setChecklist([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const patient = patients.find((entry) => entry.id === selectedPatientId);
  const items = checklist.filter((entry) => entry.patientId === selectedPatientId);
  const completed = items.filter((entry) => entry.completed).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const grouped = items.reduce<Record<string, DischargeChecklistItem[]>>((accumulator, item) => {
    if (!accumulator[item.category]) {
      accumulator[item.category] = [];
    }
    accumulator[item.category].push(item);
    return accumulator;
  }, {});

  async function loadChecklist(patientId: string) {
    setSelectedPatientId(patientId);
    const itemsData = await listDischargeChecklist(patientId, token ?? undefined);
    setChecklist(itemsData);
  }

  async function toggleItem(id: string) {
    const target = items.find((entry) => entry.id === id);
    if (!target || !selectedPatientId) return;

    const nextCompleted = !target.completed;
    setChecklist((prev) => prev.map((entry) => (entry.id === id ? { ...entry, completed: nextCompleted } : entry)));

    try {
      const updated = await updateDischargeChecklistItem(
        selectedPatientId,
        id,
        { completed: nextCompleted, notes: target.notes },
        token ?? undefined,
      );
      setChecklist((prev) => prev.map((entry) => (entry.id === id ? updated : entry)));
    } catch {
      setChecklist((prev) => prev.map((entry) => (entry.id === id ? target : entry)));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Discharge Checklist</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track discharge readiness for patients pending release</p>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="py-4">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {patients.map((entry) => (
              <button
                key={entry.id}
                onClick={() => void loadChecklist(entry.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  selectedPatientId === entry.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {entry.roomNumber} - {entry.firstName} {entry.lastName}
              </button>
            ))}
          </div>

          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {patient?.firstName?.[0] ?? ""}{patient?.lastName?.[0] ?? ""}
              </div>
              <div>
                <p className="text-sm font-semibold">{patient ? `${patient.firstName} ${patient.lastName}` : "No patient selected"}</p>
                <p className="text-xs text-muted-foreground">Rm {patient?.roomNumber ?? "-"} - {patient?.diagnosis ?? "Discharge checklist"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">{pct}%</p>
              <p className="text-[10px] text-muted-foreground">{completed}/{total} complete</p>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
          {pct < 100 && total > 0 && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700">
              <AlertTriangle className="h-3 w-3" />
              {total - completed} item{total - completed > 1 ? "s" : ""} remaining before discharge
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        {Object.entries(grouped).map(([category, categoryItems]) => {
          const allDone = categoryItems.every((item) => item.completed);
          return (
            <Card key={category} className={cn("border-border/50 shadow-sm", allDone && "opacity-70")}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold capitalize">
                  {category}
                  {allDone && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {categoryItems.filter((item) => item.completed).length}/{categoryItems.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {categoryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => void toggleItem(item.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
                        item.completed
                          ? "border-emerald-500/20 bg-emerald-500/[0.05]"
                          : "border-border/50 hover:bg-muted/40",
                      )}
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>{item.description}</p>
                        {item.completedBy && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {item.completedBy} - {item.completedAt ? new Date(item.completedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                          </p>
                        )}
                        {item.notes && <p className="mt-0.5 text-[10px] italic text-muted-foreground">{item.notes}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
