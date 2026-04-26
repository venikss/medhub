"use client";

import { useEffect, useState } from "react";
import { DollarSign, CreditCard, Clock, AlertTriangle, TrendingUp, FileText, XCircle, Users } from "lucide-react";
import { StatCard } from "@/components/molecules/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getBillingDashboard, listClaims, listInvoices } from "@/features/billing/api";
import { FinancialStatusBadge } from "@/features/billing/components/FinancialStatusBadge";
import type { BillingStats, Denial, InsuranceClaim, Invoice, Payment } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const pct = (n: number) => `${n.toFixed(1)}%`;

const agingBuckets = [
  { label: "0-30 days", lo: 0, hi: 30, pctColor: "bg-blue-400" },
  { label: "31-60 days", lo: 31, hi: 60, pctColor: "bg-amber-400" },
  { label: "61-90 days", lo: 61, hi: 90, pctColor: "bg-orange-400" },
  { label: "90+ days", lo: 91, hi: Infinity, pctColor: "bg-red-400" },
];

function getAgeDays(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

export default function BillingDashboardPage() {
  const token = useAuthStore((state) => state.token);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [activeDenials, setActiveDenials] = useState<Denial[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      getBillingDashboard(token ?? undefined),
      listInvoices({}, token ?? undefined),
      listClaims({}, token ?? undefined),
    ])
      .then(([dashboard, invoiceList, claimList]) => {
        if (cancelled) return;
        setStats(dashboard.stats);
        setRecentPayments((dashboard.recentPayments ?? []).filter((payment) => !payment.isVoid));
        setActiveDenials(dashboard.activeDenials ?? []);
        setInvoices(invoiceList);
        setClaims(claimList);
      })
      .catch(() => {
        if (cancelled) return;
        setStats(null);
        setRecentPayments([]);
        setActiveDenials([]);
        setInvoices([]);
        setClaims([]);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const agingData = agingBuckets.map(({ label, lo, hi, pctColor }) => {
    const bucket = invoices.filter((invoice) => {
      const age = getAgeDays(invoice.createdAt);
      return age >= lo && age <= hi && invoice.status !== "cleared" && invoice.status !== "void";
    });
    return {
      label,
      pctColor,
      count: bucket.length,
      total: bucket.reduce((sum, invoice) => sum + invoice.patientBalance, 0),
    };
  });

  const totalAging = agingData.reduce((sum, bucket) => sum + bucket.total, 0);
  const pendingClaimsCount = claims.filter((claim) =>
    claim.status === "submitted" || claim.status === "acknowledged" || claim.status === "pending",
  ).length;
  const overdueThirtyDaysCount = invoices.filter((invoice) => {
    const age = getAgeDays(invoice.createdAt);
    return age >= 30 && invoice.status !== "cleared" && invoice.status !== "void";
  }).length;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Billing Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Revenue cycle overview - {new Date().toLocaleDateString("en-US", { dateStyle: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Billed Today" value={fmt(stats?.totalBilledToday ?? 0)} icon={FileText} iconClassName="text-blue-500" />
        <StatCard title="Collected Today" value={fmt(stats?.collectedToday ?? 0)} icon={DollarSign} iconClassName="text-green-500" />
        <StatCard title="Pending Insurance" value={fmt(stats?.pendingInsurance ?? 0)} icon={Clock} iconClassName="text-purple-500" />
        <StatCard title="Patient Balance Due" value={fmt(stats?.patientBalanceDue ?? 0)} icon={Users} iconClassName="text-orange-500" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard title="Pending Claims" value={String(pendingClaimsCount)} icon={CreditCard} iconClassName="text-indigo-500" />
        <StatCard title="Active Denials" value={String(activeDenials.length)} icon={XCircle} iconClassName="text-red-500" />
        <StatCard title="Overdue 30+ Days" value={String(overdueThirtyDaysCount)} icon={AlertTriangle} iconClassName="text-amber-500" />
        <StatCard title="Collection Rate" value={pct(stats?.collectionRate ?? 0)} icon={TrendingUp} iconClassName="text-teal-500" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Aging Accounts Receivable</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {agingData.map((bucket) => (
              <div key={bucket.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium">{bucket.label}</span>
                  <span className="text-muted-foreground">
                    {bucket.count} invoice{bucket.count !== 1 ? "s" : ""} - {fmt(bucket.total)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${bucket.pctColor}`} style={{ width: `${totalAging > 0 ? Math.min(100, (bucket.total / totalAging) * 100) : 0}%` }} />
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground pt-1">Total Patient AR: {fmt(totalAging)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Active Denials</CardTitle></CardHeader>
          <CardContent>
            {activeDenials.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active denials.</p>
            ) : (
              <div className="space-y-3">
                {activeDenials.map((denial) => (
                  <div key={denial.id} className="flex items-start justify-between gap-2 text-sm border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <p className="font-medium">{denial.patientName}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {denial.reasonCode} - {denial.reasonDescription.slice(0, 55)}...
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-semibold text-red-600 text-sm">{fmt(denial.deniedAmount)}</p>
                      <FinancialStatusBadge status={denial.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Recent Payments</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="pb-2 text-left font-medium">Patient</th>
                  <th className="pb-2 text-left font-medium">Payer</th>
                  <th className="pb-2 text-left font-medium">Method</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                  <th className="pb-2 text-right font-medium">Posted</th>
                </tr>
              </thead>
              <tbody>
                {recentPayments.map((payment) => (
                  <tr key={payment.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{payment.patientName}</td>
                    <td className="py-2 text-muted-foreground">{payment.payer}</td>
                    <td className="py-2"><Badge variant="outline" className="text-xs capitalize">{payment.method.replace(/_/g, " ")}</Badge></td>
                    <td className="py-2 text-right text-green-700 font-semibold">{fmt(payment.amount)}</td>
                    <td className="py-2 text-right text-muted-foreground text-xs">{payment.postedAt.slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Claim Status Summary</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {(["submitted", "pending", "partially_paid", "paid"] as const).map((status) => {
              const claimGroup = claims.filter((claim) => claim.status === status);
              return (
                <div key={status} className="rounded-lg border p-3 text-center">
                  <FinancialStatusBadge status={status} />
                  <p className="text-2xl font-bold mt-2">{claimGroup.length}</p>
                  <p className="text-xs text-muted-foreground">{fmt(claimGroup.reduce((sum, claim) => sum + claim.totalBilled, 0))}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
