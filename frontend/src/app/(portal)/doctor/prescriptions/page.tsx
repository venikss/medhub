"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, CheckCircle2, Package, Pill, Plus, Send } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { StatCard } from "@/components/molecules/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createDoctorPrescription, type DoctorAdmission, type DoctorPrescription, listAdmissions, listDoctorPrescriptions } from "@/features/doctor/api";
import {
  MedicationCombobox,
  isCustomMedication,
  type MedicationSelection,
} from "@/features/pharmacy/components/MedicationCombobox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FormularyItem } from "@/types";
import { cn } from "@/lib/utils";

// Map formulary form → route string used by backend
const FORM_TO_ROUTE: Record<string, string> = {
  tablet: "oral",
  capsule: "oral",
  oral: "oral",
  liquid: "oral",
  syrup: "oral",
  suspension: "oral",
  solution: "oral",
  injection: "iv",
  iv: "iv",
  infusion: "iv",
  im: "im",
  topical: "topical",
  cream: "topical",
  ointment: "topical",
  patch: "transdermal",
  inhaler: "inhaled",
  nebuliser: "inhaled",
  suppository: "rectal",
  drops: "ophthalmic",
  spray: "nasal",
  sublingual: "sublingual",
};

function routeFromFormularyItem(item: FormularyItem): string {
  const form = (item.form ?? "").toLowerCase();
  return FORM_TO_ROUTE[form] ?? form ?? "oral";
}

const ROUTES = [
  "oral",
  "iv",
  "im",
  "sc",
  "topical",
  "inhaled",
  "sublingual",
  "rectal",
  "nasal",
  "ophthalmic",
  "otic",
  "transdermal",
  "other",
];

const FREQUENCIES = [
  "QD (once daily)",
  "BID (twice daily)",
  "TID (three times daily)",
  "QID (four times daily)",
  "Q4H",
  "Q6H",
  "Q8H",
  "Q12H",
  "QHS (at bedtime)",
  "QOD (every other day)",
  "PRN (as needed)",
  "Q6H PRN",
  "Q8H PRN",
  "STAT (once immediately)",
];

const formularyStatusColor: Record<string, string> = {
  formulary: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "non-formulary": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  restricted: "bg-red-500/10 text-red-700 border-red-500/20",
  investigational: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

function PrescriptionsInner() {
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const urlPatientId = searchParams.get("patientId") ?? undefined;
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);
  const [patients, setPatients] = useState<DoctorAdmission[]>([]);
  const patientId = urlPatientId ?? selectedPatientId;

  const [showForm, setShowForm] = useState(false);
  const [selectedMed, setSelectedMed] = useState<MedicationSelection | null>(null);
  const [prescriptions, setPrescriptions] = useState<DoctorPrescription[]>([]);
  const [draft, setDraft] = useState({
    dosage: "",
    route: "oral",
    frequency: "QD (once daily)",
    quantity: "30",
    refills: "3",
    sig: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (urlPatientId) return;
    if (!user?.id) return;
    let cancelled = false;
    void listAdmissions({ status: "admitted", doctorId: user.id }, token ?? undefined)
      .then((data) => { if (!cancelled) setPatients(data); })
      .catch(() => { if (!cancelled) setPatients([]); });
    return () => { cancelled = true; };
  }, [urlPatientId, token, user?.id]);

  useEffect(() => {
    let cancelled = false;
    void listDoctorPrescriptions({ patientId }, token ?? undefined)
      .then((data) => { if (!cancelled) setPrescriptions(data); })
      .catch(() => { if (!cancelled) setPrescriptions([]); });
    return () => { cancelled = true; };
  }, [patientId, token]);

  const activeMeds = useMemo(() => prescriptions.filter((p) => p.status === "active"), [prescriptions]);
  const onHold = useMemo(() => prescriptions.filter((p) => p.status === "on-hold"), [prescriptions]);

  function handleMedSelect(item: MedicationSelection) {
    setSelectedMed(item);
    setError(null);
    setMessage(null);

    if (!isCustomMedication(item)) {
      // Auto-fill from formulary data
      const strength = item.strengths[0] ?? "";
      const route = routeFromFormularyItem(item);
      setDraft((prev) => ({
        ...prev,
        dosage: strength,
        route,
        sig: `Take ${strength || "prescribed dose"} ${route} ${prev.frequency}`,
      }));
    } else {
      setDraft((prev) => ({ ...prev, dosage: "", route: "oral", sig: "" }));
    }
  }

  async function handleSubmitPrescription() {
    setError(null);
    setMessage(null);

    if (!patientId) {
      setError("Select a patient before submitting.");
      return;
    }
    if (!selectedMed) {
      setError("Choose a medication first.");
      return;
    }

    const quantity = Number.parseInt(draft.quantity, 10);
    const refills = Number.parseInt(draft.refills, 10);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setError("Quantity must be greater than 0.");
      return;
    }
    if (!Number.isFinite(refills) || refills < 0) {
      setError("Refills must be 0 or greater.");
      return;
    }

    const medicationName = isCustomMedication(selectedMed)
      ? selectedMed.name
      : selectedMed.genericName;

    setSubmitting(true);
    try {
      const created = await createDoctorPrescription(
        {
          patientId,
          medicationName,
          dose: draft.dosage,
          route: draft.route,
          frequency: draft.frequency,
          quantity,
          refillsAllowed: refills,
          instructions: draft.sig,
          startDate: new Date().toISOString().slice(0, 10),
          generic_name: isCustomMedication(selectedMed) ? undefined : selectedMed.genericName,
          rxnormCode: isCustomMedication(selectedMed) ? undefined : selectedMed.rxnormCode,
        },
        token ?? undefined,
      );

      setPrescriptions((prev) => [created, ...prev]);
      setMessage("Prescription submitted successfully.");
      setSelectedMed(null);
      setDraft({ dosage: "", route: "oral", frequency: "QD (once daily)", quantity: "30", refills: "3", sig: "" });
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Failed to submit prescription.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const formularyItem =
    selectedMed && !isCustomMedication(selectedMed) ? (selectedMed as FormularyItem) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Prescriptions</h1>
          <p className="mt-1 text-sm text-muted-foreground">Active medications and new prescription entry</p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" /> New Rx
        </Button>
      </div>

      {!urlPatientId && (
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-muted-foreground shrink-0">Patient</span>
          <Select value={selectedPatientId ?? ""} onValueChange={(v) => setSelectedPatientId(v || undefined)}>
            <SelectTrigger className="w-72">
              <SelectValue placeholder="Select a patient…" />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.patientId} value={p.patientId}>
                  {p.patientName} — {p.mrn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Active Prescriptions" value={activeMeds.length} icon={Pill} iconClassName="bg-violet-500/10 text-violet-600" />
        <StatCard title="Patients on Meds" value={new Set(activeMeds.map((item) => item.patientId)).size} icon={Pill} iconClassName="bg-cyan-500/10 text-cyan-600" />
        <StatCard title="On Hold" value={onHold.length} icon={Pill} iconClassName="bg-amber-500/10 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {showForm && (
          <Card className="border-border/50 shadow-sm lg:col-span-2 overflow-visible">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Pill className="h-4 w-4 text-primary" /> New Prescription
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
                </div>
              )}
              {message && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {message}
                </div>
              )}

              {/* ── Medication picker ── */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Medication
                </label>
                <MedicationCombobox
                  value={selectedMed}
                  onSelect={handleMedSelect}
                  onClear={() => { setSelectedMed(null); setDraft({ dosage: "", route: "oral", frequency: "QD (once daily)", quantity: "30", refills: "3", sig: "" }); }}
                />
              </div>

              {/* ── Formulary chip row (shown when a formulary item is selected) ── */}
              {formularyItem && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-2">
                  <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize", formularyStatusColor[formularyItem.formularyStatus])}>
                    {formularyItem.formularyStatus}
                  </span>
                  {formularyItem.drugClass && (
                    <Badge variant="outline" className="h-auto rounded-full px-2 py-0.5 text-[10px]">
                      {formularyItem.drugClass}
                    </Badge>
                  )}
                  {formularyItem.brandNames[0] && (
                    <Badge variant="outline" className="h-auto rounded-full px-2 py-0.5 text-[10px] text-muted-foreground">
                      {formularyItem.brandNames[0]}
                    </Badge>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-[10px]">
                    <Package className="h-3 w-3" />
                    <span className={cn(
                      "font-medium",
                      formularyItem.stockLevel === 0 ? "text-red-600" :
                      formularyItem.stockLevel <= formularyItem.reorderPoint ? "text-amber-600" :
                      "text-emerald-700"
                    )}>
                      {formularyItem.stockLevel === 0 ? "Out of stock" :
                       formularyItem.stockLevel <= formularyItem.reorderPoint ? `${formularyItem.stockLevel} (low)` :
                       `${formularyItem.stockLevel} in stock`}
                    </span>
                  </span>
                </div>
              )}

              {/* ── Detail fields (always shown so user can type directly) ── */}
              {selectedMed && (
                <div className="space-y-3 border-t pt-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Dosage</label>
                      <Input
                        value={draft.dosage}
                        onChange={(e) => setDraft((p) => ({ ...p, dosage: e.target.value }))}
                        placeholder="e.g. 500mg"
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Route</label>
                      <select
                        value={draft.route}
                        onChange={(e) => setDraft((p) => ({ ...p, route: e.target.value }))}
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring capitalize"
                      >
                        {ROUTES.map((r) => (
                          <option key={r} value={r} className="capitalize">{r}</option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-2">
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Frequency</label>
                      <select
                        value={draft.frequency}
                        onChange={(e) => setDraft((p) => ({ ...p, frequency: e.target.value }))}
                        className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {FREQUENCIES.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Quantity</label>
                      <Input
                        type="number"
                        min={1}
                        value={draft.quantity}
                        onChange={(e) => setDraft((p) => ({ ...p, quantity: e.target.value }))}
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-semibold uppercase text-muted-foreground">Refills</label>
                      <Input
                        type="number"
                        min={0}
                        value={draft.refills}
                        onChange={(e) => setDraft((p) => ({ ...p, refills: e.target.value }))}
                        className="mt-0.5 h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-semibold uppercase text-muted-foreground">SIG / Instructions</label>
                    <Textarea
                      value={draft.sig}
                      onChange={(e) => setDraft((p) => ({ ...p, sig: e.target.value }))}
                      placeholder="e.g. Take 1 tablet by mouth twice daily with food"
                      className="mt-0.5 resize-none text-sm"
                      rows={2}
                    />
                  </div>

                  <Button className="w-full gap-2" disabled={submitting} onClick={() => void handleSubmitPrescription()}>
                    <Send className="h-3.5 w-3.5" />
                    {submitting ? "Submitting…" : "Submit Prescription"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card className={cn("border-border/50 shadow-sm", showForm ? "lg:col-span-3" : "lg:col-span-5")}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Pill className="h-4 w-4 text-primary" /> Active Prescriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-2 text-left font-medium">Medication</th>
                    <th className="py-2 text-left font-medium">Patient</th>
                    <th className="py-2 text-left font-medium">Dosage</th>
                    <th className="py-2 text-left font-medium">Route</th>
                    <th className="py-2 text-left font-medium">Frequency</th>
                    <th className="py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx) => (
                    <tr key={rx.id} className="border-b border-border/30 transition-colors hover:bg-muted/40">
                      <td className="py-2.5">
                        <div className="font-medium">{rx.genericName ?? rx.generic_name ?? rx.medicationName}</div>
                        {(rx.displayMedicationName && (rx.genericName ?? rx.generic_name) && rx.displayMedicationName !== (rx.genericName ?? rx.generic_name)) && (
                          <div className="text-xs text-muted-foreground">{rx.displayMedicationName}</div>
                        )}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{rx.patientName}</td>
                      <td className="py-2.5">{rx.dose}</td>
                      <td className="py-2.5"><Badge variant="outline" className="text-[10px] capitalize">{rx.route}</Badge></td>
                      <td className="py-2.5 text-xs text-muted-foreground">{rx.frequency}</td>
                      <td className="py-2.5"><StatusBadge status={rx.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function PrescriptionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><p className="text-sm text-muted-foreground">Loading...</p></div>}>
      <PrescriptionsInner />
    </Suspense>
  );
}
