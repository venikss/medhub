import { apiFetch } from "@/lib/api";
import type { Encounter } from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface DoctorPrescription {
  id: string;
  patientId: string;
  patientName: string;
  encounterId?: string | null;
  prescribedById?: string;
  prescribedByName?: string;
  medicationName: string;
  generic_name?: string | null;
  genericName?: string | null;
  displayMedicationName?: string | null;
  rxnormCode?: string | null;
  dose: string;
  route: string;
  frequency: string;
  quantity: number;
  refillsAllowed: number;
  instructions: string;
  startDate: string;
  endDate?: string | null;
  status: string;
  createdAt: string;
}

export interface DoctorAppointment {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  department?: string | null;
  date: string;
  time: string;
  duration: number;
  status: string;
  type: string;
  notes?: string | null;
}

export interface DoctorAdmission {
  id: string;
  patientId: string;
  patientName: string;
  mrn: string;
  status: string;
  admittingDoctorId?: string | null;
  admittingDoctorName?: string | null;
  assignedDoctorId?: string | null;
  assignedDoctorName?: string | null;
  ward?: string | null;
  bed?: string | null;
  admittedAt?: string | null;
  reasonForAdmission?: string | null;
}

export interface DoctorOrder {
  id: string;
  patientId: string;
  patientName: string;
  category: string;
  orderableName?: string;
  name?: string;
  priority: string;
  status: string;
  orderedAt?: string;
  createdAt?: string;
  results?: string | null;
  completedAt?: string | null;
}

export interface DoctorChartPatient {
  id: string;
  mrn: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  dateOfBirth: string;
  gender: "male" | "female" | "other";
  phone?: string;
  email?: string;
  address?: string;
  bloodType?: string | null;
  allergies?: string[];
  status: string;
  ward?: string | null;
  wardName?: string | null;
  roomNumber?: string | null;
}

export interface DoctorChartDiagnosis {
  id: string;
  icdCode?: string;
  code?: string;
  description: string;
  diagnosisType?: string;
  type?: string;
  status: string;
}

export interface DiagnosisCatalogOption {
  label: string;
  icd10Code?: string | null;
  snomedCode?: string | null;
  snomedDisplay?: string | null;
}

export interface DoctorChartEncounter {
  id: string;
  date?: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  status: string;
  authorName?: string;
  visitType?: string;
}

export interface DoctorChartMedication {
  id: string;
  patientId: string;
  patientName: string;
  medicationName?: string;
  medication?: string;
  dose?: string;
  dosage?: string;
  route: string;
  frequency: string;
  quantity: number;
  refillsAllowed?: number;
  refills?: number;
  instructions?: string;
  sig?: string;
  startDate: string;
  status: string;
}

export interface DoctorChartResult {
  id: string;
  patientId?: string;
  patientName?: string;
  category?: "lab" | "imaging";
  orderId?: string;
  testName?: string;
  value?: string;
  unit?: string;
  referenceRange?: string;
  flag?: string;
  reportedAt?: string;
  reviewedBy?: string;
  notes?: string;
  impression?: string;
  findings?: string;
  examName?: string;
}

export interface DoctorChartCdssItem {
  id: string;
  outputKind?: "alert" | "recommendation";
  severity: "critical" | "warning" | "info";
  title: string;
  summary?: string;
  sourceModule?: string;
}

export interface DoctorPatientChart {
  patient: DoctorChartPatient;
  encounters: DoctorChartEncounter[];
  diagnoses: DoctorChartDiagnosis[];
  orders: DoctorOrder[];
  prescriptions: DoctorChartMedication[];
  labResults: DoctorChartResult[];
  radiologyReports: DoctorChartResult[];
  cdss: DoctorChartCdssItem[];
}

export interface DoctorResultsInbox {
  labResults: DoctorChartResult[];
  radiologyReports: DoctorChartResult[];
}

function normalizeDoctorOrderPriority(priority: string) {
  switch (priority) {
    case "normal":
    case "low":
      return "routine";
    case "high":
      return "urgent";
    default:
      return priority;
  }
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

type DoctorEncounterResponse = {
  id: string;
  patientId: string;
  patientName?: string;
  doctorId?: string;
  doctorName?: string;
  type: Encounter["visitType"];
  status: Encounter["status"];
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  signedAt?: string | null;
  createdAt?: string;
};

function mapEncounter(encounter: DoctorEncounterResponse) {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    patientName: encounter.patientName ?? "",
    date: encounter.createdAt ?? new Date().toISOString(),
    subjective: encounter.subjective,
    objective: encounter.objective,
    assessment: encounter.assessment,
    plan: encounter.plan,
    status: encounter.status,
    authorId: encounter.doctorId ?? "",
    authorName: encounter.doctorName ?? "",
    signedAt: encounter.signedAt ?? undefined,
    visitType: encounter.type,
  } satisfies Encounter;
}

export function listDoctorEncounters(
  query: { patientId?: string; doctorId?: string; status?: string } = {},
  token?: string,
) {
  return getPaginatedList<DoctorEncounterResponse>(withQuery("/doctors/encounters/", query), token)
    .then((items) => items.map(mapEncounter));
}

export function createDoctorEncounter(
  payload: {
    patientId: string;
    type: Encounter["visitType"];
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  },
  token?: string,
) {
  return apiFetch<DoctorEncounterResponse>("/doctors/encounters/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }).then(mapEncounter);
}

export function updateDoctorEncounter(
  encounterId: string,
  payload: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  },
  token?: string,
) {
  return apiFetch<DoctorEncounterResponse>(`/doctors/encounters/${encounterId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }).then(mapEncounter);
}

export function signDoctorEncounter(encounterId: string, token?: string) {
  return apiFetch<DoctorEncounterResponse>(`/doctors/encounters/${encounterId}/sign/`, {
    method: "POST",
    token,
  }).then(mapEncounter);
}

export function listDoctorPrescriptions(
  query: { patientId?: string; encounterId?: string } = {},
  token?: string,
) {
  return getPaginatedList<DoctorPrescription>(withQuery("/doctors/prescriptions/", query), token);
}

export function createDoctorPrescription(
  payload: {
    patientId: string;
    encounterId?: string;
    medicationName: string;
    dose: string;
    route: string;
    frequency: string;
    quantity: number;
    refillsAllowed: number;
    instructions: string;
    startDate: string;
    endDate?: string;
    generic_name?: string;
    rxnormCode?: string;
  },
  token?: string,
) {
  return apiFetch("/doctors/prescriptions/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<DoctorPrescription>;
}

export function createDoctorDiagnosis(
  payload: {
    patientId: string;
    encounterId?: string;
    icdCode: string;
    description: string;
    diagnosisType: string;
    status: string;
    snomedCode?: string;
    snomedDisplay?: string;
  },
  token?: string,
) {
  return apiFetch("/doctors/diagnoses/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<DoctorChartDiagnosis>;
}

export async function searchDiagnosisCatalog(query: string, token?: string) {
  const path = `/doctors/diagnosis-catalog/search/?q=${encodeURIComponent(query)}`;
  const response = (await apiFetch(path, { token })) as { data?: DiagnosisCatalogOption[] };
  return response.data ?? [];
}

export function listDoctorAppointments(
  query: { doctorId?: string; date?: string; status?: string } = {},
  token?: string,
) {
  return getPaginatedList<DoctorAppointment>(withQuery("/patients/appointments/", query), token);
}

export function listAdmissions(
  query: { status?: string; patientId?: string; doctorId?: string; departmentId?: string } = {},
  token?: string,
) {
  return getPaginatedList<DoctorAdmission>(withQuery("/patients/admissions/", query), token);
}

export function listDoctorOrders(
  query: { patientId?: string; encounterId?: string; category?: string; status?: string } = {},
  token?: string,
) {
  return getPaginatedList<DoctorOrder>(withQuery("/doctors/orders/", query), token);
}

export function createDoctorOrder(
  payload: {
    patientId: string;
    encounterId?: string;
    category: string;
    orderableName?: string;
    priority: string;
    instructions?: string;
    bodyPart?: string;
    examCode?: string;
    indication?: string;
    clinicalHistory?: string;
    specimenType?: string;
  },
  token?: string,
) {
  return apiFetch("/doctors/orders/", {
    method: "POST",
    token,
    body: JSON.stringify({
      ...payload,
      priority: normalizeDoctorOrderPriority(payload.priority),
    }),
  }) as Promise<DoctorOrder>;
}

export function getDoctorResultsInbox(doctorId: string, token?: string) {
  return apiFetch(`/doctors/${doctorId}/results/`, { token }) as Promise<DoctorResultsInbox>;
}

export function reviewDoctorResult(resultId: string, notes = "", token?: string) {
  return apiFetch(`/doctors/results/${resultId}/review/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ notes }),
  }) as Promise<DoctorChartResult>;
}

export function getDoctorPatientChart(patientId: string, token?: string) {
  return apiFetch(`/doctors/patients/${patientId}/chart/`, { token }) as Promise<DoctorPatientChart>;
}
