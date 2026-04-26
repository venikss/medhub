"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { Pill, Search, Users, AlertTriangle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MedicationProfile } from "@/features/pharmacy/components/MedicationProfile";
import { getPharmacyProfile, listPharmacyProfiles } from "@/features/pharmacy/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { PharmacyPrescription, RefillRecord } from "@/types";

type AllergyEntry = string | { substance?: string; reaction?: string; severity?: string };
import { cn } from "@/lib/utils";

interface ProfilePatient {
  id: string;
  name: string;
  mrn: string;
  allergies: string[];
  activeMedicationCount: number;
}

export default function MedProfilesPageWrapper() {
  return (
    <Suspense>
      <MedProfilesPage />
    </Suspense>
  );
}

function MedProfilesPage() {
  const token = useAuthStore((state) => state.token);
  const searchParams = useSearchParams();
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [patients, setPatients] = useState<ProfilePatient[]>([]);
  const [activeMeds, setActiveMeds] = useState<PharmacyPrescription[]>([]);
  const [patientAllergies, setPatientAllergies] = useState<AllergyEntry[]>([]);
  const [patientRefills, setPatientRefills] = useState<RefillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    void listPharmacyProfiles(token ?? undefined)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const loadedPatients = response.data.map((item) => ({
          id: item.patientId,
          name: item.patientName,
          mrn: item.mrn,
          allergies: item.allergies,
          activeMedicationCount: item.activeMedicationCount,
        }));

        setPatients(loadedPatients);
        setSelectedPatientId((current) => current || loadedPatients[0]?.id || "");
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load profiles");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }

    let cancelled = false;

    void getPharmacyProfile(selectedPatientId, token ?? undefined)
      .then((profile) => {
        if (cancelled) {
          return;
        }

        setActiveMeds(profile.activeMedications.filter((rx) => rx.status !== "cancelled"));
        setPatientAllergies(profile.allergies);
        setPatientRefills(
          profile.refills.map((refill, index) => ({
            ...refill,
            medication:
              profile.activeMedications.find((rx) => rx.id === refill.prescriptionId)?.medication || "Medication",
            dosage: profile.activeMedications.find((rx) => rx.id === refill.prescriptionId)?.dosage || "",
            refillNumber: index + 1,
            totalRefills:
              profile.activeMedications.find((rx) => rx.id === refill.prescriptionId)?.refillsAllowed || index + 1,
            pharmacist: (refill as RefillRecord & { pharmacistName?: string }).pharmacistName || "Pharmacist",
            nextRefillDate: undefined,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) {
          setActiveMeds([]);
          setPatientAllergies([]);
          setPatientRefills([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPatientId, token]);

  const filteredPatients = useMemo(() => {
    return patients.filter((patient) => {
      if (!search.trim()) {
        return true;
      }

      const loweredQuery = search.toLowerCase();
      return (
        patient.name.toLowerCase().includes(loweredQuery) || patient.mrn.toLowerCase().includes(loweredQuery)
      );
    });
  }, [patients, search]);

  const selectedPatient = patients.find((patient) => patient.id === selectedPatientId);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm">Loading medication profiles…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/5 px-6 py-4 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-red-700">Failed to load profiles</p>
          <p className="mt-1 text-xs text-red-600/80">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Medication Profiles</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patient medication history, active therapies, and refill records
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patients..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-9 pl-10 text-sm"
            />
          </div>

          <div className="space-y-1">
            {filteredPatients.map((patient) => {
              const isSelected = patient.id === selectedPatientId;

              return (
                <button
                  key={patient.id}
                  onClick={() => setSelectedPatientId(patient.id)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 hover:bg-muted/40",
                  )}
                >
                  <div className="mb-0.5 flex items-center justify-between">
                    <p className="text-sm font-medium">{patient.name}</p>
                    {patient.activeMedicationCount > 0 && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                        {patient.activeMedicationCount} Rx
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[10px] text-muted-foreground">{patient.mrn}</p>
                  {patient.allergies.length > 0 && (
                    <p className="mt-0.5 text-[10px] font-medium text-red-600">
                      Allergies: {patient.allergies.map((a: any) => typeof a === "string" ? a : a.substance ?? a.reaction ?? JSON.stringify(a)).join(", ")}
                    </p>
                  )}
                </button>
              );
            })}

            {filteredPatients.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <Users className="mx-auto mb-2 h-7 w-7 text-muted-foreground/30" />
                No patients found.
              </div>
            )}
          </div>
        </div>

        <div>
          {selectedPatient ? (
            <MedicationProfile
              patientName={selectedPatient.name}
              allergies={patientAllergies}
              activeMeds={activeMeds}
              refills={patientRefills}
            />
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Pill className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">Select a patient to view their medication profile</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
