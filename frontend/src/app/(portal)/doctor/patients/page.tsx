"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BedDouble, ChevronRight, Clock, Search, Stethoscope, UserRound } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {} from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { type DoctorAdmission, type DoctorAppointment, listAdmissions, listDoctorAppointments } from "@/features/doctor/api";

const filters = ["all", "admitted", "critical", "active"] as const;

type DoctorPatientRow = {
  id: string;
  patientId: string;
  firstName: string;
  lastName: string;
  patientName: string;
  mrn?: string;
  status: string;
  ward?: string | null;
  roomNumber?: string | null;
  diagnosis?: string | null;
  admittedAt?: string | null;
};

function splitName(fullName: string) {
  const [firstName = "", ...rest] = fullName.split(" ");
  return { firstName, lastName: rest.join(" ") };
}

function MyPatientsPage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [admissions, setAdmissions] = useState<DoctorAdmission[]>([]);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const doctorId = user?.id;

  useEffect(() => {
    let cancelled = false;

    if (!doctorId) {
      return;
    }

    void listAdmissions({ status: "admitted", doctorId }, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setAdmissions(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAdmissions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doctorId, token]);

  useEffect(() => {
    if (!doctorId) {
      return;
    }

    let cancelled = false;

    void listDoctorAppointments({ doctorId }, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setAppointments(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppointments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [doctorId, token]);

  const rows = (() => {
    const map = new Map<string, DoctorPatientRow>();

    admissions
      .filter((item) => !doctorId || item.assignedDoctorId === doctorId || item.admittingDoctorId === doctorId)
      .forEach((item) => {
        const { firstName, lastName } = splitName(item.patientName);
        map.set(item.patientId, {
          id: item.id,
          patientId: item.patientId,
          firstName,
          lastName,
          patientName: item.patientName,
          mrn: item.mrn,
          status: item.ward?.toLowerCase().includes("icu") ? "critical" : "admitted",
          ward: item.ward,
          roomNumber: item.bed,
          diagnosis: item.reasonForAdmission,
          admittedAt: item.admittedAt,
        });
      });

    appointments.forEach((item) => {
      if (map.has(item.patientId)) {
        return;
      }
      const { firstName, lastName } = splitName(item.patientName);
      map.set(item.patientId, {
        id: item.id,
        patientId: item.patientId,
        firstName,
        lastName,
        patientName: item.patientName,
        status: item.status === "in-progress" ? "active" : "stable",
        diagnosis: item.notes,
      });
    });

    return Array.from(map.values());
  })();

  const patients = rows
    .filter((patient) => filter === "all" || patient.status === filter)
    .filter((patient) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        patient.firstName.toLowerCase().includes(q) ||
        patient.lastName.toLowerCase().includes(q) ||
        patient.patientName.toLowerCase().includes(q) ||
        (patient.mrn ?? "").toLowerCase().includes(q)
      );
    });

  function timeSince(dateStr?: string | null): string {
    if (!dateStr) return "";
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  const acuityColors: Record<string, string> = {
    critical: "bg-red-500 text-white",
    admitted: "bg-sky-500 text-white",
    active: "bg-emerald-500 text-white",
    stable: "bg-slate-400 text-white",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Patients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Admitted and outpatient panel for {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || "the current doctor"}
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or MRN..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 pl-10"
          />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${filter === item ? "border-primary bg-primary text-primary-foreground" : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted"}`}
            >
              {item === "all" ? `All (${rows.length})` : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {patients.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
            <UserRound className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm font-medium">No patients match this filter</p>
            <p className="text-xs text-muted-foreground/70">Admitted patients and appointments will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {patients.map((patient) => {
            const acuityClass = acuityColors[patient.status] ?? acuityColors.stable;
            const initials = `${(patient.firstName[0] ?? "").toUpperCase()}${(patient.lastName[0] ?? "").toUpperCase()}`;
            return (
              <Link
                key={patient.patientId}
                href={`/doctor/patients/${patient.patientId}`}
                className="group relative flex flex-col gap-0 rounded-xl border border-border/50 bg-card shadow-sm transition-all hover:border-primary/40 hover:shadow-md overflow-hidden"
              >
                {/* Acuity color top bar */}
                <div className={`h-1.5 w-full ${patient.status === "critical" ? "bg-red-500" : patient.status === "admitted" ? "bg-sky-500" : patient.status === "active" ? "bg-emerald-500" : "bg-slate-300"}`} />

                <div className="flex items-start gap-4 p-4">
                  {/* Avatar */}
                  <Avatar className="h-12 w-12 shrink-0 border-2 border-border/50">
                    <AvatarFallback className={`text-sm font-bold ${patient.status === "critical" ? "bg-red-500/15 text-red-600" : "bg-primary/10 text-primary"}`}>
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold leading-tight">{patient.patientName}</p>
                        <span className="mt-0.5 inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{patient.mrn ?? "—"}</span>
                      </div>
                      <StatusBadge status={patient.status} />
                    </div>

                    {/* Location */}
                    {(patient.ward || patient.roomNumber) && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <BedDouble className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                        <span>{[patient.ward, patient.roomNumber ? `Bed ${patient.roomNumber}` : null].filter(Boolean).join(" · ")}</span>
                      </div>
                    )}

                    {/* Diagnosis */}
                    {patient.diagnosis && (
                      <div className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
                        <Stethoscope className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                        <span className="line-clamp-2">{patient.diagnosis}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-border/30 bg-muted/20 px-4 py-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>{timeSince(patient.admittedAt) || "—"}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-primary transition-colors group-hover:text-primary/80">
                    View Chart <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MyPatientsPageWrapper() {
  return (
    <Suspense>
      <MyPatientsPage />
    </Suspense>
  );
}
