import { AlertTriangle, Calendar } from "lucide-react";
import type { Invoice } from "@/types";
import { FinancialStatusBadge } from "./FinancialStatusBadge";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function isOverdue(inv: Invoice): boolean {
  if (!inv.dueDate) return false;
  return (
    new Date(inv.dueDate) < new Date() &&
    inv.status !== "cleared" &&
    inv.status !== "void"
  );
}

interface Props {
  invoice: Invoice;
  selected?: boolean;
  onClick?: () => void;
}

export function InvoiceCard({ invoice, selected = false, onClick }: Props) {
  const overdue = isOverdue(invoice);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`rounded-lg border p-4 cursor-pointer transition-colors select-none ${
        selected
          ? "border-blue-500 bg-blue-50"
          : overdue
          ? "border-red-200 bg-red-50/40 hover:bg-red-50"
          : "border-border hover:bg-muted/50"
      }`}
    >
      {/* Row 1 – patient + status */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{invoice.patientName}</p>
          <p className="text-xs text-muted-foreground">{invoice.id}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {overdue && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
          <FinancialStatusBadge status={invoice.status} size="sm" />
        </div>
      </div>

      {/* Row 2 – service description */}
      <p className="text-xs text-muted-foreground mt-1.5 truncate">
        {invoice.encounterType.charAt(0).toUpperCase() + invoice.encounterType.slice(1)} — {invoice.primaryDiagnosis}
      </p>

      {/* Row 3 – financials */}
      <div className="flex items-end justify-between mt-3 gap-2">
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">Charges</p>
            <p className="font-semibold">{fmt(invoice.totalCharges)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ins. Paid</p>
            <p className="font-semibold text-green-700">{fmt(invoice.insurancePaid)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pt. Due</p>
            <p className={`font-semibold ${invoice.patientBalance > 0 ? "text-orange-600" : "text-green-700"}`}>
              {fmt(invoice.patientBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Row 4 – payer + due date */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        <span>{invoice.insurancePlan?.payerName ?? "Self-Pay"}</span>
        {invoice.dueDate && (
          <span className={`flex items-center gap-1 ${overdue ? "text-red-500 font-medium" : ""}`}>
            <Calendar className="h-3 w-3" />
            Due {invoice.dueDate}
          </span>
        )}
      </div>
    </div>
  );
}
