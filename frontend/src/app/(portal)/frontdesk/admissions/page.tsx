"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, ArrowRightLeft, Clock, LogOut, UserPlus, Search, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { StatCard } from "@/components/molecules/StatCard";
import { BedMap } from "@/features/frontdesk/components/BedMap";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createAdmission, dischargeAdmission, getFrontDeskAdmissionLookups, listAdmissions, listBeds, listPatients, transferAdmission } from "@/features/frontdesk/api";
import type { Admission, AdminDepartment, AdminUser, BedInfo, Ward } from "@/types";

const tabs = ["All", "Inpatient", "Outpatient", "Emergency", "Observation"] as const;
const admissionTypes = ["inpatient", "outpatient", "emergency", "observation"] as const;
const dischargeTypes = ["home", "transfer", "ama", "expired"] as const;

type Patient = { id: string; mrn: string; firstName: string; lastName: string; fullName?: string };

export default function AdmissionsPage() {
  const token = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<string>("All");
  const [showBedMap, setShowBedMap] = useState(false);
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [beds, setBeds] = useState<BedInfo[]>([]);

  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" });
  const showAlert = useCallback((title: string, message: string) => setAlertDialog({ open: true, title, message }), []);

  const [admitDialog, setAdmitDialog] = useState(false);
  const [admitStep, setAdmitStep] = useState<"patient" | "details" | "vitals">("patient");
  const [admitPatients, setAdmitPatients] = useState<Patient[]>([]);
  const [admitSearch, setAdmitSearch] = useState("");
  const [admitSelectedPatient, setAdmitSelectedPatient] = useState<Patient | null>(null);
  const [admitType, setAdmitType] = useState<string>("inpatient");
  const [admitReason, setAdmitReason] = useState("");
  const [admitSubmitting, setAdmitSubmitting] = useState(false);
  const [admitDoctorId, setAdmitDoctorId] = useState("");
  const [admitDeptId, setAdmitDeptId] = useState("");
  const [admitWardId, setAdmitWardId] = useState("");
  const [admitBedId, setAdmitBedId] = useState("");
  const [doctors, setDoctors] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [admitBeds, setAdmitBeds] = useState<BedInfo[]>([]);

  const [admitCreated, setAdmitCreated] = useState<{ id: string; patientId: string; patientName: string } | null>(null);
  const [vSystolic, setVSystolic] = useState("");
  const [vDiastolic, setVDiastolic] = useState("");
  const [vHr, setVHr] = useState("");
  const [vSpo2, setVSpo2] = useState("");
  const [vTemp, setVTemp] = useState("");
  const [vRr, setVRr] = useState("");
  const [vPain, setVPain] = useState("");
  const [vGcs, setVGcs] = useState("");
  const [vNotes, setVNotes] = useState("");
  const [vSubmitting, setVSubmitting] = useState(false);
  const [vDone, setVDone] = useState(false);

  const [dischargeDialog, setDischargeDialog] = useState<Admission | null>(null);
  const [dischargeType, setDischargeType] = useState("home");
  const [dischargeSummary, setDischargeSummary] = useState("");
  const [dischargeFollowUp, setDischargeFollowUp] = useState("");
  const [dischargeSubmitting, setDischargeSubmitting] = useState(false);

  const [transferDialog, setTransferDialog] = useState<Admission | null>(null);
  const [transferBedId, setTransferBedId] = useState("");
  const [transferReason, setTransferReason] = useState("");
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const [admissionList, bedList] = await Promise.all([
          listAdmissions({}, token ?? undefined),
          listBeds({}, token ?? undefined),
        ]);
        if (cancelled) return;
        setAdmissions(admissionList);
        setBeds(bedList);
      } catch {
        if (cancelled) return;
        setAdmissions([]);
        setBeds([]);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(
    () => (activeTab === "All" ? admissions : admissions.filter((item) => item.type === activeTab.toLowerCase())),
    [activeTab, admissions],
  );

  const admitted = admissions.filter((item) => item.status === "admitted").length;
  const bedStats = {
    total: beds.length,
    available: beds.filter((bed) => bed.status === "available").length,
    occupied: beds.filter((bed) => bed.status === "occupied").length,
    reserved: beds.filter((bed) => bed.status === "reserved").length,
  };
  const filteredDoctors = admitDeptId ? doctors.filter((doctor) => !doctor.departmentId || doctor.departmentId === admitDeptId) : doctors;
  const visibleWards = admitDeptId ? wards.filter((ward) => ward.departmentId === admitDeptId) : wards;
  const selectedDoctor = doctors.find((doctor) => doctor.id === admitDoctorId);
  const selectedDepartment = departments.find((department) => department.id === admitDeptId);
  const selectedWard = wards.find((ward) => ward.id === admitWardId);
  const selectedBed = admitBeds.find((bed) => bed.bedId === admitBedId);
  function handleDoctorChange(value: string) {
    setAdmitDoctorId(value);
    const selectedDoctor = doctors.find((doctor) => doctor.id === value);
    if (selectedDoctor?.departmentId) {
      setAdmitDeptId(selectedDoctor.departmentId);
      if (admitWardId && !wards.some((ward) => ward.id === admitWardId && ward.departmentId === selectedDoctor.departmentId)) {
        setAdmitWardId("");
        setAdmitBedId("");
      }
    }
  }

  function handleDepartmentChange(value: string) {
    setAdmitDeptId(value);
    setAdmitWardId("");
    setAdmitBedId("");
    const selectedDoctor = doctors.find((doctor) => doctor.id === admitDoctorId);
    if (selectedDoctor?.departmentId && selectedDoctor.departmentId !== value) {
      setAdmitDoctorId("");
    }
  }

  async function openAdmitDialog() {
    if (!token) return;
    const patients = await listPatients({}, token);
    if (patients.length === 0) {
      showAlert("No Patients", "No registered patients are available for admission yet.");
      return;
    }
    setAdmitPatients(patients);
    setAdmitSearch("");
    setAdmitSelectedPatient(null);
    setAdmitType("inpatient");
    setAdmitReason("");
    setAdmitDoctorId("");
    setAdmitDeptId("");
    setAdmitWardId("");
    setAdmitBedId("");
    setAdmitStep("patient");
    setAdmitDialog(true);
    setAdmitCreated(null);
    setVSystolic(""); setVDiastolic(""); setVHr(""); setVSpo2("");
    setVTemp(""); setVRr(""); setVPain(""); setVGcs(""); setVNotes("");
    setVSubmitting(false); setVDone(false);
    void getFrontDeskAdmissionLookups({}, token)
      .then((lookup) => {
        setDoctors(lookup.doctors);
        setDepartments(lookup.departments);
        setWards(lookup.wards);
        setAdmitBeds(lookup.beds);
        setAdmitDoctorId(lookup.meta.recommendedDoctorId ?? lookup.doctors[0]?.id ?? "");
        setAdmitDeptId(lookup.meta.recommendedDepartmentId ?? lookup.doctors[0]?.departmentId ?? "");
      })
      .catch((error) => {
        showAlert("Lookup Error", error instanceof Error ? error.message : "We couldn't load admission lookup data.");
      });
  }

  const admitFilteredPatients = useMemo(() => {
    if (!admitSearch.trim()) return admitPatients.slice(0, 10);
    const needle = admitSearch.trim().toLowerCase();
    return admitPatients.filter((p) => {
      const name = (p.fullName ?? `${p.firstName} ${p.lastName}`).toLowerCase();
      return name.includes(needle) || p.mrn.toLowerCase().includes(needle);
    }).slice(0, 10);
  }, [admitSearch, admitPatients]);

  function selectPatientAndContinue(patient: Patient) {
    setAdmitSelectedPatient(patient);
    setAdmitStep("details");
  }

  async function submitAdmission() {
    if (!token || !admitSelectedPatient || admitSubmitting) return;
    if (!admitReason.trim()) {
      showAlert("Missing Field", "Reason for admission is required.");
      return;
    }
    try {
      setAdmitSubmitting(true);
      const payload: Record<string, unknown> = {
        patientId: admitSelectedPatient.id,
        type: admitType,
        status: "active",
        reasonForAdmission: admitReason.trim(),
      };
      if (admitDoctorId) payload.admittingDoctor = admitDoctorId;
      if (admitDeptId) payload.departmentId = admitDeptId;
      if (admitWardId) payload.wardId = admitWardId;
      if (admitBedId) payload.bedId = admitBedId;
      const created = await createAdmission(payload, token);
      setAdmissions((current) => [created, ...current]);
      setAdmitCreated({ id: created.id, patientId: created.patientId, patientName: created.patientName });
      setAdmitStep("vitals");
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "We couldn't create the admission.");
    } finally {
      setAdmitSubmitting(false);
    }
  }

  async function submitAdmissionVitals(skip = false) {
    if (skip || !token || !admitCreated) {
      setAdmitDialog(false);
      if (!skip) showAlert("Admission Created", `${admitCreated?.patientName ?? "Patient"} has been admitted. Vitals can be entered from the nurse station.`);
      return;
    }
    setVSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        patient: admitCreated.patientId,
        is_admission_vitals: true,
      };
      if (vSystolic) body.systolic = Number(vSystolic);
      if (vDiastolic) body.diastolic = Number(vDiastolic);
      if (vHr) body.heart_rate = Number(vHr);
      if (vSpo2) body.spo2 = Number(vSpo2);
      if (vTemp) body.temperature = Number(vTemp);
      if (vRr) body.respiratory_rate = Number(vRr);
      if (vPain) body.pain_score = Number(vPain);
      if (vGcs) body.gcs = Number(vGcs);
      if (vNotes) body.notes = vNotes;
      await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api"}/nurses/vitals/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      setVDone(true);
      setTimeout(() => setAdmitDialog(false), 1200);
    } catch {
      showAlert("Vitals Error", "Admission created but vitals could not be saved. Please enter them from the nurse station.");
      setAdmitDialog(false);
    } finally {
      setVSubmitting(false);
    }
  }

  function openDischargeDialog(admission: Admission) {
    setDischargeType("home");
    setDischargeSummary("");
    setDischargeFollowUp("");
    setDischargeDialog(admission);
  }

  async function submitDischarge() {
    if (!token || !dischargeDialog || dischargeSubmitting) return;
    if (!dischargeSummary.trim()) {
      showAlert("Missing Field", "Discharge summary is required.");
      return;
    }
    try {
      setDischargeSubmitting(true);
      await dischargeAdmission(
        dischargeDialog.id,
        { dischargeType, summary: dischargeSummary.trim(), followUpDate: dischargeFollowUp.trim() || undefined },
        token,
      );
      const admissionList = await listAdmissions({}, token);
      setAdmissions(admissionList);
      setDischargeDialog(null);
      showAlert("Success", `Discharged ${dischargeDialog.patientName}.`);
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "We couldn't discharge the patient.");
    } finally {
      setDischargeSubmitting(false);
    }
  }

  function openTransferDialog(admission: Admission) {
    const availableBeds = beds.filter((bed) => bed.status === "available");
    if (availableBeds.length === 0) {
      showAlert("No Beds", "No available beds found for transfer.");
      return;
    }
    setTransferBedId("");
    setTransferReason("");
    setTransferDialog(admission);
  }

  async function submitTransfer() {
    if (!token || !transferDialog || transferSubmitting) return;
    const selectedBed = beds.find((b) => b.bedId === transferBedId);
    if (!selectedBed || !selectedBed.wardId) {
      showAlert("Invalid Bed", "Please select a valid destination bed.");
      return;
    }
    if (!transferReason.trim()) {
      showAlert("Missing Field", "Transfer reason is required.");
      return;
    }
    try {
      setTransferSubmitting(true);
      await transferAdmission(
        transferDialog.id,
        { fromWard: transferDialog.wardId, fromBed: transferDialog.bedId, toWard: selectedBed.wardId, toBed: selectedBed.bedId, reason: transferReason.trim() },
        token,
      );
      const [admissionList, bedList] = await Promise.all([listAdmissions({}, token), listBeds({}, token)]);
      setAdmissions(admissionList);
      setBeds(bedList);
      setTransferDialog(null);
      showAlert("Success", `Transferred ${transferDialog.patientName}.`);
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "We couldn't transfer the admission.");
    } finally {
      setTransferSubmitting(false);
    }
  }

  const availableBeds = useMemo(() => beds.filter((b) => b.status === "available"), [beds]);

  return (
    <div className="space-y-6">
      {/* Alert Dialog */}
      <Dialog open={alertDialog.open} onOpenChange={(open) => setAlertDialog((p) => ({ ...p, open }))}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{alertDialog.title}</DialogTitle>
            <DialogDescription>{alertDialog.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setAlertDialog((p) => ({ ...p, open: false }))}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Admission Dialog */}
      <Dialog open={admitDialog} onOpenChange={(open) => { if (!open) setAdmitDialog(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {admitStep === "patient" && "New Admission"}
              {admitStep === "details" && "Admission Details"}
              {admitStep === "vitals" && (
                <span className="flex items-center gap-2"><Activity className="h-4 w-4 text-emerald-600" /> Record Admission Vitals</span>
              )}
            </DialogTitle>
            <DialogDescription>
              {admitStep === "patient" && "Search and select a patient"}
              {admitStep === "details" && `Admission details for ${admitSelectedPatient?.fullName ?? `${admitSelectedPatient?.firstName} ${admitSelectedPatient?.lastName}`}`}
              {admitStep === "vitals" && (
                <span className="text-emerald-700 font-medium">
                  ✓ {admitCreated?.patientName} admitted. Enter baseline vitals now or skip to enter later.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {admitStep === "patient" ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name or MRN..." value={admitSearch} onChange={(e) => setAdmitSearch(e.target.value)} className="pl-9" />
              </div>
              <div className="max-h-60 overflow-y-auto space-y-1">
                {admitFilteredPatients.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPatientAndContinue(p)}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium">{p.fullName ?? `${p.firstName} ${p.lastName}`}</p>
                      <p className="text-xs text-muted-foreground font-mono">{p.mrn}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">Select</Badge>
                  </button>
                ))}
                {admitFilteredPatients.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No patients match your search.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label>Admission Type</Label>
                <Select value={admitType} onValueChange={setAdmitType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {admissionTypes.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Admitting Doctor</Label>
                <Select value={admitDoctorId} onValueChange={handleDoctorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a doctor...">
                      {selectedDoctor ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}` : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {filteredDoctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.firstName} {d.lastName}{d.specialization ? ` - ${d.specialization}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={admitDeptId} onValueChange={handleDepartmentChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department...">
                      {selectedDepartment?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ward</Label>
                <Select value={admitWardId} onValueChange={(v) => { setAdmitWardId(v); setAdmitBedId(""); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select ward...">
                      {selectedWard ? `${selectedWard.name} (${selectedWard.departmentName})` : undefined}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {visibleWards.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.name} ({w.departmentName})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {admitWardId && (() => {
                const wardBeds = admitBeds.filter((b) => b.wardId === admitWardId && b.status === "available");
                return wardBeds.length > 0 ? (
                  <div className="space-y-2">
                    <Label>Bed</Label>
                    <Select value={admitBedId} onValueChange={setAdmitBedId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select bed...">
                          {selectedBed ? `Bed ${selectedBed.bedNumber} (Room ${selectedBed.roomNumber})` : undefined}
                        </SelectValue>
                      </SelectTrigger>
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
              <div className="space-y-2">
                <Label>Reason for Admission</Label>
                <Textarea placeholder="Enter reason for admission..." value={admitReason} onChange={(e) => setAdmitReason(e.target.value)} rows={3} />
              </div>
            </div>
          )}

          {admitStep === "vitals" && (
            <div className="space-y-3">
              {vDone ? (
                <div className="flex flex-col items-center gap-2 py-6">
                  <span className="text-4xl">✅</span>
                  <p className="text-sm font-medium text-emerald-700">Vitals saved successfully!</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Systolic BP (mmHg)</Label>
                      <Input type="number" placeholder="120" value={vSystolic} onChange={e => setVSystolic(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Diastolic BP (mmHg)</Label>
                      <Input type="number" placeholder="80" value={vDiastolic} onChange={e => setVDiastolic(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Heart Rate (bpm)</Label>
                      <Input type="number" placeholder="72" value={vHr} onChange={e => setVHr(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">SpO₂ (%)</Label>
                      <Input type="number" placeholder="98" value={vSpo2} onChange={e => setVSpo2(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Temperature (°C)</Label>
                      <Input type="number" step="0.1" placeholder="36.6" value={vTemp} onChange={e => setVTemp(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Respiratory Rate (/min)</Label>
                      <Input type="number" placeholder="16" value={vRr} onChange={e => setVRr(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Pain Score (0–10)</Label>
                      <Input type="number" min={0} max={10} placeholder="0" value={vPain} onChange={e => setVPain(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">GCS (3–15)</Label>
                      <Input type="number" min={3} max={15} placeholder="15" value={vGcs} onChange={e => setVGcs(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs">Notes <span className="text-muted-foreground">(optional)</span></Label>
                    <Textarea rows={2} className="mt-1 text-xs resize-none" placeholder="Any additional admission notes..." value={vNotes} onChange={e => setVNotes(e.target.value)} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">These will be saved as the baseline admission vitals and linked to the patient KG.</p>
                </>
              )}
            </div>
          )}

          <DialogFooter>
            {admitStep === "details" && (
              <>
                <Button variant="outline" onClick={() => setAdmitStep("patient")}>Back</Button>
                <Button onClick={() => void submitAdmission()} disabled={admitSubmitting}>
                  {admitSubmitting ? "Creating..." : "Create Admission"}
                </Button>
              </>
            )}
            {admitStep === "vitals" && !vDone && (
              <>
                <Button variant="ghost" className="text-xs" onClick={() => void submitAdmissionVitals(true)}>Skip for Now</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1.5"
                  disabled={vSubmitting || (!vSystolic && !vHr && !vSpo2 && !vTemp)}
                  onClick={() => void submitAdmissionVitals(false)}
                >
                  {vSubmitting ? "Saving..." : <><Activity className="h-3.5 w-3.5" /> Save Vitals</>}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Discharge Dialog */}
      <Dialog open={!!dischargeDialog} onOpenChange={(open) => { if (!open) setDischargeDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Discharge Patient</DialogTitle>
            <DialogDescription>Discharge {dischargeDialog?.patientName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Discharge Type</Label>
              <Select value={dischargeType} onValueChange={setDischargeType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {dischargeTypes.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Discharge Summary</Label>
              <Textarea placeholder="Enter discharge summary..." value={dischargeSummary} onChange={(e) => setDischargeSummary(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Date <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input type="date" value={dischargeFollowUp} onChange={(e) => setDischargeFollowUp(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDischargeDialog(null)}>Cancel</Button>
            <Button onClick={() => void submitDischarge()} disabled={dischargeSubmitting} className="bg-red-600 hover:bg-red-700">
              {dischargeSubmitting ? "Discharging..." : "Discharge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={!!transferDialog} onOpenChange={(open) => { if (!open) setTransferDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Transfer Patient</DialogTitle>
            <DialogDescription>Transfer {transferDialog?.patientName} to a new bed</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Destination Bed</Label>
              <Select value={transferBedId} onValueChange={setTransferBedId}>
                <SelectTrigger><SelectValue placeholder="Select a bed..." /></SelectTrigger>
                <SelectContent>
                  {availableBeds.map((bed) => (
                    <SelectItem key={bed.bedId} value={bed.bedId}>
                      {bed.wardName ?? bed.ward} — Bed {bed.bedNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Transfer Reason</Label>
              <Textarea placeholder="Enter reason for transfer..." value={transferReason} onChange={(e) => setTransferReason(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDialog(null)}>Cancel</Button>
            <Button onClick={() => void submitTransfer()} disabled={transferSubmitting}>
              {transferSubmitting ? "Transferring..." : "Transfer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ADT Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Admissions, discharges, and transfers</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setShowBedMap(!showBedMap)}>
            <BedDouble className="h-4 w-4" /> {showBedMap ? "Hide" : "Show"} Bed Map
          </Button>
          <Button className="gap-2" onClick={() => void openAdmitDialog()}>
            <UserPlus className="h-4 w-4" /> New Admission
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard title="Active Admissions" value={admitted} icon={UserPlus} iconClassName="bg-cyan-500/10 text-cyan-600" />
        <StatCard title="Available Beds" value={bedStats.available} icon={BedDouble} iconClassName="bg-emerald-500/10 text-emerald-600" />
        <StatCard title="Occupied Beds" value={bedStats.occupied} icon={BedDouble} iconClassName="bg-sky-500/10 text-sky-600" />
        <StatCard title="Reserved Beds" value={bedStats.reserved} icon={BedDouble} iconClassName="bg-amber-500/10 text-amber-600" />
      </div>

      {showBedMap && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BedDouble className="h-4 w-4 text-primary" /> Bed Map
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BedMap beds={beds} />
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeTab === tab
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
            }`}
          >
            {tab}
            {tab !== "All" && (
              <span className="ml-1 opacity-70">
                ({admissions.filter((item) => item.type === tab.toLowerCase()).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
            <BedDouble className="h-12 w-12 text-muted-foreground/20" />
            <p className="text-sm font-medium">No admissions in this category</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((admission) => {
            const initials = admission.patientName
              .split(" ")
              .map((n: string) => n[0] ?? "")
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const typeColor: Record<string, string> = {
              inpatient: "bg-sky-500/15 text-sky-700 border-sky-200",
              outpatient: "bg-emerald-500/15 text-emerald-700 border-emerald-200",
              emergency: "bg-red-500/15 text-red-700 border-red-200",
              observation: "bg-amber-500/15 text-amber-700 border-amber-200",
            };
            const admittedDate = new Date(admission.admittedAt);
            const diffHours = Math.floor((Date.now() - admittedDate.getTime()) / 3_600_000);
            const lengthOfStay = diffHours < 24 ? `${diffHours}h` : `${Math.floor(diffHours / 24)}d`;
            return (
              <div
                key={admission.id}
                className="flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card shadow-sm transition-all hover:shadow-md"
              >
                {/* Top accent bar */}
                <div className={`h-1.5 w-full ${admission.type === "emergency" ? "bg-red-500" : admission.type === "inpatient" ? "bg-sky-500" : admission.type === "outpatient" ? "bg-emerald-500" : "bg-amber-400"}`} />

                <div className="flex items-start gap-3 p-4">
                  {/* Avatar */}
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-border/50 bg-muted text-sm font-bold text-muted-foreground">
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{admission.patientName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{admission.mrn}</p>
                      </div>
                      <StatusBadge status={admission.status} />
                    </div>

                    <div className="mt-2 space-y-1">
                      {/* Type badge */}
                      <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium capitalize ${typeColor[admission.type] ?? "bg-muted text-muted-foreground"}`}>
                        {admission.type}
                      </span>

                      {/* Ward/Bed */}
                      {admission.ward && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <BedDouble className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                          <span>{admission.ward}{admission.bed ? ` · Bed ${admission.bed}` : ""}</span>
                        </div>
                      )}

                      {/* Doctor */}
                      {admission.admittingDoctor && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Activity className="h-3.5 w-3.5 shrink-0 text-indigo-500" />
                          <span className="truncate">Dr. {admission.admittingDoctor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-auto flex items-center justify-between border-t border-border/30 bg-muted/20 px-4 py-2">
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>LOS {lengthOfStay} · {admittedDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] gap-1"
                      onClick={() => openTransferDialog(admission)}
                    >
                      <ArrowRightLeft className="h-3 w-3" /> Transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-[11px] gap-1 text-red-600 hover:text-red-700"
                      onClick={() => openDischargeDialog(admission)}
                    >
                      <LogOut className="h-3 w-3" /> Discharge
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
