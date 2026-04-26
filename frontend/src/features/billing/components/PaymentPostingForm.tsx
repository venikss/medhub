"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CheckCircle } from "lucide-react";
import type { Invoice, PaymentMethod } from "@/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit Card" },
  { value: "debit_card", label: "Debit Card" },
  { value: "check", label: "Check" },
  { value: "eft", label: "EFT" },
  { value: "insurance_eft", label: "Insurance EFT" },
  { value: "wire", label: "Wire Transfer" },
];

interface Props {
  invoices: Invoice[];
  preselectedInvoiceId?: string;
  onPost?: (data: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    payer: string;
    referenceNumber: string;
    notes: string;
  }) => void;
}

export function PaymentPostingForm({ invoices, preselectedInvoiceId, onPost }: Props) {
  const [invoiceId, setInvoiceId] = useState(preselectedInvoiceId ?? "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("insurance_eft");
  const [payer, setPayer] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [posted, setPosted] = useState(false);

  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!invoiceId || !amount || !payer) return;
    onPost?.({
      invoiceId,
      amount: Number(amount),
      method,
      payer,
      referenceNumber: reference,
      notes,
    });
    setPosted(true);
    setTimeout(() => setPosted(false), 3000);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Invoice selector */}
      <div className="space-y-1.5">
        <Label>Invoice</Label>
        <Select value={invoiceId} onValueChange={(v) => setInvoiceId(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Select invoice…" />
          </SelectTrigger>
          <SelectContent>
            {invoices.map((inv) => (
              <SelectItem key={inv.id} value={inv.id}>
                {inv.id} — {inv.patientName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedInvoice && (
          <p className="text-xs text-muted-foreground">
            Balance due:{" "}
            <span className="font-semibold text-orange-600">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                selectedInvoice.patientBalance
              )}
            </span>
          </p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount ($)</Label>
        <Input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
        />
      </div>

      {/* Method */}
      <div className="space-y-1.5">
        <Label>Payment Method</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {METHODS.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Payer */}
      <div className="space-y-1.5">
        <Label htmlFor="payer">Payer Name</Label>
        <Input
          id="payer"
          placeholder="Patient / Insurance name"
          value={payer}
          onChange={(e) => setPayer(e.target.value)}
          required
        />
      </div>

      {/* Reference */}
      <div className="space-y-1.5">
        <Label htmlFor="ref">Reference / Check Number</Label>
        <Input
          id="ref"
          placeholder="Optional"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          placeholder="ERA batch, EOB date, adjustment details…"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={posted}>
        {posted ? (
          <><CheckCircle className="h-4 w-4 mr-2" /> Payment Posted</>
        ) : (
          "Post Payment"
        )}
      </Button>
    </form>
  );
}
