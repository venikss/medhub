import { Badge } from "@/components/ui/badge";
import type { BillingInvoiceStatus, ClaimStatus, DenialStatus } from "@/types";

type AnyStatus = BillingInvoiceStatus | ClaimStatus | DenialStatus;

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  // Invoice
  draft:            { label: "Draft",           className: "bg-gray-100 text-gray-700" },
  sent:             { label: "Sent",             className: "bg-blue-100 text-blue-700" },
  billed_insurance: { label: "Billed Insurance", className: "bg-purple-100 text-purple-700" },
  partial:          { label: "Partial",          className: "bg-amber-100 text-amber-700" },
  unpaid:           { label: "Unpaid",           className: "bg-orange-100 text-orange-700" },
  overdue:          { label: "Overdue",          className: "bg-red-100 text-red-700" },
  cleared:          { label: "Cleared",          className: "bg-green-100 text-green-700" },
  void:             { label: "Void",             className: "bg-gray-200 text-gray-500" },

  // Claim
  submitted:        { label: "Submitted",        className: "bg-blue-100 text-blue-700" },
  acknowledged:     { label: "Acknowledged",     className: "bg-indigo-100 text-indigo-700" },
  pending:          { label: "Pending",          className: "bg-amber-100 text-amber-700" },
  partially_paid:   { label: "Partial Payment",  className: "bg-amber-100 text-amber-700" },
  paid:             { label: "Paid",             className: "bg-green-100 text-green-700" },
  denied:           { label: "Denied",           className: "bg-red-100 text-red-700" },
  appealed:         { label: "Appealed",         className: "bg-purple-100 text-purple-700" },

  // Denial
  pending_appeal:   { label: "Pending Appeal",   className: "bg-orange-100 text-orange-700" },
  upheld:           { label: "Upheld",           className: "bg-red-100 text-red-700" },
  overturned:       { label: "Overturned",       className: "bg-green-100 text-green-700" },
  resubmitted:      { label: "Resubmitted",      className: "bg-blue-100 text-blue-700" },
  written_off:      { label: "Written Off",      className: "bg-gray-200 text-gray-500" },
};

interface Props {
  status: AnyStatus;
  size?: "sm" | "default";
}

export function FinancialStatusBadge({ status, size = "default" }: Props) {
  const config = STATUS_CONFIG[status] ?? { label: status, className: "bg-gray-100 text-gray-600" };
  return (
    <Badge
      variant="outline"
      className={`border-0 font-medium ${size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs"} ${config.className}`}
    >
      {config.label}
    </Badge>
  );
}
