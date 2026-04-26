"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/atoms/StatusBadge";
import { DispensePanel } from "@/features/pharmacy/components/DispensePanel";
import {
  getPharmacyDispenseQueue,
  listFormularyItems,
  listPharmacyPrescriptions,
} from "@/features/pharmacy/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { FormularyItem, PharmacyPrescription } from "@/types";
import { cn } from "@/lib/utils";

const settingIcons: Record<string, string> = {
  inpatient: "IP",
  outpatient: "OP",
  discharge: "DC",
};

export default function DispensePage() {
  const token = useAuthStore((state) => state.token);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dispensableRxs, setDispensableRxs] = useState<PharmacyPrescription[]>([]);
  const [dispensedToday, setDispensedToday] = useState<PharmacyPrescription[]>([]);
  const [formularyItems, setFormularyItems] = useState<FormularyItem[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getPharmacyDispenseQueue({}, token ?? undefined),
      listPharmacyPrescriptions({ status: "dispensed" }, token ?? undefined),
      listFormularyItems({}, token ?? undefined),
    ])
      .then(([queue, history, formulary]) => {
        if (cancelled) {
          return;
        }

        setDispensableRxs(queue);
        setDispensedToday(history.slice(0, 10));
        setFormularyItems(formulary);
        setSelectedId((current) => current ?? queue[0]?.id ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setDispensableRxs([]);
          setDispensedToday([]);
          setFormularyItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const selected = dispensableRxs.find((rx) => rx.id === selectedId) ?? dispensableRxs[0] ?? null;

  const formularyItem = useMemo(() => {
    if (!selected) {
      return undefined;
    }

    const medicationName = (selected.genericName || selected.medication || "").toLowerCase();
    return formularyItems.find((item) => {
      const generic = item.genericName.toLowerCase();
      const brands = item.brandNames.some((brand) => brand.toLowerCase().includes(medicationName));
      return medicationName.includes(generic) || generic.includes(medicationName) || brands;
    });
  }, [formularyItems, selected]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dispensing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Stock-aware dispensing for verified prescriptions
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Ready to Dispense</h2>
            <Badge variant="outline" className="border-teal-500/30 text-xs text-teal-700">
              {dispensableRxs.length} items
            </Badge>
          </div>

          {dispensableRxs.length === 0 && (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm">No items ready to dispense.</p>
              </CardContent>
            </Card>
          )}

          {dispensableRxs.map((rx) => {
            const stockMatch = formularyItems.find((item) =>
              (rx.genericName || rx.medication).toLowerCase().includes(item.genericName.toLowerCase()),
            );
            const stockOk = stockMatch ? stockMatch.stockLevel >= rx.quantity : true;
            const isSelected = (selected?.id ?? null) === rx.id;

            return (
              <button
                key={rx.id}
                onClick={() => setSelectedId(rx.id)}
                className={cn(
                  "w-full rounded-lg border p-3 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/50 hover:bg-muted/40",
                  !stockOk && !isSelected && "border-red-500/20 bg-red-500/[0.02]",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-mono text-muted-foreground">{rx.id}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] font-semibold text-muted-foreground">
                      {settingIcons[rx.setting] ?? rx.setting}
                    </span>
                    <StatusBadge status={rx.priority} />
                  </div>
                </div>
                <p className="text-sm font-medium leading-tight">
                  {rx.medication} <span className="text-xs text-muted-foreground">{rx.dosage}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{rx.patientName}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={rx.status} />
                  <span className="text-[10px] text-muted-foreground">Qty: {rx.quantity}</span>
                  {!stockOk && (
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-red-600">
                      <AlertTriangle className="h-2.5 w-2.5" /> Low stock
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <div className="space-y-6">
          {selected ? (
            <DispensePanel
              rx={selected}
              formularyItem={formularyItem}
              token={token}
              onDispense={() => {
                setDispensableRxs((prev) => prev.filter((rx) => rx.id !== selected.id));
                setSelectedId(null);
              }}
            />
          ) : (
            <Card className="border-border/50">
              <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <Package className="h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm">Select a prescription to begin dispensing</p>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Dispensed Recently
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30 text-xs text-muted-foreground">
                      <th className="px-3 py-2.5 text-left font-medium">Prescription</th>
                      <th className="px-3 py-2.5 text-left font-medium">Patient</th>
                      <th className="px-3 py-2.5 text-left font-medium">Medication</th>
                      <th className="px-3 py-2.5 text-center font-medium">Qty</th>
                      <th className="px-3 py-2.5 text-left font-medium">Lot</th>
                      <th className="px-3 py-2.5 text-left font-medium">Dispensed By</th>
                      <th className="px-3 py-2.5 text-left font-medium">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dispensedToday.map((dispensed) => (
                      <tr
                        key={dispensed.id}
                        className="border-b border-border/30 transition-colors hover:bg-muted/40"
                      >
                        <td className="px-3 py-2.5 font-mono text-xs">{dispensed.id}</td>
                        <td className="px-3 py-2.5 text-xs font-medium">{dispensed.patientName}</td>
                        <td className="px-3 py-2.5 text-xs">{dispensed.medication}</td>
                        <td className="px-3 py-2.5 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {dispensed.quantity}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground">
                          {dispensed.lotNumber || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {dispensed.dispensedBy || "-"}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {dispensed.dispensedAt
                              ? new Date(dispensed.dispensedAt).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "-"}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {dispensedToday.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                          No dispense records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
