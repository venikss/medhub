"use client";

import { useEffect, useState } from "react";
import {
  FlaskConical,
  HeartPulse,
  Network,
  ArrowUpRight,
  Pill,
  ScanLine,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getPatientModuleGraphSummary } from "@/features/cdss/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { CDSSPatientModuleGraphSummary, CDSSSourceModule } from "@/types";

interface ModuleGraphSummaryProps {
  patientId: string;
  module: CDSSSourceModule;
}

const MODULE_STYLES: Record<
  CDSSSourceModule,
  {
    icon: React.ComponentType<{ className?: string }>;
    accent: string;
    hero: string;
  }
> = {
  doctor: {
    icon: Stethoscope,
    accent: "text-sky-300",
    hero: "border-sky-400/30 bg-sky-500/10 text-sky-50",
  },
  pharmacy: {
    icon: Pill,
    accent: "text-emerald-300",
    hero: "border-emerald-400/30 bg-emerald-500/10 text-emerald-50",
  },
  lab: {
    icon: FlaskConical,
    accent: "text-fuchsia-300",
    hero: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-50",
  },
  radiology: {
    icon: ScanLine,
    accent: "text-cyan-300",
    hero: "border-cyan-400/30 bg-cyan-500/10 text-cyan-50",
  },
  nursing: {
    icon: HeartPulse,
    accent: "text-amber-300",
    hero: "border-amber-400/30 bg-amber-500/10 text-amber-50",
  },
  emergency: {
    icon: ShieldAlert,
    accent: "text-rose-300",
    hero: "border-rose-400/30 bg-rose-500/10 text-rose-50",
  },
  surgery: {
    icon: ShieldAlert,
    accent: "text-violet-300",
    hero: "border-violet-400/30 bg-violet-500/10 text-violet-50",
  },
  system: {
    icon: Network,
    accent: "text-slate-200",
    hero: "border-slate-400/30 bg-slate-500/10 text-slate-50",
  },
};

export function ModuleGraphSummary({ patientId, module }: ModuleGraphSummaryProps) {
  const token = useAuthStore((state) => state.token);
  const [summary, setSummary] = useState<CDSSPatientModuleGraphSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const style = MODULE_STYLES[module] ?? MODULE_STYLES.system;
  const Icon = style.icon;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getPatientModuleGraphSummary(patientId, module, token ?? undefined);
        if (!cancelled) {
          setSummary(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load graph summary.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [module, patientId, token]);

  return (
      <Card className="border-border/50 bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(15,23,42,0.78))] text-slate-50 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Icon className={`h-4 w-4 ${style.accent}`} />
            KG Summary
          </CardTitle>
          <Link href={`/cdss/patient/${patientId}/graph`}>
            <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-[11px] text-slate-300 hover:text-white">
              Open Full KG
              <ArrowUpRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="text-xs text-slate-400">Loading graph context...</p>
        ) : error ? (
          <p className="text-xs text-rose-300">{error}</p>
        ) : summary ? (
          <>
            <div className={`rounded-xl border px-3 py-3 ${style.hero}`}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] opacity-80">{module}</p>
              <p className="mt-1 text-sm font-semibold">{summary.title}</p>
              <p className="mt-1 text-xs leading-5 opacity-90">{summary.summary}</p>
              <div className="mt-3 flex items-center gap-2 text-[11px] opacity-85">
                <Network className="h-3.5 w-3.5" />
                <span>Live patient graph available for full exploration</span>
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Dx", value: summary.counts.diagnoses },
                { label: "Meds", value: summary.counts.medications },
                { label: "Alg", value: summary.counts.allergies },
                { label: "Labs", value: summary.counts.labs },
                { label: "Img", value: summary.counts.radiology },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg border border-slate-700/70 bg-slate-900/70 px-2 py-1.5 text-center"
                >
                  <p className="text-sm font-semibold text-white">{item.value}</p>
                  <p className="text-[10px] uppercase tracking-wide text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {summary.sections.slice(0, 3).map((section) => (
                <div
                  key={section.label}
                  className="rounded-lg border border-slate-700/70 bg-slate-900/60 px-3 py-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {section.label}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {section.items.slice(0, 3).map((item) => (
                      <span
                        key={`${section.label}-${item}`}
                        className="rounded-full border border-slate-700/80 bg-slate-950/70 px-2 py-1 text-[11px] leading-4 text-slate-100/90"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-400">No graph context available.</p>
        )}
      </CardContent>
    </Card>
  );
}
