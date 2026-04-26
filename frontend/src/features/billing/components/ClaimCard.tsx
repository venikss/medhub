import { AlertCircle, ExternalLink } from "lucide-react";
import type { InsuranceClaim } from "@/types";
import { FinancialStatusBadge } from "./FinancialStatusBadge";

const fmt = (n?: number) =>
  n === undefined
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

interface Props {
  claim: InsuranceClaim;
  selected?: boolean;
  onClick?: () => void;
}

export function ClaimCard({ claim, selected = false, onClick }: Props) {
  const hasDenials = (claim.denialIds?.length ?? 0) > 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`rounded-lg border p-4 cursor-pointer transition-colors select-none ${
        selected
          ? "border-blue-500 bg-blue-50"
          : hasDenials
          ? "border-red-200 hover:bg-red-50/30"
          : "border-border hover:bg-muted/50"
      }`}
    >
      {/* Row 1 */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{claim.patientName}</p>
          <p className="text-xs text-muted-foreground">{claim.id}</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasDenials && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
          <FinancialStatusBadge status={claim.status} size="sm" />
        </div>
      </div>

      {/* Row 2 – payer */}
      <p className="text-xs text-muted-foreground mt-1">
        {claim.payerName} · {claim.claimType}
      </p>

      {/* Row 3 – amounts */}
      <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
        <div>
          <p className="text-muted-foreground">Billed</p>
          <p className="font-semibold">{fmt(claim.totalBilled)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Allowed</p>
          <p className="font-semibold">{fmt(claim.allowedAmount)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Paid</p>
          <p className={`font-semibold ${claim.paidAmount ? "text-green-700" : ""}`}>
            {fmt(claim.paidAmount)}
          </p>
        </div>
        <div>
          <p className="text-muted-foreground">Pt. Resp.</p>
          <p className={`font-semibold ${(claim.patientResponsibility ?? 0) > 0 ? "text-orange-600" : ""}`}>
            {fmt(claim.patientResponsibility)}
          </p>
        </div>
      </div>

      {/* Row 4 – submitted date */}
      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
        {claim.submittedAt ? (
          <span>Submitted {claim.submittedAt.slice(0, 10)}</span>
        ) : (
          <span>Draft</span>
        )}
        <ExternalLink className="h-3 w-3 opacity-40" />
      </div>
    </div>
  );
}
