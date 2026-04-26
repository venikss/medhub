"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { ClaimStatus, Denial, InsuranceClaim, Invoice } from "@/types";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { listClaims, listDenials, listInvoices } from "@/features/billing/api";
import { ClaimCard } from "@/features/billing/components/ClaimCard";
import { FinancialStatusBadge } from "@/features/billing/components/FinancialStatusBadge";

const fmt = (n?: number) =>
  n === undefined ? "-" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const STATUS_FILTERS: { label: string; value: ClaimStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Submitted", value: "submitted" },
  { label: "Acknowledged", value: "acknowledged" },
  { label: "Pending", value: "pending" },
  { label: "Partial", value: "partially_paid" },
  { label: "Paid", value: "paid" },
  { label: "Denied", value: "denied" },
];

export default function ClaimsPage() {
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClaimStatus | "all">("all");
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [denials, setDenials] = useState<Denial[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listClaims({}, token ?? undefined),
      listDenials({}, token ?? undefined),
      listInvoices({}, token ?? undefined),
    ])
      .then(([claimList, denialList, invoiceList]) => {
        if (cancelled) return;
        setClaims(claimList);
        setDenials(denialList);
        setInvoices(invoiceList);
        setSelectedId((current) => current || claimList[0]?.id || "");
      })
      .catch(() => {
        if (cancelled) return;
        setClaims([]);
        setDenials([]);
        setInvoices([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return claims.filter((claim) => {
      const matchSearch =
        claim.patientName.toLowerCase().includes(q) ||
        claim.id.toLowerCase().includes(q) ||
        claim.payerName.toLowerCase().includes(q);
      const matchStatus = filter === "all" || claim.status === filter;
      return matchSearch && matchStatus;
    });
  }, [claims, filter, search]);

  const claim = claims.find((item) => item.id === selectedId) ?? null;
  const claimDenials = claim ? denials.filter((denial) => denial.claimId === claim.id) : [];
  const relatedInvoice = claim ? invoices.find((invoice) => invoice.id === claim.invoiceId) : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <aside className="w-80 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b space-y-3">
          <h2 className="font-semibold">Claim Worklist</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search..." className="pl-9 h-9" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status.value}
                onClick={() => setFilter(status.value)}
                className={`text-xs rounded-full px-2.5 py-0.5 border transition-colors ${
                  filter === status.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((item) => (
            <ClaimCard key={item.id} claim={item} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)} />
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground px-2 py-4">No claims found.</p>
          )}
        </div>
      </aside>

      {claim ? (
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold">{claim.id}</h1>
              <p className="text-muted-foreground text-sm">{claim.patientName} · {claim.mrn}</p>
            </div>
            <FinancialStatusBadge status={claim.status} />
          </div>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Claim Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-muted-foreground">Payer</p><p className="font-medium">{claim.payerName}</p></div>
                <div><p className="text-xs text-muted-foreground">Member ID</p><p className="font-medium">{claim.memberId}</p></div>
                {claim.groupNumber && (
                  <div><p className="text-xs text-muted-foreground">Group #</p><p className="font-medium">{claim.groupNumber}</p></div>
                )}
                <div><p className="text-xs text-muted-foreground">Claim Type</p><p className="font-medium capitalize">{claim.claimType}</p></div>
                <div><p className="text-xs text-muted-foreground">Invoice</p><p className="font-medium">{claim.invoiceId}</p></div>
                {claim.submittedAt && (
                  <div><p className="text-xs text-muted-foreground">Submitted</p><p className="font-medium">{claim.submittedAt.slice(0, 10)}</p></div>
                )}
                {claim.acknowledgedAt && (
                  <div><p className="text-xs text-muted-foreground">Acknowledged</p><p className="font-medium">{claim.acknowledgedAt.slice(0, 10)}</p></div>
                )}
                {claim.processedAt && (
                  <div><p className="text-xs text-muted-foreground">Processed</p><p className="font-medium">{claim.processedAt.slice(0, 10)}</p></div>
                )}
                {claim.eobReceivedAt && (
                  <div><p className="text-xs text-muted-foreground">EOB Received</p><p className="font-medium">{claim.eobReceivedAt.slice(0, 10)}</p></div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">EOB / Payment Breakdown</CardTitle></CardHeader>
            <CardContent>
              <div className="max-w-xs space-y-2 text-sm ml-auto">
                <div className="flex justify-between"><span className="text-muted-foreground">Total Billed</span><span className="font-semibold">{fmt(claim.totalBilled)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Allowed Amount</span><span>{fmt(claim.allowedAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Adjustment</span><span className="text-blue-700">- {fmt(claim.adjustmentAmount)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Insurance Paid</span><span className="text-green-700">{fmt(claim.paidAmount)}</span></div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Patient Responsibility</span>
                  <span className={(claim.patientResponsibility ?? 0) > 0 ? "text-orange-600" : "text-green-700"}>
                    {fmt(claim.patientResponsibility)}
                  </span>
                </div>
              </div>
              {claim.notes && (
                <p className="text-xs text-muted-foreground border-t pt-3 mt-3">{claim.notes}</p>
              )}
            </CardContent>
          </Card>

          {claimDenials.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Denials ({claimDenials.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {claimDenials.map((denial) => (
                  <div key={denial.id} className="rounded-md border border-red-200 bg-red-50/50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="outline" className="text-xs border-red-300 text-red-700 mb-1">{denial.reasonCode}</Badge>
                        <p className="text-sm font-medium">{denial.reasonDescription}</p>
                        <p className="text-xs text-muted-foreground">Denied: {fmt(denial.deniedAmount)} · Service: {denial.serviceDate}</p>
                      </div>
                      <FinancialStatusBadge status={denial.status} size="sm" />
                    </div>
                    {denial.resolutionNotes && (
                      <p className="text-xs text-muted-foreground mt-2 border-t pt-2">{denial.resolutionNotes}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {relatedInvoice && (
            <Card>
              <CardHeader className="pb-3"><CardTitle className="text-sm">Related Invoice: {relatedInvoice.id}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <span>{relatedInvoice.primaryDiagnosis}</span>
                  <FinancialStatusBadge status={relatedInvoice.status} size="sm" />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {relatedInvoice.chargeItems.length} charge items · Total {fmt(relatedInvoice.totalCharges)}
                </p>
              </CardContent>
            </Card>
          )}
        </main>
      ) : (
        <main className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a claim to view details.
        </main>
      )}
    </div>
  );
}
