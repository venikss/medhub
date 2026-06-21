import { apiFetch } from "@/lib/api";
import type {
  CriticalFinding,
  DicomSeries,
  ImagingOrder,
  ImagingStudy,
  ModalitySlot,
  PriorStudy,
  RadiologyReport,
  RadiologyStats,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface RadiologyDashboardResponse {
  stats: RadiologyStats;
  statOrders: ImagingOrder[];
  recentSignedReports: RadiologyReport[];
  pendingCriticalFindings: CriticalFinding[];
}

export interface ImagingOrdersQuery {
  [key: string]: string | undefined;
  q?: string;
  modality?: string;
  status?: string;
  priority?: string;
}

export interface ImagingStudiesQuery {
  [key: string]: string | undefined;
  q?: string;
  modality?: string;
  status?: string;
}

export interface CriticalFindingsQuery {
  [key: string]: string | undefined;
  patientId?: string;
  unacknowledged?: string;
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

function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") {
      search.set(key, String(value));
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function getRadiologyDashboard(token?: string) {
  return apiFetch<RadiologyDashboardResponse>("/radiology/dashboard/", { token });
}

export function getRadiologyStats(token?: string) {
  return apiFetch<RadiologyStats>("/radiology/stats/", { token });
}

export function listImagingOrders(query: ImagingOrdersQuery = {}, token?: string) {
  return getPaginatedList<ImagingOrder>(withQuery("/radiology/orders/", query), token);
}

export function listRadiologyReports(token?: string) {
  return getPaginatedList<RadiologyReport>("/radiology/reports/", token);
}

export function listCriticalFindings(query: CriticalFindingsQuery = {}, token?: string) {
  return getPaginatedList<CriticalFinding>(withQuery("/radiology/critical/", query), token);
}

export function listImagingStudies(query: ImagingStudiesQuery = {}, token?: string) {
  return getPaginatedList<ImagingStudy>(withQuery("/radiology/studies/", query), token);
}

export async function listPriorStudies(studyId: string, token?: string): Promise<PriorStudy[]> {
  const data = await apiFetch(`/radiology/studies/${studyId}/priors/`, { token }) as any;
  if (Array.isArray(data)) return data;
  return data?.results ?? data?.data ?? [];
}

export function createRadiologyReport(
  payload: { studyId: string; indication?: string; technique?: string },
  token?: string,
) {
  return apiFetch<RadiologyReport>("/radiology/reports/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateRadiologyReport(
  reportId: string,
  payload: Partial<Pick<RadiologyReport, "technique" | "comparison" | "findings" | "impression" | "recommendations" | "status">>,
  token?: string,
) {
  return apiFetch<RadiologyReport>(`/radiology/reports/${reportId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function signRadiologyReport(reportId: string, token?: string) {
  return apiFetch<RadiologyReport>(`/radiology/reports/${reportId}/sign/`, {
    method: "POST",
    token,
  });
}

export function acknowledgeCriticalFinding(findingId: string, token?: string) {
  return apiFetch<CriticalFinding>(`/radiology/critical/${findingId}/acknowledge/`, {
    method: "PUT",
    token,
  });
}

export function notifyCriticalFinding(
  findingId: string,
  payload: { notifiedTo: string; callbackNumber?: string },
  token?: string,
) {
  return apiFetch<CriticalFinding>(`/radiology/critical/${findingId}/notify/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function listModalitySchedules(
  query: { modality?: string; date?: string } = {},
  token?: string,
) {
  return getPaginatedList<ModalitySlot>(withQuery("/radiology/schedules/", query), token);
}

export function protocolImagingOrder(
  orderId: string,
  payload: { protocolNotes?: string },
  token?: string,
) {
  return apiFetch<ImagingOrder>(`/radiology/orders/${orderId}/protocol/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function scheduleImagingOrder(
  orderId: string,
  payload: { scheduledAt: string; scheduledRoom?: string },
  token?: string,
) {
  return apiFetch<ImagingOrder>(`/radiology/orders/${orderId}/schedule/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function cancelImagingOrder(
  orderId: string,
  payload: { reason?: string } = {},
  token?: string,
) {
  return apiFetch<ImagingOrder>(`/radiology/orders/${orderId}/cancel/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export function updateStudyStatus(
  studyId: string,
  newStatus: string,
  token?: string,
) {
  return apiFetch<ImagingStudy>(`/radiology/studies/${studyId}/status/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status: newStatus }),
  });
}

export function createImagingStudy(
  payload: { orderId: string; examDate: string; room?: string; status?: string },
  token?: string,
) {
  return apiFetch<ImagingStudy>("/radiology/studies/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

/**
 * Returns the authenticated proxy URL for the raw DICOM file.
 * Cornerstone3D should NOT use this directly — use DicomViewer which fetches
 * the bytes with auth and passes a blob URL to the viewer.
 */
export function getDicomFileUrl(studyId: string): string {
  const base =
    (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/+$/, "") || "/api/v1";
  return `${base}/radiology/studies/${studyId}/dicom-file/`;
}

/** List all saved DICOM series (upload bundles) for a study, newest first. */
export function listDicomSeries(studyId: string, token?: string | null): Promise<DicomSeries[]> {
  return apiFetch<DicomSeries[]>(`/radiology/studies/${studyId}/series/`, { token });
}

export interface DicomAnalysisResult {
  technique:       string;
  comparison:      string;
  findings:        string;
  impression:      string;
  recommendations: string;
  alerts:          string;
  metadata:        Record<string, string>;
  aiSource:        string;
  studyId:         string;
  seriesId?:       string;
  raw:             string;
}

/**
 * Upload one or more DICOM files (optional) and receive an AI-generated report draft.
 * When multiple files are provided (a multi-slice series), the backend samples
 * representative slices from across the full set for vision analysis.
 * Pass seriesId to re-analyse a previously-uploaded series without re-uploading.
 * If neither files nor seriesId is given, the backend falls back to the stored pacs_url.
 */
export function analyzeDicomStudy(
  studyId: string,
  files?: File | File[],
  seriesId?: string,
): Promise<DicomAnalysisResult> {
  if (files) {
    const formData = new FormData();
    const fileList = Array.isArray(files) ? files : [files];
    fileList.forEach((f) => formData.append("file", f));
    if (seriesId) formData.append("seriesId", seriesId);
    return apiFetch<DicomAnalysisResult>(`/radiology/studies/${studyId}/dicom-analyze/`, {
      method: "POST",
      body: formData,
    });
  }
  return apiFetch<DicomAnalysisResult>(`/radiology/studies/${studyId}/dicom-analyze/`, {
    method: "POST",
    body: JSON.stringify(seriesId ? { seriesId } : {}),
  });
}
