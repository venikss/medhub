"use client";

/**
 * ImagingExamCombobox — searchable exam picker for radiology orders.
 *
 * Features:
 *  • Comprehensive built-in catalog of standard DICOM exam types
 *  • Filter tabs by modality (XR, CT, MRI, US, NM, PET, DEXA, MAMMO, FLUORO)
 *  • Shows modality badge + body region + contrast indicator per item
 *  • Allows "custom" free-text entry for non-catalog exams
 *  • Colour-coded modality badges consistent with ModalityBadge component
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ImagingModality } from "@/types";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImagingExam {
  name: string;
  modality: ImagingModality;
  body: string;
  contrast: boolean;
}

export interface CustomImagingExam {
  name: string;
  modality?: ImagingModality;
  custom: true;
}

export type ImagingExamSelection = ImagingExam | CustomImagingExam;

export function isCustomExam(v: ImagingExamSelection): v is CustomImagingExam {
  return "custom" in v && v.custom === true;
}

interface ImagingExamComboboxProps {
  value?: ImagingExamSelection | null;
  onSelect: (exam: ImagingExamSelection) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

// ─── Catalog ──────────────────────────────────────────────────────────────────

const IMAGING_CATALOG: ImagingExam[] = [
  // ── Plain X-Ray
  { name: "Chest X-Ray (PA & Lateral)", modality: "XR", body: "Thorax", contrast: false },
  { name: "Chest X-Ray (AP Portable)", modality: "XR", body: "Thorax", contrast: false },
  { name: "Abdominal X-Ray (KUB)", modality: "XR", body: "Abdomen", contrast: false },
  { name: "Cervical Spine X-Ray", modality: "XR", body: "Cervical Spine", contrast: false },
  { name: "Lumbar Spine X-Ray", modality: "XR", body: "Lumbar Spine", contrast: false },
  { name: "Pelvis X-Ray", modality: "XR", body: "Pelvis", contrast: false },
  { name: "Shoulder X-Ray", modality: "XR", body: "Shoulder", contrast: false },
  { name: "Humerus X-Ray", modality: "XR", body: "Humerus", contrast: false },
  { name: "Elbow X-Ray", modality: "XR", body: "Elbow", contrast: false },
  { name: "Wrist X-Ray", modality: "XR", body: "Wrist", contrast: false },
  { name: "Hand X-Ray", modality: "XR", body: "Hand", contrast: false },
  { name: "Hip X-Ray", modality: "XR", body: "Hip", contrast: false },
  { name: "Femur X-Ray", modality: "XR", body: "Femur", contrast: false },
  { name: "Knee X-Ray", modality: "XR", body: "Knee", contrast: false },
  { name: "Tibia / Fibula X-Ray", modality: "XR", body: "Tibia/Fibula", contrast: false },
  { name: "Ankle X-Ray", modality: "XR", body: "Ankle", contrast: false },
  { name: "Foot X-Ray", modality: "XR", body: "Foot", contrast: false },
  // ── CT
  { name: "CT Head without Contrast", modality: "CT", body: "Head", contrast: false },
  { name: "CT Head with Contrast", modality: "CT", body: "Head", contrast: true },
  { name: "CT Head with/without Contrast", modality: "CT", body: "Head", contrast: true },
  { name: "CT Angiography – Brain (CTA)", modality: "CT", body: "Brain", contrast: true },
  { name: "CT Chest without Contrast", modality: "CT", body: "Chest", contrast: false },
  { name: "CT Chest with Contrast", modality: "CT", body: "Chest", contrast: true },
  { name: "CT Pulmonary Angiography (CTPA)", modality: "CT", body: "Chest", contrast: true },
  { name: "CT Angiography – Chest/Aorta", modality: "CT", body: "Chest", contrast: true },
  { name: "CT Coronary Angiography", modality: "CT", body: "Heart", contrast: true },
  { name: "CT Abdomen without Contrast", modality: "CT", body: "Abdomen", contrast: false },
  { name: "CT Abdomen with Contrast", modality: "CT", body: "Abdomen", contrast: true },
  { name: "CT Abdomen/Pelvis without Contrast", modality: "CT", body: "Abdomen & Pelvis", contrast: false },
  { name: "CT Abdomen/Pelvis with Contrast", modality: "CT", body: "Abdomen & Pelvis", contrast: true },
  { name: "CT Pelvis with Contrast", modality: "CT", body: "Pelvis", contrast: true },
  { name: "CT Neck with Contrast", modality: "CT", body: "Neck", contrast: true },
  { name: "CT Spine – Cervical", modality: "CT", body: "Cervical Spine", contrast: false },
  { name: "CT Spine – Thoracic", modality: "CT", body: "Thoracic Spine", contrast: false },
  { name: "CT Spine – Lumbar", modality: "CT", body: "Lumbar Spine", contrast: false },
  // ── MRI
  { name: "MRI Brain without Gadolinium", modality: "MRI", body: "Brain", contrast: false },
  { name: "MRI Brain with Gadolinium", modality: "MRI", body: "Brain", contrast: true },
  { name: "MRI Brain with/without Gadolinium", modality: "MRI", body: "Brain", contrast: true },
  { name: "MRA Brain (non-contrast)", modality: "MRI", body: "Brain", contrast: false },
  { name: "MRI Spine – Cervical", modality: "MRI", body: "Cervical Spine", contrast: false },
  { name: "MRI Spine – Thoracic", modality: "MRI", body: "Thoracic Spine", contrast: false },
  { name: "MRI Spine – Lumbar", modality: "MRI", body: "Lumbar Spine", contrast: false },
  { name: "MRI Spine – Cervical with Contrast", modality: "MRI", body: "Cervical Spine", contrast: true },
  { name: "MRI Abdomen with Contrast", modality: "MRI", body: "Abdomen", contrast: true },
  { name: "MRI Pelvis with Contrast", modality: "MRI", body: "Pelvis", contrast: true },
  { name: "MRI Prostate (mpMRI)", modality: "MRI", body: "Prostate", contrast: true },
  { name: "MRI Knee", modality: "MRI", body: "Knee", contrast: false },
  { name: "MRI Shoulder", modality: "MRI", body: "Shoulder", contrast: false },
  { name: "MRI Hip", modality: "MRI", body: "Hip", contrast: false },
  { name: "MRI Wrist", modality: "MRI", body: "Wrist", contrast: false },
  { name: "MRI Breast (Bilateral)", modality: "MRI", body: "Bilateral Breast", contrast: true },
  { name: "MRI Cardiac", modality: "MRI", body: "Heart", contrast: true },
  // ── Ultrasound
  { name: "Ultrasound Abdomen (Complete)", modality: "US", body: "Abdomen", contrast: false },
  { name: "Ultrasound Pelvis (Transabdominal)", modality: "US", body: "Pelvis", contrast: false },
  { name: "Ultrasound Pelvis (Transvaginal)", modality: "US", body: "Pelvis", contrast: false },
  { name: "Ultrasound Renal / Bladder", modality: "US", body: "Kidneys & Bladder", contrast: false },
  { name: "Ultrasound Thyroid / Parathyroid", modality: "US", body: "Thyroid", contrast: false },
  { name: "Ultrasound Breast", modality: "US", body: "Breast", contrast: false },
  { name: "Ultrasound Carotid Duplex Doppler", modality: "US", body: "Neck", contrast: false },
  { name: "Ultrasound DVT – Lower Extremity", modality: "US", body: "Lower Extremity", contrast: false },
  { name: "Ultrasound DVT – Upper Extremity", modality: "US", body: "Upper Extremity", contrast: false },
  { name: "Echocardiogram (TTE)", modality: "US", body: "Heart", contrast: false },
  { name: "Echocardiogram – Transesophageal (TEE)", modality: "US", body: "Heart", contrast: false },
  { name: "Ultrasound-Guided Biopsy", modality: "US", body: "Variable", contrast: false },
  { name: "Ultrasound Scrotal", modality: "US", body: "Scrotum/Testes", contrast: false },
  // ── Nuclear Medicine
  { name: "Bone Scan (Tc-99m)", modality: "NM", body: "Whole Body", contrast: false },
  { name: "Ventilation/Perfusion Scan (V/Q)", modality: "NM", body: "Lungs", contrast: false },
  { name: "Thyroid Scan (Tc-99m)", modality: "NM", body: "Thyroid", contrast: false },
  { name: "Thyroid Uptake (I-131)", modality: "NM", body: "Thyroid", contrast: false },
  { name: "Hepatobiliary Scan (HIDA)", modality: "NM", body: "Hepatobiliary", contrast: false },
  { name: "Renal Scan (MAG-3 Diuretic)", modality: "NM", body: "Kidneys", contrast: false },
  { name: "Myocardial Perfusion Scan (SPECT)", modality: "NM", body: "Heart", contrast: false },
  { name: "Sentinel Node Lymphoscintigraphy", modality: "NM", body: "Variable", contrast: false },
  // ── PET
  { name: "PET-CT Whole Body (FDG)", modality: "PET", body: "Whole Body", contrast: false },
  { name: "PET-CT Brain (FDG)", modality: "PET", body: "Brain", contrast: false },
  { name: "PET-CT Cardiac Viability", modality: "PET", body: "Heart", contrast: false },
  // ── DEXA
  { name: "DEXA Bone Density (Spine & Hip)", modality: "DEXA", body: "Spine / Hip", contrast: false },
  { name: "DEXA Body Composition", modality: "DEXA", body: "Whole Body", contrast: false },
  // ── Mammography
  { name: "Mammogram – Screening (Bilateral)", modality: "MAMMO", body: "Bilateral Breast", contrast: false },
  { name: "Mammogram – Diagnostic", modality: "MAMMO", body: "Breast", contrast: false },
  { name: "Breast Tomosynthesis 3D (Bilateral)", modality: "MAMMO", body: "Bilateral Breast", contrast: false },
  // ── Fluoroscopy
  { name: "Barium Swallow (Esophagram)", modality: "FLUORO", body: "Esophagus", contrast: true },
  { name: "Upper GI Series", modality: "FLUORO", body: "Upper GI", contrast: true },
  { name: "Small Bowel Follow-Through", modality: "FLUORO", body: "Small Bowel", contrast: true },
  { name: "Barium Enema (Double Contrast)", modality: "FLUORO", body: "Colon", contrast: true },
  { name: "Cystogram / Voiding Cystourethrogram (VCUG)", modality: "FLUORO", body: "Bladder/Urethra", contrast: true },
];

// ─── Modality colour palette ──────────────────────────────────────────────────

interface ModalityStyle {
  bg: string;
  text: string;
  border: string;
  label: string;
}

const MODALITY_STYLE: Record<ImagingModality, ModalityStyle> = {
  XR: { bg: "bg-sky-500/10", text: "text-sky-700", border: "border-sky-500/25", label: "XR" },
  CT: { bg: "bg-violet-500/10", text: "text-violet-700", border: "border-violet-500/25", label: "CT" },
  MRI: { bg: "bg-indigo-500/10", text: "text-indigo-700", border: "border-indigo-500/25", label: "MRI" },
  US: { bg: "bg-teal-500/10", text: "text-teal-700", border: "border-teal-500/25", label: "US" },
  NM: { bg: "bg-orange-500/10", text: "text-orange-700", border: "border-orange-500/25", label: "NM" },
  PET: { bg: "bg-rose-500/10", text: "text-rose-700", border: "border-rose-500/25", label: "PET" },
  DEXA: { bg: "bg-amber-500/10", text: "text-amber-700", border: "border-amber-500/25", label: "DEXA" },
  MAMMO: { bg: "bg-pink-500/10", text: "text-pink-700", border: "border-pink-500/25", label: "MMG" },
  FLUORO: { bg: "bg-emerald-500/10", text: "text-emerald-700", border: "border-emerald-500/25", label: "FLR" },
};

const ALL_MODALITIES: ImagingModality[] = ["XR", "CT", "MRI", "US", "NM", "PET", "DEXA", "MAMMO", "FLUORO"];

// ─── Component ────────────────────────────────────────────────────────────────

export function ImagingExamCombobox({
  value,
  onSelect,
  onClear,
  placeholder = "Select exam…",
  className,
  disabled = false,
}: ImagingExamComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [modalityFilter, setModalityFilter] = useState<ImagingModality | "all">("all");
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Close on outside click ──
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => searchRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return IMAGING_CATALOG.filter((exam) => {
      if (modalityFilter !== "all" && exam.modality !== modalityFilter) return false;
      if (!q) return true;
      return (
        exam.name.toLowerCase().includes(q) ||
        exam.modality.toLowerCase().includes(q) ||
        exam.body.toLowerCase().includes(q)
      );
    });
  }, [query, modalityFilter]);

  function handleSelect(exam: ImagingExamSelection) {
    onSelect(exam);
    setOpen(false);
    setQuery("");
  }

  const displayValue = value
    ? isCustomExam(value)
      ? `Custom: ${value.name}`
      : value.name
    : null;

  const selectedModality =
    value && !isCustomExam(value) ? value.modality : null;
  const portalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* ── Trigger ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors",
          "hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-1 ring-ring border-ring/70",
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {selectedModality && (
            <ModalityPill modality={selectedModality} size="sm" />
          )}
          <span className={cn("truncate text-sm", !displayValue && "text-muted-foreground")}>
            {displayValue ?? placeholder}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {value && onClear && (
            <span
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && onClear()}
              onClick={(e) => {
                e.stopPropagation();
                onClear();
              }}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200",
              open && "rotate-180",
            )}
          />
        </div>
      </button>

      {/* ── Dropdown panel ── */}
      {open && portalRoot && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className={cn(
            "overflow-hidden rounded-xl border border-border/60",
            "bg-popover text-popover-foreground shadow-xl shadow-black/[0.08] ring-1 ring-black/[0.04]",
          )}
        >
          {/* Search */}
          <div className="border-b border-border/40 p-2 pb-0">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by exam name, modality, or body region…"
                className="h-8 border-0 bg-muted/40 pl-8 text-xs shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          {/* Modality filter tabs */}
          <div className="flex gap-1 overflow-x-auto border-b border-border/40 px-2 py-1.5 scrollbar-hide">
            <button
              type="button"
              onClick={() => setModalityFilter("all")}
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                modalityFilter === "all"
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
            >
              All
            </button>
            {ALL_MODALITIES.map((m) => {
              const s = MODALITY_STYLE[m];
              const active = modalityFilter === m;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModalityFilter(m)}
                  className={cn(
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition-colors",
                    active
                      ? `${s.bg} ${s.text} ${s.border}`
                      : "border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted",
                  )}
                >
                  {s.label}
                </button>
              );
            })}
          </div>

          {/* Results */}
          <div className="max-h-[280px] overflow-y-auto p-1">
            {filtered.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No exams match your search.
              </p>
            )}

            {filtered.map((exam) => {
              const isSelected =
                value &&
                !isCustomExam(value) &&
                value.name === exam.name &&
                value.modality === exam.modality;

              return (
                <button
                  key={`${exam.modality}-${exam.name}`}
                  type="button"
                  onClick={() => handleSelect(exam)}
                  className={cn(
                    "group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent/40",
                    isSelected && "bg-primary/8 hover:bg-primary/12",
                  )}
                >
                  <ModalityPill modality={exam.modality} />

                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-snug">
                      {exam.name}
                    </span>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                      <span>{exam.body}</span>
                      <span className="opacity-40">·</span>
                      {exam.contrast ? (
                        <span className="font-medium text-violet-600">With contrast</span>
                      ) : (
                        <span>No contrast</span>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom exam option */}
          {query.trim() && (
            <div className="border-t border-border/40 p-1">
              <button
                type="button"
                onClick={() =>
                  handleSelect({ name: query.trim(), custom: true })
                }
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/40"
              >
                <span className="flex h-6 w-10 shrink-0 items-center justify-center rounded-md bg-muted/60 text-[10px] font-bold text-muted-foreground">
                  +
                </span>
                <span className="text-sm text-muted-foreground">
                  Use{" "}
                  <strong className="font-semibold text-foreground">
                    &quot;{query.trim()}&quot;
                  </strong>{" "}
                  as custom exam
                </span>
              </button>
            </div>
          )}
        </div>,
        portalRoot,
      )}
    </div>
  );
}

// ─── ModalityPill sub-component ───────────────────────────────────────────────

function ModalityPill({
  modality,
  size = "md",
}: {
  modality: ImagingModality;
  size?: "sm" | "md";
}) {
  const s = MODALITY_STYLE[modality];
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border font-bold tabular-nums",
        s.bg,
        s.text,
        s.border,
        size === "sm" ? "px-1 py-px text-[9px]" : "min-w-[2.25rem] px-1.5 py-0.5 text-[10px] text-center",
      )}
    >
      {s.label}
    </span>
  );
}
