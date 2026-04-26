"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { FormularyItem } from "@/types";
import { cn } from "@/lib/utils";

interface FormularySearchProps {
  items: FormularyItem[];
  className?: string;
}

const statusColors: Record<string, string> = {
  formulary: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "non-formulary": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  restricted: "bg-red-500/10 text-red-700 border-red-500/20",
  investigational: "bg-violet-500/10 text-violet-700 border-violet-500/20",
};

export function FormularySearch({ items, className }: FormularySearchProps) {
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");

  const classes = ["all", ...Array.from(new Set(items.map((i) => i.drugClass)))];

  const filtered = items
    .filter((i) => classFilter === "all" || i.drugClass === classFilter)
    .filter((i) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return i.genericName.toLowerCase().includes(q) || i.brandNames.some((b) => b.toLowerCase().includes(q)) || i.drugClass.toLowerCase().includes(q);
    });

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search by drug name, brand, or class…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {classes.slice(0, 6).map((c) => (
            <button key={c} onClick={() => setClassFilter(c)} className={cn("px-2 py-1 rounded-full text-[10px] font-medium border transition-colors capitalize", classFilter === c ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted")}>
              {c === "all" ? "All" : c.split(" — ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((item) => {
          const lowStock = item.stockLevel <= item.reorderPoint;
          return (
            <div key={item.id} className={cn("p-3 rounded-lg border hover:shadow-sm transition-all", lowStock ? "border-amber-500/30 bg-amber-500/[0.02]" : "border-border/50")}>
              <div className="flex items-start justify-between mb-1">
                <div>
                  <p className="text-sm font-semibold">{item.genericName}</p>
                  <p className="text-xs text-muted-foreground">{item.brandNames.join(", ")}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full border capitalize", statusColors[item.formularyStatus])}>{item.formularyStatus}</span>
                  {item.requiresPriorAuth && <Badge variant="outline" className="text-[9px] text-amber-600">PA</Badge>}
                  {item.controlledSchedule && <Badge variant="outline" className="text-[9px] text-red-600">{item.controlledSchedule}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1.5">
                <span>{item.drugClass}</span>
                <span>·</span>
                <span className="capitalize">{item.form}</span>
                <span>·</span>
                <span>{item.strengths.join(", ")}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <Package className="h-2.5 w-2.5" />
                  <span className={cn("font-medium",lowStock ? "text-amber-700" : "text-emerald-700")}>{item.stockLevel}</span>
                  {lowStock && <AlertTriangle className="h-2.5 w-2.5 text-amber-600" />}
                </span>
                <span>·</span>
                <span>${item.unitCost.toFixed(2)}/unit</span>
              </div>
              {item.notes && <p className="text-[10px] text-muted-foreground mt-1.5 italic">{item.notes}</p>}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-8 text-sm text-muted-foreground">No drugs found.</div>}
      </div>
    </div>
  );
}
