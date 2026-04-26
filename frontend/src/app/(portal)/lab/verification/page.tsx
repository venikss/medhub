"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, Clock, CheckCircle2 } from "lucide-react";
import { StatCard } from "@/components/molecules/StatCard";
import { VerificationPanel } from "@/features/lab/components/VerificationPanel";
import { listLabWorklist } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { LabPanel } from "@/types";

export default function VerificationPage() {
  const token = useAuthStore((state) => state.token);
  const [panels, setPanels] = useState<LabPanel[]>([]);

  const refresh = () => {
    void listLabWorklist({}, token ?? undefined)
      .then((data) => setPanels(data))
      .catch(() => setPanels([]));
  };

  useEffect(() => {
    let cancelled = false;

    void listLabWorklist({}, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setPanels(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPanels([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const pendingVerification = useMemo(
    () => panels.filter((panel) => panel.status === "complete" || panel.status === "partial"),
    [panels],
  );
  const verified = useMemo(
    () => panels.filter((panel) => panel.status === "verified" || panel.status === "released"),
    [panels],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Result Verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review, authorize, and release final lab results
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Awaiting Verification"
          value={pendingVerification.length}
          icon={Clock}
          iconClassName="bg-amber-500/10 text-amber-600"
        />
        <StatCard
          title="Verified Today"
          value={verified.length}
          icon={CheckCircle2}
          iconClassName="bg-emerald-500/10 text-emerald-600"
        />
        <StatCard
          title="Total Panels"
          value={panels.length}
          icon={ShieldCheck}
          iconClassName="bg-teal-500/10 text-teal-600"
        />
      </div>

      <div className="space-y-4">
        {pendingVerification.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            All panels verified. No items pending.
          </div>
        ) : (
          pendingVerification.map((panel) => <VerificationPanel key={panel.id} panel={panel} onStatusChange={refresh} />)
        )}
      </div>

      {verified.length > 0 && (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Recently Verified
          </h2>
          {verified.map((panel) => (
            <VerificationPanel key={panel.id} panel={panel} onStatusChange={refresh} />
          ))}
        </div>
      )}
    </div>
  );
}
