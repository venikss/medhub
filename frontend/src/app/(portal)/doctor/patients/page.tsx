"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronRight, Search } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
        <div className="flex items-center gap-1.5">
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

      <div className="space-y-2">
        {patients.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No patients matching filter.</p>
            </CardContent>
          </Card>
        ) : (
          patients.map((patient) => (
            <Link
              key={patient.patientId}
              href={`/doctor/patients/${patient.patientId}`}
              className="group flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4 transition-all hover:border-primary/30 hover:shadow-md"
            >
              <Avatar className="h-10 w-10 border">
                <AvatarFallback className={`text-xs font-bold ${patient.status === "critical" ? "bg-red-500/15 text-red-600" : "bg-primary/10 text-primary"}`}>
                  {(patient.firstName[0] ?? "").toUpperCase()}{(patient.lastName[0] ?? "").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold">{patient.patientName}</p>
                </div>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                  {patient.mrn && <span className="font-mono">{patient.mrn}</span>}
                  {patient.ward && <><span>·</span><span>{patient.ward} Rm {patient.roomNumber ?? "-"}</span></>}
                  {patient.diagnosis && <><span>·</span><span className="max-w-[240px] truncate">{patient.diagnosis}</span></>}
                </div>
              </div>
              {patient.status === "critical" && (
                <Badge variant="destructive" className="text-[10px]">Critical</Badge>
              )}
              <StatusBadge status={patient.status} />
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 transition-colors group-hover:text-primary" />
            </Link>
          ))
        )}
      </div>
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
