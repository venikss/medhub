"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  Send,
  Stethoscope,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listDoctorInterventions, respondToIntervention } from "@/features/pharmacy/api";
import type { InterventionRecord } from "@/types";
import { cn } from "@/lib/utils";

const typeColors: Record<string, string> = {
  "dose-adjustment": "bg-sky-500/10 text-sky-700 border-sky-500/20",
  "therapy-change": "bg-violet-500/10 text-violet-700 border-violet-500/20",
  "drug-discontinuation": "bg-red-500/10 text-red-700 border-red-500/20",
  "allergy-clarification": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  "brand-to-generic": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "formulary-substitution": "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  other: "bg-muted/50 text-muted-foreground border-border/50",
};

const outcomeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  pending: {
    label: "Awaiting Response",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  noted: {
    label: "Noted",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  accepted: {
    label: "Accepted",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
    className: "bg-red-500/10 text-red-700 border-red-500/20",
  },
  modified: {
    label: "Modified",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    className: "bg-sky-500/10 text-sky-700 border-sky-500/20",
  },
  "": {
    label: "Awaiting Response",
    icon: <Clock className="h-3.5 w-3.5" />,
    className: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
};

function isPending(i: InterventionRecord) {
  return !i.outcome || i.outcome === "pending";
}

export default function DoctorInterventionsPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [interventions, setInterventions] = useState<InterventionRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState<"noted" | "note" | null>(null);
  const [tab, setTab] = useState<"pending" | "all">("pending");

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void listDoctorInterventions(user.id, token ?? undefined)
      .then((data) => {
        if (cancelled) return;
        setInterventions(data);
        setSelectedId(data[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) setInterventions([]);
      });
    return () => { cancelled = true; };
  }, [user?.id, token]);

  const displayed = useMemo(
    () => tab === "pending" ? interventions.filter(isPending) : interventions,
    [interventions, tab],
  );

  const selected = interventions.find((i) => i.id === selectedId) ?? null;

  const handleMarkNoted = async () => {
    if (!selected) return;
    setSubmitting("noted");
    try {
      const updated = await respondToIntervention(
        selected.id,
        "noted",
        note.trim() || "Noted by prescribing physician.",
        token ?? undefined,
      );
      setInterventions((prev) =>
        prev.map((i) => (i.id === updated.id ? (updated as InterventionRecord) : i)),
      );
      setNote("");
    } finally {
      setSubmitting(null);
    }
  };

  const handleSendNote = async () => {
    if (!selected || !note.trim()) return;
    setSubmitting("note");
    try {
      const updated = await respondToIntervention(
        selected.id,
        selected.outcome || "pending",
        note.trim(),
        token ?? undefined,
      );
      setInterventions((prev) =>
        prev.map((i) => (i.id === updated.id ? (updated as InterventionRecord) : i)),
      );
      setNote("");
    } finally {
      setSubmitting(null);
    }
  };

  const pendingCount = interventions.filter(isPending).length;

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pharmacy Interventions</h1>
          <p className="text-sm text-muted-foreground">
            Pharmacist clinical queries on your prescriptions
          </p>
        </div>
        {pendingCount > 0 && (
          <Badge className="gap-1.5 bg-amber-500/10 text-amber-700 border-amber-500/20 px-2.5">
            <Clock className="h-3.5 w-3.5" />
            {pendingCount} pending
          </Badge>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/30 p-1 w-fit">
        {(["pending", "all"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              tab === t
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t === "pending" ? `Pending (${pendingCount})` : `All (${interventions.length})`}
          </button>
        ))}
      </div>

      {displayed.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 text-emerald-500/50" />
          <p className="text-sm font-medium">No {tab === "pending" ? "pending " : ""}interventions</p>
          <p className="text-xs">
            {tab === "pending"
              ? "All pharmacist queries have been addressed."
              : "No interventions have been raised for your prescriptions yet."}
          </p>
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-[320px_1fr] min-h-0">
          {/* Left list */}
          <div className="flex flex-col gap-2 overflow-y-auto pr-1">
            {displayed.map((item) => {
              const oc = outcomeConfig[item.outcome ?? ""] ?? outcomeConfig[""];
              const tc = typeColors[item.type] ?? typeColors.other;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    "w-full rounded-xl border p-3 text-left transition-all hover:shadow-sm",
                    selectedId === item.id
                      ? "border-primary/40 bg-primary/5 shadow-sm"
                      : "border-border/60 bg-card hover:border-border",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.patientName}</p>
                      <p className="truncate text-xs text-muted-foreground">{item.medication}</p>
                    </div>
                    <Badge className={cn("shrink-0 gap-1 border text-[10px]", oc.className)}>
                      {oc.icon}
                      {oc.label}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={cn("border text-[10px]", tc)}>
                      {item.type.replace(/-/g, " ")}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right detail */}
          {selected ? (
            <Card className="overflow-y-auto">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{selected.patientName}</CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">{selected.medication}</p>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0 gap-1.5 border",
                      (outcomeConfig[selected.outcome ?? ""] ?? outcomeConfig[""]).className,
                    )}
                  >
                    {(outcomeConfig[selected.outcome ?? ""] ?? outcomeConfig[""]).icon}
                    {(outcomeConfig[selected.outcome ?? ""] ?? outcomeConfig[""]).label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {/* Meta row */}
                <div className="flex flex-wrap gap-2">
                  <Badge className={cn("border text-xs", typeColors[selected.type] ?? typeColors.other)}>
                    {selected.type.replace(/-/g, " ")}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Raised by <span className="font-medium text-foreground">{selected.pharmacistName}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(selected.createdAt).toLocaleString()}
                  </span>
                </div>

                {/* Pharmacist concern */}
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                    <AlertTriangle className="h-3 w-3" />
                    Clinical Concern
                  </p>
                  <p className="text-sm leading-relaxed">{selected.reason}</p>
                </div>

                {/* Recommendation */}
                <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Stethoscope className="h-3 w-3" />
                    Pharmacist Recommendation
                  </p>
                  <p className="text-sm leading-relaxed">{selected.recommendation}</p>
                </div>

                {/* Existing prescriber response */}
                {selected.prescriberResponse && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-1">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      <MessageSquare className="h-3 w-3" />
                      Your Previous Response
                    </p>
                    <p className="text-sm leading-relaxed">{selected.prescriberResponse}</p>
                    {selected.resolvedAt && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(selected.resolvedAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {/* Response form — always visible so doctor can add follow-up notes */}
                <div className="space-y-3 border-t border-border/40 pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Respond to Pharmacist
                  </p>
                  <Textarea
                    placeholder="Write a note to the pharmacist (optional for 'Mark as Noted')…"
                    rows={3}
                    className="resize-none text-sm"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs"
                      disabled={submitting !== null}
                      onClick={handleMarkNoted}
                    >
                      {submitting === "noted" ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      Mark as Noted
                    </Button>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs"
                      disabled={submitting !== null || !note.trim()}
                      onClick={handleSendNote}
                    >
                      {submitting === "note" ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      ) : (
                        <Send className="h-3.5 w-3.5" />
                      )}
                      Send Note
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
