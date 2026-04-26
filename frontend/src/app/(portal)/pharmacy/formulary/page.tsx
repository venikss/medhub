"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, RefreshCw, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormularySearch } from "@/features/pharmacy/components/FormularySearch";
import { listFormularyItems, listPharmacySubstitutions, updateSubstitutionStatus } from "@/features/pharmacy/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { FormularyItem, SubstitutionRequest } from "@/types";
import { cn } from "@/lib/utils";

const substitutionStatusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  approved: { label: "Approved", className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-700 border-red-500/20" },
};

export default function FormularyPage() {
  const token = useAuthStore((state) => state.token);
  const [formulary, setFormulary] = useState<FormularyItem[]>([]);
  const [substitutions, setSubstitutions] = useState<SubstitutionRequest[]>([]);
  const [subUpdating, setSubUpdating] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    void Promise.all([
      listFormularyItems({}, token ?? undefined),
      listPharmacySubstitutions({}, token ?? undefined),
    ])
      .then(([items, substitutionItems]) => {
        if (cancelled) {
          return;
        }

        setFormulary(items);
        setSubstitutions(substitutionItems);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : "Failed to load formulary data");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubstitutionAction = async (id: string, action: "approved" | "rejected") => {
    setSubUpdating(id);
    try {
      const updated = await updateSubstitutionStatus(id, action, token ?? undefined);
      setSubstitutions((prev) =>
        prev.map((s) => (s.id === updated.id ? (updated as SubstitutionRequest) : s)),
      );
    } finally {
      setSubUpdating(null);
    }
  };

  const lowStock = useMemo(
    () => formulary.filter((item) => item.stockLevel <= item.reorderPoint),
    [formulary],
  );

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <span className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm">Loading formulary…</p>
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-500/30 bg-red-500/5 px-6 py-4 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-500" />
          <p className="text-sm font-semibold text-red-700">Failed to load formulary</p>
          <p className="mt-1 text-xs text-red-600/80">{fetchError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Formulary</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Drug formulary, stock levels, and therapeutic substitutions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="border-rose-500/30 bg-rose-500/5 text-xs text-rose-700">
            {lowStock.length} low stock
          </Badge>
          <Badge variant="outline" className="text-xs">
            {formulary.length} drugs
          </Badge>
        </div>
      </div>

      {lowStock.length > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-700">
              {lowStock.length} item{lowStock.length > 1 ? "s" : ""} at or below reorder point
            </p>
            <p className="mt-0.5 text-xs text-rose-600/80">
              {lowStock.map((item) => item.genericName).join(" - ")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <div>
          <FormularySearch items={formulary} />
        </div>

        <div className="space-y-4">
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <RefreshCw className="h-4 w-4 text-violet-600" /> Substitution Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {substitutions.map((substitution) => {
                const config =
                  substitutionStatusConfig[substitution.status] ?? substitutionStatusConfig.pending;

                return (
                  <div
                    key={substitution.id}
                    className="space-y-2 rounded-lg border border-border/50 p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-muted-foreground">{substitution.id}</span>
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                          config.className,
                        )}
                      >
                        {config.label}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium">{substitution.patientName}</p>
                      <p className="text-emerald-700">
                        <span className="font-medium">Substitute:</span> {substitution.substituteMedication}
                      </p>
                    </div>
                    <p className="capitalize text-muted-foreground">
                      Reason: {substitution.reason.replace(/-/g, " ")}
                    </p>
                    {substitution.costSavings !== undefined && (
                      <p className="font-medium text-emerald-700">
                        Savings: ${substitution.costSavings.toFixed(2)}
                      </p>
                    )}
                    {substitution.status === "pending" && (
                      <div className="flex gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 border-red-500/30 text-xs text-red-600 hover:bg-red-500/10"
                          disabled={subUpdating === substitution.id}
                          onClick={() => handleSubstitutionAction(substitution.id, "rejected")}
                        >
                          {subUpdating === substitution.id ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Reject"}
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs"
                          disabled={subUpdating === substitution.id}
                          onClick={() => handleSubstitutionAction(substitution.id, "approved")}
                        >
                          {subUpdating === substitution.id ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : "Approve"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {substitutions.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No substitution requests.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Package className="h-4 w-4 text-primary" /> Stock Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {formulary
                .slice()
                .sort((left, right) => left.stockLevel / Math.max(left.reorderPoint, 1) - right.stockLevel / Math.max(right.reorderPoint, 1))
                .slice(0, 6)
                .map((item) => {
                  const divisor = Math.max(item.reorderPoint * 3, 1);
                  const percentage = Math.min(100, Math.round((item.stockLevel / divisor) * 100));
                  const isLow = item.stockLevel <= item.reorderPoint;

                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="max-w-[160px] truncate font-medium">{item.genericName}</span>
                        <span className={cn("font-mono font-medium", isLow ? "text-rose-600" : "text-emerald-700")}>
                          {item.stockLevel}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isLow ? "bg-rose-500" : percentage > 50 ? "bg-emerald-500" : "bg-amber-500",
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              {formulary.length === 0 && (
                <div className="py-4 text-center text-xs text-muted-foreground">
                  <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-muted-foreground/30" />
                  No formulary items found.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
