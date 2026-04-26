"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2, Search, Stethoscope, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { searchDiagnosisCatalog, type DiagnosisCatalogOption } from "@/features/doctor/api";
import { cn } from "@/lib/utils";

interface DiagnosisCatalogComboboxProps {
  value?: DiagnosisCatalogOption | null;
  onSelect: (item: DiagnosisCatalogOption) => void;
  onClear?: () => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DiagnosisCatalogCombobox({
  value,
  onSelect,
  onClear,
  placeholder = "Search diagnosis catalog…",
  className,
  disabled = false,
}: DiagnosisCatalogComboboxProps) {
  const token = useAuthStore((state) => state.token);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<DiagnosisCatalogOption[]>([]);
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
    if (open) {
      const timer = setTimeout(() => searchRef.current?.focus(), 40);
      return () => clearTimeout(timer);
    }
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
    if (!open) return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await searchDiagnosisCatalog(query || "diabetes", token ?? undefined);
        setItems(data);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query, token]);

  const portalRoot = typeof document !== "undefined" ? document.body : null;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm shadow-xs transition-colors",
          "hover:bg-accent/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          open && "ring-1 ring-ring border-ring/70",
        )}
      >
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {value ? `${value.label} (${value.icd10Code ?? "no ICD-10"})` : placeholder}
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
          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
        </div>
      </button>

      {open && portalRoot && createPortal(
        <div
          ref={dropdownRef}
          style={dropdownStyle}
          className="overflow-hidden rounded-xl border border-border/60 bg-popover text-popover-foreground shadow-xl shadow-black/[0.08] ring-1 ring-black/[0.04]"
        >
          <div className="border-b border-border/40 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search diabetes, hypertension, MI…"
                className="h-8 border-0 bg-muted/40 pl-8 text-xs shadow-none focus-visible:ring-0"
              />
              {loading && <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="max-h-[280px] overflow-y-auto p-1">
            {!loading && items.length === 0 && (
              <p className="py-8 text-center text-xs text-muted-foreground">
                {query ? "No diagnoses match your search." : "Start typing to search the diagnosis catalog."}
              </p>
            )}

            {items.map((item) => {
              const isSelected = value?.icd10Code === item.icd10Code && value?.label === item.label;
              return (
                <button
                  key={`${item.icd10Code ?? "none"}-${item.snomedCode ?? "none"}-${item.label}`}
                  type="button"
                  onClick={() => {
                    onSelect(item);
                    setOpen(false);
                    setQuery("");
                  }}
                  className={cn(
                    "group flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent/40",
                    isSelected && "bg-primary/8 hover:bg-primary/12",
                  )}
                >
                  <div className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", isSelected ? "bg-primary/20" : "bg-muted/60 group-hover:bg-muted")}>
                    <Stethoscope className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium leading-snug">{item.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {item.icd10Code && (
                        <Badge variant="outline" className="h-auto rounded-full px-1.5 py-px text-[9px] font-mono">
                          ICD-10 {item.icd10Code}
                        </Badge>
                      )}
                      {item.snomedCode && (
                        <Badge variant="outline" className="h-auto rounded-full px-1.5 py-px text-[9px] font-mono text-indigo-700">
                          SNOMED {item.snomedCode}
                        </Badge>
                      )}
                    </div>
                    {item.snomedDisplay && item.snomedDisplay !== item.label && (
                      <p className="mt-1 text-[10px] text-muted-foreground">{item.snomedDisplay}</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>,
        portalRoot,
      )}
    </div>
  );
}
