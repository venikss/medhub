"use client";

import { useMemo } from "react";
import { useCDSSStore } from "../store";

/**
 * Composable hook scoped to a single patient.
 * Does NOT apply module adapters — returns all recs for this patient
 * regardless of source module. Suitable for patient-context views.
 */
export function useCDSSPatient(patientId: string) {
  const store = useCDSSStore();

  const recommendations = useMemo(
    () => store.recommendations.filter((r) => r.patientId === patientId),
    [store.recommendations, patientId],
  );

  const overrides = useMemo(
    () => store.overrides.filter((o) => o.patientId === patientId),
    [store.overrides, patientId],
  );

  const activeRecs   = recommendations.filter((r) => r.status === "active");
  const resolvedRecs = recommendations.filter((r) => r.status !== "active");

  const counts = {
    total:    recommendations.length,
    active:   activeRecs.length,
    critical: activeRecs.filter((r) => r.severity === "critical").length,
    warnings: activeRecs.filter((r) => r.severity === "warning").length,
    info:     activeRecs.filter((r) => r.severity === "info").length,
    overrides: overrides.length,
  };

  const patientName = recommendations[0]?.patientName ?? "Unknown patient";
  const patientMRN  = recommendations[0]?.patientMRN  ?? "—";

  return {
    recommendations,
    activeRecs,
    resolvedRecs,
    overrides,
    counts,
    patientName,
    patientMRN,
    selectRecommendation: store.selectRecommendation,
    openOverrideModal:    store.openOverrideModal,
    submitOverride:       store.submitOverride,
  };
}
