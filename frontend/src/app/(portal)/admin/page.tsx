"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Users, Building2, Activity, ShieldCheck, BedDouble,
  FlaskConical, ScanLine, AlertTriangle, CheckCircle2, XCircle,
} from "lucide-react";
import { StatCard } from "@/components/molecules/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getAdminStats, listAdminUsers, listAuditLogs, listBeds, listDepartments } from "@/features/admin/api";
import { RoleBadge } from "@/features/admin/components/RoleBadge";
import { StatusChip } from "@/features/admin/components/StatusChip";

function toDisplayText(value: unknown, fallback = "Unknown") {
    if (typeof value === "string") {
        return value;
    }

    if (value && typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return fallback;
        }
    }

    if (value == null) {
        return fallback;
    }

    return String(value);
}

export default function AdminDashboard() {
    const token = useAuthStore((state) => state.token);
    const [stats, setStats] = useState<Awaited<ReturnType<typeof getAdminStats>> | null>(null);
    const [departments, setDepartments] = useState<Awaited<ReturnType<typeof listDepartments>>>([]);
    const [users, setUsers] = useState<Awaited<ReturnType<typeof listAdminUsers>>>([]);
    const [auditLogs, setAuditLogs] = useState<Awaited<ReturnType<typeof listAuditLogs>>>([]);
    const [beds, setBeds] = useState<Awaited<ReturnType<typeof listBeds>>>([]);

    useEffect(() => {
        let cancelled = false;

        void Promise.all([
            getAdminStats(token ?? undefined),
            listDepartments({}, token ?? undefined),
            listAdminUsers({}, token ?? undefined),
            listAuditLogs({}, token ?? undefined),
            listBeds({}, token ?? undefined),
        ])
            .then(([nextStats, nextDepartments, nextUsers, nextAuditLogs, nextBeds]) => {
                if (cancelled) return;
                setStats(nextStats);
                setDepartments(nextDepartments);
                setUsers(nextUsers);
                setAuditLogs(nextAuditLogs);
                setBeds(nextBeds);
            })
            .catch(() => {
                if (cancelled) return;
                setStats(null);
                setDepartments([]);
                setUsers([]);
                setAuditLogs([]);
                setBeds([]);
            });

        return () => {
            cancelled = true;
        };
    }, [token]);

    const recentAudit = useMemo(() => auditLogs.slice(0, 6), [auditLogs]);
    const recentActivity = useMemo(
        () =>
            recentAudit.map((entry) => ({
                id: entry.id,
                action: toDisplayText(entry.details, `${entry.action} ${entry.resource}`),
                user: toDisplayText(entry.userName),
                timestamp: entry.timestamp.replace("T", " ").substring(0, 16),
                type: entry.outcome === "failure" ? "warning" : entry.severity === "critical" ? "warning" : "success",
            })),
        [recentAudit],
    );
    const bedSummary = useMemo(
        () => [
            { label: "Available", count: beds.filter((b) => b.status === "available").length, color: "text-emerald-600" },
            { label: "Occupied", count: beds.filter((b) => b.status === "occupied").length, color: "text-blue-600" },
            { label: "Reserved", count: beds.filter((b) => b.status === "reserved").length, color: "text-violet-600" },
            { label: "Maintenance/Cleaning", count: beds.filter((b) => b.status === "maintenance" || b.status === "cleaning").length, color: "text-amber-600" },
        ],
        [beds],
    );

    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        System overview · MedHub Virtual Hospital
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
                    <CheckCircle2 className="h-4 w-4" />
                    {stats?.systemUptime ?? 0}% uptime
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Users"
                    value={stats?.totalUsers ?? 0}
                    icon={Users}
                    trend={{ value: stats?.activeUsers ?? 0, label: "active" }}
                    iconClassName="bg-violet-500/10 text-violet-600"
                />
                <StatCard
                    title="Departments"
                    value={stats?.totalDepartments ?? 0}
                    icon={Building2}
                    iconClassName="bg-teal-500/10 text-teal-600"
                />
                <StatCard
                    title="Beds"
                    value={`${stats?.occupiedBeds ?? 0}/${stats?.totalBeds ?? 0}`}
                    icon={BedDouble}
                    trend={{ value: stats?.totalBeds ? Math.round(((stats.occupiedBeds ?? 0) / stats.totalBeds) * 100) : 0, label: "% occupied" }}
                    iconClassName="bg-sky-500/10 text-sky-600"
                />
                <StatCard
                    title="Audit Events Today"
                    value={stats?.auditLogsToday ?? 0}
                    icon={ShieldCheck}
                    iconClassName="bg-emerald-500/10 text-emerald-600"
                />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Active Lab Tests"
                    value={stats?.totalLabTests ?? 0}
                    icon={FlaskConical}
                    iconClassName="bg-amber-500/10 text-amber-600"
                />
                <StatCard
                    title="Radiology Studies"
                    value={stats?.totalRadiologyStudies ?? 0}
                    icon={ScanLine}
                    iconClassName="bg-indigo-500/10 text-indigo-600"
                />
                <StatCard
                    title="Active Patients"
                    value={departments.reduce((sum, department) => sum + department.activePatients, 0)}
                    icon={Activity}
                    iconClassName="bg-rose-500/10 text-rose-600"
                />
                <StatCard
                    title="Suspended Users"
                    value={users.filter((user) => user.status === "suspended").length}
                    icon={AlertTriangle}
                    iconClassName="bg-red-500/10 text-red-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card className="lg:col-span-3 border-border/50 shadow-sm">
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-primary" />
                                Departments
                            </CardTitle>
                            <Link href="/admin/departments">
                                <Button variant="ghost" size="sm" className="text-xs h-7">View all</Button>
                            </Link>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border/50">
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</th>
                                        <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Head</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Staff</th>
                                        <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Patients</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {departments.slice(0, 8).map((department) => (
                                        <tr key={department.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                            <td className="py-2.5 px-3 font-medium">{department.name}</td>
                                            <td className="py-2.5 px-3 text-muted-foreground">{department.headName ?? "–"}</td>
                                            <td className="py-2.5 px-3 text-center">{department.staffCount}</td>
                                            <td className="py-2.5 px-3 text-center">
                                                <Badge variant="secondary" className="text-xs">
                                                    {department.activePatients}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 flex flex-col gap-4">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base font-semibold flex items-center gap-2">
                                    <BedDouble className="h-4 w-4 text-primary" />
                                    Bed Availability
                                </CardTitle>
                                <Link href="/admin/beds">
                                    <Button variant="ghost" size="sm" className="text-xs h-7">Manage</Button>
                                </Link>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-3">
                                {bedSummary.map((item) => (
                                    <div key={item.label} className="rounded-lg border border-border/50 p-3 text-center">
                                        <p className={`text-2xl font-bold ${item.color}`}>{item.count}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-border/50 shadow-sm flex-1">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Recent Activity
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {recentActivity.map((activity) => (
                                    <div key={activity.id} className="flex items-start gap-3 py-1.5">
                                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                                            activity.type === "success" ? "bg-emerald-500" :
                                            activity.type === "warning" ? "bg-amber-500" : "bg-sky-500"
                                        }`} />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium leading-tight">{activity.action}</p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {activity.user} · {activity.timestamp}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <ShieldCheck className="h-4 w-4 text-primary" />
                            Recent Audit Events
                        </CardTitle>
                        <Link href="/admin/audit">
                            <Button variant="ghost" size="sm" className="text-xs h-7">View full log</Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Action</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resource</th>
                                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Severity</th>
                                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Outcome</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentAudit.map((entry) => (
                                    <tr key={entry.id} className={`border-b border-border/30 hover:bg-muted/30 transition-colors ${entry.severity === "critical" ? "bg-red-500/5" : ""}`}>
                                        <td className="py-2.5 px-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
                                            {entry.timestamp.replace("T", " ").substring(0, 16)}
                                        </td>
                                        <td className="py-2.5 px-3">
                                            <p className="font-medium text-xs">{entry.userName}</p>
                                            <p className="text-xs text-muted-foreground capitalize">{String(entry.userRole ?? "unknown").replace("_", " ")}</p>
                                        </td>
                                        <td className="py-2.5 px-3 capitalize font-medium text-xs">{String(entry.action ?? "unknown").replace("_", " ")}</td>
                                        <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground">{entry.resource}</td>
                                        <td className="py-2.5 px-3 text-center">
                                            <StatusChip status={entry.severity} />
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                            {entry.outcome === "success"
                                                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 mx-auto" />
                                                : <XCircle className="h-4 w-4 text-red-600 mx-auto" />}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            Users
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                                {stats?.totalUsers ?? 0} total
                            </Badge>
                            <Link href="/admin/users">
                                <Button variant="ghost" size="sm" className="text-xs h-7">Manage</Button>
                            </Link>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border/50">
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                                    <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Department</th>
                                    <th className="text-center py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user) => (
                                    <tr key={user.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                                        <td className="py-2.5 px-3 font-medium">{user.firstName} {user.lastName}</td>
                                        <td className="py-2.5 px-3 text-muted-foreground">{user.email}</td>
                                        <td className="py-2.5 px-3">
                                            <RoleBadge role={user.role} />
                                        </td>
                                        <td className="py-2.5 px-3 text-muted-foreground">{user.departmentName ?? "–"}</td>
                                        <td className="py-2.5 px-3 text-center">
                                            <StatusChip status={user.status} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
