"use client";

import { useState, useMemo } from "react";
import { useCDSSStore } from "../store";
import { getAdapter } from "../adapters";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type {
  CDSSSourceModule, CDSSOverrideAction, CDSSOverrideReasonCategory,
} from "@/types";

interface UseCDSSModuleOptions {
  /** Which clinical module is embedding CDSS (controls adapter filtering) */
  module: CDSSSourceModule;
  /** Optionally scope to a single patient */
  patientId?: string;
}

/**
 * Composable hook for embedding CDSS inside any clinical module.
 *
 * Usage:
 *   const cdss = useCDSSModule({ module: "pharmacy", patientId: "pat-002" });
 *
 *
 *
 *
 * This hook owns its own selection and modal UI state so it does NOT
 * pollute the central hub store with embedded-module state.
 */
export function useCDSSModule({ module, patientId }: UseCDSSModuleOptions) {
  const store = useCDSSStore();
  const token = useAuthStore((state) => state.token);
  const adapter = useMemo(() => getAdapter(module), [module]);

  const [selectedId, setSelectedId]               = useState<string | null>(null);
  const [showOverride, setShowOverride]           = useState(false);
  const [overrideTargetId, setOverrideTargetId]  = useState<string | null>(null);
  const [showEvidence, setShowEvidence]           = useState(false);

  const scopedRecs = useMemo(() => {
    const all = patientId
      ? store.recommendations.filter((r) => r.patientId === patientId)
      : store.recommendations;
    return adapter.filterRecommendations(all);
  }, [store.recommendations, patientId, adapter]);

  const activeRecs   = useMemo(() => scopedRecs.filter((r) => r.status === "active"),                                    [scopedRecs]);
  const criticalRecs = useMemo(() => activeRecs.filter((r) => r.severity === "critical"),                                [activeRecs]);

  const counts = useMemo(() => ({
    total:    scopedRecs.length,
    active:   activeRecs.length,
    critical: criticalRecs.length,
    warnings: activeRecs.filter((r) => r.severity === "warning").length,
    info:     activeRecs.filter((r) => r.severity === "info").length,
  }), [scopedRecs, activeRecs, criticalRecs]);

  const selectedRec    = scopedRecs.find((r) => r.id === selectedId)          ?? null;
  const overrideTarget = scopedRecs.find((r) => r.id === overrideTargetId)    ?? null;

  function openOverride(id: string) {
    setOverrideTargetId(id);
    setShowOverride(true);
  }

  function closeOverride() {
    setShowOverride(false);
    setOverrideTargetId(null);
  }

  function submitOverride(payload: {
    action: CDSSOverrideAction;
    reasonCategory: CDSSOverrideReasonCategory;
    reason: string;
    notes?: string;
    clinicianName: string;
    clinicianRole: string;
  }) {
    if (!overrideTargetId) return;
    store.openOverrideModal(overrideTargetId);
    store.submitOverride({ ...payload, sourceModule: module, token });
    closeOverride();
  }

  return {
    recommendations: scopedRecs,
    activeRecs,
    criticalRecs,
    counts,
    overrides: store.overrides.filter((o) =>
      patientId ? o.patientId === patientId : true
    ),

    selectedRec,
    selectRecommendation: (id: string | null) => setSelectedId(id),

    overrideTarget,
    showOverride,
    openOverride,
    closeOverride,
    submitOverride,

    showEvidence,
    setShowEvidence,

    moduleLabel: adapter.label,
    sourceModule: module,
  };
}
