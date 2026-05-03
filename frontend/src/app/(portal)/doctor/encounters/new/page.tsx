"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EncounterNoteEditor, type EncounterNoteEditorHandle } from "@/features/doctor/components/EncounterNoteEditor";
import { EncounterAISuggest } from "@/features/doctor/components/EncounterAISuggest";
import { PatientBanner } from "@/features/doctor/components/PatientBanner";
import { CDSSSidebar } from "@/features/doctor/components/CDSSSidebar";
import { FileText, Calendar, Activity, Thermometer, Heart, Wind, Gauge, ChevronDown, ChevronUp } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createDoctorEncounter, listAdmissions, listDoctorEncounters, signDoctorEncounter, updateDoctorEncounter, type DoctorAdmission } from "@/features/doctor/api";
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
    const [currentEncounterId, setCurrentEncounterId] = useState<string | null>(null);
    const [liveForm, setLiveForm] = useState({ subjective: "", objective: "", assessment: "", plan: "" });
    const [latestVitals, setLatestVitals] = useState<Record<string, number | string | boolean | null> | null>(null);
    const [expandedEncounterId, setExpandedEncounterId] = useState<string | null>(null);
    const editorRef = useRef<EncounterNoteEditorHandle>(null);
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
        const activePatientId = patientId;
        let cancelled = false;

        async function load() {
            setIsLoading(true);
            setLoadError(null);
            try {
                const resolvedPatient = await getPatient(activePatientId, token ?? undefined);

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
                // Fetch latest vitals for the encounter sidebar
                try {
                    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api";
                    const vRes = await fetch(`${baseUrl}/nurses/patients/${resolvedPatient.id}/vitals/latest/`, {
                        headers: { Authorization: `Bearer ${token}` },
                    });
                    if (vRes.ok) {
                        const vData = await vRes.json() as Record<string, number | string | boolean | null>;
                        if (!cancelled) setLatestVitals(vData);
                    }
                } catch { /* vitals are non-critical */ }
                setIsLoading(false);
            } catch {
                if (!cancelled) {
                    setPatient(null);
                    setRecentEncounters([]);
                    setCdss([]);
                    setLoadError(
                        activePatientId
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
        if (currentEncounterId) {
            // Update existing draft in-place
            const updated = await updateDoctorEncounter(currentEncounterId, data, token ?? undefined);
            setRecentEncounters((prev) => prev.map((e) => e.id === currentEncounterId ? updated : e));
        } else {
            const created = await createDoctorEncounter(
                {
                    patientId: patient.id,
                    type: patient.status === "admitted" ? "inpatient" : "outpatient",
                    ...data,
                },
                token ?? undefined,
            );
            setCurrentEncounterId(created.id);
            setRecentEncounters((prev) => [created, ...prev]);
        }
    }

    async function handleSign(data: Pick<Encounter, "subjective" | "objective" | "assessment" | "plan">) {
        if (!patient) return;
        let encounterId = currentEncounterId;

        if (encounterId) {
            // Update existing draft with latest SOAP, then sign it
            await updateDoctorEncounter(encounterId, data, token ?? undefined);
        } else {
            // No draft yet — create one, then sign it
            const created = await createDoctorEncounter(
                {
                    patientId: patient.id,
                    type: patient.status === "admitted" ? "inpatient" : "outpatient",
                    ...data,
                },
                token ?? undefined,
            );
            encounterId = created.id;
            setCurrentEncounterId(encounterId);
        }

        const signed = await signDoctorEncounter(encounterId, token ?? undefined);
        // Replace the draft with the signed version (no duplicate)
        setRecentEncounters((prev) =>
            prev.some((e) => e.id === encounterId)
                ? prev.map((e) => e.id === encounterId ? signed : e)
                : [signed, ...prev]
        );
        setCurrentEncounterId(null); // Reset — encounter is now locked
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
                            <SelectValue placeholder="Select a patient to begin..." />
                        </SelectTrigger>
                        <SelectContent>
                            {admissions.map((a) => (
                                <SelectItem key={a.patientId} value={a.patientId}>
                                    {a.patientName} - {a.mrn}
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

    if (!displayPatient) return null;

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
                        ref={editorRef}
                        patientName={`${displayPatient.firstName} ${displayPatient.lastName}`}
                        onSave={handleSave}
                        onSign={handleSign}
                        onFormChange={setLiveForm}
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
                                    {recentEncounters.map((encounter) => {
                                        const isExpanded = expandedEncounterId === encounter.id;
                                        const isSigned = encounter.status === "signed" || encounter.status === "locked";
                                        return (
                                            <div key={encounter.id} className="rounded-lg border border-border/50 overflow-hidden">
                                                {/* Row header — always visible, click to expand */}
                                                <button
                                                    className="w-full flex items-center gap-3 p-2.5 hover:bg-muted/40 transition-colors text-left"
                                                    onClick={() => setExpandedEncounterId(isExpanded ? null : encounter.id)}
                                                >
                                                    <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-mono text-muted-foreground truncate">{encounter.id}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(encounter.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · {encounter.authorName}</p>
                                                    </div>
                                                    <Badge variant="secondary" className="text-[10px] capitalize shrink-0">{encounter.visitType}</Badge>
                                                    <Badge
                                                        variant={isSigned ? "default" : "outline"}
                                                        className={`text-[10px] capitalize shrink-0 ${
                                                            isSigned ? "bg-emerald-600 hover:bg-emerald-600 text-white" : ""
                                                        }`}
                                                    >
                                                        {encounter.status}
                                                    </Badge>
                                                    {isExpanded
                                                        ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                                        : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                                                </button>

                                                {/* Expandable SOAP content */}
                                                {isExpanded && (
                                                    <div className="border-t border-border/40 bg-muted/20 p-3 space-y-3">
                                                        {encounter.subjective && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Subjective</p>
                                                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{encounter.subjective}</p>
                                                            </div>
                                                        )}
                                                        {encounter.objective && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Objective</p>
                                                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{encounter.objective}</p>
                                                            </div>
                                                        )}
                                                        {encounter.assessment && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Assessment</p>
                                                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{encounter.assessment}</p>
                                                            </div>
                                                        )}
                                                        {encounter.plan && (
                                                            <div>
                                                                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Plan</p>
                                                                <p className="text-xs leading-relaxed whitespace-pre-wrap">{encounter.plan}</p>
                                                            </div>
                                                        )}
                                                        {isSigned && (
                                                            <p className="text-[10px] text-muted-foreground/60 pt-1 border-t border-border/30">
                                                                🔒 Signed &amp; locked — read only
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-1">
                    <div className="sticky top-4 space-y-4">

                        {/* ── Vitals Panel ─────────────────────────── */}
                        {latestVitals && (() => {
                            const v = latestVitals;
                            const news2 = Number(v.news2Score ?? v.news2_score ?? -1);
                            const isAdmission = v.isAdmissionVitals ?? v.is_admission_vitals;
                            const recorded = typeof v.recordedAt === "string" ? v.recordedAt.slice(0, 16).replace("T", " ") : "";
                            const news2Risk = news2 < 0 ? null : news2 < 3 ? "LOW" : news2 < 5 ? "MEDIUM" : news2 < 7 ? "HIGH" : "VERY HIGH";
                            const news2Color = !news2Risk || news2Risk === "LOW" ? "text-emerald-600" : news2Risk === "MEDIUM" ? "text-amber-600" : "text-red-600";
                            return (
                                <Card className="border-border/50 shadow-sm">
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-xs font-semibold flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <Activity className="h-3.5 w-3.5 text-emerald-600" />
                                                {isAdmission ? "Admission Vitals" : "Latest Vitals"}
                                            </span>
                                            {recorded && <span className="text-[10px] font-normal text-muted-foreground">{recorded}</span>}
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1.5">
                                        <div className="grid grid-cols-2 gap-1.5">
                                            {(v.systolic && v.diastolic) && (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Gauge className="h-2.5 w-2.5" />BP</p>
                                                    <p className="text-xs font-semibold">{String(v.systolic)}/{String(v.diastolic)} <span className="text-[10px] font-normal text-muted-foreground">mmHg</span></p>
                                                </div>
                                            )}
                                            {v.heartRate || v.heart_rate ? (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Heart className="h-2.5 w-2.5" />HR</p>
                                                    <p className="text-xs font-semibold">{String(v.heartRate ?? v.heart_rate)} <span className="text-[10px] font-normal text-muted-foreground">bpm</span></p>
                                                </div>
                                            ) : null}
                                            {v.spo2 && (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">SpO₂</p>
                                                    <p className="text-xs font-semibold">{String(v.spo2)}<span className="text-[10px] font-normal text-muted-foreground">%</span></p>
                                                </div>
                                            )}
                                            {v.temperature && (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Thermometer className="h-2.5 w-2.5" />Temp</p>
                                                    <p className="text-xs font-semibold">{Number(v.temperature).toFixed(1)}<span className="text-[10px] font-normal text-muted-foreground">°C</span></p>
                                                </div>
                                            )}
                                            {(v.respiratoryRate || v.respiratory_rate) && (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide flex items-center gap-1"><Wind className="h-2.5 w-2.5" />RR</p>
                                                    <p className="text-xs font-semibold">{String(v.respiratoryRate ?? v.respiratory_rate)}<span className="text-[10px] font-normal text-muted-foreground">/min</span></p>
                                                </div>
                                            )}
                                            {(v.painScore ?? v.pain_score) !== null && (v.painScore ?? v.pain_score) !== undefined && (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">Pain</p>
                                                    <p className="text-xs font-semibold">{String(v.painScore ?? v.pain_score)}<span className="text-[10px] font-normal text-muted-foreground">/10</span></p>
                                                </div>
                                            )}
                                            {v.gcs && (
                                                <div className="rounded border border-border/40 bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] text-muted-foreground uppercase tracking-wide">GCS</p>
                                                    <p className="text-xs font-semibold">{String(v.gcs)}<span className="text-[10px] font-normal text-muted-foreground">/15</span></p>
                                                </div>
                                            )}
                                        </div>
                                        {news2 >= 0 && (
                                            <div className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${
                                                news2Risk === "LOW" ? "border-emerald-500/30 bg-emerald-500/5" :
                                                news2Risk === "MEDIUM" ? "border-amber-500/30 bg-amber-500/5" :
                                                "border-red-500/30 bg-red-500/5"
                                            }`}>
                                                <span className="text-[10px] text-muted-foreground font-medium">NEWS2 Score</span>
                                                <span className={`font-bold ${news2Color}`}>{news2} — {news2Risk}</span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            );
                        })()}
                        {/* ─────────────────────────────────────────── */}

                        <CDSSSidebar suggestions={cdss} />
                        {patient && (
                            <EncounterAISuggest
                                encounterId={currentEncounterId ?? ""}
                                patientId={patient.id}
                                soap={liveForm}
                                onApplyAssessment={(text) => editorRef.current?.applyField("assessment", text)}
                                onApplyPlan={(text) => editorRef.current?.applyField("plan", text)}
                                token={token}
                            />
                        )}
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
