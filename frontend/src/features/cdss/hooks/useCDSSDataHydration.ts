"use client";

import { useEffect, useMemo, useState } from "react";
import { listCDSSOverrides, listCDSSRecommendations, runPatientCDSSRules } from "../api";
import { mockCDSSOverrides, mockCDSSRecommendations } from "../mock/data";
import { useCDSSStore } from "../store";

interface UseCDSSDataHydrationOptions {
  token?: string | null;
  patientId?: string;
  refreshPatientIds?: string[];
  refreshBeforeLoad?: boolean;
  includeOverrides?: boolean;
  useMockOnError?: boolean;
}

export function useCDSSDataHydration({
  token,
  patientId,
  refreshPatientIds = [],
  refreshBeforeLoad = false,
  includeOverrides = false,
  useMockOnError = false,
}: UseCDSSDataHydrationOptions) {
  const setRecommendations = useCDSSStore((state) => state.setRecommendations);
  const setOverrides = useCDSSStore((state) => state.setOverrides);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const normalizedRefreshIds = useMemo(
    () => Array.from(new Set(refreshPatientIds.filter((value): value is string => Boolean(value)))).sort(),
    [refreshPatientIds],
  );
  const refreshIdsKey = normalizedRefreshIds.join("|");

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setLoading(true);
      setError(null);

      try {
        const idsToRefresh = Array.from(
          new Set(
            [patientId, ...normalizedRefreshIds]
              .filter((value): value is string => Boolean(value))
          )
        );

        if (refreshBeforeLoad && idsToRefresh.length > 0) {
          await Promise.allSettled(
            idsToRefresh.map((id) => runPatientCDSSRules(id, token ?? undefined))
          );
        }

        const [recommendations, overrides] = await Promise.all([
          listCDSSRecommendations(patientId ? { patientId } : {}, token ?? undefined),
          includeOverrides ? listCDSSOverrides(token ?? undefined) : Promise.resolve(null),
        ]);

        if (cancelled) return;

        setRecommendations(recommendations);
        if (overrides) {
          setOverrides(patientId ? overrides.filter((item) => item.patientId === patientId) : overrides);
        }
        setLoading(false);
      } catch (err) {
        if (cancelled) return;

        if (useMockOnError) {
          const recommendations = patientId
            ? mockCDSSRecommendations.filter((item) => item.patientId === patientId)
            : mockCDSSRecommendations;
          const overrides = patientId
            ? mockCDSSOverrides.filter((item) => item.patientId === patientId)
            : mockCDSSOverrides;

          setRecommendations(recommendations);
          if (includeOverrides) {
            setOverrides(overrides);
          }
          setError("Showing seeded CDSS examples while the live feed is unavailable.");
        } else {
          setRecommendations([]);
          if (includeOverrides) {
            setOverrides([]);
          }
          setError(err instanceof Error ? err.message : "Failed to load CDSS recommendations.");
        }

        setLoading(false);
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [
    includeOverrides,
    patientId,
    refreshBeforeLoad,
    refreshIdsKey,
    normalizedRefreshIds,
    setOverrides,
    setRecommendations,
    token,
    useMockOnError,
  ]);

  return { loading, error };
}
