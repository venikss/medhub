"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock, Filter, Search, ShieldCheck, User } from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listPharmacyPrescriptions } from "@/features/pharmacy/api";
import { RxVerificationCard } from "@/features/pharmacy/components/RxVerificationCard";
import { PharmacyCDSSPanel } from "@/features/cdss/components/modules/PharmacyCDSSPanel";
import { useCDSSDataHydration } from "@/features/cdss/hooks/useCDSSDataHydration";
import { cn } from "@/lib/utils";
import type { PharmacyPrescription } from "@/types";

const tabs = ["pending", "all"] as const;
type Tab = typeof tabs[number];

export default function VerificationPage() {
  const token = useAuthStore((state) => state.token);
  const [tab, setTab] = useState<Tab>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [search, setSearch] = useState("");
  const [patientFilter, setPatientFilter] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;

    void listPharmacyPrescriptions(
      { status: tab === "pending" ? "verification" : "all" },
      token ?? undefined,
    )
      .then((data) => {
        if (!cancelled) {
          setPrescriptions(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPrescriptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tab, token]);

  const pendingRxs = useMemo(
    () => prescriptions.filter((rx) => rx.status === "pending-verification" || rx.status === "ordered"),
    [prescriptions],
  );
  const baseList = tab === "pending" ? pendingRxs : prescriptions;

  const uniquePatients = useMemo(() => {
    const map = new Map<string, string>();
    baseList.forEach((rx) => map.set(rx.patientId, rx.patientName));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [baseList]);

  const displayList = useMemo(() => {
    let list = baseList;
    if (patientFilter !== "all") list = list.filter((rx) => rx.patientId === patientFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (rx) =>
          rx.patientName.toLowerCase().includes(q) ||
          (rx.mrn ?? "").toLowerCase().includes(q) ||
          rx.medication.toLowerCase().includes(q),
      );
    }
    return list;
  }, [baseList, patientFilter, search]);

  const selected = displayList.find((rx) => rx.id === selectedId) ?? displayList[0] ?? null;
  const { error: cdssFeedMessage } = useCDSSDataHydration({
    token,
    patientId: selected?.patientId,
    refreshPatientIds: selected?.patientId ? [selected.patientId] : [],
    refreshBeforeLoad: Boolean(selected?.patientId),
    includeOverrides: true,
    useMockOnError: false,
  });

  const handleRxUpdated = (updated: PharmacyPrescription) => {
    setPrescriptions((prev) => prev.map((rx) => rx.id === updated.id ? updated : rx));
  };
  const severePending = pendingRxs.filter((rx) =>
    rx.warnings.some((warning) => warning.severity === "severe" || warning.severity === "contraindicated"),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pharmacist Verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review drug interactions, allergies, and dosing before approving
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-xs text-amber-600">
            {pendingRxs.length} pending
          </Badge>
          {severePending.length > 0 && (
            <Badge variant="outline" className="border-red-500/30 bg-red-500/5 text-xs text-red-600">
              {severePending.length} severe alerts
            </Badge>
          )}
        </div>
      </div>

      {severePending.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
          <div className="flex-1">
            <span className="font-semibold text-red-700">
              {severePending.length} prescription{severePending.length > 1 ? "s" : ""} with severe or contraindicated warnings require immediate review.
            </span>
            <p className="mt-0.5 text-xs text-red-600/80">
              {severePending.map((rx) => `${rx.patientName} - ${rx.medication}`).join(" · ")}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 border-b">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => {
              setTab(item);
              setSelectedId(null);
              setSearch("");
              setPatientFilter("all");
            }}
            className={cn(
              "mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium capitalize transition-colors",
              tab === item
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item === "pending" && <Clock className="h-3.5 w-3.5" />}
            {item === "all" && <Filter className="h-3.5 w-3.5" />}
            {item === "pending" ? `Pending (${pendingRxs.length})` : "All Prescriptions"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient, MRN, or drug…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelectedId(null); }}
              className="h-8 pl-8 text-xs"
            />
          </div>
          {/* Patient filter chips */}
          {uniquePatients.length > 1 && (
            <div className="flex flex-wrap gap-1">
              <button
                onClick={() => { setPatientFilter("all"); setSelectedId(null); }}
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  patientFilter === "all"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                All ({baseList.length})
              </button>
              {uniquePatients.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setPatientFilter(p.id); setSelectedId(null); }}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                    patientFilter === p.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
                  )}
                >
                  <User className="h-2.5 w-2.5" />
                  {p.name.split(" ")[0]}
                </button>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
          {displayList.map((rx) => {
            const hasSevere = rx.warnings.some(
              (warning) => warning.severity === "severe" || warning.severity === "contraindicated",
            );
            const isSelected = (selected?.id ?? null) === rx.id;

            return (
              <button
                key={rx.id}
                onClick={() => setSelectedId(rx.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 hover:bg-muted/40",
                  hasSevere && !isSelected && "border-red-500/30 bg-red-500/[0.02]",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{rx.id}</span>
                  <StatusBadge status={rx.priority} />
                </div>
                <p className="text-sm font-medium leading-tight">{rx.medication} {rx.dosage}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{rx.patientName}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <StatusBadge status={rx.status} />
                  {rx.warnings.length > 0 && (
                    <span
                      className={cn(
                        "flex items-center gap-0.5 text-[10px] font-semibold",
                        hasSevere ? "text-red-600" : "text-amber-600",
                      )}
                    >
                      <AlertTriangle className="h-2.5 w-2.5" /> {rx.warnings.length}
                    </span>
                  )}
                  {rx.status === "verified" && (
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                  )}
                </div>
              </button>
            );
          })}
          {displayList.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500/50" />
              {search || patientFilter !== "all" ? "No results match your search." : "All prescriptions verified."}
            </div>
          )}
          </div>
        </div>

        <div>
          {selected ? (
            <div className="space-y-4">
              {cdssFeedMessage && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                  {cdssFeedMessage}
                </div>
              )}
              <PharmacyCDSSPanel
                patientId={selected.patientId}
                focusedMedications={[selected.medication, selected.genericName].filter(Boolean)}
              />
              <RxVerificationCard
                rx={selected}
                token={token}
                onVerify={handleRxUpdated}
                onHold={handleRxUpdated}
                onReject={handleRxUpdated}
              />
            </div>
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <ShieldCheck className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">Select a prescription to review</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
