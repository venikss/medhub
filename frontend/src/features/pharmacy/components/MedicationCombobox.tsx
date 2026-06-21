"use client";

/**
 * MedicationCombobox — searchable medication picker backed by the live formulary.
 *
 * Features:
 *  • Debounced search against GET /pharmacy/formulary/?q=:query
 *  • Shows generic name, brand, strength, drug class, formulary status, stock level
 *  • Highlights low-stock / out-of-stock with colour signals
 *  • Allows "custom" free-text entry for off-formulary drugs
 *  • Auto-fills dosage/route/form when a formulary item is selected
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Pill, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { listFormularyItems } from "@/features/pharmacy/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { FormularyItem } from "@/types";
import { cn } from "@/lib/utils";

export interface CustomMedication {
  name: string;
  custom: true;
}

export type MedicationSelection = FormularyItem | CustomMedication;

export function isCustomMedication(v: MedicationSelection): v is CustomMedication {
  return "custom" in v && v.custom === true;
}

interface MedicationComboboxProps {
  value?: MedicationSelection | null;
  onSelect: (item: MedicationSelection) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const formularyStatusColor: Record<string, string> = {
  formulary: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "non-formulary": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  restricted: "bg-red-500/10 text-red-700 border-red-500/20",
  investigational: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

function stockBadge(item: FormularyItem) {
  if (item.stockLevel === 0)
    return { label: "Out of stock", cls: "bg-red-500/10 text-red-700" };
  if (item.stockLevel <= item.reorderPoint)
    return { label: "Low stock", cls: "bg-amber-500/10 text-amber-700" };
  return { label: "In stock", cls: "bg-emerald-500/10 text-emerald-700" };
}

function displayLabel(v: MedicationSelection): string {
  if (isCustomMedication(v)) return v.name;
  return v.genericName || v.displayName || v.brandNames[0] || "Medication";
}

export function MedicationCombobox({
  value,
  onSelect,
  onClear,
  placeholder = "Select medication…",
  className,
  disabled = false,
}: MedicationComboboxProps) {
  const token = useAuthStore((s) => s.token);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<FormularyItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await listFormularyItems({ q: query || undefined }, token ?? undefined);
        setItems(data);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 280);
    return () => clearTimeout(t);
  }, [query, open, token]);

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  function handleSelect(item: MedicationSelection) {
    onSelect(item);
    setOpen(false);
    setQuery("");
  }

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
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? displayLabel(value) : placeholder}
        </span>
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
          {/* Search row */}
          <div className="border-b border-border/40 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, brand, or class…"
                className="h-8 border-0 bg-muted/40 pl-8 text-xs shadow-none focus-visible:ring-0"
              />
              {loading && (
                <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Results list */}
          <div className="max-h-[260px] overflow-y-auto p-1">
            {!loading && items.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {query ? "No drugs match your search." : "No formulary items found."}
              </p>
            )}

            {items.map((item) => {
              const stock = stockBadge(item);
              const fColor = formularyStatusColor[item.formularyStatus] ?? formularyStatusColor.formulary;
              const isSelected =
                value && !isCustomMedication(value) && value.id === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className={cn(
                    "group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent/40",
                    isSelected && "bg-primary/8 hover:bg-primary/12",
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors",
                      isSelected
                        ? "bg-primary/20"
                        : "bg-muted/60 group-hover:bg-muted",
                    )}
                  >
                    <Pill
                      className={cn(
                        "h-3.5 w-3.5",
                        isSelected ? "text-primary" : "text-muted-foreground",
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium leading-snug">
                        {item.genericName}
                      </span>
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                          stock.cls,
                        )}
                      >
                        {stock.label}
                      </span>
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground">
                      {(item.displayName || item.brandNames[0]) && (
                        <span className="italic">{item.displayName || item.brandNames[0]}</span>
                      )}
                      {item.strengths[0] && (
                        <>
                          <span className="opacity-40">·</span>
                          <span className="font-medium text-foreground/70">
                            {item.strengths[0]}
                          </span>
                        </>
                      )}
                      <span className="opacity-40">·</span>
                      <span className="capitalize">{item.form}</span>
                      {item.drugClass && (
                        <>
                          <span className="opacity-40">·</span>
                          <span>{item.drugClass}</span>
                        </>
                      )}
                    </div>

                    {/* Badges row */}
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-px text-[9px] font-medium capitalize",
                          fColor,
                        )}
                      >
                        {item.formularyStatus}
                      </span>
                      {item.requiresPriorAuth && (
                        <Badge
                          variant="outline"
                          className="h-auto rounded-full px-1.5 py-px text-[9px] text-amber-600"
                        >
                          Prior auth
                        </Badge>
                      )}
                      {item.rxnormCode && (
                        <Badge
                          variant="outline"
                          className="h-auto rounded-full px-1.5 py-px text-[9px] text-cyan-700"
                        >
                          RxNorm {item.rxnormCode}
                        </Badge>
                      )}
                      {item.controlledSchedule && (
                        <Badge
                          variant="outline"
                          className="h-auto rounded-full px-1.5 py-px text-[9px] text-red-600"
                        >
                          {item.controlledSchedule}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {isSelected && (
                    <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom / free-text option */}
          {query.trim() && (
            <div className="border-t border-border/40 p-1">
              <button
                type="button"
                onClick={() =>
                  handleSelect({ name: query.trim(), custom: true })
                }
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/40"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-xs font-bold text-muted-foreground">
                  +
                </span>
                <span className="text-sm text-muted-foreground">
                  Use{" "}
                  <strong className="font-semibold text-foreground">
                    &quot;{query.trim()}&quot;
                  </strong>{" "}
                  as off-formulary medication
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
