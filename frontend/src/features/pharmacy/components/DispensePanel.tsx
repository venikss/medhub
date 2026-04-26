"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, ScanLine, Printer, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { dispensePharmacyPrescription } from "@/features/pharmacy/api";
import type { DispenseRecord, FormularyItem, PharmacyPrescription } from "@/types";
import { cn } from "@/lib/utils";

interface DispensePanelProps {
  rx: PharmacyPrescription;
  formularyItem?: FormularyItem;
  token?: string | null;
  onDispense?: (record: DispenseRecord) => void;
  className?: string;
}

export function DispensePanel({ rx, formularyItem, token, onDispense, className }: DispensePanelProps) {
  const [lotNumber, setLotNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [loading, setLoading] = useState(false);

  const stockOk = formularyItem ? formularyItem.stockLevel >= rx.quantity : true;
  const lowStock = formularyItem ? formularyItem.stockLevel <= formularyItem.reorderPoint : false;

  const handleDispense = async () => {
    setLoading(true);
    try {
      const record = await dispensePharmacyPrescription(
        rx.id,
        { quantity: rx.quantity, lotNumber, expirationDate, daysSupply: 1 },
        token ?? undefined,
      );
      setLotNumber("");
      setExpirationDate("");
      onDispense?.(record);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={cn("border-border/50 shadow-sm", !stockOk && "border-red-500/30", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Dispense: {rx.medication} {rx.dosage}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Patient + Rx info */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-2 rounded border border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase">Patient</p>
            <p className="font-medium">{rx.patientName}</p>
            <p className="text-muted-foreground font-mono text-[10px]">{rx.mrn}</p>
          </div>
          <div className="p-2 rounded border border-border/50">
            <p className="text-[10px] text-muted-foreground uppercase">Quantity</p>
            <p className="text-lg font-bold">{rx.quantity}</p>
            <p className="text-muted-foreground">{rx.route} · {rx.frequency}</p>
          </div>
        </div>

        {/* Stock status */}
        {formularyItem && (
          <div className={cn("flex items-center justify-between p-2.5 rounded-lg border", stockOk ? (lowStock ? "bg-amber-500/[0.05] border-amber-500/30" : "bg-emerald-500/[0.05] border-emerald-500/30") : "bg-red-500/[0.06] border-red-500/30")}>
            <div className="flex items-center gap-2 text-xs">
              {stockOk ? (
                <CheckCircle2 className={cn("h-3.5 w-3.5", lowStock ? "text-amber-600" : "text-emerald-600")} />
              ) : (
                <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
              )}
              <span className="font-medium">
                Stock: {formularyItem.stockLevel} units
                {lowStock && " (LOW)"}
                {!stockOk && " — INSUFFICIENT"}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">${formularyItem.unitCost.toFixed(2)}/unit · Total: ${(formularyItem.unitCost * rx.quantity).toFixed(2)}</span>
          </div>
        )}

        {/* Dispensing form */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase block mb-1">Lot Number</label>
            <Input
              placeholder="LOT-..."
              className="h-8 text-xs font-mono"
              value={lotNumber}
              onChange={(e) => setLotNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase block mb-1">Expiration Date</label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
            />
          </div>
        </div>

        {/* Barcode + Label */}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 gap-2 text-xs h-9">
            <ScanLine className="h-3.5 w-3.5" /> Scan Barcode
          </Button>
          <Button variant="outline" className="flex-1 gap-2 text-xs h-9">
            <Printer className="h-3.5 w-3.5" /> Print Label
          </Button>
        </div>

        {/* Dispense */}
        <Button
          className="w-full gap-2"
          disabled={!stockOk || rx.status !== "verified" || loading || !lotNumber || !expirationDate}
          onClick={handleDispense}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Confirm Dispense
        </Button>
      </CardContent>
    </Card>
  );
}

