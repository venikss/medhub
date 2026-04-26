"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EncounterNoteEditor } from "@/features/doctor/components/EncounterNoteEditor";
import { PatientBanner } from "@/features/doctor/components/PatientBanner";
import { CDSSSidebar } from "@/features/doctor/components/CDSSSidebar";
import { FileText, Calendar } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createDoctorEncounter, listAdmissions, listDoctorEncounters, signDoctorEncounter, type DoctorAdmission } from "@/features/doctor/api";
import { getPatientCDSSSummary } from "@/features/cdss/api";
import { getPatient } from "@/features/frontdesk/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Encounter, Patient } from "@/types";

function EncounterPageInner() {
    const searchParams = useSearchParams();
    const token = useAuthStore((state) => state.token);
    const user = useAuthStore((state) => state.user);
    const urlPatientId = searchParams.get("patientId");
    const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
    const [admissions, setAdmissions] = useState<DoctorAdmission[]>([]);
    const patientId = urlPatientId ?? selectedPatientId ?? null;
    const [patient, setPatient] = useState<Patient | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [recentEncounters, setRecentEncounters] = useState<Encounter[]>([]);
    const [cdss, setCdss] = useState<Array<{ id: string; type: "alert" | "recommendation"; severity: "critical" | "warning" | "info"; title: string; message: string; source: string }>>([]);

    // Load admitted patients for the selector when no URL patientId
    useEffect(() => {
        if (urlPatientId) return;
        if (!user?.id) return;
        let cancelled = false;
        void listAdmissions({ status: "admitted", doctorId: user.id }, token ?? undefined)
            .then((data) => { if (!cancelled) setAdmissions(data); })
            .catch(() => { if (!cancelled) setAdmissions([]); });
        return () => { cancelled = true; };
    }, [urlPatientId, token, user?.id]);

    useEffect(() => {
        if (!patientId) return;
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setLoadError(null);
            try {
                const resolvedPatient = await getPatient(patientId, token ?? undefined);

                if (!resolvedPatient || cancelled) {
                    if (!cancelled) {
                        setPatient(null);
                        setRecentEncounters([]);
                        setCdss([]);
                        setLoadError("We couldn't load this patient workspace.");
                        setIsLoading(false);
                    }
                    return;
                }

                const [encounters, cdssSummary] = await Promise.all([
                    listDoctorEncounters({ patientId: resolvedPatient.id }, token ?? undefined),
                    getPatientCDSSSummary(resolvedPatient.id, token ?? undefined).catch(() => ({ data: [] })),
                ]);

                if (cancelled) return;

                setPatient(resolvedPatient);
                setRecentEncounters(encounters);
                setCdss(
                    (cdssSummary.data ?? []).map((item) => ({
                        id: item.id,
                        type: item.outputKind === "recommendation" ? "recommendation" : "alert",
                        severity: item.severity,
                        title: item.title,
                        message: item.summary ?? "",
                        source: item.sourceModule ?? "system",
                    })),
                );
                setIsLoading(false);
            } catch {
                if (!cancelled) {
                    setPatient(null);
                    setRecentEncounters([]);
                    setCdss([]);
                    setLoadError(
                        patientId
                            ? "We couldn't load this patient workspace."
                            : "Open the encounter page from a patient chart to start a note.",
                    );
                    setIsLoading(false);
                }
            }
        }

        void load();

        return () => {
            cancelled = true;
        };
    }, [patientId, token]);

    const displayPatient = useMemo(() => {
        if (!patient) return null;
        return {
            ...patient,
            diagnosis: recentEncounters[0]?.assessment || undefined,
        };
    }, [patient, recentEncounters]);

    async function handleSave(data: Pick<Encounter, "subjective" | "objective" | "assessment" | "plan">) {
        if (!patient) return;
        const created = await createDoctorEncounter(
            {
                patientId: patient.id,
                type: patient.status === "admitted" ? "inpatient" : "outpatient",
                subjective: data.subjective,
                objective: data.objective,
                assessment: data.assessment,
                plan: data.plan,
            },
            token ?? undefined,
        );
        setRecentEncounters((prev) => [created, ...prev]);
    }

    async function handleSign(data: Pick<Encounter, "subjective" | "objective" | "assessment" | "plan">) {
        if (!patient) return;
        const created = await createDoctorEncounter(
            {
                patientId: patient.id,
                type: patient.status === "admitted" ? "inpatient" : "outpatient",
                subjective: data.subjective,
                objective: data.objective,
                assessment: data.assessment,
                plan: data.plan,
            },
            token ?? undefined,
        );
        const signed = await signDoctorEncounter(created.id, token ?? undefined);
        setRecentEncounters((prev) => [signed, ...prev]);
    }

    if (isLoading) {
        return <div className="py-20 text-center text-sm text-muted-foreground">Loading encounter workspace...</div>;
    }

    if (!patientId) {
        return (
            <div className="space-y-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Encounter Note</h1>
                    <p className="text-sm text-muted-foreground mt-1">SOAP documentation for this visit</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-muted-foreground shrink-0">Patient</span>
                    <Select value={selectedPatientId ?? ""} onValueChange={(v) => setSelectedPatientId(v || undefined)}>
                        <SelectTrigger className="w-80">
                            <SelectValue placeholder="Select a patient to beginâ€¦" />
                        </SelectTrigger>
                        <SelectContent>
                            {admissions.map((a) => (
                                <SelectItem key={a.patientId} value={a.patientId}>
                                    {a.patientName} â€” {a.mrn}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        );
    }

    if (!displayPatient && !isLoading) {
        return (
            <div className="py-20 text-center">
                <p className="text-sm text-muted-foreground">{loadError ?? "Encounter workspace is unavailable."}</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">New Encounter Note</h1>
                    <p className="text-sm text-muted-foreground mt-1">SOAP documentation for this visit</p>
                </div>
            </div>

            <PatientBanner patient={displayPatient} />

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-3 space-y-4">
                    <EncounterNoteEditor
                        patientName={`${displayPatient.firstName} ${displayPatient.lastName}`}
                        onSave={handleSave}
                        onSign={handleSign}
                    />

                    {recentEncounters.length > 0 && (
                        <Card className="border-border/50 shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                    Previous Encounters ({recentEncounters.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    {recentEncounters.map((encounter) => (
                                        <div key={encounter.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                                            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium">{encounter.id}</p>
                                                <p className="text-xs text-muted-foreground">{new Date(encounter.date).toLocaleDateString()} · {encounter.authorName}</p>
                                            </div>
                                            <Badge variant="secondary" className="text-[10px] capitalize">{encounter.visitType}</Badge>
                                            <Badge variant="outline" className="text-[10px] capitalize">{encounter.status}</Badge>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-4">
                        <CDSSSidebar suggestions={cdss} />
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function EncounterPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Loading...</p></div>}>
            <EncounterPageInner />
        </Suspense>
    );
}
