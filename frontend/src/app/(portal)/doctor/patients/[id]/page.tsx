"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Plus, Pill, ClipboardList, Activity, ChevronRight, Calendar, Network, BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { PatientBanner } from "@/features/doctor/components/PatientBanner";
import { DiagnosisCatalogCombobox } from "@/features/doctor/components/DiagnosisCatalogCombobox";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createDoctorDiagnosis, getDoctorPatientChart, type DiagnosisCatalogOption, type DoctorChartResult, type DoctorPatientChart } from "@/features/doctor/api";
import { DoctorCDSSPanel } from "@/features/cdss/components/modules/DoctorCDSSPanel";
import { PatientReportPanel } from "@/features/cdss/components/shared/PatientReportPanel";
import { PatientChatPanel } from "@/features/cdss/components/shared/PatientChatPanel";
import { useCDSSDataHydration } from "@/features/cdss/hooks/useCDSSDataHydration";
import { cn } from "@/lib/utils";

const tabs = [
  { key: "summary", label: "Summary", icon: ClipboardList },
  { key: "notes", label: "Notes", icon: FileText },
  { key: "orders", label: "Orders", icon: Plus },
  { key: "medications", label: "Medications", icon: Pill },
  { key: "results", label: "Results", icon: Activity },
  { key: "ai", label: "AI Assistant", icon: BrainCircuit },
] as const;

function mapResultFlag(flag?: string) {
  const normalized = (flag ?? "normal").toLowerCase();
  if (normalized === "critical-high" || normalized === "critical-low") return "critical";
  if (normalized === "high" || normalized === "low" || normalized === "critical") return normalized;
  return "normal";
}

function toBannerPatient(chart: DoctorPatientChart) {
  const primaryDiagnosis = chart.diagnoses[0]?.description;
  return {
    id: chart.patient.id,
    mrn: chart.patient.mrn,
    firstName: chart.patient.firstName,
    lastName: chart.patient.lastName,
    dateOfBirth: chart.patient.dateOfBirth,
    gender: chart.patient.gender,
    phone: chart.patient.phone ?? "",
    email: chart.patient.email ?? "",
    address: chart.patient.address ?? "",
    bloodType: chart.patient.bloodType ?? undefined,
    allergies: chart.patient.allergies ?? [],
    status: (chart.patient.status as "active" | "discharged" | "critical" | "stable" | "admitted") ?? "active",
    ward: chart.patient.wardName ?? chart.patient.ward ?? undefined,
    roomNumber: chart.patient.roomNumber ?? undefined,
    diagnosis: primaryDiagnosis,
  };
}

export default function PatientChartPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const token = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<string>("summary");
  const [chart, setChart] = useState<DoctorPatientChart | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDiagnosis, setSelectedDiagnosis] = useState<DiagnosisCatalogOption | null>(null);
  const [savingDiagnosis, setSavingDiagnosis] = useState(false);
  const [diagnosisMessage, setDiagnosisMessage] = useState<string | null>(null);
  const { error: cdssFeedMessage } = useCDSSDataHydration({
    token,
    patientId: id,
    refreshPatientIds: [id],
    refreshBeforeLoad: true,
    includeOverrides: true,
    useMockOnError: false,
  });

  useEffect(() => {
    let cancelled = false;

    void getDoctorPatientChart(id, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setChart(data);
          setNotFound(false);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setChart(null);
          const message = error instanceof Error ? error.message : "We couldn't load this patient chart.";
          const isNotFound = /404|patient not found/i.test(message);
          setNotFound(isNotFound);
          setLoadError(isNotFound ? null : message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  const patient = useMemo(() => (chart ? toBannerPatient(chart) : null), [chart]);

  if (!chart || !patient) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className={loadError ? "text-destructive" : "text-muted-foreground"}>
          {notFound ? "Patient not found" : loadError ?? "Loading patient chart..."}
        </p>
        <Link href="/doctor/patients"><Button variant="outline" className="mt-4">Back to Patients</Button></Link>
      </div>
    );
  }

  const patientEncounters = chart.encounters;
  const patientDiagnoses = chart.diagnoses;
  const patientOrders = chart.orders;
  const patientMeds = chart.prescriptions;
  const patientResults: DoctorChartResult[] = [
    ...(chart.labResults ?? []).map((item) => ({ ...item, category: "lab" as const })),
    ...(chart.radiologyReports ?? []).map((item) => ({ ...item, category: "imaging" as const })),
  ];
  const flagColors: Record<string, string> = { normal: "text-emerald-600", high: "text-amber-600", low: "text-sky-600", critical: "text-red-600" };
  const flagBg: Record<string, string> = { normal: "bg-emerald-500/10 border-emerald-500/30", high: "bg-amber-500/10 border-amber-500/30", low: "bg-sky-500/10 border-sky-500/30", critical: "bg-red-500/10 border-red-500/30" };

  async function handleAddDiagnosis() {
    if (!selectedDiagnosis?.icd10Code) {
      setDiagnosisMessage("Select a diagnosis with an ICD-10 code first.");
      return;
    }
    setSavingDiagnosis(true);
    setDiagnosisMessage(null);
    try {
      await createDoctorDiagnosis(
        {
          patientId: id,
          icdCode: selectedDiagnosis.icd10Code,
          description: selectedDiagnosis.label,
          diagnosisType: "primary",
          status: "active",
          snomedCode: selectedDiagnosis.snomedCode ?? undefined,
          snomedDisplay: selectedDiagnosis.snomedDisplay ?? selectedDiagnosis.label,
        },
        token ?? undefined,
      );
      const refreshed = await getDoctorPatientChart(id, token ?? undefined);
      setChart(refreshed);
      setSelectedDiagnosis(null);
      setDiagnosisMessage("Diagnosis added from ontology catalog.");
    } catch (error) {
      setDiagnosisMessage(error instanceof Error ? error.message : "Failed to add diagnosis.");
    } finally {
      setSavingDiagnosis(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Link href="/doctor/patients" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to Patients
        </Link>
        <div className="flex gap-2">
          <Link href={`/doctor/encounters/new?patientId=${id}`}>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"><FileText className="h-3.5 w-3.5" /> New Note</Button>
          </Link>
          <Link href={`/doctor/orders?patientId=${id}`}>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"><Plus className="h-3.5 w-3.5" /> New Order</Button>
          </Link>
          <Link href={`/doctor/prescriptions?patientId=${id}`}>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"><Pill className="h-3.5 w-3.5" /> Prescribe</Button>
          </Link>
          <Link href={`/cdss/patient/${id}/graph`}>
            <Button size="sm" className="h-8 text-xs gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/20">
              <Network className="h-3.5 w-3.5" /> Knowledge Graph
            </Button>
          </Link>
        </div>
      </div>

      <PatientBanner patient={patient} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center gap-1 border-b pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                  activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "summary" && (
            <div className="space-y-4">
              <Card className="border-border/50 shadow-sm overflow-visible">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Active Diagnoses</CardTitle></CardHeader>
                <CardContent>
                  <div className="mb-4 rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Ontology Catalog</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Search real coded diagnoses like diabetes, hypertension, or myocardial infarction and add them with ICD-10 and SNOMED attached.
                    </p>
                    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                      <DiagnosisCatalogCombobox
                        value={selectedDiagnosis}
                        onSelect={setSelectedDiagnosis}
                        onClear={() => setSelectedDiagnosis(null)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => void handleAddDiagnosis()} disabled={savingDiagnosis || !selectedDiagnosis}>
                        {savingDiagnosis ? "Adding…" : "Add Diagnosis"}
                      </Button>
                    </div>
                    {diagnosisMessage && <p className="mt-2 text-xs text-muted-foreground">{diagnosisMessage}</p>}
                  </div>
                  {patientDiagnoses.length === 0 ? <p className="text-xs text-muted-foreground">No diagnoses recorded.</p> : (
                    <div className="space-y-2">
                      {patientDiagnoses.map((diagnosis) => (
                        <div key={diagnosis.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                          <Badge variant="outline" className="text-[10px] font-mono shrink-0">{diagnosis.icdCode ?? diagnosis.code ?? "-"}</Badge>
                          <span className="text-sm flex-1">{diagnosis.description}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">{diagnosis.diagnosisType ?? diagnosis.type ?? "diagnosis"}</Badge>
                          <StatusBadge status={diagnosis.status} />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {patientEncounters.length > 0 && (
                <Card className="border-border/50 shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Latest Encounter</CardTitle></CardHeader>
                  <CardContent>
                    {(() => {
                      const encounter = patientEncounters[0];
                      return (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {encounter.date ? new Date(encounter.date).toLocaleDateString() : "-"} · {encounter.authorName ?? "Doctor"}
                            <Badge variant="secondary" className="text-[10px] capitalize">{encounter.status}</Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{encounter.visitType ?? "visit"}</Badge>
                          </div>
                          {[{ l: "S", v: encounter.subjective }, { l: "O", v: encounter.objective }, { l: "A", v: encounter.assessment }, { l: "P", v: encounter.plan }].map((section) => (
                            <div key={section.l}>
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold mr-1.5">{section.l}</span>
                              <span className="text-sm text-muted-foreground whitespace-pre-line">{section.v}</span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50 shadow-sm">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Active Medications ({patientMeds.filter((medication) => medication.status === "active").length})</CardTitle>
                  <button onClick={() => setActiveTab("medications")} className="text-xs text-primary hover:underline flex items-center gap-0.5">View all <ChevronRight className="h-3 w-3" /></button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {patientMeds.filter((medication) => medication.status === "active").map((medication) => (
                      <span key={medication.id} className="text-xs bg-violet-500/10 text-violet-700 border border-violet-500/20 px-2 py-1 rounded-full">
                        {medication.medicationName ?? medication.medication} {medication.dose ?? medication.dosage} · {medication.frequency}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "notes" && (
            <div className="space-y-3">
              {patientEncounters.length === 0 ? (
                <Card className="border-border/50"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No encounter notes yet.</p></CardContent></Card>
              ) : (
                patientEncounters.map((encounter) => (
                  <Card key={encounter.id} className="border-border/50 shadow-sm">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-sm font-semibold">{encounter.id}</CardTitle>
                          <Badge variant="secondary" className="text-[10px] capitalize">{encounter.status}</Badge>
                          <Badge variant="outline" className="text-[10px] capitalize">{encounter.visitType ?? "visit"}</Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">{encounter.date ? new Date(encounter.date).toLocaleDateString() : "-"} · {encounter.authorName ?? "Doctor"}</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {[{ l: "Subjective", v: encounter.subjective }, { l: "Objective", v: encounter.objective }, { l: "Assessment", v: encounter.assessment }, { l: "Plan", v: encounter.plan }].map((section) => (
                          <div key={section.l}>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{section.l}</p>
                            <p className="text-sm whitespace-pre-line">{section.v}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "orders" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Orders ({patientOrders.length})</CardTitle></CardHeader>
              <CardContent>
                {patientOrders.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No orders for this patient.</p>
                ) : (
                  <div className="space-y-2">
                    {patientOrders.map((order) => (
                      <div key={order.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/40 transition-colors">
                        <Badge variant="outline" className="text-[10px] capitalize shrink-0">{order.category}</Badge>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{order.orderableName ?? order.name ?? "Order"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(order.orderedAt ?? order.createdAt ?? "").toLocaleString()}</p>
                        </div>
                        <Badge variant={order.priority === "stat" ? "destructive" : order.priority === "urgent" ? "default" : "secondary"} className="text-[10px]">{order.priority}</Badge>
                        <StatusBadge status={order.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTab === "medications" && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Medications ({patientMeds.length})</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {patientMeds.map((medication) => (
                    <div key={medication.id} className="p-3 rounded-lg border border-border/50 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{medication.medicationName ?? medication.medication} {medication.dose ?? medication.dosage}</p>
                        <Badge variant="outline" className="text-[10px] capitalize">{medication.route}</Badge>
                        <StatusBadge status={medication.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{medication.instructions ?? medication.sig}</p>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>Frequency: {medication.frequency}</span>
                        <span>Qty: {medication.quantity}</span>
                        <span>Refills: {medication.refillsAllowed ?? medication.refills ?? 0}</span>
                        <span>Start: {medication.startDate}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {activeTab === "results" && (
            <div className="space-y-2">
              {patientResults.length === 0 ? (
                <Card className="border-border/50"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No results available.</p></CardContent></Card>
              ) : (
                patientResults.map((result) => {
                  const mappedFlag = mapResultFlag(result.flag);
                  return (
                    <div key={result.id} className={cn("flex items-center gap-4 p-3 rounded-lg border", flagBg[mappedFlag])}>
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{result.testName ?? result.examName ?? "Result"}</p>
                        <p className="text-xs text-muted-foreground">{new Date(result.reportedAt ?? "").toLocaleString()}</p>
                      </div>
                      <span className={cn("text-lg font-bold", flagColors[mappedFlag])}>
                        {result.value ?? result.impression ?? result.findings ?? "-"} <span className="text-xs font-normal text-muted-foreground">{result.unit}</span>
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">Ref: {result.referenceRange ?? "-"}</span>
                      <Badge variant="outline" className={cn("text-[10px]", flagColors[mappedFlag])}>{mappedFlag}</Badge>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "ai" && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <PatientReportPanel patientId={id} />
              <PatientChatPanel
                patientId={id}
                patientName={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
              />
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-4 space-y-3">
            {cdssFeedMessage && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                {cdssFeedMessage}
              </div>
            )}
            <DoctorCDSSPanel patientId={id} clinicianRole="Attending Physician" clinicianName="Current Clinician" />
          </div>
        </div>
      </div>
    </div>
  );
}
