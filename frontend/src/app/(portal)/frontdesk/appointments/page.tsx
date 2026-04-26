"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { StatCard } from "@/components/molecules/StatCard";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createAppointment, listAppointments, searchPatients, updateAppointmentStatus } from "@/features/frontdesk/api";
import type { ADTPatient, Appointment } from "@/types";

const departments = ["All", "Internal Medicine", "Cardiology", "Neurology", "Surgery", "Orthopedics"];
const timeSlots = ["08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00"];

export default function AppointmentsPage() {
  const token = useAuthStore((state) => state.token);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [deptFilter, setDeptFilter] = useState("All");
  const [showBooking, setShowBooking] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientMatches, setPatientMatches] = useState<ADTPatient[]>([]);
  const [bookForm, setBookForm] = useState({
    patientName: "",
    patientId: "",
    doctor: "",
    doctorId: "",
    department: "",
    date: new Date().toISOString().slice(0, 10),
    time: "",
    duration: "30",
    type: "consultation",
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;

    void listAppointments({ date: selectedDate }, token ?? undefined)
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
  }, [selectedDate, token]);

  useEffect(() => {
    if (!showBooking || bookForm.patientName.trim().length < 2) {
      return;
    }

    let cancelled = false;
    const handle = window.setTimeout(() => {
      void searchPatients(bookForm.patientName, token ?? undefined)
        .then((matches) => {
          if (!cancelled) {
            setPatientMatches(matches);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setPatientMatches([]);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [bookForm.patientName, showBooking, token]);

  const dayAppointments = appointments;
  const filtered = deptFilter === "All" ? dayAppointments : dayAppointments.filter((appointment) => appointment.department === deptFilter);
  const scheduled = dayAppointments.filter((appointment) => appointment.status === "scheduled").length;
  const completed = dayAppointments.filter((appointment) => appointment.status === "completed").length;
  const inProgress = dayAppointments.filter((appointment) => appointment.status === "in-progress").length;

  const doctorOptions = useMemo(
    () =>
      Array.from(
        new Map(
          appointments
            .filter((appointment) => appointment.doctorId && appointment.doctorName)
            .map((appointment) => [
              appointment.doctorId,
              {
                id: appointment.doctorId,
                name: appointment.doctorName,
                department: appointment.department,
              },
            ]),
        ).values(),
      ),
    [appointments],
  );

  const visiblePatientMatches =
    showBooking && bookForm.patientName.trim().length >= 2 ? patientMatches : [];

  const canBook = Boolean(bookForm.patientId && bookForm.doctorId && bookForm.time);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Appointment Scheduler</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage and book patient appointments</p>
        </div>
        <Button className="gap-2" onClick={() => setShowBooking(!showBooking)}>
          <Plus className="h-4 w-4" /> Book Appointment
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Total Today" value={dayAppointments.length} icon={CalendarDays} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Scheduled" value={scheduled} icon={Clock} iconClassName="bg-amber-500/10 text-amber-600" />
        <StatCard title="In Progress" value={inProgress} icon={User} iconClassName="bg-cyan-500/10 text-cyan-600" />
        <StatCard title="Completed" value={completed} icon={CalendarDays} iconClassName="bg-emerald-500/10 text-emerald-600" />
      </div>

      {showBooking && (
        <Card className="border-primary/30 shadow-sm bg-primary/[0.02]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">New Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Patient Name</label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Search patient..."
                  value={bookForm.patientName}
                  onChange={(event) => setBookForm({ ...bookForm, patientName: event.target.value, patientId: "" })}
                />
                {visiblePatientMatches.length > 0 && (
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={bookForm.patientId}
                    onChange={(event) => {
                      const selected = visiblePatientMatches.find((match) => match.id === event.target.value);
                      setBookForm((current) => ({
                        ...current,
                        patientId: event.target.value,
                        patientName: selected ? `${selected.firstName} ${selected.lastName}` : current.patientName,
                      }));
                    }}
                  >
                    <option value="">Select patient...</option>
                    {visiblePatientMatches.map((match) => (
                      <option key={match.id} value={match.id}>
                        {match.firstName} {match.lastName} ({match.mrn})
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Doctor</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={bookForm.doctorId}
                  onChange={(event) => {
                    const selected = doctorOptions.find((option) => option.id === event.target.value);
                    setBookForm((current) => ({
                      ...current,
                      doctorId: event.target.value,
                      doctor: selected?.name ?? "",
                      department: selected?.department ?? current.department,
                    }));
                  }}
                >
                  <option value="">Select doctor...</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input type="date" className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={bookForm.date} onChange={(event) => setBookForm({ ...bookForm, date: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Time</label>
                <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={bookForm.time} onChange={(event) => setBookForm({ ...bookForm, time: event.target.value })}>
                  <option value="">Select time...</option>
                  {timeSlots.map((slot) => <option key={slot}>{slot}</option>)}
                </select>
              </div>
            </div>
            {!doctorOptions.length && (
              <p className="text-xs text-muted-foreground mt-3">
                Doctors are populated from existing appointment data on this screen.
              </p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setShowBooking(false)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!canBook}
                onClick={() => {
                  if (!canBook) return;
                  void createAppointment(
                    {
                      patientId: bookForm.patientId,
                      doctorId: bookForm.doctorId,
                      date: bookForm.date,
                      time: bookForm.time,
                      duration: Number(bookForm.duration),
                      type: bookForm.type,
                      notes: bookForm.notes,
                    },
                    token ?? undefined,
                  )
                    .then((created) => {
                      setAppointments((current) => [...current, created]);
                      setShowBooking(false);
                    })
                    .catch(() => {});
                }}
              >
                Book Appointment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Date:</label>
          <input type="date" className="flex h-8 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {departments.map((department) => (
            <button key={department} onClick={() => setDeptFilter(department)} className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${deptFilter === department ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"}`}>
              {department}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Schedule - {new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No appointments for this day/filter</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((appointment) => (
                <div key={appointment.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50">
                  <div className="text-center min-w-[52px]">
                    <p className="text-sm font-bold">{appointment.time}</p>
                    <p className="text-[10px] text-muted-foreground">{appointment.duration}min</p>
                  </div>
                  <div className="h-10 w-px bg-border/60" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{appointment.patientName}</p>
                    <p className="text-xs text-muted-foreground">{appointment.doctorName} · {appointment.department}</p>
                    {appointment.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{appointment.notes}</p>}
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">{appointment.type}</Badge>
                  <StatusBadge status={appointment.status} />
                  {appointment.status === "scheduled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        void updateAppointmentStatus(appointment.id, "in-progress", token ?? undefined)
                          .then((updated) => {
                            setAppointments((current) => current.map((item) => (item.id === appointment.id ? { ...item, status: updated.status } : item)));
                          })
                          .catch(() => {});
                      }}
                    >
                      Check In
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
