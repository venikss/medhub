"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Plus, Clock } from "lucide-react";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createNursingNote, listNursePatients, listNursingNotes, listWounds, type NurseWardPatient } from "@/features/nurse/api";
import type { NursingNoteCategory, NursingNote, WoundNote } from "@/types";
import { cn } from "@/lib/utils";

const categories: { key: NursingNoteCategory | "wound" | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "All", emoji: "📋" },
  { key: "assessment", label: "Assessment", emoji: "🩺" },
  { key: "care", label: "Care", emoji: "🩹" },
  { key: "education", label: "Education", emoji: "📖" },
  { key: "communication", label: "Communication", emoji: "📞" },
  { key: "wound", label: "Wound/Device", emoji: "🩹" },
];

const templates = [
  "Routine assessment - patient stable, no complaints.",
  "Fall risk precautions in place. Bed alarm on. Non-skid socks provided.",
  "Patient educated on medication purpose and side effects. Verbalized understanding.",
  "Physician notified of change in patient condition. New orders received.",
  "Wound care performed per protocol. Site documented.",
];

export default function NursingNotesPage() {
  const token = useAuthStore((state) => state.token);
  const [catFilter, setCatFilter] = useState<string>("all");
  const [patientFilter, setPatientFilter] = useState<string>("all");
  const [showEditor, setShowEditor] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notePatient, setNotePatient] = useState("");
  const [noteCategory, setNoteCategory] = useState<string>("assessment");
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<NurseWardPatient[]>([]);
  const [notesData, setNotesData] = useState<NursingNote[]>([]);
  const [woundNotesData, setWoundNotesData] = useState<WoundNote[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listNursePatients(token ?? undefined),
      listNursingNotes({}, token ?? undefined),
      listWounds({}, token ?? undefined),
    ])
      .then(([patientData, noteData, woundData]) => {
        if (!cancelled) {
          setPatients(patientData);
          setNotesData(noteData);
          setWoundNotesData(woundData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPatients([]);
          setNotesData([]);
          setWoundNotesData([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const notes = notesData
    .filter((note) => catFilter === "all" || note.category === catFilter)
    .filter((note) => patientFilter === "all" || note.patientId === patientFilter)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const woundNotes = woundNotesData.filter((note) => patientFilter === "all" || note.patientId === patientFilter);
  const showWounds = catFilter === "all" || catFilter === "wound";

  const catColors: Record<string, string> = {
    assessment: "bg-sky-500/10 text-sky-700 border-sky-500/30",
    care: "bg-teal-500/10 text-teal-700 border-teal-500/30",
    education: "bg-violet-500/10 text-violet-700 border-violet-500/30",
    communication: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    safety: "bg-red-500/10 text-red-700 border-red-500/30",
    procedure: "bg-cyan-500/10 text-cyan-700 border-cyan-500/30",
  };

  async function handleSaveNote() {
    const patientId = notePatient || (patientFilter !== "all" ? patientFilter : patients[0]?.id);
    if (!patientId || !noteText.trim()) return;

    const backendCategory =
      noteCategory === "care"
        ? "intervention"
        : noteCategory === "communication"
          ? "communication"
          : noteCategory === "education"
            ? "education"
            : "assessment";

    setSaving(true);
    try {
      await createNursingNote(
        {
          patient: patientId,
          category: backendCategory,
          content: noteText.trim(),
        },
        token ?? undefined,
      );

      const refreshedNotes = await listNursingNotes({}, token ?? undefined);
      setNotesData(refreshedNotes);
      setShowEditor(false);
      setNoteText("");
      setNotePatient("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nursing Notes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Clinical documentation, assessments, and wound/device notes</p>
        </div>
        <Button className="gap-2" onClick={() => setShowEditor(!showEditor)}>
          <Plus className="h-4 w-4" /> New Note
        </Button>
      </div>

      {showEditor && (
        <Card className="border-border/50 border-primary/30 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <FileText className="h-4 w-4 text-primary" /> New Nursing Note
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Patient</label>
                <select
                  value={notePatient}
                  onChange={(e) => setNotePatient(e.target.value)}
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
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <select
                  value={noteCategory}
                  onChange={(e) => setNoteCategory(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="assessment">Assessment</option>
                  <option value="care">Care / Intervention</option>
                  <option value="education">Education</option>
                  <option value="communication">Communication</option>
                </select>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="mr-1 self-center text-[10px] font-semibold text-muted-foreground">Templates:</span>
              {templates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => setNoteText(template)}
                  className="max-w-[220px] truncate rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:border-border hover:bg-muted"
                >
                  {template.slice(0, 50)}...
                </button>
              ))}
            </div>
            <Textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Type your nursing note here..." rows={4} className="resize-none text-sm" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowEditor(false); setNoteText(""); }}>Cancel</Button>
              <Button size="sm" disabled={saving || !notePatient || !noteText.trim()} onClick={() => void handleSaveNote()}>
                {saving ? <span className="mr-1 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
                Save Note
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((category) => (
            <button
              key={category.key}
              onClick={() => setCatFilter(category.key)}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                catFilter === category.key
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              <span>{category.emoji}</span> {category.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPatientFilter("all")}
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
              patientFilter === "all"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
            )}
          >
            All Patients
          </button>
          {patients.map((patient) => (
            <button
              key={patient.id}
              onClick={() => setPatientFilter(patient.id)}
              className={cn(
                "rounded-full border px-2 py-1 text-xs font-medium transition-colors",
                patientFilter === patient.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border/50 bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {patient.roomNumber} - {patient.firstName}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {catFilter !== "wound" && notes.map((note) => (
          <div key={note.id} className={cn("rounded-lg border p-3", catColors[note.category] || "border-border/50")}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize">{note.category}</Badge>
                <span className="text-sm font-medium">{note.patientName}</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {new Date(note.timestamp).toLocaleString()}
                <span>- {note.authorName}</span>
              </div>
            </div>
            <p className="text-sm leading-relaxed">{note.content}</p>
          </div>
        ))}

        {showWounds && woundNotes.map((note) => (
          <div key={note.id} className="rounded-lg border border-orange-500/30 bg-orange-500/[0.05] p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] capitalize text-orange-700">🩹 {note.type}</Badge>
                <span className="text-sm font-medium">{note.patientName}</span>
                <span className="text-xs text-muted-foreground">{note.location}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(note.timestamp).toLocaleString()} - {note.recordedBy}</span>
            </div>
            <p className="text-sm">{note.description}</p>
            <p className="mt-1 text-xs italic text-muted-foreground">Care: {note.care}</p>
          </div>
        ))}

        {catFilter !== "wound" && notes.length === 0 && (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No notes matching filter.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
