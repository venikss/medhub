"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { getPatientAccountTimeline, listInvoices, listPatientAccounts, listPayments } from "@/features/billing/api";
import { FinancialStatusBadge } from "@/features/billing/components/FinancialStatusBadge";
import { FinancialTimeline } from "@/features/billing/components/FinancialTimeline";
import type { FinancialEvent, Invoice, PatientAccount, Payment } from "@/types";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export default function PatientSummaryPage() {
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [accounts, setAccounts] = useState<PatientAccount[]>([]);
  const [events, setEvents] = useState<FinancialEvent[]>([]);
  const [patientInvoices, setPatientInvoices] = useState<Invoice[]>([]);
  const [patientPayments, setPatientPayments] = useState<Payment[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listPatientAccounts({}, token ?? undefined)
      .then((data) => {
        if (cancelled) return;
        setAccounts(data);
        setSelectedId((current) => current || data[0]?.patientId || "");
      })
      .catch(() => {
        if (!cancelled) {
          setAccounts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!selectedId) return;

    let cancelled = false;

    void Promise.all([
      getPatientAccountTimeline(selectedId, token ?? undefined),
      listInvoices({ patientId: selectedId }, token ?? undefined),
      listPayments({ patientId: selectedId }, token ?? undefined),
    ])
      .then(([timeline, invoices, payments]) => {
        if (cancelled) return;
        setEvents(timeline);
        setPatientInvoices(invoices);
        setPatientPayments(payments);
      })
      .catch(() => {
        if (cancelled) return;
        setEvents([]);
        setPatientInvoices([]);
        setPatientPayments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, token]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return accounts.filter((account) => account.patientName.toLowerCase().includes(q) || account.mrn.toLowerCase().includes(q));
  }, [accounts, search]);

  const account = accounts.find((item) => item.patientId === selectedId) ?? null;
  const primaryInvoice = patientInvoices[0];
  const insurance = primaryInvoice?.insurancePlan;
  const patientPaid = patientPayments.filter((payment) => !payment.isVoid).reduce((sum, payment) => sum + payment.amount, 0);
  const adjustments = patientInvoices.reduce((sum, invoice) => sum + invoice.adjustments, 0);
  const overdueBalance = patientInvoices
    .filter((invoice) => invoice.status === "overdue")
    .reduce((sum, invoice) => sum + invoice.patientBalance, 0);

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      <aside className="w-72 shrink-0 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold mb-3">Patient Accounts</h2>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search patient / MRN..."
              className="pl-9 h-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.map((item) => (
            <button
              key={item.patientId}
              onClick={() => setSelectedId(item.patientId)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                selectedId === item.patientId ? "bg-blue-50 border border-blue-200" : "hover:bg-muted/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-sm">{item.patientName}</p>
                {item.patientBalance > 0 && (
                  <span className="text-xs font-semibold text-orange-600">{fmt(item.patientBalance)}</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{item.mrn}</p>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground px-3 py-4">No patients found.</p>
          )}
        </div>
      </aside>

      {account ? (
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">{account.patientName}</h1>
              <p className="text-sm text-muted-foreground">
                {account.mrn}
                {primaryInvoice?.dateOfBirth ? ` · DOB ${primaryInvoice.dateOfBirth}` : ""}
              </p>
            </div>
            {account.patientBalance > 0 ? (
              <Badge variant="outline" className="text-orange-700 border-orange-300 bg-orange-50 text-sm px-3 py-1">
                Balance Due: {fmt(account.patientBalance)}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 text-sm px-3 py-1">
                Account Clear
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Account Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Charged</span>
                    <span className="font-semibold">{fmt(account.totalBilled)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Insurance Paid</span>
                    <span className="font-semibold text-green-700">- {fmt(account.insurancePaid)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Contractual Adjustments</span>
                    <span className="font-semibold text-blue-700">- {fmt(adjustments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Patient Paid</span>
                    <span className="font-semibold text-green-700">- {fmt(patientPaid)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Patient Balance Due</span>
                    <span className={account.patientBalance > 0 ? "text-orange-600" : "text-green-700"}>
                      {fmt(account.patientBalance)}
                    </span>
                  </div>
                  {overdueBalance > 0 && (
                    <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-red-700 text-xs">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {fmt(overdueBalance)} overdue
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-blue-500" />
                  Insurance Coverage
                </CardTitle>
              </CardHeader>
              <CardContent>
                {insurance ? (
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-semibold">{insurance.payerName}</p>
                      <p className="text-muted-foreground">{insurance.planName}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-muted-foreground">Member ID</p>
                        <p className="font-medium">{insurance.memberId}</p>
                      </div>
                      {insurance.groupNumber && (
                        <div>
                          <p className="text-xs text-muted-foreground">Group #</p>
                          <p className="font-medium">{insurance.groupNumber}</p>
                        </div>
                      )}
                      {insurance.copay !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground">Copay</p>
                          <p className="font-medium">{fmt(insurance.copay)}</p>
                        </div>
                      )}
                      {insurance.deductible !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground">Deductible</p>
                          <p className="font-medium">
                            {fmt(insurance.deductibleMet ?? 0)} / {fmt(insurance.deductible)} met
                          </p>
                        </div>
                      )}
                      {insurance.outOfPocketMax !== undefined && (
                        <div>
                          <p className="text-xs text-muted-foreground">Out-of-Pocket Max</p>
                          <p className="font-medium">
                            {fmt(insurance.outOfPocketMet ?? 0)} / {fmt(insurance.outOfPocketMax)} met
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-muted-foreground">Prior Auth Required</p>
                        <FinancialStatusBadge status={insurance.requiresAuth ? "billed_insurance" : "cleared"} size="sm" />
                      </div>
                    </div>
                    {insurance.phone && (
                      <p className="text-xs text-muted-foreground">Phone: {insurance.phone}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No insurance on file - Self-pay.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Financial Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <FinancialTimeline events={events} />
            </CardContent>
          </Card>
        </main>
      ) : (
        <main className="flex-1 flex items-center justify-center text-muted-foreground">
          Select a patient to view their account.
        </main>
      )}
    </div>
  );
}
