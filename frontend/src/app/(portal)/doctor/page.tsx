"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowRight, CalendarDays, FileText, Plus, Stethoscope, Users } from "lucide-react";
import { StatCard } from "@/components/molecules/StatCard";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { type DoctorAdmission, type DoctorAppointment, listAdmissions, listDoctorAppointments } from "@/features/doctor/api";

function formatVisitType(value?: string | null) {
  if (!value) return "Appointment";
  return value.replace(/-/g, " ");
}

export default function DoctorDashboard() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);
  const [admissions, setAdmissions] = useState<DoctorAdmission[]>([]);
  const doctorId = user?.id;

  useEffect(() => {
    if (!doctorId) {
      return;
    }

    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);

    void listDoctorAppointments(
      { doctorId, date: today },
      token ?? undefined,
    )
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

  const myAdmittedPatients = admissions.filter((item) => doctorId && (item.assignedDoctorId === doctorId || item.admittingDoctorId === doctorId));
  const criticalPatients = myAdmittedPatients.filter((item) => item.ward?.toLowerCase().includes("icu"));
  const inProgressAppointments = appointments.filter((item) => item.status === "in-progress");

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {user?.firstName ? `Good morning, ${user.firstName}` : "Doctor Dashboard"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Here&apos;s your clinical overview for today</p>
        </div>
        <div className="flex gap-2">
          <Link href="/doctor/encounters/new">
            <Button variant="outline" className="gap-2"><FileText className="h-4 w-4" /> New Note</Button>
          </Link>
          <Link href="/doctor/orders">
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Order</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="My Patients" value={myAdmittedPatients.length} icon={Users} iconClassName="bg-teal-500/10 text-teal-600" />
        <StatCard title="Today's Appointments" value={appointments.length} icon={CalendarDays} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Critical Patients" value={criticalPatients.length} icon={Stethoscope} iconClassName="bg-red-500/10 text-red-600" />
        <StatCard title="In Progress" value={inProgressAppointments.length} icon={Activity} iconClassName="bg-amber-500/10 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="border-border/50 shadow-sm lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays className="h-4 w-4 text-primary" />
              Today&apos;s Schedule
            </CardTitle>
            <Link href="/doctor/schedule" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Full schedule <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {appointments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No appointments scheduled for today.</p>
              ) : (
                appointments.map((appointment) => (
                  <Link
                    key={appointment.id}
                    href={`/doctor/patients/${appointment.patientId}`}
                    className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-border/50 hover:bg-muted/40"
                  >
                    <div className="min-w-[52px] text-center">
                      <p className="text-sm font-bold">
                        {appointment.time ? appointment.time.slice(0, 5) : "--:--"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{appointment.duration}min</p>
                    </div>
                    <div className="h-10 w-px bg-border/60" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{appointment.patientName}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {formatVisitType(appointment.type)}
                        {appointment.notes ? ` - ${appointment.notes}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={appointment.status} />
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Stethoscope className="h-4 w-4 text-primary" />
                Admitted Patients
              </CardTitle>
              <Link href="/doctor/patients" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {myAdmittedPatients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No admitted patients assigned.</p>
                ) : (
                  Array.from(new Set(myAdmittedPatients.map((p) => p.ward).filter((w): w is string => Boolean(w))))
                    .sort()
                    .map((wardName) => {
                      const patientsInWard = myAdmittedPatients.filter((p) => p.ward === wardName);
                      return (
                        <div key={wardName} className="space-y-2">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2 pl-1">
                            {wardName}
                          </p>
                          {patientsInWard.map((patient) => {
                            const names = patient.patientName.split(" ");
                            return (
                              <Link
                                key={patient.id}
                                href={`/doctor/patients/${patient.patientId}`}
                                className="flex items-center gap-3 rounded-lg p-2.5 transition-colors hover:bg-muted/40"
                              >
                                <Avatar className="h-8 w-8 border">
                                  <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                                    {(names[0]?.[0] ?? "").toUpperCase()}{(names[1]?.[0] ?? "").toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium">{patient.patientName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    Bed {patient.bed ?? "-"}
                                  </p>
                                </div>
                                <StatusBadge status={patient.ward?.toLowerCase().includes("icu") ? "critical" : "admitted"} />
                              </Link>
                            );
                          })}
                        </div>
                      );
                    })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
