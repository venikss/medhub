"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, CheckCircle2, AlertTriangle, UserCheck, ArrowRight, Shield, Clock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { createAdmission, updateAdmission, frontDeskCheckIn, getFrontDeskPatientSummary, listBeds, listWards, searchPatients } from "@/features/frontdesk/api";
import { listAdminUsers, listDepartments } from "@/features/admin/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ADTPatient, AdminDepartment, AdminUser, Appointment, BedInfo, Ward } from "@/types";

export default function CheckInPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
            <CheckInContent />
        </Suspense>
    );
}

function CheckInContent() {
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedPatient, setSelectedPatient] = useState<ADTPatient | null>(null);
    const [step, setStep] = useState<"search" | "verify" | "confirmed">("search");
    const [results, setResults] = useState<ADTPatient[]>([]);
    const [patientAppts, setPatientAppts] = useState<Appointment[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [checkInError, setCheckInError] = useState<string | null>(null);
    const [admitDoctorId, setAdmitDoctorId] = useState("");
    const [admitDeptId, setAdmitDeptId] = useState("");
    const [admitWardId, setAdmitWardId] = useState("");
    const [admitBedId, setAdmitBedId] = useState("");
    const [admitType, setAdmitType] = useState("inpatient");
    const [admitReason, setAdmitReason] = useState("");
    const [showAdmit, setShowAdmit] = useState(true);
    const [doctors, setDoctors] = useState<AdminUser[]>([]);
    const [departments, setDepartments] = useState<AdminDepartment[]>([]);
    const [wards, setWards] = useState<Ward[]>([]);
    const [admitBeds, setAdmitBeds] = useState<BedInfo[]>([]);
    const admissionTypes = ["inpatient", "outpatient", "emergency", "observation"];
    const searchParams = useSearchParams();
    const patientId = searchParams.get("patientId");
    const token = useAuthStore((state) => state.token);

    const hasSearch = searchQuery.trim().length >= 1;

    const resetAdmitFields = () => {
        setAdmitDoctorId("");
        setAdmitDeptId("");
        setAdmitWardId("");
        setAdmitBedId("");
        setAdmitType("inpatient");
        setAdmitReason("");
        setShowAdmit(true);
    };

    const fetchLookups = () => {
        Promise.all([
            listAdminUsers({ role: "doctor" }, token),
            listDepartments({}, token),
            listWards(token),
            listBeds({}, token),
        ]).then(([d, depts, w, b]) => {
            setDoctors(d);
            setDepartments(depts);
            setWards(w);
            setAdmitBeds(b);
        }).catch(() => {});
    };

    const handleSelectPatient = (p: ADTPatient) => {
        void (async () => {
            resetAdmitFields();
            try {
                const summary = await getFrontDeskPatientSummary(p.id, token);
                setSelectedPatient(summary.patient);
                setPatientAppts(summary.todayAppointments.filter((a) => a.status === "scheduled"));
                setStep("verify");
                setSearchQuery("");
                setResults([]);
            } catch {
                setSelectedPatient(p);
                setPatientAppts([]);
                setStep("verify");
                setSearchQuery("");
                setResults([]);
            }
            fetchLookups();
        })();
    };

    const handleConfirmCheckIn = () => {
        if (!selectedPatient || isSubmitting) return;
        setIsSubmitting(true);
        setCheckInError(null);
        void (async () => {
            try {
                const firstAppointment = patientAppts[0];
                const checkInRes = await frontDeskCheckIn(
                    {
                        patientId: selectedPatient.id,
                        appointmentId: firstAppointment?.id,
                        service: firstAppointment ? "consultation" : "registration",
                        priority: "normal",
                    },
                    token,
                );
                if (showAdmit) {
                    const existingAdmission = (checkInRes as Record<string, unknown>)?.activeAdmission as { id?: string } | null;
                    if (existingAdmission?.id) {
                        const updatePayload: Record<string, unknown> = {};
                        if (admitDoctorId) updatePayload.admittingDoctor = admitDoctorId;
                        if (admitDeptId) updatePayload.departmentId = admitDeptId;
                        if (admitReason.trim()) updatePayload.reasonForAdmission = admitReason.trim();
                        if (Object.keys(updatePayload).length > 0) {
                            try {
                                await updateAdmission(existingAdmission.id, updatePayload, token);
                            } catch (err) {
                                console.error("Failed to update admission during check-in:", err);
                            }
                        }
                    } else {
                        const payload: Record<string, unknown> = {
                            patientId: selectedPatient.id,
                            type: admitType,
                            status: "admitted",
                            reasonForAdmission: admitReason.trim() || "Check-in admission",
                        };
                        if (admitDoctorId) payload.admittingDoctor = admitDoctorId;
                        if (admitDeptId) payload.departmentId = admitDeptId;
                        if (admitWardId) payload.wardId = admitWardId;
                        if (admitBedId) payload.bedId = admitBedId;
                        try {
                            await createAdmission(payload, token);
                        } catch (err) {
                            console.error("Failed to create admission during check-in:", err);
                        }
                    }
                }
                setStep("confirmed");
            } catch (err) {
                console.error("Check-in failed:", err);
                setCheckInError("Check-in failed. Please try again.");
            } finally {
                setIsSubmitting(false);
            }
        })();
    };

    const handleReset = () => {
        setSelectedPatient(null);
        setPatientAppts([]);
        setStep("search");
        setSearchQuery("");
        setResults([]);
        resetAdmitFields();
    };

    useEffect(() => {
        if (patientId && token) {
            void (async () => {
                try {
                    resetAdmitFields();
                    const summary = await getFrontDeskPatientSummary(patientId, token);
                    setSelectedPatient(summary.patient);
                    setPatientAppts(summary.todayAppointments.filter((a) => a.status === "scheduled"));
                    setStep("verify");
                    fetchLookups();
                } catch (err) {
                    console.error("Failed to pre-load patient for check-in:", err);
                }
            })();
        }
    }, [patientId, token]);

    useEffect(() => {
        let cancelled = false;
        if (!hasSearch) {
            setResults([]);
            return;
        }
        const timer = setTimeout(() => {
            const run = async () => {
                try {
                    const data = await searchPatients(searchQuery, token);
                    if (!cancelled) {
                        setResults(data);
                    }
                } catch {
                    if (!cancelled) {
                        setResults([]);
                    }
                }
            };
            void run();
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [hasSearch, searchQuery, token]);

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <div className="text-center">
                <h1 className="text-2xl font-bold tracking-tight">Patient Check-In</h1>
                <p className="text-sm text-muted-foreground mt-1">Search for patient → verify identity → confirm check-in</p>
            </div>

            {/* Step indicator */}
            <div className="flex items-center justify-center gap-2">
                {["Search", "Verify", "Confirmed"].map((label, idx) => {
                    const stepIdx = idx;
                    const currentIdx = step === "search" ? 0 : step === "verify" ? 1 : 2;
                    return (
                        <div key={label} className="flex items-center gap-2">
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${stepIdx <= currentIdx ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                                {stepIdx < currentIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
                            </div>
                            <span className={`text-xs font-medium ${stepIdx <= currentIdx ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                            {idx < 2 && <div className={`w-12 h-px ${stepIdx < currentIdx ? "bg-primary" : "bg-border"}`} />}
                        </div>
                    );
                })}
            </div>

            {/* Step 1: Search */}
            {step === "search" && (
                <Card className="border-border/50 shadow-sm">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Search className="h-4 w-4 text-primary" />
                            Find Patient
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Input
                            autoFocus
                            placeholder="Type patient name or MRN…"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-11"
                        />
                        {results.length > 0 && (
                            <div className="space-y-1.5 max-h-64 overflow-y-auto">
                                {results.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => handleSelectPatient(p)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-muted/40 transition-all text-left"
                                    >
                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                            {p.firstName[0]}{p.lastName[0]}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium">{p.firstName} {p.lastName}</p>
                                            <p className="text-xs text-muted-foreground">{p.mrn} · {p.dateOfBirth}</p>
                                        </div>
                                        <StatusBadge status={p.status} />
                                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {hasSearch && results.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-4">No patients found. Try a different search term.</p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Verify */}
            {step === "verify" && selectedPatient && (
                <div className="space-y-4">
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-primary" />
                                Verify Patient Identity
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Identity details */}
                            <div className="flex items-start gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                                    {selectedPatient.firstName[0]}{selectedPatient.lastName[0]}
                                </div>
                                <div className="flex-1 space-y-1">
                                    <p className="font-semibold text-lg">{selectedPatient.firstName} {selectedPatient.lastName}</p>
                                    <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                                        <div><span className="text-muted-foreground text-xs">MRN:</span> <span className="font-mono">{selectedPatient.mrn}</span></div>
                                        <div><span className="text-muted-foreground text-xs">DOB:</span> {selectedPatient.dateOfBirth}</div>
                                        <div><span className="text-muted-foreground text-xs">Phone:</span> {selectedPatient.phone}</div>
                                        <div><span className="text-muted-foreground text-xs">Gender:</span> <span className="capitalize">{selectedPatient.gender}</span></div>
                                    </div>
                                </div>
                            </div>

                            {/* Warnings */}
                            {!selectedPatient.consentSigned && (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                                    <p className="text-sm text-amber-800 dark:text-amber-300">Consent forms have not been signed. Please have the patient sign before proceeding.</p>
                                </div>
                            )}

                            {(() => { const al = Array.isArray(selectedPatient.allergies) ? selectedPatient.allergies : typeof selectedPatient.allergies === "string" && selectedPatient.allergies ? selectedPatient.allergies.split(",").map((s: string) => s.trim()).filter(Boolean) : []; return al.length > 0 ? (
                                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                                    <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                                    <p className="text-sm text-red-800 dark:text-red-300">
                                        Allergies: <strong>{al.map((a: any) => typeof a === "string" ? a : a.substance ?? a.reaction ?? JSON.stringify(a)).join(", ")}</strong>
                                    </p>
                                </div>
                            ) : null; })()}

                            {/* Insurance verification */}
                            {selectedPatient.insurance && (
                                <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/30">
                                    <Shield className="h-4 w-4 text-emerald-600 shrink-0" />
                                    <div className="flex-1 text-sm">
                                        <span className="font-medium">{selectedPatient.insurance.provider}</span>
                                        <span className="text-muted-foreground"> · {selectedPatient.insurance.policyNumber} · Copay ${selectedPatient.insurance.copay ?? "N/A"}</span>
                                    </div>
                                    <StatusBadge status={selectedPatient.insurance.coverageType} />
                                </div>
                            )}

                            <Separator />

                            {/* Admission Assignment */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                                        Admission Details
                                    </h4>
                                    <Button variant="ghost" size="sm" onClick={() => setShowAdmit(!showAdmit)}>
                                        {showAdmit ? "Hide" : "Assign Doctor / Room"}
                                    </Button>
                                </div>
                                {showAdmit && (
                                    <div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Admission Type</Label>
                                                <Select value={admitType} onValueChange={(v) => setAdmitType(v ?? "inpatient")}>
                                                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                                                    <SelectContent>
                                                        {admissionTypes.map((t) => (
                                                            <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Admitting Doctor</Label>
                                                <Select value={admitDoctorId} onValueChange={(v) => setAdmitDoctorId(v ?? "")}>
                                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select doctor..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {doctors.map((d) => (
                                                            <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.specialization ? ` — ${d.specialization}` : ""}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Department</Label>
                                                <Select value={admitDeptId} onValueChange={(v) => setAdmitDeptId(v ?? "")}>
                                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select department..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {departments.map((d) => (
                                                            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-xs">Ward</Label>
                                                <Select value={admitWardId} onValueChange={(v) => { setAdmitWardId(v ?? ""); setAdmitBedId(""); }}>
                                                    <SelectTrigger className="h-9"><SelectValue placeholder="Select ward..." /></SelectTrigger>
                                                    <SelectContent>
                                                        {wards.map((w) => (
                                                            <SelectItem key={w.id} value={w.id}>{w.name} ({w.departmentName})</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        {admitWardId && (() => {
                                            const wardBeds = admitBeds.filter((b) => b.wardId === admitWardId && b.status === "available");
                                            return wardBeds.length > 0 ? (
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs">Bed</Label>
                                                    <Select value={admitBedId} onValueChange={(v) => setAdmitBedId(v ?? "")}>
                                                        <SelectTrigger className="h-9"><SelectValue placeholder="Select bed..." /></SelectTrigger>
                                                        <SelectContent>
                                                            {wardBeds.map((b) => (
                                                                <SelectItem key={b.bedId} value={b.bedId}>Bed {b.bedNumber} (Room {b.roomNumber})</SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">No available beds in this ward.</p>
                                            );
                                        })()}
                                        <div className="space-y-1.5">
                                            <Label className="text-xs">Reason for Admission</Label>
                                            <Textarea placeholder="Reason..." value={admitReason} onChange={(e) => setAdmitReason(e.target.value)} rows={2} className="text-sm" />
                                        </div>
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Today's appointments */}
                            <div>
                                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                    Today&apos;s Appointments
                                </h4>
                                {patientAppts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-lg text-center">No scheduled appointments today — this is a walk-in visit</p>
                                ) : (
                                    <div className="space-y-1.5">
                                        {patientAppts.map((a) => (
                                            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40">
                                                <span className="text-sm font-bold min-w-[44px]">{a.time}</span>
                                                <div className="h-6 w-px bg-border/60" />
                                                <div className="flex-1 min-w-0 text-sm">
                                                    <span className="font-medium">{a.doctorName}</span> · <span className="text-muted-foreground">{a.department}</span>
                                                </div>
                                                <Badge variant="outline" className="text-[10px] capitalize">{a.type}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {checkInError && (
                        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                            <p className="text-sm text-red-800 dark:text-red-300">{checkInError}</p>
                        </div>
                    )}

                    <div className="flex justify-between">
                        <Button variant="outline" onClick={handleReset} disabled={isSubmitting}>← Back to Search</Button>
                        <Button className="gap-2 min-w-[160px]" onClick={handleConfirmCheckIn} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                            {isSubmitting ? "Checking In…" : "Confirm Check-In"}
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 3: Confirmed */}
            {step === "confirmed" && selectedPatient && (
                <Card className="border-emerald-500/30 shadow-sm bg-emerald-500/5">
                    <CardContent className="py-12 text-center space-y-4">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 mx-auto">
                            <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-lg font-bold text-emerald-800 dark:text-emerald-300">Check-In Complete</p>
                            <p className="text-sm text-muted-foreground mt-1">
                                {selectedPatient.firstName} {selectedPatient.lastName} ({selectedPatient.mrn}) has been checked in.
                            </p>
                        </div>
                        {patientAppts.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                                Next: <strong>{patientAppts[0].doctorName}</strong> at <strong>{patientAppts[0].time}</strong> ({patientAppts[0].department})
                            </p>
                        )}
                        <Button variant="outline" className="mt-4" onClick={handleReset}>Check In Another Patient</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
