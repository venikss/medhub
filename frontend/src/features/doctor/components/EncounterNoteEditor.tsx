"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Save, CheckCircle2, FileText, Loader2 } from "lucide-react";
import type { Encounter } from "@/types";
import { cn } from "@/lib/utils";

export interface EncounterNoteEditorHandle {
    applyField: (field: "assessment" | "plan", value: string) => void;
}

interface EncounterNoteEditorProps {
    encounter?: Encounter;
    patientName?: string;
    onSave?: (data: Pick<Encounter, "subjective" | "objective" | "assessment" | "plan">) => Promise<void> | void;
    onSign?: (data: Pick<Encounter, "subjective" | "objective" | "assessment" | "plan">) => Promise<void> | void;
    onFormChange?: (data: Pick<Encounter, "subjective" | "objective" | "assessment" | "plan">) => void;
    className?: string;
}

const soapSections = [
    {
        key: "subjective" as const,
        label: "Subjective",
        placeholder: "Chief complaint, HPI, ROS, PMH…",
        chips: [
            "Patient presents with ",
            "No acute distress.",
            "Denies fever, chills, nausea, or vomiting.",
            "History of ",
            "Onset: sudden / gradual. Duration: ",
            "Pain scale: /10.",
        ],
    },
    {
        key: "objective" as const,
        label: "Objective",
        placeholder: "Vitals, physical exam findings, lab data…",
        chips: [
            "Alert and oriented x3.",
            "Vitals stable.",
            "Regular rate and rhythm, no murmurs.",
            "Clear to auscultation bilaterally.",
            "Abdomen soft, non-tender, non-distended.",
            "No peripheral oedema.",
        ],
    },
    {
        key: "assessment" as const,
        label: "Assessment",
        placeholder: "Diagnoses, clinical impression…",
        chips: [
            "Stable, no acute changes.",
            "Improving clinically.",
            "1. ",
            "Differential includes: ",
            "Consistent with ",
        ],
    },
    {
        key: "plan" as const,
        label: "Plan",
        placeholder: "Treatment plan, orders, follow-up…",
        chips: [
            "Continue current medications.",
            "Labs ordered — see orders.",
            "Imaging ordered — see orders.",
            "Follow-up in ",
            "Patient educated on diagnosis and plan.",
            "Discharge home today.",
        ],
    },
] as const;

type SoapKey = "subjective" | "objective" | "assessment" | "plan";

// Auto-growing textarea
function AutoTextarea({
    value,
    onChange,
    placeholder,
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    className?: string;
}) {
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
    }, [value]);

    return (
        <textarea
            ref={ref}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className={cn(
                "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none overflow-hidden",
                className,
            )}
        />
    );
}

export const EncounterNoteEditor = forwardRef<EncounterNoteEditorHandle, EncounterNoteEditorProps>(
function EncounterNoteEditor({ encounter, patientName, onSave, onSign, onFormChange, className }, ref) {
    const [form, setForm] = useState({
        subjective: encounter?.subjective || "",
        objective: encounter?.objective || "",
        assessment: encounter?.assessment || "",
        plan: encounter?.plan || "",
    });
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState<string | null>(null);
    const textareaRefs = useRef<Record<SoapKey, HTMLTextAreaElement | null>>({
        subjective: null, objective: null, assessment: null, plan: null,
    });

    const onFormChangeRef = useRef(onFormChange);
    onFormChangeRef.current = onFormChange;

    const update = (field: SoapKey, value: string) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setLastSaved(null);
    };

    // Notify parent of form changes without calling setState during render
    useEffect(() => {
        onFormChangeRef.current?.(form);
    }, [form]);

    // Expose applyField so the AI panel can write assessment/plan back into the editor
    useImperativeHandle(ref, () => ({
        applyField: (field: "assessment" | "plan", value: string) => update(field, value),
    }));

    const appendChip = (field: SoapKey, chip: string) => {
        setForm((prev) => {
            const current = prev[field];
            const separator = current && !current.endsWith("\n") && !current.endsWith(" ") ? "\n" : "";
            return { ...prev, [field]: current + separator + chip };
        });
        setLastSaved(null);
        // Focus the textarea after inserting
        setTimeout(() => textareaRefs.current[field]?.focus(), 0);
    };

    const handleSave = useCallback(async () => {
        setSaving(true);
        try {
            await onSave?.(form);
            setLastSaved(new Date().toLocaleTimeString());
        } finally {
            setSaving(false);
        }
    }, [form, onSave]);

    const handleSign = async () => {
        setSaving(true);
        try {
            if (onSign) {
                await onSign(form);
            } else {
                await onSave?.(form);
            }
            setLastSaved(new Date().toLocaleTimeString());
        } finally {
            setSaving(false);
        }
    };

    // ⌘S / Ctrl+S shortcut
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                void handleSave();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [handleSave]);

    return (
        <Card className={cn("border-border/50 shadow-sm", className)}>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        {encounter ? "Edit Encounter Note" : "New Encounter Note"}
                    </CardTitle>
                    {patientName && <Badge variant="outline" className="text-xs">{patientName}</Badge>}
                    {encounter?.status && <Badge variant="secondary" className="text-[10px] capitalize">{encounter.status}</Badge>}
                </div>
                <div className="flex items-center gap-2">
                    {lastSaved && (
                        <span className="text-[10px] text-emerald-600 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Saved {lastSaved}
                        </span>
                    )}
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => { void handleSave(); }} disabled={saving}>
                        {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Save Draft
                    </Button>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={() => { void handleSign(); }} disabled={saving}>
                        <CheckCircle2 className="h-3 w-3" /> Sign & Lock
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-5">
                {soapSections.map((section) => (
                    <div key={section.key} className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/10 text-primary text-[10px] font-bold">
                                {section.label[0]}
                            </span>
                            {section.label}
                        </label>
                        <AutoTextarea
                            value={form[section.key]}
                            onChange={(v) => update(section.key, v)}
                            placeholder={section.placeholder}
                        />
                        {/* Quick-insert chips */}
                        <div className="flex flex-wrap gap-1 pt-0.5">
                            {section.chips.map((chip) => (
                                <button
                                    key={chip}
                                    type="button"
                                    onClick={() => appendChip(section.key, chip)}
                                    className="rounded-full border border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
});

EncounterNoteEditor.displayName = "EncounterNoteEditor";
