"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DuplicateWarning } from "@/features/frontdesk/components/DuplicateWarning";
import { createPatient, searchPatients } from "@/features/frontdesk/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { DuplicateCandidate } from "@/types";

export default function RegisterPatientPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <RegisterPatientContent />
    </Suspense>
  );
}

function RegisterPatientContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useAuthStore((state) => state.token);
  const nameHint = searchParams.get("name") || "";

  const [form, setForm] = useState({
    firstName: nameHint.split(" ")[0] || "",
    lastName: nameHint.split(" ").slice(1).join(" ") || "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    email: "",
    address: "",
    nationality: "",
    maritalStatus: "",
    preferredLanguage: "English",
    bloodType: "",
    allergies: "",
    emergencyContactName: "",
    emergencyContactRelationship: "",
    emergencyContactPhone: "",
    insuranceProvider: "",
    insurancePolicyNumber: "",
    insuranceGroupNumber: "",
    insuranceValidFrom: "",
    insuranceValidTo: "",
    insuranceCopay: "",
    insuranceCoverageType: "full",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(true);
  const [duplicateCandidates, setDuplicateCandidates] = useState<DuplicateCandidate[]>([]);

  const update = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (!showDuplicates || !form.firstName || !form.lastName) {
      return;
    }

    let cancelled = false;
    const query = `${form.firstName} ${form.lastName}`.trim();

    const handle = window.setTimeout(() => {
      void searchPatients(query, token ?? undefined)
        .then((matches) => {
          if (cancelled) return;
          const candidates = matches
            .filter(
              (match) =>
                match.firstName.toLowerCase() === form.firstName.toLowerCase() &&
                match.lastName.toLowerCase() === form.lastName.toLowerCase(),
            )
            .map((match) => ({
              patientA: {
                id: "new",
                mrn: "NEW",
                firstName: form.firstName,
                lastName: form.lastName,
                dateOfBirth: form.dateOfBirth,
                phone: form.phone,
              },
              patientB: {
                id: match.id,
                mrn: match.mrn,
                firstName: match.firstName,
                lastName: match.lastName,
                dateOfBirth: match.dateOfBirth,
                phone: match.phone,
              },
              matchScore: 90,
              matchReasons: ["Same first and last name"],
            }));
          setDuplicateCandidates(candidates);
        })
        .catch(() => {
          if (!cancelled) {
            setDuplicateCandidates([]);
          }
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [form.firstName, form.lastName, form.dateOfBirth, form.phone, showDuplicates, token]);

  const visibleDuplicateCandidates =
    showDuplicates && form.firstName && form.lastName ? duplicateCandidates : [];

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    void createPatient(
      {
        firstName: form.firstName,
        lastName: form.lastName,
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone,
        email: form.email,
        address: { street: form.address },
        nationality: form.nationality || undefined,
        maritalStatus: form.maritalStatus || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        bloodType: form.bloodType || undefined,
        allergies: form.allergies.split(",").map((item) => item.trim()).filter(Boolean),
        emergencyContact: form.emergencyContactName
          ? {
              name: form.emergencyContactName,
              relationship: form.emergencyContactRelationship,
              phone: form.emergencyContactPhone,
            }
          : undefined,
        insuranceProvider: form.insuranceProvider || undefined,
        insuranceId: form.insurancePolicyNumber || undefined,
        insuranceDetails: form.insuranceProvider
          ? {
              provider: form.insuranceProvider,
              policyNumber: form.insurancePolicyNumber,
              groupNumber: form.insuranceGroupNumber,
              validFrom: form.insuranceValidFrom,
              validTo: form.insuranceValidTo,
              copay: form.insuranceCopay ? Number(form.insuranceCopay) : undefined,
              coverageType: form.insuranceCoverageType,
            }
          : undefined,
      },
      token ?? undefined,
    )
      .then((patient) => {
        router.push(`/frontdesk/patients/${patient.id}`);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to register patient");
        setSaving(false);
      });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link href="/frontdesk/patients">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Register New Patient</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Enter patient demographics, emergency contact, and insurance</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <strong>Registration Failed:</strong> {error}
        </div>
      )}

      {visibleDuplicateCandidates.length > 0 && (
        <DuplicateWarning
          candidates={visibleDuplicateCandidates}
          onDismiss={() => setShowDuplicates(false)}
          onMerge={(dup) => router.push(`/frontdesk/patients/${dup.patientB.id}`)}
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Demographics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName">First Name *</Label>
                <Input id="firstName" value={form.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="First name" required autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input id="lastName" value={form.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Last name" required />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="dob">Date of Birth *</Label>
                <Input id="dob" type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="gender">Gender *</Label>
                <select id="gender" value={form.gender} onChange={(e) => update("gender", e.target.value)} required className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="maritalStatus">Marital Status</Label>
                <select id="maritalStatus" value={form.maritalStatus} onChange={(e) => update("maritalStatus", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Select...</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} placeholder="+1-555-0000" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} placeholder="patient@email.com" required />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address">Address *</Label>
              <Input id="address" value={form.address} onChange={(e) => update("address", e.target.value)} placeholder="Street, City, State, ZIP" required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="nationality">Nationality</Label>
                <Input id="nationality" value={form.nationality} onChange={(e) => update("nationality", e.target.value)} placeholder="e.g. Egyptian" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bloodType">Blood Type</Label>
                <select id="bloodType" value={form.bloodType} onChange={(e) => update("bloodType", e.target.value)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  <option value="">Unknown</option>
                  <option>A+</option><option>A-</option><option>B+</option><option>B-</option>
                  <option>AB+</option><option>AB-</option><option>O+</option><option>O-</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="language">Preferred Language</Label>
                <Input id="language" value={form.preferredLanguage} onChange={(e) => update("preferredLanguage", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="allergies">Known Allergies</Label>
              <Textarea id="allergies" value={form.allergies} onChange={(e) => update("allergies", e.target.value)} placeholder="Comma-separated, e.g. Penicillin, Latex" rows={2} />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Emergency Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="ecName">Full Name *</Label>
                <Input id="ecName" value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} placeholder="Contact name" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecRel">Relationship *</Label>
                <Input id="ecRel" value={form.emergencyContactRelationship} onChange={(e) => update("emergencyContactRelationship", e.target.value)} placeholder="e.g. Spouse" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ecPhone">Phone *</Label>
                <Input id="ecPhone" type="tel" value={form.emergencyContactPhone} onChange={(e) => update("emergencyContactPhone", e.target.value)} placeholder="+1-555-0000" required />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Insurance / Coverage (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="insProvider">Insurance Provider</Label>
                <Input id="insProvider" value={form.insuranceProvider} onChange={(e) => update("insuranceProvider", e.target.value)} placeholder="e.g. Blue Cross" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insPolicy">Policy Number</Label>
                <Input id="insPolicy" value={form.insurancePolicyNumber} onChange={(e) => update("insurancePolicyNumber", e.target.value)} placeholder="Policy #" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="insGroup">Group Number</Label>
                <Input id="insGroup" value={form.insuranceGroupNumber} onChange={(e) => update("insuranceGroupNumber", e.target.value)} placeholder="Group #" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insFrom">Valid From</Label>
                <Input id="insFrom" type="date" value={form.insuranceValidFrom} onChange={(e) => update("insuranceValidFrom", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insTo">Valid To</Label>
                <Input id="insTo" type="date" value={form.insuranceValidTo} onChange={(e) => update("insuranceValidTo", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="insCopay">Copay ($)</Label>
                <Input id="insCopay" type="number" value={form.insuranceCopay} onChange={(e) => update("insuranceCopay", e.target.value)} placeholder="0" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/frontdesk/patients">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
          <Button type="submit" disabled={saving} className="gap-2 min-w-[140px]">
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Register Patient"}
          </Button>
        </div>
      </form>
    </div>
  );
}
