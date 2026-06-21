import { apiFetch, API_BASE_URL } from "@/lib/api";
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
  const overrides = await getPaginatedList<CDSSOverrideBackend>("/cdss/overrides/", token);

  return overrides.map((override) => ({
    id: override.id,
    recommendationId: override.recommendationId,
    recommendationTitle: "CDSS Override",
    patientId: (override as any).patientId ?? "",
    patientName: (override as any).patientName || "—",
    clinicianId: "",
    clinicianName: override.clinicianName,
    clinicianRole: override.clinicianRole,
    action: override.action,
    reasonCategory: override.reasonCategory,
    reason: override.reason,
    timestamp: override.recordedAt,
    notes: override.notes,
    sourceModule: override.sourceModule,
  }));
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

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function generatePatientReport(
  patientId: string,
  token?: string | null,
): Promise<{ report: string; role: string }> {
  return apiFetch(`/cdss/patients/${patientId}/report/`, {
    method: "POST",
    token,
  }) as Promise<{ report: string; role: string }>;
}

export async function chatWithPatient(
  patientId: string,
  message: string,
  history: ChatMessage[],
  token?: string | null,
): Promise<{ response: string; history: ChatMessage[] }> {
  return apiFetch(`/cdss/patients/${patientId}/chat/`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
    token,
  }) as Promise<{ response: string; history: ChatMessage[] }>;
}

export type ChatStreamEvent =
  | { type: "thinking"; text: string }
  | { type: "answer"; text: string }
  | { type: "done"; history: ChatMessage[] }
  | { type: "error"; text: string };

export async function* chatWithPatientStream(
  patientId: string,
  message: string,
  history: ChatMessage[],
  token?: string | null,
): AsyncGenerator<ChatStreamEvent> {
  const readStoredToken = (): string | null => {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("medhub-auth") : null;
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { state?: { token?: string | null }; token?: string | null } | null;
      return (parsed && "state" in parsed ? parsed.state?.token : (parsed as { token?: string | null } | null)?.token) ?? null;
    } catch { return null; }
  };

  const makeStreamRequest = (tok: string | null) =>
    fetch(`${API_BASE_URL}/cdss/patients/${patientId}/chat/stream/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      },
      body: JSON.stringify({ message, history }),
    });

  let resolvedToken = readStoredToken() ?? token ?? null;
  let res = await makeStreamRequest(resolvedToken);

  if (res.status === 401) {
    try {
      const raw = typeof window !== "undefined" ? window.localStorage.getItem("medhub-auth") : null;
      if (raw) {
        const stored = JSON.parse(raw) as { state?: { token?: string | null; refreshToken?: string | null }; refreshToken?: string | null };
        const refreshToken = (stored && "state" in stored ? stored.state?.refreshToken : (stored as { refreshToken?: string | null } | null)?.refreshToken) ?? null;
        if (refreshToken) {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshed = (await refreshRes.json()) as { token: string; refreshToken: string };
            if ("state" in stored && stored.state) {
              stored.state.token = refreshed.token;
              stored.state.refreshToken = refreshed.refreshToken;
            } else {
              (stored as Record<string, unknown>).token = refreshed.token;
              (stored as Record<string, unknown>).refreshToken = refreshed.refreshToken;
            }
            window.localStorage.setItem("medhub-auth", JSON.stringify(stored));
            resolvedToken = refreshed.token;
            res = await makeStreamRequest(resolvedToken);
          }
        }
      }
    } catch { /* fall through to error handling below */ }
  }

  if (!res.ok || !res.body) {
    throw new Error(`Chat stream failed: ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith("data: ")) continue;
      try {
        yield JSON.parse(line.slice(6)) as ChatStreamEvent;
      } catch {
      }
    }
  }
}

export interface DifferentialItem {
  diagnosis: string;
  icd10Code?: string | null;
  reasoning?: string;
  likelihood?: "MOST LIKELY" | "POSSIBLE" | "RULE OUT" | null;
}

export interface EncounterSuggestion {
  encounter_id: string;
  differential: DifferentialItem[];
  assessment: string;
  plan: string;
  alerts: string;
  raw: string;
}

export async function suggestEncounterAssessment(
  encounterId: string,
  soap: { subjective?: string; objective?: string; assessment?: string; plan?: string },
  token?: string | null,
): Promise<EncounterSuggestion> {
  return apiFetch(`/cdss/encounters/${encounterId}/suggest/`, {
    method: "POST",
    body: JSON.stringify(soap),
    token,
  }) as Promise<EncounterSuggestion>;
}

export interface AcceptedDiagnosis {
  id: string;
  patientId: string;
  encounterId?: string | null;
  icdCode: string;
  description: string;
  diagnosisType: string;
  status: string;
  createdAt: string;
}

export async function acceptAIDiagnosis(
  encounterId: string,
  body: {
    diagnosis: string;
    icd10Code?: string | null;
    snomedCode?: string | null;
    snomedDisplay?: string | null;
    diagnosisType?: string;
    status?: string;
  },
  token?: string | null,
): Promise<AcceptedDiagnosis> {
  return apiFetch(`/cdss/encounters/${encounterId}/accept_diagnosis/`, {
    method: "POST",
    body: JSON.stringify(body),
    token,
  }) as Promise<AcceptedDiagnosis>;
}

export interface SubstitutionSuggestion {
  substitute: string;
  reason: string;
}

export interface RxAISuggestion {
  verdict: "safe" | "caution" | "do_not_dispense";
  verdict_text: string;
  interactions: string;
  allergy_risks: string;
  dose_assessment: string;
  recommendations: string;
  substitutions_raw: string;
  substitution_list: SubstitutionSuggestion[];
  summary: string;
  raw: string;
}

export async function suggestRxVerification(
  prescriptionId: string,
  patientId: string,
  rx: {
    medication: string;
    dose: string;
    route: string;
    frequency: string;
    sig?: string;
    indication?: string;
  },
  token?: string | null,
): Promise<RxAISuggestion> {
  return apiFetch(`/cdss/prescriptions/${prescriptionId}/ai_suggest/`, {
    method: "POST",
    body: JSON.stringify({ patientId, ...rx }),
    token,
  }) as Promise<RxAISuggestion>;
}

export interface LabAISuggestion {
  overall: "normal" | "abnormal" | "critical";
  overall_text: string;
  interpretation: string;
  clinical_context: string;
  follow_up: string;
  summary: string;
  raw: string;
}

export interface LabResultInput {
  testName: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: string;
}

export async function suggestLabInterpretation(
  panelId: string,
  patientId: string,
  panelName: string,
  results: LabResultInput[],
  token?: string | null,
): Promise<LabAISuggestion> {
  return apiFetch(`/cdss/lab-panels/${panelId}/ai_suggest/`, {
    method: "POST",
    body: JSON.stringify({ patientId, panelName, results }),
    token,
  }) as Promise<LabAISuggestion>;
}
