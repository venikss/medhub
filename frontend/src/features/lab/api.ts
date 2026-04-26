import { apiFetch } from "@/lib/api";
import type {
  AccessionRecord,
  AnalyzerQueueItem,
  LabPanel,
  LabReport,
  RecollectionRequest,
  Specimen,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface LabCriticalValue {
  id: string;
  resultId: string;
  patientId: string;
  patientName: string;
  mrn?: string;
  testName: string;
  value: string;
  unit?: string;
  status: string;
  notifiedTo?: string;
  notifiedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  createdAt?: string;
}

function withQuery(path: string, params: Record<string, any>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") {
      search.set(key, value);
    }
  });
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function getPaginatedList<T>(path: string, token?: string | null): Promise<T[]> {
  const data = (await apiFetch(path, { token })) as
    | PaginatedResponse<T>
    | { data?: T[]; results?: T[] }
    | T[];

  if (Array.isArray(data)) {
    return data;
  }

  return (data as any).results ?? (data as any).data ?? [];
}

export function listLabWorklist(
  query: { status?: string; priority?: string; patientId?: string; date?: string } = {},
  token?: string | null,
) {
  return getPaginatedList<LabPanel>(withQuery("/lab/worklist/", query), token);
}

export function submitPanelResults(
  panelId: string,
  results: Array<{
    testCode: string;
    testName: string;
    value: string;
    unit?: string;
    referenceRange?: string;
    flag?: string;
    previousValue?: string;
    delta?: string;
    comment?: string;
  }>,
  token?: string | null,
) {
  return apiFetch(`/lab/panels/${panelId}/results/`, {
    method: "POST",
    token,
    body: JSON.stringify({ results }),
  });
}

export function listSpecimens(query: { status?: string } = {}, token?: string | null) {
  return getPaginatedList<Specimen>(withQuery("/lab/specimens/", query), token);
}

export function listAccessions(token?: string | null) {
  return getPaginatedList<AccessionRecord>("/lab/accessions/", token);
}

export function createAccession(
  payload: { specimen: string; condition: string; test_names: string[] },
  token?: string | null,
) {
  return apiFetch("/lab/accessions/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<AccessionRecord>;
}

export function listAnalyzerQueue(query: { status?: string; instrument?: string } = {}, token?: string | null) {
  return getPaginatedList<AnalyzerQueueItem>(withQuery("/lab/analyzers/queue/", query), token);
}

export function updateAnalyzerQueueStatus(
  entryId: string,
  payload: { status: string; errorMessage?: string },
  token?: string | null,
) {
  return apiFetch(`/lab/analyzers/queue/${entryId}/status/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<AnalyzerQueueItem>;
}

export function listRecollections(token?: string | null) {
  return getPaginatedList<RecollectionRequest>("/lab/recollections/", token);
}

export function listLabReports(query: { status?: string; patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<LabReport>(withQuery("/lab/reports/", query), token);
}

export function listCriticalValues(query: { patientId?: string; unacknowledged?: string } = {}, token?: string | null) {
  return getPaginatedList<LabCriticalValue>(withQuery("/lab/critical/", query), token);
}

export function notifyCriticalValue(
  resultId: string,
  payload: { notifiedTo: string; notificationMethod?: string; readbackProvided?: boolean },
  token?: string | null,
) {
  return apiFetch(`/lab/critical/${resultId}/notify/`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function verifyPanel(panelId: string, token?: string | null) {
  return apiFetch(`/lab/panels/${panelId}/verify/`, {
    method: "PUT",
    token,
  }) as Promise<LabPanel>;
}

export function releaseLabReport(reportId: string, notes?: string, token?: string | null) {
  return apiFetch(`/lab/reports/${reportId}/release/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ notes: notes ?? "" }),
  }) as Promise<LabReport>;
}

export function rejectSpecimen(specimenId: string, reason: string, token?: string | null) {
  return apiFetch(`/lab/specimens/${specimenId}/reject/`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason }),
  });
}

export function recollectSpecimen(
  payload: { specimenId: string; reason: string },
  token?: string | null,
) {
  return apiFetch(`/lab/specimens/recollect/`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
