import {
  DollarSign, FileText, ShieldCheck, Building2, ArrowDownCircle,
  ClipboardList, XCircle, Send, UserCheck, ReceiptText,
  RefreshCw, LogOut, CreditCard,
} from "lucide-react";
import type { FinancialEvent, FinancialEventType } from "@/types";

const EVENT_CONFIG: Record<
  FinancialEventType,
  { Icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  admission:          { Icon: Building2,      color: "text-blue-600",   bg: "bg-blue-100" },
  discharge:          { Icon: LogOut,         color: "text-teal-600",   bg: "bg-teal-100" },
  charge_posted:      { Icon: ReceiptText,    color: "text-purple-600", bg: "bg-purple-100" },
  insurance_verified: { Icon: ShieldCheck,    color: "text-green-600",  bg: "bg-green-100" },
  claim_submitted:    { Icon: Send,           color: "text-blue-600",   bg: "bg-blue-100" },
  eob_received:       { Icon: FileText,       color: "text-indigo-600", bg: "bg-indigo-100" },
  payment_posted:     { Icon: DollarSign,     color: "text-green-600",  bg: "bg-green-100" },
  denial_received:    { Icon: XCircle,        color: "text-red-600",    bg: "bg-red-100" },
  appeal_submitted:   { Icon: ClipboardList,  color: "text-orange-600", bg: "bg-orange-100" },
  invoice_sent:       { Icon: Send,           color: "text-sky-600",    bg: "bg-sky-100" },
  patient_payment:    { Icon: CreditCard,     color: "text-emerald-600",bg: "bg-emerald-100" },
  adjustment:         { Icon: RefreshCw,      color: "text-gray-600",   bg: "bg-gray-100" },
  refund:             { Icon: ArrowDownCircle,color: "text-amber-600",  bg: "bg-amber-100" },
  collection:         { Icon: UserCheck,      color: "text-red-600",    bg: "bg-red-100" },
};

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function fmtTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

interface Props {
  events: FinancialEvent[];
}

export function FinancialTimeline({ events }: Props) {
  const sorted = [...events].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No financial activity recorded.</p>;
  }

  return (
    <ol className="relative space-y-0">
      {sorted.map((evt, idx) => {
        const cfg = EVENT_CONFIG[evt.type] ?? EVENT_CONFIG.adjustment;
        const { Icon } = cfg;
        const isLast = idx === sorted.length - 1;

        return (
          <li key={evt.id} className="flex gap-3 relative">
            {/* vertical line */}
            {!isLast && (
              <span className="absolute left-4 top-8 bottom-0 w-px bg-border" />
            )}

            {/* icon bubble */}
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${cfg.bg}`}
            >
              <Icon className={`h-4 w-4 ${cfg.color}`} />
            </span>

            {/* content */}
            <div className="pb-6 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-medium text-sm">{evt.title}</p>
                {evt.amount !== undefined && (
                  <span className={`text-xs font-semibold ${evt.type === "denial_received" ? "text-red-600" : "text-green-700"}`}>
                    {evt.type === "denial_received" ? "-" : "+"}{fmt(evt.amount)}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{evt.description}</p>
              <p className="text-xs text-muted-foreground/70 mt-1">{fmtTime(evt.timestamp)}{(evt.postedBy ?? evt.performedBy) ? ` · ${evt.postedBy ?? evt.performedBy}` : ""}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
