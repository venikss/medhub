"use client";

import { useState } from "react";
import { FlaskConical, ImageIcon, Plus, Send, Stethoscope, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  ImagingExamCombobox,
  isCustomExam,
  type ImagingExam,
  type ImagingExamSelection,
} from "@/features/radiology/components/ImagingExamCombobox";
import type { ImagingModality, OrderCategory, Priority } from "@/types";
import { cn } from "@/lib/utils";

const categories: { key: OrderCategory; icon: typeof FlaskConical; label: string; color: string }[] = [
  { key: "lab", icon: FlaskConical, label: "Lab", color: "bg-teal-500/10 text-teal-600 border-teal-500/30" },
  { key: "imaging", icon: ImageIcon, label: "Imaging", color: "bg-indigo-500/10 text-indigo-600 border-indigo-500/30" },
  { key: "consult", icon: Stethoscope, label: "Consult", color: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30" },
];

const commonOrders: Record<OrderCategory, string[]> = {
  lab: ["CBC with Diff", "BMP", "CMP", "Lipid Panel", "HbA1c", "TSH", "Troponin I", "PT/INR", "Urinalysis", "Blood Culture"],
  imaging: [], // handled by ImagingExamCombobox
  consult: ["Cardiology", "Neurology", "Surgery", "Pulmonology", "Nephrology", "Endocrinology", "Psychiatry"],
  procedure: [],
};

// ── Modality badge colours mirroring ModalityBadge ──
const MODALITY_STYLE: Record<ImagingModality, { bg: string; text: string; label: string }> = {
  XR: { bg: "bg-sky-500/10", text: "text-sky-700", label: "XR" },
  CT: { bg: "bg-violet-500/10", text: "text-violet-700", label: "CT" },
  MRI: { bg: "bg-indigo-500/10", text: "text-indigo-700", label: "MRI" },
  US: { bg: "bg-teal-500/10", text: "text-teal-700", label: "US" },
  NM: { bg: "bg-orange-500/10", text: "text-orange-700", label: "NM" },
  PET: { bg: "bg-rose-500/10", text: "text-rose-700", label: "PET" },
  DEXA: { bg: "bg-amber-500/10", text: "text-amber-700", label: "DEXA" },
  MAMMO: { bg: "bg-pink-500/10", text: "text-pink-700", label: "MMG" },
  FLUORO: { bg: "bg-emerald-500/10", text: "text-emerald-700", label: "FLR" },
};

interface CartEntry {
  category: OrderCategory;
  name: string;
  priority: Priority;
  notes: string;
  modality?: ImagingModality;
  bodyRegion?: string;
  contrastRequired?: boolean;
}

interface OrderComposerProps {
  patientId?: string;
  patientName?: string;
  onSubmit?: (orders: CartEntry[]) => Promise<void> | void;
  className?: string;
}

export function OrderComposer({ patientId, patientName, onSubmit, className }: OrderComposerProps) {
  const [activeCategory, setActiveCategory] = useState<OrderCategory>("lab");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority>("normal");
  const [notes, setNotes] = useState("");
  const [customOrder, setCustomOrder] = useState("");
  const [selectedExam, setSelectedExam] = useState<ImagingExamSelection | null>(null);
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = commonOrders[activeCategory].filter((order) =>
    order.toLowerCase().includes(search.toLowerCase()),
  );

  const priorityLabel = (value: Priority) => {
    switch (value) {
      case "normal": return "Routine";
      case "high": return "Urgent";
      default: return value.toUpperCase() === "STAT" ? "STAT" : value[0].toUpperCase() + value.slice(1);
    }
  };

  const addToCart = (name: string, extra?: Omit<CartEntry, "category" | "name" | "priority" | "notes">) => {
    setError(null);
    setMessage(null);
    if (!cart.find((item) => item.name === name && item.category === activeCategory)) {
      setCart((prev) => [...prev, { category: activeCategory, name, priority, notes, ...extra }]);
    }
    setSearch("");
    setCustomOrder("");
    setNotes("");
    setSelectedExam(null);
  };

  const addCustomOrder = () => {
    const value = customOrder.trim();
    if (!value) {
      setError("Enter the custom order name first.");
      setMessage(null);
      return;
    }
    addToCart(value);
  };

  // Called when user picks an exam from the imaging combobox
  const handleImagingExamSelect = (exam: ImagingExamSelection) => {
    setSelectedExam(exam);
  };

  const addSelectedImagingExam = () => {
    if (!selectedExam) {
      setError("Select an imaging exam first, then click Add to Cart.");
      return;
    }
    if (isCustomExam(selectedExam)) {
      addToCart(selectedExam.name);
    } else {
      const e = selectedExam as ImagingExam;
      addToCart(e.name, {
        modality: e.modality,
        bodyRegion: e.body,
        contrastRequired: e.contrast,
      });
    }
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, index) => index !== idx));
  };

  const handleSubmit = async () => {
    setError(null);
    setMessage(null);
    if (!patientId) { setError("Select a patient first before submitting orders."); return; }
    if (cart.length === 0) { setError("Add at least one order before submitting."); return; }
    if (!onSubmit) { setError("Order submission is not connected yet."); return; }

    setSubmitting(true);
    try {
      await onSubmit(cart);
      setCart([]);
      setMessage("Orders submitted successfully.");
    } catch (submitError) {
      setError(
        submitError instanceof Error && submitError.message
          ? submitError.message
          : "Failed to submit orders.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className={cn("border-border/50 shadow-sm overflow-visible", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" />
            Order Composer
          </CardTitle>
          {patientName && <Badge variant="outline" className="text-xs">{patientName}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {/* ── Category tabs ── */}
        <div className="flex items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setActiveCategory(cat.key);
                setSearch("");
                setCustomOrder("");
                setSelectedExam(null);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                activeCategory === cat.key ? cat.color : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted",
              )}
            >
              <cat.icon className="h-3 w-3" /> {cat.label}
            </button>
          ))}
        </div>

        {/* ── Priority selector (common to all tabs) ── */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase text-muted-foreground">Priority</span>
          {(["normal", "urgent", "stat"] as Priority[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPriority(p)}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-semibold capitalize transition-colors",
                priority === p
                  ? p === "stat"
                    ? "border-red-500/30 bg-red-500/10 text-red-700"
                    : p === "urgent"
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-700"
                    : "border-primary/30 bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/40 text-muted-foreground hover:bg-muted",
              )}
            >
              {p === "normal" ? "Routine" : p === "urgent" ? "Urgent" : "STAT"}
            </button>
          ))}
        </div>

        {/* ── Imaging tab: combobox ── */}
        {activeCategory === "imaging" ? (
          <div className="space-y-2">
            <label className="text-[10px] font-semibold uppercase text-muted-foreground">
              Select Exam
            </label>
            <ImagingExamCombobox
              value={selectedExam}
              onSelect={handleImagingExamSelect}
              onClear={() => setSelectedExam(null)}
              placeholder="Search exam name, modality, or body region…"
            />

            {/* Add to cart button */}
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 h-8 text-xs"
              onClick={addSelectedImagingExam}
              disabled={!selectedExam}
            >
              <Plus className="h-3.5 w-3.5" /> Add to Cart
            </Button>
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <Input
                placeholder={`Search ${activeCategory} orders...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {filtered.map((name) => {
                const inCart = cart.some((item) => item.name === name && item.category === activeCategory);
                return (
                  <button
                    key={name}
                    onClick={() => addToCart(name)}
                    disabled={inCart}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-medium border transition-colors",
                      inCart
                        ? "bg-primary/10 text-primary border-primary/30 cursor-not-allowed"
                        : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted hover:border-border",
                    )}
                  >
                    {inCart ? "✓ " : "+ "}
                    {name}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder={`Other ${activeCategory} order...`}
                value={customOrder}
                onChange={(e) => setCustomOrder(e.target.value)}
                className="flex-1 h-9 text-sm"
              />
              <Button type="button" variant="outline" className="h-9" onClick={addCustomOrder}>
                Add Other
              </Button>
            </div>
          </>
        )}

        {/* ── Cart ── */}
        {cart.length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-semibold text-muted-foreground">Pending Orders ({cart.length})</p>
            {cart.map((item, idx) => {
              const mStyle = item.modality ? MODALITY_STYLE[item.modality] : null;
              return (
                <div
                  key={`${item.category}-${item.name}-${idx}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/30 border border-border/50"
                >
                  {/* Category / Modality badge */}
                  {mStyle ? (
                    <span
                      className={cn(
                        "mt-0.5 shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold",
                        mStyle.bg, mStyle.text,
                      )}
                    >
                      {mStyle.label}
                    </span>
                  ) : (
                    <Badge variant="outline" className="mt-0.5 shrink-0 text-[10px] capitalize">{item.category}</Badge>
                  )}

                  {/* Name + meta */}
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.name}</span>
                    {item.bodyRegion && (
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        {item.bodyRegion}
                        {item.contrastRequired && (
                          <><span className="opacity-40">·</span><span className="font-medium text-violet-600">Contrast</span></>
                        )}
                      </span>
                    )}
                  </div>

                  <Badge
                    variant={item.priority === "stat" ? "destructive" : item.priority === "urgent" ? "default" : "secondary"}
                    className="shrink-0 text-[10px]"
                  >
                    {priorityLabel(item.priority)}
                  </Badge>
                  <button onClick={() => removeFromCart(idx)} className="mt-0.5 shrink-0 text-muted-foreground hover:text-red-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            <Button className="w-full gap-2 mt-2" onClick={() => void handleSubmit()} disabled={submitting}>
              <Send className="h-3.5 w-3.5" /> Submit {cart.length} Order{cart.length > 1 ? "s" : ""}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

