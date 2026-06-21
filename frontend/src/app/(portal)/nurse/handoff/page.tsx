"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, ArrowRight, Sun, Moon, Sunset, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HandoffCard } from "@/features/nurse/components/HandoffCard";
import { listHandoffs, listNursePatients, createHandoff, acknowledgeHandoff, type NurseWardPatient } from "@/features/nurse/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { HandoffEntry } from "@/types";
import { cn } from "@/lib/utils";

const shiftOptions = [
  { key: "day", label: "Day", icon: Sun, color: "text-amber-700 bg-amber-500/10 border-amber-500/20" },
  { key: "evening", label: "Evening", icon: Sunset, color: "text-orange-700 bg-orange-500/10 border-orange-500/20" },
  { key: "night", label: "Night", icon: Moon, color: "text-indigo-700 bg-indigo-500/10 border-indigo-500/20" },
] as const;

export default function HandoffPage() {
  const token = useAuthStore((state) => state.token);
  const [handoffs, setHandoffs] = useState<HandoffEntry[]>([]);
  const [patients, setPatients] = useState<NurseWardPatient[]>([]);
  const [shiftFilter, setShiftFilter] = useState<string>("day");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ackingId, setAckingId] = useState<string | null>(null);

  const [formPatient, setFormPatient] = useState("");
  const [formShiftType, setFormShiftType] = useState<string>("day");
  const [formSituation, setFormSituation] = useState("");
  const [formBackground, setFormBackground] = useState("");
  const [formAssessment, setFormAssessment] = useState("");
  const [formRec, setFormRec] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      listHandoffs({}, token ?? undefined),
      listNursePatients(token ?? undefined),
    ]).then(([h, p]) => {
      if (!cancelled) { setHandoffs(h); setPatients(p); }
    }).catch(() => {
      if (!cancelled) { setHandoffs([]); setPatients([]); }
    });
    return () => { cancelled = true; };
  }, [token]);

  const filteredHandoffs = useMemo(
    () => handoffs.filter((h) => h.shiftType === shiftFilter),
    [handoffs, shiftFilter],
  );

  const activeShift = shiftOptions.find((s) => s.key === shiftFilter)!;
  const ShiftIcon = activeShift.icon;

  async function handleCreateHandoff() {
    if (!formPatient || !formSituation.trim()) return;
    setSaving(true);
    try {
      await createHandoff(
        {
          patient: formPatient,
          situation: formSituation,
          background: formBackground,
          assessment: formAssessment,
          recommendation: formRec,
          shiftDate: today,
          shiftType: formShiftType,
        },
        token ?? undefined,
      );
      const refreshed = await listHandoffs({}, token ?? undefined);
      setHandoffs(refreshed);
      setShowForm(false);
      setFormPatient("");
      setFormSituation("");
      setFormBackground("");
      setFormAssessment("");
      setFormRec("");
    } finally {
      setSaving(false);
    }
  }

  async function handleAcknowledge(id: string) {
    setAckingId(id);
    try {
      await acknowledgeHandoff(id, token ?? undefined);
      const refreshed = await listHandoffs({}, token ?? undefined);
      setHandoffs(refreshed);
    } finally {
      setAckingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shift Handoff</h1>
          <p className="mt-1 text-sm text-muted-foreground">SBAR-based patient handoff for shift change</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4" /> New Handoff
          </Button>
        </div>
      </div>

      {/* Shift filter tabs */}
      <div className="flex items-center gap-2">
        {shiftOptions.map((shift) => {
          const Icon = shift.icon;
          return (
            <button
              key={shift.key}
              onClick={() => setShiftFilter(shift.key)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                shiftFilter === shift.key
                  ? shift.color
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {shift.label} Shift
            </button>
          );
        })}
        <Badge variant="outline" className="ml-2 text-[10px]">
          {filteredHandoffs.length} handoff{filteredHandoffs.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      {/* Create Handoff Form */}
      {showForm && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" /> New SBAR Handoff
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Patient</label>
                <select
                  value={formPatient}
                  onChange={(e) => setFormPatient(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select patient...</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.firstName} {p.lastName} - Rm {p.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Shift</label>
                <select
                  value={formShiftType}
                  onChange={(e) => setFormShiftType(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="day">Day (07:00-15:00)</option>
                  <option value="evening">Evening (15:00-23:00)</option>
                  <option value="night">Night (23:00-07:00)</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">S - Situation</label>
              <Textarea value={formSituation} onChange={(e) => setFormSituation(e.target.value)} placeholder="Current situation and reason for handoff..." rows={2} className="resize-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">B - Background</label>
              <Textarea value={formBackground} onChange={(e) => setFormBackground(e.target.value)} placeholder="Relevant medical history and context..." rows={2} className="resize-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">A - Assessment</label>
              <Textarea value={formAssessment} onChange={(e) => setFormAssessment(e.target.value)} placeholder="Current assessment and clinical findings..." rows={2} className="resize-none text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">R - Recommendation</label>
              <Textarea value={formRec} onChange={(e) => setFormRec(e.target.value)} placeholder="Recommended actions and follow-up..." rows={2} className="resize-none text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" disabled={saving || !formPatient || !formSituation.trim()} onClick={() => void handleCreateHandoff()}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                Create Handoff
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Card */}
      {filteredHandoffs.length > 0 && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <ShiftIcon className="h-4 w-4 text-primary" />
              {activeShift.label} Shift Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline" className="text-[10px]">
                {filteredHandoffs.length} patient{filteredHandoffs.length !== 1 ? "s" : ""}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {today}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Handoff Cards */}
      <div className="space-y-4">
        {filteredHandoffs.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              No handoffs for {activeShift.label.toLowerCase()} shift.
            </CardContent>
          </Card>
        ) : (
          filteredHandoffs.map((handoff) => (
            <div key={handoff.id} className="space-y-2">
              <HandoffCard handoff={handoff} />
              {!handoff.acknowledged && (
                <div className="flex justify-end px-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs"
                    disabled={ackingId === handoff.id}
                    onClick={() => void handleAcknowledge(handoff.id)}
                  >
                    {ackingId === handoff.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3 w-3" />
                    )}
                    Acknowledge Receipt
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
