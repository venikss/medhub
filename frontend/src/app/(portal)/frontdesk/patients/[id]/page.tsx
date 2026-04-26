"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Phone, Mail, Calendar, MapPin, Heart, Shield, AlertTriangle, FileText, CheckCircle2, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { createAdmission, getFrontDeskAdmissionLookups, getFrontDeskPatientSummary } from "@/features/frontdesk/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { Admission, AdminDepartment, AdminUser, BedInfo, Insurance, Ward } from "@/types";

const admissionTypes = ["inpatient", "outpatient", "emergency", "observation"] as const;

export default function PatientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const token = useAuthStore((state) => state.token);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getFrontDeskPatientSummary>> | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Admit dialog
  const [admitDialog, setAdmitDialog] = useState(false);
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

  // Alert dialog
  const [alertDialog, setAlertDialog] = useState<{ open: boolean; title: string; message: string }>({ open: false, title: "", message: "" });
  const showAlert = useCallback((title: string, message: string) => setAlertDialog({ open: true, title, message }), []);

  useEffect(() => {
    let cancelled = false;

    void getFrontDeskPatientSummary(id, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setSummary(data);
          setNotFound(false);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setSummary(null);
          const message = error instanceof Error ? error.message : "We couldn't load this patient.";
          const isNotFound = /404|patient not found/i.test(message);
          setNotFound(isNotFound);
          setLoadError(isNotFound ? null : message);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, token]);

  if (notFound) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <p className="text-lg font-semibold">Patient not found</p>
          <Link href="/frontdesk/patients"><Button variant="outline">Back to search</Button></Link>
        </div>
      </div>
    );
  }

  if (!summary) {
    if (loadError) {
      return <div className="text-sm text-destructive">{loadError}</div>;
    }
    return <div className="text-sm text-muted-foreground">Loading patient details...</div>;
  }

  const patient = summary.patient;
  const admissions: Admission[] = summary.activeAdmission ? [summary.activeAdmission] : [];
  const age = new Date().getFullYear() - new Date(patient.dateOfBirth).getFullYear();
  const emergencyContact = patient.emergencyContact;
  const insurance = (patient.insurance ?? patient.insuranceDetails ?? null) as Partial<Insurance> | null;
  const address = typeof patient.address === "string"
    ? patient.address
    : Object.values(patient.address ?? {}).filter(Boolean).join(", ");
  const filteredDoctors = admitDeptId ? doctors.filter((doctor) => !doctor.departmentId || doctor.departmentId === admitDeptId) : doctors;
  const visibleWards = admitDeptId ? wards.filter((ward) => ward.departmentId === admitDeptId) : wards;
  const recommendedDoctorId = doctors[0]?.id ?? "";
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

  async function handleAdmitPatient() {
    if (!token || admitSubmitting) return;
    if (summary?.activeAdmission) {
      showAlert("Already Admitted", "This patient already has an active admission.");
      return;
    }
    setAdmitType("inpatient");
    setAdmitReason("");
    setAdmitDoctorId("");
    setAdmitDeptId("");
    setAdmitWardId("");
    setAdmitBedId("");
    setAdmitDialog(true);
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

  async function submitAdmission() {
    if (!token || admitSubmitting) return;
    if (!admitReason.trim()) {
      showAlert("Missing Field", "Reason for admission is required.");
      return;
    }
    try {
      setAdmitSubmitting(true);
      const payload: Record<string, unknown> = {
        patientId: patient!.id,
        type: admitType,
        status: "active",
        reasonForAdmission: admitReason.trim(),
      };
      if (admitDoctorId) payload.admittingDoctor = admitDoctorId;
      if (admitDeptId) payload.departmentId = admitDeptId;
      if (admitWardId) payload.wardId = admitWardId;
      if (admitBedId) payload.bedId = admitBedId;
      const created = await createAdmission(payload, token);
      setAdmitDialog(false);
      showAlert("Success", `Admission created for ${created.patientName}.`);
      router.push("/frontdesk/admissions");
    } catch (error) {
      showAlert("Error", error instanceof Error ? error.message : "We couldn't create the admission.");
    } finally {
      setAdmitSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start gap-4">
        <Link href="/frontdesk/patients">
          <Button variant="ghost" size="icon" className="h-8 w-8 mt-1"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary text-lg font-bold">
              {patient.firstName[0]}{patient.lastName[0]}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{patient.firstName} {patient.lastName}</h1>
                <StatusBadge status={patient.status} />
                {!patient.consentSigned && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">
                    <AlertTriangle className="h-2.5 w-2.5" /> Consent pending
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">{patient.mrn}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/frontdesk/checkin?patientId=${patient.id}`}><Button variant="outline" size="sm">Check In</Button></Link>
          <Button size="sm" onClick={() => void handleAdmitPatient()} disabled={admitSubmitting}>
            {admitSubmitting ? "Admitting..." : "Admit Patient"}
          </Button>
        </div>
      </div>

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

      {/* Admit Dialog */}
      <Dialog open={admitDialog} onOpenChange={setAdmitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admit Patient</DialogTitle>
            <DialogDescription>Create an admission for {patient.firstName} {patient.lastName}</DialogDescription>
          </DialogHeader>
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
                    <SelectItem key={d.id} value={d.id} className="flex justify-between items-center w-full">
                      <div className="flex flex-col">
                        <span className="font-medium">{d.firstName} {d.lastName}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {d.specialization}{d.specialization && " · "}
                          {d.activePatientCount ?? 0} active {d.activePatientCount === 1 ? 'patient' : 'patients'}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {recommendedDoctorId ? (
                <p className="text-[11px] text-muted-foreground">
                  Lowest current load: {doctors.find((doctor) => doctor.id === recommendedDoctorId)?.firstName} {doctors.find((doctor) => doctor.id === recommendedDoctorId)?.lastName}
                </p>
              ) : null}
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdmitDialog(false)}>Cancel</Button>
            <Button onClick={() => void submitAdmission()} disabled={admitSubmitting}>
              {admitSubmitting ? "Creating..." : "Create Admission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Demographics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-6 text-sm">
                <div><span className="text-muted-foreground text-xs block">Date of Birth</span><span className="font-medium flex items-center gap-1"><Calendar className="h-3 w-3 text-muted-foreground" />{patient.dateOfBirth} ({age}y)</span></div>
                <div><span className="text-muted-foreground text-xs block">Gender</span><span className="font-medium capitalize">{patient.gender}</span></div>
                <div><span className="text-muted-foreground text-xs block">Blood Type</span><span className="font-medium">{patient.bloodType || "Unknown"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Phone</span><span className="font-medium flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{patient.phone}</span></div>
                <div><span className="text-muted-foreground text-xs block">Email</span><span className="font-medium flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{patient.email || "-"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Language</span><span className="font-medium">{patient.preferredLanguage || "English"}</span></div>
                <div className="col-span-2 sm:col-span-3"><span className="text-muted-foreground text-xs block">Address</span><span className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3 text-muted-foreground" />{address || "-"}</span></div>
              </div>
              {patient.allergies && patient.allergies.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <span className="text-muted-foreground text-xs block mb-1.5">Allergies</span>
                    <div className="flex flex-wrap gap-1">
                      {patient.allergies.map((allergy: unknown, i: number) => {
                        const normalized = allergy as string | { substance?: string; reaction?: string };
                        const label = typeof normalized === "string" ? normalized : normalized.substance ?? normalized.reaction ?? JSON.stringify(normalized);
                        return <Badge key={i} variant="destructive" className="text-xs">{label}</Badge>;
                      })}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Heart className="h-4 w-4 text-primary" /> Admission History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {admissions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No admission records</p>
              ) : (
                <div className="space-y-3">
                  {admissions.map((admission) => (
                    <div key={admission.id} className="flex items-center gap-4 p-3 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                      <div className="text-center min-w-[54px]">
                        <p className="text-xs text-muted-foreground">{new Date(admission.admittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      </div>
                      <div className="h-8 w-px bg-border/60" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{admission.reasonForAdmission}</p>
                        <p className="text-xs text-muted-foreground">{admission.admittingDoctor} · {admission.department}{admission.ward ? ` · ${admission.ward}` : ""}</p>
                      </div>
                      <StatusBadge status={admission.status} />
                      <Badge variant="outline" className="text-[10px] capitalize">{admission.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {emergencyContact && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" /> Emergency Contact
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <p className="font-medium">{emergencyContact.name}</p>
                <p className="text-muted-foreground text-xs">{emergencyContact.relationship}</p>
                <p className="flex items-center gap-1 text-xs"><Phone className="h-3 w-3" />{emergencyContact.phone}</p>
              </CardContent>
            </Card>
          )}

          {insurance && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4 text-primary" /> Insurance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div><span className="text-muted-foreground text-xs block">Provider</span><span className="font-medium">{insurance.provider || patient.insuranceProvider || "-"}</span></div>
                <div><span className="text-muted-foreground text-xs block">Policy</span><span className="font-mono text-xs">{insurance.policyNumber || patient.insuranceId || "-"}</span></div>
                <div className="flex gap-4">
                  <div><span className="text-muted-foreground text-xs block">Copay</span><span className="font-medium">${insurance.copay ?? "N/A"}</span></div>
                  <div><span className="text-muted-foreground text-xs block">Coverage</span><StatusBadge status={insurance.coverageType || "none"} /></div>
                </div>
                <div><span className="text-muted-foreground text-xs block">Valid</span><span className="text-xs">{insurance.validFrom || "-"} → {insurance.validTo || "-"}</span></div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Consent Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              {summary.consents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">No consents on file</p>
              ) : (
                <div className="space-y-2">
                  {summary.consents.map((consent) => (
                    <div key={consent.id} className="flex items-center justify-between p-2 rounded-lg border border-border/40">
                      <div className="flex items-center gap-2">
                        {consent.status === "signed" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : (
                          <Clock className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="text-xs font-medium capitalize">{consent.type}</span>
                      </div>
                      <StatusBadge status={consent.status} />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
