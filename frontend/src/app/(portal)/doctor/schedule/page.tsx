"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { StatCard } from "@/components/molecules/StatCard";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listDoctorAppointments, type DoctorAppointment } from "@/features/doctor/api";

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDayLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function SchedulePage() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const today = useMemo(() => new Date(), []);
  const days = useMemo(
    () => [-1, 0, 1].map((offset) => isoDate(new Date(today.getTime() + offset * 24 * 60 * 60 * 1000))),
    [today],
  );
  const [selectedDate, setSelectedDate] = useState(days[1] ?? isoDate(today));
  const [appointments, setAppointments] = useState<DoctorAppointment[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    void listDoctorAppointments(
      { doctorId: user.id, date: selectedDate },
      token ?? undefined,
    )
      .then((data) => {
        if (!cancelled) setAppointments(data);
      })
      .catch(() => {
        if (!cancelled) setAppointments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, token, user?.id]);

  const scheduled = appointments.filter((a) => a.status === "scheduled").length;
  const inProgress = appointments.filter((a) => a.status === "in-progress").length;
  const currentIdx = days.indexOf(selectedDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinic Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your daily appointments and clinic availability</p>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={currentIdx <= 0}
          onClick={() => setSelectedDate(days[currentIdx - 1])}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex gap-1.5">
          {days.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDate(day)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                selectedDate === day
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted"
              }`}
            >
              {formatDayLabel(day)}
            </button>
          ))}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          disabled={currentIdx >= days.length - 1}
          onClick={() => setSelectedDate(days[currentIdx + 1])}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Appointments" value={appointments.length} icon={CalendarDays} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Scheduled" value={scheduled} icon={CalendarDays} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="In Progress" value={inProgress} icon={CalendarDays} iconClassName="bg-cyan-500/10 text-cyan-600" />
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays className="h-4 w-4 text-primary" />
            {formatDayLabel(selectedDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No appointments scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {appointments.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={`/doctor/patients/${appointment.patientId}`}
                  className="flex items-center gap-4 rounded-lg border border-transparent p-3 transition-colors hover:border-border/50 hover:bg-muted/40"
                >
                  <div className="min-w-[56px] text-center">
                    <p className="text-sm font-bold">{appointment.time?.slice(0, 5) ?? "--:--"}</p>
                    <p className="text-[10px] text-muted-foreground">{appointment.duration} min</p>
                  </div>
                  <div className="h-10 w-px bg-border/60" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{appointment.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {appointment.department ?? "Clinic"} · <span className="capitalize">{appointment.type}</span>
                      {appointment.notes ? ` - ${appointment.notes}` : ""}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{appointment.type}</Badge>
                  <StatusBadge status={appointment.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
