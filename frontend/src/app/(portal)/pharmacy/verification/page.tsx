"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, BrainCircuit, ChevronDown, ChevronUp, Clock,
  Loader2, MessageSquare, Search, ShieldCheck, User, X,
} from "lucide-react";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import {
  holdPharmacyPrescription,
  listPharmacyPrescriptions,
  rejectPharmacyPrescription,
  releasePharmacyPrescriptionHold,
  verifyPharmacyPrescription,
} from "@/features/pharmacy/api";
import { PharmacyAISuggest } from "@/features/pharmacy/components/PharmacyAISuggest";
import { PharmacyCDSSPanel } from "@/features/cdss/components/modules/PharmacyCDSSPanel";
import { PatientChatPanel } from "@/features/cdss/components/shared/PatientChatPanel";
import { useCDSSDataHydration } from "@/features/cdss/hooks/useCDSSDataHydration";
import { cn } from "@/lib/utils";
import type { PharmacyPrescription } from "@/types";

type PanelTab = "medications" | "cdss" | "ai-chat";

export default function VerificationPage() {
  const token = useAuthStore((state) => state.token);
  const [prescriptions, setPrescriptions] = useState<PharmacyPrescription[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [panelTab, setPanelTab] = useState<PanelTab>("medications");
  const [expandedMedId, setExpandedMedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<Record<string, "verify" | "hold" | "reject" | null>>({});

  useEffect(() => {
    let cancelled = false;
    void listPharmacyPrescriptions({}, token ?? undefined)
      .then((data) => { if (!cancelled) setPrescriptions(data); })
      .catch(() => { if (!cancelled) setPrescriptions([]); });
    return () => { cancelled = true; };
  }, [token]);

  const patientGroups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; mrn: string; rxs: PharmacyPrescription[] }>();
    prescriptions.forEach((rx) => {
      if (!map.has(rx.patientId)) {
        map.set(rx.patientId, { id: rx.patientId, name: rx.patientName, mrn: rx.mrn, rxs: [] });
      }
      map.get(rx.patientId)!.rxs.push(rx);
    });
    return Array.from(map.values());
  }, [prescriptions]);

  const filteredGroups = useMemo(() => {
    if (!search.trim()) return patientGroups;
    const q = search.toLowerCase();
    return patientGroups
      .map((g) => ({
        ...g,
        rxs: g.rxs.filter(
          (rx) =>
            g.name.toLowerCase().includes(q) ||
            (g.mrn ?? "").toLowerCase().includes(q) ||
            rx.medication.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.rxs.length > 0);
  }, [patientGroups, search]);

  const selectedGroup = filteredGroups.find((g) => g.id === selectedPatientId) ?? null;

  const { error: cdssFeedMessage } = useCDSSDataHydration({
    token,
    patientId: selectedPatientId ?? undefined,
    refreshPatientIds: selectedPatientId ? [selectedPatientId] : [],
    refreshBeforeLoad: Boolean(selectedPatientId),
    includeOverrides: true,
  });

  const totalPending = prescriptions.filter(
    (rx) => rx.status === "pending-verification" || rx.status === "ordered",
  ).length;
  const totalSevere = prescriptions.filter((rx) =>
    rx.warnings.some((w) => w.severity === "severe" || w.severity === "contraindicated"),
  ).length;

  const handleUpdate = (updated: PharmacyPrescription) => {
    const REMOVE_STATUSES = ["verified", "cancelled", "dispensed", "returned"];
    if (REMOVE_STATUSES.includes(updated.status)) {
      setPrescriptions((prev) => prev.filter((rx) => rx.id !== updated.id));
    } else {
      setPrescriptions((prev) => prev.map((rx) => (rx.id === updated.id ? updated : rx)));
    }
    setActionLoading((prev) => ({ ...prev, [updated.id]: null }));
  };

  async function quickVerify(rx: PharmacyPrescription) {
    setActionLoading((prev) => ({ ...prev, [rx.id]: "verify" }));
    try {
      const updated = await verifyPharmacyPrescription(rx.id, "", token ?? undefined);
      handleUpdate(updated as PharmacyPrescription);
    } catch {
      setActionLoading((prev) => ({ ...prev, [rx.id]: null }));
    }
  }

  async function quickHold(rx: PharmacyPrescription) {
    setActionLoading((prev) => ({ ...prev, [rx.id]: "hold" }));
    try {
      const updated = await holdPharmacyPrescription(rx.id, "Held pending review", token ?? undefined);
      handleUpdate(updated as PharmacyPrescription);
    } catch {
      setActionLoading((prev) => ({ ...prev, [rx.id]: null }));
    }
  }

  async function quickDecline(rx: PharmacyPrescription) {
    setActionLoading((prev) => ({ ...prev, [rx.id]: "reject" }));
    try {
      const updated = await rejectPharmacyPrescription(rx.id, "Declined by pharmacist", token ?? undefined);
      handleUpdate(updated as PharmacyPrescription);
    } catch {
      setActionLoading((prev) => ({ ...prev, [rx.id]: null }));
    }
  }

  async function quickRelease(rx: PharmacyPrescription) {
    setActionLoading((prev) => ({ ...prev, [rx.id]: "hold" }));
    try {
      const updated = await releasePharmacyPrescriptionHold(rx.id, token ?? undefined);
      handleUpdate(updated as PharmacyPrescription);
    } catch {
      setActionLoading((prev) => ({ ...prev, [rx.id]: null }));
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pharmacist Verification</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select a patient to review and verify their prescriptions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-xs text-amber-600">
            {totalPending} pending
          </Badge>
          {totalSevere > 0 && (
            <Badge variant="outline" className="border-red-500/30 bg-red-500/5 text-xs text-red-600">
              {totalSevere} severe alerts
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">

        {/* ── Left: Patient List ── */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patient, MRN, or drug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            {filteredGroups.length === 0 && (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-500/50" />
                {search ? "No results match your search." : "No prescriptions to review."}
              </div>
            )}
            {filteredGroups.map((group) => {
              const pending = group.rxs.filter(
                (rx) => rx.status === "pending-verification" || rx.status === "ordered",
              );
              const hasSevere = group.rxs.some((rx) =>
                rx.warnings.some((w) => w.severity === "severe" || w.severity === "contraindicated"),
              );
              const isSelected = selectedPatientId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setSelectedPatientId(group.id);
                    setExpandedMedId(null);
                    setPanelTab("medications");
                  }}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 hover:bg-muted/40",
                    hasSevere && !isSelected && "border-red-500/30 bg-red-500/[0.02]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium">{group.name}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {hasSevere && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
                      <Badge
                        variant={pending.length > 0 ? "default" : "secondary"}
                        className="h-5 px-1.5 text-[10px]"
                      >
                        {pending.length} pending
                      </Badge>
                    </div>
                  </div>
                  <p className="ml-5 mt-0.5 text-[11px] text-muted-foreground">{group.mrn}</p>
                  <div className="ml-5 mt-1.5 flex flex-wrap gap-1">
                    {group.rxs.slice(0, 3).map((rx) => (
                      <span
                        key={rx.id}
                        className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {rx.medication}
                      </span>
                    ))}
                    {group.rxs.length > 3 && (
                      <span className="text-[10px] text-muted-foreground">
                        +{group.rxs.length - 3} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right: Patient Detail ── */}
        {selectedGroup ? (
          <div className="space-y-4">
            {/* Patient header */}
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-muted/20 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold">{selectedGroup.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedGroup.mrn}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {selectedGroup.rxs.filter(
                    (rx) => rx.status === "pending-verification" || rx.status === "ordered",
                  ).length}{" "}
                  pending
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  {selectedGroup.rxs.length} total
                </Badge>
              </div>
            </div>

            {cdssFeedMessage && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
                {cdssFeedMessage}
              </div>
            )}

            {/* Tab bar */}
            <div className="flex items-center gap-1 border-b">
              {(
                [
                  { key: "medications", label: "Medications", icon: ShieldCheck },
                  { key: "cdss", label: "CDSS Alerts", icon: AlertTriangle },
                  { key: "ai-chat", label: "AI Chat", icon: MessageSquare },
                ] as const
              ).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPanelTab(key)}
                  className={cn(
                    "mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                    panelTab === key
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Medications tab */}
            {panelTab === "medications" && (
              <div className="space-y-2">
                {selectedGroup.rxs.map((rx) => {
                  const isPending =
                    rx.status === "pending-verification" || rx.status === "ordered";
                  const isOnHold = rx.status === "on-hold";
                  const hasSevere = rx.warnings.some(
                    (w) => w.severity === "severe" || w.severity === "contraindicated",
                  );
                  const isExpanded = expandedMedId === rx.id;
                  const aState = actionLoading[rx.id];

                  return (
                    <div
                      key={rx.id}
                      className={cn(
                        "rounded-lg border",
                        hasSevere ? "border-red-500/30 bg-red-500/[0.02]" :
                        isOnHold ? "border-amber-400/40 bg-amber-50/40" :
                        "border-border/50",
                        isExpanded && "ring-1 ring-primary/20",
                      )}
                    >
                      {isOnHold && ((rx as any).holdReason || rx.notes) && (
                        <div className="flex items-center gap-1.5 border-b border-amber-200/60 bg-amber-50/60 px-3 py-1.5 text-[11px] text-amber-800">
                          <Clock className="h-3 w-3 shrink-0 text-amber-600" />
                          <span className="font-semibold">On Hold:</span>
                          <span>{(rx as any).holdReason || rx.notes}</span>
                        </div>
                      )}
                      {/* Med row */}
                      <div className="flex items-center gap-3 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {rx.medication} {rx.dosage}
                            </p>
                            {hasSevere && (
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {rx.route} · {rx.frequency} · {rx.setting}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={rx.status} />
                            <StatusBadge status={rx.priority} />
                            {rx.warnings.length > 0 && (
                              <span
                                className={cn(
                                  "flex items-center gap-0.5 text-[10px] font-semibold",
                                  hasSevere ? "text-red-600" : "text-amber-600",
                                )}
                              >
                                <AlertTriangle className="h-2.5 w-2.5" />
                                {rx.warnings.length} warning
                                {rx.warnings.length > 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Inline actions */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {isPending && (
                            <>
                              <Button
                                size="sm"
                                className="h-7 gap-1 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                                disabled={!!aState}
                                onClick={() => void quickVerify(rx)}
                              >
                                {aState === "verify" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 border-blue-500/30 text-xs text-blue-700 hover:bg-blue-500/10"
                                disabled={!!aState}
                                onClick={() => void quickHold(rx)}
                              >
                                {aState === "hold" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                Hold
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 border-red-500/30 text-xs text-red-700 hover:bg-red-500/10"
                                disabled={!!aState}
                                onClick={() => void quickDecline(rx)}
                              >
                                {aState === "reject" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                Decline
                              </Button>
                            </>
                          )}
                          {rx.status === "on-hold" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 border-emerald-500/30 text-xs text-emerald-700 hover:bg-emerald-500/10"
                                disabled={!!aState}
                                onClick={() => void quickRelease(rx)}
                              >
                                {aState === "hold" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-3 w-3" />
                                )}
                                Resume
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 gap-1 border-red-500/30 text-xs text-red-700 hover:bg-red-500/10"
                                disabled={!!aState}
                                onClick={() => void quickDecline(rx)}
                              >
                                {aState === "reject" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                                Decline
                              </Button>
                            </>
                          )}
                          {/* AI Analyse toggle */}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={() => setExpandedMedId(isExpanded ? null : rx.id)}
                          >
                            <BrainCircuit className="h-3 w-3" />
                            {isExpanded ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>

                      {/* AI Analysis panel (expanded) */}
                      {isExpanded && (
                        <div className="border-t border-border/40 p-3">
                          <PharmacyAISuggest
                            rx={rx}
                            token={token}
                            onVerify={handleUpdate}
                            onHold={handleUpdate}
                            onReject={handleUpdate}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* CDSS Alerts tab */}
            {panelTab === "cdss" && (
              <PharmacyCDSSPanel
                patientId={selectedGroup.id}
                focusedMedications={selectedGroup.rxs.map((rx) => rx.medication)}
              />
            )}

            {/* AI Chat tab */}
            {panelTab === "ai-chat" && (
              <PatientChatPanel
                patientId={selectedGroup.id}
                patientName={selectedGroup.name}
                initialMessage={`I'm reviewing pharmacy prescriptions for ${selectedGroup.name}. Their pending medications are: ${selectedGroup.rxs
                  .filter((rx) => rx.status === "pending-verification" || rx.status === "ordered")
                  .map((rx) => `${rx.medication} ${rx.dosage}`)
                  .join(", ")}. Please provide a clinical safety overview.`}
              />
            )}
          </div>
        ) : (
          <Card className="border-border/50">
            <CardContent className="flex flex-col items-center justify-center gap-2 py-20 text-muted-foreground">
              <User className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm">Select a patient to review their prescriptions</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

