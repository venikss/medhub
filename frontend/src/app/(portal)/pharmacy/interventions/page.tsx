"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Filter,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { listPharmacyInterventions, respondToIntervention } from "@/features/pharmacy/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { InterventionRecord } from "@/types";
import { cn } from "@/lib/utils";

const tabs = ["pending", "all"] as const;
type Tab = (typeof tabs)[number];

const typeColors: Record<string, string> = {
  monitoring: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  clarification: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  substitution: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  education: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "adverse-event": "bg-red-500/10 text-red-700 border-red-500/20",
  "dose-adjustment": "bg-sky-500/10 text-sky-700 border-sky-500/20",
  "therapy-change": "bg-violet-500/10 text-violet-700 border-violet-500/20",
  "drug-discontinuation": "bg-red-500/10 text-red-700 border-red-500/20",
  "allergy-clarification": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  "brand-to-generic": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "formulary-substitution": "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  other: "bg-muted/50 text-muted-foreground border-border/50",
};

const outcomeConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  accepted: { label: "Accepted", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-700 border-red-500/20" },
  modified: { label: "Modified", className: "bg-sky-500/10 text-sky-700 border-sky-500/20" },
  "partially-accepted": {
    label: "Partial",
    className: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  },
  "": { label: "Pending", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
};

export default function InterventionsPage() {
  const token = useAuthStore((state) => state.token);
  const [tab, setTab] = useState<Tab>("pending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [interventions, setInterventions] = useState<InterventionRecord[]>([]);
  const [responseNotes, setResponseNotes] = useState("");
  const [responding, setResponding] = useState<"accepted" | "rejected" | null>(null);

  const handleRespond = async (outcome: "accepted" | "rejected") => {
    if (!selected || !responseNotes.trim()) return;
    setResponding(outcome);
    try {
      const updated = await respondToIntervention(selected.id, outcome, responseNotes, token ?? undefined);
      setInterventions((prev) => prev.map((i) => i.id === updated.id ? updated as InterventionRecord : i));
      setResponseNotes("");
    } finally {
      setResponding(null);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void listPharmacyInterventions({}, token ?? undefined)
      .then((data) => {
        if (cancelled) {
          return;
        }
        setInterventions(data);
        setSelectedId((current) => current ?? data[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setInterventions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const pendingList = useMemo(
    () =>
      interventions.filter(
        (intervention) => !intervention.outcome || intervention.outcome === "pending",
      ),
    [interventions],
  );
  const displayList = tab === "pending" ? pendingList : interventions;
  const selected = displayList.find((intervention) => intervention.id === selectedId) ?? displayList[0] ?? null;
  const selectedOutcomeConfig = outcomeConfig[selected?.outcome ?? ""] ?? outcomeConfig.pending;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Interventions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pharmacist clinical interventions for monitoring, clarifications, and drug safety
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="border-amber-500/30 bg-amber-500/5 text-xs text-amber-600"
          >
            {pendingList.length} pending
          </Badge>
        </div>
      </div>

      {pendingList.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.05] px-4 py-3 text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span className="font-medium text-amber-700">
            {pendingList.length} intervention{pendingList.length > 1 ? "s" : ""} awaiting prescriber response.
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 border-b">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => {
              setTab(item);
              setSelectedId(null);
            }}
            className={cn(
              "flex items-center gap-1.5 border-b-2 -mb-px px-3 py-2 text-sm font-medium capitalize transition-colors",
              tab === item
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
            )}
          >
            {item === "pending" ? <Clock className="h-3.5 w-3.5" /> : <Filter className="h-3.5 w-3.5" />}
            {item === "pending" ? `Pending (${pendingList.length})` : "All Interventions"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-1.5">
          {displayList.map((intervention) => {
            const outcome = outcomeConfig[intervention.outcome ?? ""] ?? outcomeConfig.pending;
            const isSelected = (selected?.id ?? null) === intervention.id;

            return (
              <button
                key={intervention.id}
                onClick={() => setSelectedId(intervention.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 hover:bg-muted/40",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{intervention.id}</span>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                      outcome.className,
                    )}
                  >
                    {outcome.label}
                  </span>
                </div>
                <p className="text-sm font-medium leading-tight">{intervention.patientName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{intervention.medication}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize",
                      typeColors[intervention.type] ?? typeColors.other,
                    )}
                  >
                    {intervention.type.replace(/-/g, " ")}
                  </span>
                </div>
              </button>
            );
          })}
          {displayList.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500/50" />
              No interventions to show.
            </div>
          )}
        </div>

        <div>
          {selected ? (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                    <Activity className="h-4 w-4 text-primary" />
                    Intervention {selected.id}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded border px-1.5 py-0.5 text-[10px] font-medium capitalize",
                        typeColors[selected.type] ?? typeColors.other,
                      )}
                    >
                      {selected.type.replace(/-/g, " ")}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        selectedOutcomeConfig.className,
                      )}
                    >
                      {selectedOutcomeConfig.label}
                    </span>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <div>
                    <span className="text-muted-foreground">Patient: </span>
                    <span className="font-medium">{selected.patientName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Medication: </span>
                    <span className="font-medium">{selected.medication}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Prescriber: </span>
                    <span>{selected.prescriberContact}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pharmacist: </span>
                    <span>{selected.pharmacistName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Created: </span>
                    <span>{new Date(selected.createdAt).toLocaleString()}</span>
                  </div>
                  {selected.resolvedAt && (
                    <div>
                      <span className="text-muted-foreground">Resolved: </span>
                      <span>{new Date(selected.resolvedAt).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">
                    Reason / Clinical Issue
                  </p>
                  <p className="text-sm">{selected.reason}</p>
                </div>

                <div className="space-y-1 rounded-lg border border-teal-500/20 bg-teal-500/[0.04] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                    Pharmacist Recommendation
                  </p>
                  <p className="text-sm">{selected.recommendation}</p>
                </div>

                {selected.prescriberResponse && (
                  <div className="space-y-1 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
                      <MessageSquare className="h-3 w-3" /> Prescriber Response
                    </p>
                    <p className="text-sm">{selected.prescriberResponse}</p>
                  </div>
                )}

                {(!selected.outcome || selected.outcome === "pending") && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase text-muted-foreground">
                      Follow-up notes / prescriber response
                    </label>
                    <Textarea
                      placeholder="Document prescriber contact or follow-up (required)..."
                      rows={3}
                      className="resize-none text-xs"
                      value={responseNotes}
                      onChange={(e) => setResponseNotes(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-red-500/30 text-xs text-red-600 hover:bg-red-500/10"
                        disabled={responding !== null || !responseNotes.trim()}
                        onClick={() => handleRespond("rejected")}
                      >
                        {responding === "rejected" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
                        Mark Rejected
                      </Button>
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={responding !== null || !responseNotes.trim()}
                        onClick={() => handleRespond("accepted")}
                      >
                        {responding === "accepted" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        Mark Accepted
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Activity className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">Select an intervention to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
