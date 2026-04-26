import { apiFetch } from "@/lib/api";
import type {
  CDSSOverrideRecord,
  CDSSPatientModuleGraphSummary,
  CDSSRecommendation,
  CDSSHospitalSummary,
  CDSSStats,
  CDSSOverrideAction,
  CDSSOverrideReasonCategory,
  CDSSSourceModule,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface CDSSStatsBackend {
  total: number;
  active: number;
  acknowledged: number;
  overridden: number;
  dismissed: number;
  followed: number;
  expired: number;
  criticalActive: number;
  generatedToday: number;
  overridesToday: number;
  followedToday: number;
  acknowledgedToday: number;
  infoActive: number;
  warningActive: number;
  overrideRate: number;
  followRate: number;
}

interface CDSSOverrideBackend {
  id: string;
  recommendationId: string;
  action: CDSSOverrideAction;
  reasonCategory: CDSSOverrideReasonCategory;
  reason: string;
  notes?: string;
  clinicianName: string;
  clinicianRole: string;
  sourceModule?: CDSSSourceModule;
  recordedAt: string;
}

interface CDSSPatientSummaryResponse {
  total: number;
  critical: number;
  warning: number;
  info: number;
  data: CDSSRecommendation[];
}

interface CDSSRunRulesResponse {
  patientId: string;
  generatedCount: number;
  graphSnapshot: {
    patientUid: string;
    diagnoses: Array<Record<string, unknown>>;
    medications: Array<Record<string, unknown>>;
    symptoms: Array<Record<string, unknown>>;
  };
  recommendations: CDSSRecommendation[];
}

function withQuery(path: string, params: Record<string, string | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

interface DataEnvelope<T> {
  data?: T[];
  results?: T[];
}

async function getPaginatedList<T>(path: string, token?: string | null): Promise<T[]> {
  const data = (await apiFetch(path, { token })) as
    | PaginatedResponse<T>
    | DataEnvelope<T>
    | T[];

  if (Array.isArray(data)) {
    return data;
  }

  if ("results" in data && Array.isArray(data.results)) {
    return data.results;
  }

  if ("data" in data && Array.isArray(data.data)) {
    return data.data;
  }

  return [];
}

export async function getCDSSStats(token?: string | null): Promise<CDSSStats> {
  const data = (await apiFetch("/cdss/stats/", { token })) as CDSSStatsBackend;

  return {
    totalActive: data.active,
    critical: data.criticalActive,
    warnings: data.warningActive ?? Math.max(data.active - data.criticalActive, 0),
    info: data.infoActive ?? 0,
    overriddenToday: data.overridesToday,
    followedToday: data.followedToday,
    acknowledgedToday: data.acknowledgedToday,
    accuracyRate: Math.max(100 - data.overrideRate, 0),
  };
}

export function getCDSSHospitalSummary(token?: string | null) {
  return apiFetch("/cdss/graph/hospital/summary/", { token }) as Promise<CDSSHospitalSummary>;
}

export function listCDSSRecommendations(
  query: {
    patientId?: string;
    status?: string;
    severity?: string;
    type?: string;
    outputKind?: string;
  } = {},
  token?: string | null,
) {
  return getPaginatedList<CDSSRecommendation>(withQuery("/cdss/recommendations/", query), token);
}

export async function listCDSSOverrides(token?: string | null): Promise<CDSSOverrideRecord[]> {
  const [overrides, recommendations] = await Promise.all([
    getPaginatedList<CDSSOverrideBackend>("/cdss/overrides/", token),
    listCDSSRecommendations({}, token),
  ]);

  const recommendationMap = new Map(recommendations.map((rec) => [rec.id, rec]));

  return overrides.map((override) => {
    const rec = recommendationMap.get(override.recommendationId);

    return {
      id: override.id,
      recommendationId: override.recommendationId,
      recommendationTitle: rec?.title ?? "CDSS Recommendation",
      patientId: rec?.patientId ?? "",
      patientName: rec?.patientName ?? "Unknown Patient",
      clinicianId: "",
      clinicianName: override.clinicianName,
      clinicianRole: override.clinicianRole,
      action: override.action,
      reasonCategory: override.reasonCategory,
      reason: override.reason,
      timestamp: override.recordedAt,
      notes: override.notes,
      sourceModule: override.sourceModule ?? rec?.sourceModule,
    };
  });
}

export function getPatientCDSSSummary(patientId: string, token?: string | null) {
  return apiFetch(`/cdss/patients/${patientId}/summary/`, { token }) as Promise<CDSSPatientSummaryResponse>;
}

export function runPatientCDSSRules(patientId: string, token?: string | null) {
  return apiFetch(`/cdss/patients/${patientId}/run_rules/`, {
    method: "POST",
    token,
  }) as Promise<CDSSRunRulesResponse>;
}

export function getPatientModuleGraphSummary(
  patientId: string,
  module: CDSSSourceModule,
  token?: string | null,
) {
  return apiFetch(
    `/cdss/patients/${patientId}/graph-summary/?module=${encodeURIComponent(module)}`,
    { token },
  ) as Promise<CDSSPatientModuleGraphSummary>;
}

export async function respondToCDSSRecommendation(
  recommendationId: string,
  payload: {
    action: CDSSOverrideAction;
    reasonCategory: CDSSOverrideReasonCategory;
    reason: string;
    notes?: string;
  },
  token?: string | null,
) {
  const data = (await apiFetch(`/cdss/recommendations/${recommendationId}/respond/`, {
    method: "POST",
    token,
    body: JSON.stringify({
      action: payload.action,
      reasonCategory: payload.reasonCategory,
      reason: payload.reason,
      clinicalJustification: payload.notes,
    }),
  })) as {
    recommendation: CDSSRecommendation;
    overrideRecord: CDSSOverrideBackend;
  };

  return {
    recommendation: data.recommendation,
    overrideRecord: {
      id: data.overrideRecord.id,
      recommendationId: data.overrideRecord.recommendationId,
      recommendationTitle: data.recommendation.title,
      patientId: data.recommendation.patientId,
      patientName: data.recommendation.patientName,
      clinicianId: "",
      clinicianName: data.overrideRecord.clinicianName,
      clinicianRole: data.overrideRecord.clinicianRole,
      action: data.overrideRecord.action,
      reasonCategory: data.overrideRecord.reasonCategory,
      reason: data.overrideRecord.reason,
      timestamp: data.overrideRecord.recordedAt,
      notes: data.overrideRecord.notes,
      sourceModule: data.overrideRecord.sourceModule ?? data.recommendation.sourceModule,
    } satisfies CDSSOverrideRecord,
  };
}
