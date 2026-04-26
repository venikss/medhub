"use client";

import { useEffect, useState } from "react";
import { Users, CalendarDays, BedDouble, UserPlus, Clock, ArrowRight, Activity, Search } from "lucide-react";
import Link from "next/link";
import { StatCard } from "@/components/molecules/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { PatientSearchBar } from "@/features/frontdesk/components/PatientSearchBar";
import { getFrontDeskSummary, type FrontDeskSummaryResponse } from "@/features/frontdesk/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";

export default function FrontDeskDashboard() {
    const token = useAuthStore((state) => state.token);
    const [summary, setSummary] = useState<FrontDeskSummaryResponse | null>(null);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            try {
                const data = await getFrontDeskSummary(token);
                if (!cancelled) {
                    setSummary(data);
                }
            } catch {
                if (!cancelled) {
                    setSummary(null);
                }
            }
        };
        void run();
        return () => {
            cancelled = true;
        };
    }, [token]);

    const todayAppts = summary?.upcomingAppointments ?? [];
    const activeAdmissions = summary?.activeAdmissions ?? 0;
    const availableBeds = summary?.availableBeds ?? 0;
    const waitingQueue = summary?.queueHighlights ?? [];
    const avgWait = summary?.avgWaitTime ?? 0;
    const bedsByWard = summary?.bedsByWard ?? [];

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Front Desk Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">Patient registration & ADT management</p>
                </div>
                <Link href="/frontdesk/patients/register">
                    <Button className="gap-2">
                        <UserPlus className="h-4 w-4" /> Register Patient
                    </Button>
                </Link>
            </div>

            {/* Quick search */}
            <PatientSearchBar showShortcutHint />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Today's Appointments" value={todayAppts.length} icon={CalendarDays} iconClassName="bg-sky-500/10 text-sky-600" />
                <StatCard title="Active Admissions" value={activeAdmissions} icon={BedDouble} iconClassName="bg-cyan-500/10 text-cyan-600" />
                <StatCard title="Available Beds" value={availableBeds} icon={BedDouble} iconClassName="bg-emerald-500/10 text-emerald-600" />
                <StatCard title="Avg Wait Time" value={`${avgWait} min`} icon={Clock} trend={{ value: -12, label: "vs yesterday" }} iconClassName="bg-amber-500/10 text-amber-600" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Upcoming appointments */}
                <Card className="lg:col-span-3 border-border/50 shadow-sm">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <CalendarDays className="h-4 w-4 text-primary" />
                            Upcoming Today
                        </CardTitle>
                        <Link href="/frontdesk/appointments" className="text-xs text-primary hover:underline flex items-center gap-1">
                            View all <ArrowRight className="h-3 w-3" />
                        </Link>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {todayAppts.slice(0, 5).map((appt) => (
                                <div key={appt.id} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/40 transition-colors border border-transparent hover:border-border/50">
                                    <div className="text-center min-w-[48px]">
                                        <p className="text-sm font-bold">{appt.time}</p>
                                        <p className="text-[10px] text-muted-foreground">{appt.duration}min</p>
                                    </div>
                                    <div className="h-8 w-px bg-border/60" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{appt.patientName}</p>
                                        <p className="text-xs text-muted-foreground">{appt.doctorName} · {appt.department}</p>
                                    </div>
                                    <StatusBadge status={appt.status} />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Bed occupancy + Queue */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <BedDouble className="h-4 w-4 text-primary" />
                                Bed Occupancy
                            </CardTitle>
                            <Link href="/frontdesk/admissions" className="text-xs text-primary hover:underline flex items-center gap-1">
                                ADT Board <ArrowRight className="h-3 w-3" />
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {bedsByWard.map((data) => (
                                    <div key={data.ward} className="space-y-1.5">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="font-medium">{data.ward}</span>
                                            <span className="text-xs text-muted-foreground">
                                                {data.available} avail / {data.total}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all ${data.total > 0 && data.occupied / data.total > 0.85 ? "bg-red-500" :
                                                        data.total > 0 && data.occupied / data.total > 0.7 ? "bg-amber-500" : "bg-emerald-500"
                                                    }`}
                                                style={{ width: `${data.total > 0 ? (data.occupied / data.total) * 100 : 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Queue ({waitingQueue.length} waiting)
                            </CardTitle>
                            <Link href="/frontdesk/queue" className="text-xs text-primary hover:underline flex items-center gap-1">
                                Full queue <ArrowRight className="h-3 w-3" />
                            </Link>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {waitingQueue.slice(0, 4).map((q) => (
                                    <div key={q.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/40">
                                        <span className="text-sm font-bold min-w-[40px]">{q.ticketNo}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm truncate">{q.patientName}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{q.service}</p>
                                        </div>
                                        <StatusBadge status={q.priority} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
