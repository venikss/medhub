"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PatientSearchBar } from "@/features/frontdesk/components/PatientSearchBar";
import { PatientCard } from "@/features/frontdesk/components/PatientCard";
import { listPatients, searchPatients } from "@/features/frontdesk/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { ADTPatient } from "@/types";

const statusFilters = ["all", "active", "admitted", "discharged", "critical"] as const;

export default function PatientSearchPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><div className="animate-pulse text-muted-foreground">Loading...</div></div>}>
      <PatientSearchContent />
    </Suspense>
  );
}

function PatientSearchContent() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") || "";
  const token = useAuthStore((state) => state.token);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [patients, setPatients] = useState<ADTPatient[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchPatients = async () => {
      try {
        const data = q.trim() 
          ? await searchPatients(q, token) 
          : await listPatients({}, token ?? undefined);
        if (!cancelled) {
          setPatients(data);
        }
      } catch {
        if (!cancelled) setPatients([]);
      }
    };

    void fetchPatients();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filteredPatients = useMemo(
    () => (statusFilter === "all" ? patients : patients.filter((patient) => patient.status === statusFilter)),
    [patients, statusFilter],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Patient Search</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Find patients by name, MRN, phone, or email
          </p>
        </div>
        <Link href="/frontdesk/patients/register">
          <Button className="gap-2">
            <UserPlus className="h-4 w-4" /> Register New
          </Button>
        </Link>
      </div>

      <PatientSearchBar autoFocus showShortcutHint initialQuery={q} />

      <div className="flex items-center gap-2 flex-wrap">
        {statusFilters.map((filter) => (
          <button
            key={filter}
            onClick={() => setStatusFilter(filter)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              statusFilter === filter
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted"
            }`}
          >
            {filter === "all" ? "All Patients" : filter.charAt(0).toUpperCase() + filter.slice(1)}
            {filter === "all" && <span className="ml-1 opacity-70">({patients.length})</span>}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filteredPatients.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No patients matching the current filter.</p>
            </CardContent>
          </Card>
        ) : (
          filteredPatients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))
        )}
      </div>
    </div>
  );
}
