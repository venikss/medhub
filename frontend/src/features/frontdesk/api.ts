import { apiFetch } from "@/lib/api";
import type { ADTPatient, Admission, AdminDepartment, AdminUser, Appointment, BedInfo, ConsentDocument, QueueEntry, Ward } from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface FrontDeskSummaryResponse {
  date: string;
  todayAppointments: number;
  activeAdmissions: number;
  availableBeds: number;
  avgWaitTime: number;
  upcomingAppointments: Appointment[];
  queueHighlights: QueueEntry[];
  bedsByWard: Array<{
    ward: string;
    total: number;
    occupied: number;
    available: number;
    reserved: number;
  }>;
}

export interface FrontDeskPatientSummaryResponse {
  patient: ADTPatient;
  todayAppointments: Appointment[];
  activeAdmission: Admission | null;
  consents: Array<{
    id: string;
    type: string;
    status: string;
    signedAt?: string | null;
  }>;
  pendingConsents: number;
}

export interface FrontDeskAdmissionLookupsResponse {
  doctors: AdminUser[];
  departments: AdminDepartment[];
  wards: Ward[];
  beds: BedInfo[];
  meta: {
    recommendedDoctorId?: string | null;
    recommendedDepartmentId?: string | null;
  };
}

function withQuery(path: string, params: Record<string, string | number | boolean | null | undefined>) {
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
  if ("results" in data && Array.isArray(data.results)) {
    return data.results;
  }
  if ("data" in data && Array.isArray(data.data)) {
    return data.data;
  }
  return [];
}

export async function searchPatients(query: string, token?: string | null): Promise<ADTPatient[]> {
  const response = await apiFetch(`/patients/search/?q=${encodeURIComponent(query)}`, { token });
  return response.data ?? [];
}

export function listPatients(query: { status?: string; ward?: string } = {}, token?: string | null) {
  return getPaginatedList<ADTPatient>(withQuery("/patients/", query), token);
}

export function getPatient(patientId: string, token?: string | null) {
  return apiFetch(`/patients/${patientId}/`, { token }) as Promise<ADTPatient>;
}

export function createPatient(payload: Record<string, unknown>, token?: string | null) {
  return apiFetch("/patients/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }).then((data) => {
    const result = data as { data?: ADTPatient } | ADTPatient;
    return "data" in result && result.data ? result.data : (result as ADTPatient);
  });
}

export function reassignDoctor(patientId: string, doctorId: string | null, token?: string | null) {
  return apiFetch(`/patients/${patientId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ assignedDoctorId: doctorId ?? "" }),
  }) as Promise<ADTPatient>;
}

export function listAdmissions(query: { status?: string; patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<Admission>(withQuery("/patients/admissions/", query), token);
}

export function createAdmission(payload: Record<string, unknown>, token?: string | null) {
  return apiFetch("/patients/admissions/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Admission>;
}

export function updateAdmission(admissionId: string, payload: Record<string, unknown>, token?: string | null) {
  return apiFetch(`/patients/admissions/${admissionId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Admission>;
}

export function listAppointments(
  query: { patientId?: string; doctorId?: string; date?: string; status?: string } = {},
  token?: string | null,
) {
  return getPaginatedList<Appointment>(withQuery("/patients/appointments/", query), token);
}

export function createAppointment(payload: Record<string, unknown>, token?: string | null) {
  return apiFetch("/patients/appointments/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Appointment>;
}

export function updateAppointmentStatus(appointmentId: string, status: string, token?: string | null) {
  return apiFetch(`/patients/appointments/${appointmentId}/status/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  }) as Promise<Appointment>;
}

export function listBeds(query: { ward?: string; status?: string; type?: string } = {}, token?: string | null) {
  return getPaginatedList<BedInfo>(withQuery("/patients/beds/", query), token);
}

export function listWards(token?: string | null) {
  return getPaginatedList<Ward>("/patients/wards/", token);
}

export function transferAdmission(
  admissionId: string,
  payload: { fromWard?: string; fromBed?: string; toWard?: string; toBed?: string; reason?: string; approvedBy?: string },
  token?: string | null,
) {
  return apiFetch(`/patients/admissions/${admissionId}/transfer/`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function dischargeAdmission(
  admissionId: string,
  payload: { dischargeType?: string; summary?: string; followUpDate?: string },
  token?: string | null,
) {
  return apiFetch(`/patients/admissions/${admissionId}/discharge/`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Admission>;
}

export function listQueue(query: { status?: string; service?: string } = {}, token?: string | null) {
  return getPaginatedList<QueueEntry>(withQuery("/patients/queue/", query), token);
}

export function updateQueueStatus(queueId: string, status: string, token?: string | null) {
  return apiFetch(`/patients/queue/${queueId}/status/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  }) as Promise<QueueEntry>;
}

export function callQueueTicket(queueId: string, token?: string | null) {
  return apiFetch(`/patients/queue/${queueId}/call/`, {
    method: "POST",
    token,
  }) as Promise<QueueEntry>;
}

export function listConsents(patientId: string, token?: string | null) {
  return getPaginatedList<ConsentDocument>(`/patients/${patientId}/consents/`, token);
}

export async function getFrontDeskSummary(token?: string | null): Promise<FrontDeskSummaryResponse> {
  return apiFetch("/patients/frontdesk/summary/", { token });
}

export async function getFrontDeskPatientSummary(
  patientId: string,
  token?: string | null,
): Promise<FrontDeskPatientSummaryResponse> {
  return apiFetch(`/patients/frontdesk/patients/${patientId}/summary/`, { token });
}

export async function getFrontDeskAdmissionLookups(
  query: { departmentId?: string; wardId?: string } = {},
  token?: string | null,
): Promise<FrontDeskAdmissionLookupsResponse> {
  return apiFetch(withQuery("/patients/frontdesk/admission-lookups/", query), { token });
}

export async function frontDeskCheckIn(
  payload: {
    patientId: string;
    appointmentId?: string;
    service?: string;
    priority?: string;
    window?: string;
  },
  token?: string | null,
) {
  return apiFetch("/patients/frontdesk/checkin/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}
