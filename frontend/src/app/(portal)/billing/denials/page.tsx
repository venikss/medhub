"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Clock, CheckCircle2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Denial, DenialStatus } from "@/types";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { appealDenial, listDenials } from "@/features/billing/api";
import { FinancialStatusBadge } from "@/features/billing/components/FinancialStatusBadge";

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const STATUS_FILTERS: { label: string; value: DenialStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Pending Appeal", value: "pending_appeal" },
  { label: "Appealed", value: "appealed" },
  { label: "Resubmitted", value: "resubmitted" },
  { label: "Overturned", value: "overturned" },
  { label: "Written Off", value: "written_off" },
];

const REASON_COLORS: Record<string, string> = {
  "CO-50": "bg-red-100 text-red-800 border-red-200",
  "CO-15": "bg-orange-100 text-orange-800 border-orange-200",
  "CO-97": "bg-purple-100 text-purple-800 border-purple-200",
  "CO-18": "bg-amber-100 text-amber-800 border-amber-200",
};

export default function DenialsPage() {
  const token = useAuthStore((state) => state.token);
  const [filter, setFilter] = useState<DenialStatus | "all">("all");
  const [denials, setDenials] = useState<Denial[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listDenials({}, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setDenials(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDenials([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    return filter === "all" ? denials : denials.filter((denial) => denial.status === filter);
  }, [denials, filter]);

  const activeCount = denials.filter((denial) => !["overturned", "written_off"].includes(denial.status)).length;
  const totalDenied = denials.reduce((sum, denial) => sum + denial.deniedAmount, 0);
  const totalRecovered = denials.filter((denial) => denial.status === "overturned").reduce((sum, denial) => sum + denial.deniedAmount, 0);

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-4rem)] overflow-y-auto">
      <div>
        <h1 className="text-2xl font-bold">Denial Queue</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Track, appeal, and resolve insurance claim denials</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Active Denials</p>
            <p className="text-2xl font-bold text-red-600 mt-1">{activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total Denied Value</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">{fmt(totalDenied)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Recovered (Overturned)</p>
            <p className="text-2xl font-bold text-green-700 mt-1">{fmt(totalRecovered)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((status) => (
          <button
            key={status.value}
            onClick={() => setFilter(status.value)}
            className={`text-xs rounded-full px-3 py-1 border transition-colors ${
              filter === status.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
            }`}
          >
            {status.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filtered.map((denial) => {
          const days = daysUntil(denial.appealDeadline);
          const isUrgent = days !== null && days <= 30 && !["overturned", "written_off"].includes(denial.status);
          const reasonColor = REASON_COLORS[denial.reasonCode] ?? "bg-gray-100 text-gray-800 border-gray-200";

          return (
            <Card key={denial.id} className={isUrgent ? "border-red-300" : ""}>
              {isUrgent && (
                <div className="bg-red-50 border-b border-red-200 px-4 py-2 flex items-center gap-2 text-red-700 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  Appeal deadline in {days} day{days !== 1 ? "s" : ""} - action required
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{denial.patientName}</CardTitle>
                    <p className="text-sm text-muted-foreground">{denial.id} · {denial.payerName} · Invoice {denial.invoiceId}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <FinancialStatusBadge status={denial.status} />
                    <span className="font-bold text-red-600">{fmt(denial.deniedAmount)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2">
                  <Badge variant="outline" className={`text-xs shrink-0 ${reasonColor}`}>
                    {denial.reasonCode}
                  </Badge>
                  <p className="text-sm">{denial.reasonDescription}</p>
                </div>

                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>Service: {denial.serviceDate}</span>
                  <span>Received: {denial.receivedAt.slice(0, 10)}</span>
                  {denial.appealDeadline && (
                    <span className={`flex items-center gap-1 ${isUrgent ? "text-red-600 font-medium" : ""}`}>
                      <Clock className="h-3 w-3" />
                      Appeal deadline: {denial.appealDeadline}
                    </span>
                  )}
                  {denial.appealSubmittedAt && (
                    <span className="flex items-center gap-1 text-purple-600">
                      <CheckCircle2 className="h-3 w-3" />
                      Appeal submitted: {denial.appealSubmittedAt.slice(0, 10)}
                    </span>
                  )}
                </div>

                {denial.resolutionNotes && (
                  <div className="rounded-md bg-muted/50 p-2.5 text-sm">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Resolution Notes</p>
                    {denial.resolutionNotes}
                  </div>
                )}

                {!["overturned", "written_off"].includes(denial.status) && (
                  <div className="flex gap-2 pt-1">
                    {denial.status === "pending_appeal" && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        disabled={submitting === denial.id}
                        onClick={() => {
                          if (!token) return;
                          const notes = window.prompt("Appeal notes (optional)", "") ?? "";
                          setSubmitting(denial.id);
                          void appealDenial(denial.id, notes, token ?? undefined)
                            .then((updated) => {
                              setDenials((current) => current.map((item) => (item.id === updated.id ? updated : item)));
                            })
                            .finally(() => setSubmitting(null));
                        }}
                      >
                        Submit Appeal
                      </Button>
                    )}
                    {denial.status === "appealed" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled>
                        <RefreshCw className="h-3 w-3 mr-1" />Follow Up
                      </Button>
                    )}
                    {denial.status === "resubmitted" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs" disabled>Check Status</Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled>
                      Write Off
                    </Button>
                  </div>
                )}
                {denial.status === "overturned" && (
                  <div className="flex items-center gap-1.5 text-green-700 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Overturned - payment recovered
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle2 className="h-10 w-10 mx-auto mb-3 text-green-500" />
            No denials in this category.
          </div>
        )}
      </div>
    </div>
  );
}
