"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { VitalsFlowsheet } from "@/features/nurse/components/VitalsFlowsheet";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listIntakeOutput, listNursePatients, listPainAssessments, listVitals, createVitals, type NurseWardPatient } from "@/features/nurse/api";
import type { IntakeOutput, PainEntry, VitalEntry } from "@/types";
import { Heart, Droplets, Activity, ArrowUp, ArrowDown, Plus, Loader2, BedDouble } from "lucide-react";
import { cn } from "@/lib/utils";

const tabOptions = ["vitals", "io", "pain"] as const;
type FlowTab = (typeof tabOptions)[number];

export default function VitalsPage() {
  const token = useAuthStore((state) => state.token);
  const [patients, setPatients] = useState<NurseWardPatient[]>([]);
  const [vitals, setVitals] = useState<VitalEntry[]>([]);
  const [ioEntries, setIoEntries] = useState<IntakeOutput[]>([]);
  const [painEntries, setPainEntries] = useState<PainEntry[]>([]);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [tab, setTab] = useState<FlowTab>("vitals");
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [savingVitals, setSavingVitals] = useState(false);
  const [vitalsError, setVitalsError] = useState<string | null>(null);
  const [vSystolic, setVSystolic] = useState("");
  const [vDiastolic, setVDiastolic] = useState("");
  const [vHR, setVHR] = useState("");
  const [vTemp, setVTemp] = useState("");
  const [vSpO2, setVSpO2] = useState("");
  const [vRR, setVRR] = useState("");
  const [vPain, setVPain] = useState("");
  const [vGCS, setVGCS] = useState("");
  const [vNotes, setVNotes] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listNursePatients(token ?? undefined),
      listVitals({}, token ?? undefined),
      listIntakeOutput({}, token ?? undefined),
      listPainAssessments({}, token ?? undefined),
    ])
      .then(([patientData, vitalData, ioData, painData]) => {
        if (!cancelled) {
          setPatients(patientData);
          setVitals(vitalData);
          setIoEntries(ioData);
          setPainEntries(painData);
          setSelectedPatient((current) => current || patientData[0]?.id || "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatients([]);
          setVitals([]);
          setIoEntries([]);
          setPainEntries([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const patientVitals = vitals.filter((entry) => entry.patientId === selectedPatient).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const patientIO = ioEntries.filter((entry) => entry.patientId === selectedPatient);
  const patientPain = painEntries.filter((entry) => entry.patientId === selectedPatient);

  const totalIntake = patientIO.filter((entry) => entry.direction === "intake").reduce((sum, entry) => sum + entry.amount, 0);
  const totalOutput = patientIO.filter((entry) => entry.direction === "output").reduce((sum, entry) => sum + entry.amount, 0);

  async function handleSaveVitals() {
    if (!selectedPatient || !vSystolic || !vDiastolic || !vHR || !vTemp || !vSpO2 || !vRR) return;
    setSavingVitals(true);
    setVitalsError(null);
    try {
      await createVitals(
        {
          patient: selectedPatient,
          systolic: Number(vSystolic),
          diastolic: Number(vDiastolic),
          heart_rate: Number(vHR),
          temperature: Number(vTemp),
          spo2: Number(vSpO2),
          respiratory_rate: Number(vRR),
          pain_score: vPain ? Number(vPain) : undefined,
          gcs: vGCS ? Number(vGCS) : undefined,
          notes: vNotes || undefined,
        },
        token ?? undefined,
      );
      const refreshed = await listVitals({}, token ?? undefined);
      setVitals(refreshed);
      setShowVitalsForm(false);
      setVSystolic(""); setVDiastolic(""); setVHR(""); setVTemp(""); setVSpO2(""); setVRR(""); setVPain(""); setVGCS(""); setVNotes("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save vitals. Check values and try again.";
      setVitalsError(msg);
    } finally {
      setSavingVitals(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vitals Flowsheet</h1>
          <p className="mt-1 text-sm text-muted-foreground">Vital signs, I&amp;O tracking, and pain assessments</p>
        </div>
        <Button className="gap-2" onClick={() => setShowVitalsForm(!showVitalsForm)} disabled={!selectedPatient}>
          <Plus className="h-4 w-4" /> Record Vitals
        </Button>
      </div>

      {/* Patient selector — mini cards */}
      {patients.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {patients.map((patient) => {
            const isSelected = selectedPatient === patient.id;
            const acuityColor: Record<string, string> = {
              critical: "border-red-400 bg-red-50 dark:bg-red-950/30",
              high: "border-amber-400 bg-amber-50 dark:bg-amber-950/30",
              medium: "border-sky-400 bg-sky-50 dark:bg-sky-950/30",
              low: "border-emerald-400 bg-emerald-50 dark:bg-emerald-950/20",
            };
            const acuityBadge: Record<string, string> = {
              critical: "bg-red-500 text-white",
              high: "bg-amber-500 text-white",
              medium: "bg-sky-500 text-white",
              low: "bg-emerald-500 text-white",
            };
            const latestVital = vitals
              .filter((v) => v.patientId === patient.id)
              .sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];

            return (
              <button
                key={patient.id}
                onClick={() => { setSelectedPatient(patient.id); setShowVitalsForm(false); }}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border-2 p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/30"
                    : (patient.acuity ? acuityColor[patient.acuity] : "border-border/50 bg-card hover:border-primary/30 hover:shadow-sm"),
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn("flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold", isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                      {patient.roomNumber ?? "?"}
                    </div>
                    <div>
                      <p className="text-xs font-semibold leading-tight">{patient.firstName} {patient.lastName}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{patient.mrn}</p>
                    </div>
                  </div>
                  {patient.acuity && (
                    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-medium capitalize", acuityBadge[patient.acuity] ?? "bg-slate-400 text-white")}>
                      {patient.acuity}
                    </span>
                  )}
                </div>

                {/* Latest vitals summary */}
                {latestVital ? (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <Heart className="h-3 w-3 shrink-0 text-red-400" />
                    <span>{latestVital.systolic}/{latestVital.diastolic} mmHg</span>
                    <span>·</span>
                    <span>HR {latestVital.heartRate}</span>
                    {latestVital.news2Score != null && (
                      <span className={cn("ml-auto rounded px-1 py-0.5 font-medium", latestVital.news2Score >= 7 ? "bg-red-100 text-red-700" : latestVital.news2Score >= 5 ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground")}>
                        NEWS2 {latestVital.news2Score}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] italic text-muted-foreground/60">No vitals recorded yet</p>
                )}

                {patient.diagnosis && (
                  <p className="line-clamp-1 text-[10px] text-muted-foreground">{patient.diagnosis}</p>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
            <BedDouble className="h-10 w-10 text-muted-foreground/20" />
            <p className="text-sm">No patients currently assigned to your ward</p>
          </CardContent>
        </Card>
      )}

      {/* Vitals Input Form */}
      {showVitalsForm && selectedPatient && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" /> Record Vital Signs
              <span className="text-xs font-normal text-muted-foreground">
                - {patients.find((p) => p.id === selectedPatient)?.firstName} {patients.find((p) => p.id === selectedPatient)?.lastName}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Systolic (mmHg)</label>
                <Input type="number" value={vSystolic} onChange={(e) => setVSystolic(e.target.value)} placeholder="120" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Diastolic (mmHg)</label>
                <Input type="number" value={vDiastolic} onChange={(e) => setVDiastolic(e.target.value)} placeholder="80" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Heart Rate (bpm)</label>
                <Input type="number" value={vHR} onChange={(e) => setVHR(e.target.value)} placeholder="72" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Temperature (°C)</label>
                <Input type="number" step="0.1" value={vTemp} onChange={(e) => setVTemp(e.target.value)} placeholder="37.0" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">SpO2 (%)</label>
                <Input type="number" value={vSpO2} onChange={(e) => setVSpO2(e.target.value)} placeholder="98" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Respiratory Rate</label>
                <Input type="number" value={vRR} onChange={(e) => setVRR(e.target.value)} placeholder="16" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Pain (0-10)</label>
                <Input type="number" min="0" max="10" value={vPain} onChange={(e) => setVPain(e.target.value)} placeholder="0" className="text-sm" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">GCS (3-15)</label>
                <Input type="number" min="3" max="15" value={vGCS} onChange={(e) => setVGCS(e.target.value)} placeholder="15" className="text-sm" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Notes (optional)</label>
              <Textarea value={vNotes} onChange={(e) => setVNotes(e.target.value)} placeholder="Additional observations..." rows={2} className="resize-none text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              {vitalsError && (
                <p className="mr-auto self-center text-xs text-destructive">{vitalsError}</p>
              )}
              <Button variant="outline" size="sm" onClick={() => { setShowVitalsForm(false); setVitalsError(null); }}>Cancel</Button>
              <Button
                size="sm"
                disabled={savingVitals || !vSystolic || !vDiastolic || !vHR || !vTemp || !vSpO2 || !vRR}
                onClick={() => void handleSaveVitals()}
              >
                {savingVitals ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Save Vitals
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-1 border-b pb-0">
        {tabOptions.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={cn(
              "flex items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors -mb-px",
              tab === item
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item === "vitals" && <Heart className="h-3.5 w-3.5" />}
            {item === "io" && <Droplets className="h-3.5 w-3.5" />}
            {item === "pain" && <Activity className="h-3.5 w-3.5" />}
            {item === "io" ? "I&O" : item}
          </button>
        ))}
      </div>

      {tab === "vitals" && <VitalsFlowsheet vitals={patientVitals} />}

      {tab === "io" && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Droplets className="h-4 w-4 text-primary" /> Intake &amp; Output
              </CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1 font-medium text-sky-600"><ArrowDown className="h-3 w-3" /> Intake: {totalIntake} mL</span>
                <span className="flex items-center gap-1 font-medium text-amber-600"><ArrowUp className="h-3 w-3" /> Output: {totalOutput} mL</span>
                <span className="font-bold">Net: {totalIntake - totalOutput} mL</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {patientIO.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No I&amp;O entries for this patient.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="px-2 py-2 text-left font-medium">Time</th>
                      <th className="px-2 py-2 text-left font-medium">Direction</th>
                      <th className="px-2 py-2 text-left font-medium">Type</th>
                      <th className="px-2 py-2 text-left font-medium">Amount</th>
                      <th className="px-2 py-2 text-left font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patientIO.map((entry) => (
                      <tr key={entry.id} className="border-b border-border/30 transition-colors hover:bg-muted/40">
                        <td className="px-2 py-2 text-xs">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                        <td className="px-2 py-2">
                          <Badge variant="outline" className={cn("text-[10px] capitalize", entry.direction === "intake" ? "text-sky-600" : "text-amber-600")}>
                            {entry.direction}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-xs capitalize">{entry.type}</td>
                        <td className="px-2 py-2 font-mono text-xs font-medium">{entry.amount} mL</td>
                        <td className="px-2 py-2 text-xs text-muted-foreground">{entry.notes || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "pain" && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="h-4 w-4 text-primary" /> Pain Assessments
            </CardTitle>
          </CardHeader>
          <CardContent>
            {patientPain.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No pain entries for this patient.</p>
            ) : (
              <div className="space-y-3">
                {patientPain.map((entry) => {
                  const painColor = entry.score >= 7 ? "text-red-600" : entry.score >= 4 ? "text-amber-600" : "text-emerald-600";
                  const painBg =
                    entry.score >= 7
                      ? "border-red-500/30 bg-red-500/10"
                      : entry.score >= 4
                        ? "border-amber-500/30 bg-amber-500/10"
                        : "border-emerald-500/30 bg-emerald-500/10";

                  return (
                    <div key={entry.id} className={cn("rounded-lg border p-3", painBg)}>
                      <div className="mb-1 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-2xl font-bold", painColor)}>{entry.score}/10</span>
                          <div>
                            <p className="text-sm font-medium">{entry.location}</p>
                            <p className="text-xs capitalize text-muted-foreground">{entry.quality}</p>
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground">{new Date(entry.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {entry.intervention && <p className="mt-1 text-xs text-muted-foreground">Intervention: {entry.intervention}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
