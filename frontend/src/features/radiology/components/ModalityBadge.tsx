"use client";

import { cn } from "@/lib/utils";
import type { ImagingModality } from "@/types";

const MODALITY_STYLES: Record<ImagingModality, string> = {
  XR:     "bg-slate-100  text-slate-700  border-slate-300",
  CT:     "bg-indigo-100 text-indigo-700 border-indigo-300",
  MRI:    "bg-purple-100 text-purple-700 border-purple-300",
  US:     "bg-teal-100   text-teal-700   border-teal-300",
  NM:     "bg-orange-100 text-orange-700 border-orange-300",
  PET:    "bg-violet-100 text-violet-700 border-violet-300",
  DEXA:   "bg-sky-100    text-sky-700    border-sky-300",
  FLUORO: "bg-amber-100  text-amber-700  border-amber-300",
  MAMMO:  "bg-pink-100   text-pink-700   border-pink-300",
};

interface ModalityBadgeProps {
  modality: ImagingModality;
  className?: string;
}

export function ModalityBadge({ modality, className }: ModalityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold tracking-wide",
        MODALITY_STYLES[modality],
        className,
      )}
    >
      {modality}
    </span>
  );
}
