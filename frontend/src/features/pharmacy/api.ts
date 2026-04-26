import { apiFetch } from "@/lib/api";
import type {
  DispenseRecord,
  DrugWarning,
  FormularyItem,
  InterventionRecord,
  PharmacyPrescription,
  RefillRecord,
  SubstitutionRequest,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface PharmacyIntervention {
  id: string;
  patientId: string;
  patientName: string;
  medication: string;
  type: string;
  reason: string;
  recommendation: string;
  outcome?: string;
  createdAt: string;
}

export interface PharmacyDashboardResponse {
  stats: {
    pendingVerification: number;
    verified: number;
    dispensing: number;
    dispensedToday: number;
    activeWarnings: number;
    pendingInterventions: number;
    lowStockItems: number;
    pendingSubstitutions: number;
  };
  pendingVerification: PharmacyPrescription[];
  severeWarnings: DrugWarning[];
  pendingInterventions: PharmacyIntervention[];
  lowStockItems: FormularyItem[];
}

export interface PharmacyPrescriptionsQuery {
  q?: string;
  status?: string;
  setting?: string;
  patientId?: string;
}

export interface PharmacyProfilesListResponse {
  data: Array<{
    id: string;
    patientId: string;
    name: string;
    patientName: string;
    mrn: string;
    allergies: string[];
    activeMedicationCount: number;
  }>;
  total: number;
}

export interface PharmacyProfileResponse {
  patientId: string;
  patientName: string;
  mrn: string;
  allergies: string[];
  activeMedications: PharmacyPrescription[];
  refills: RefillRecord[];
}

export interface FormularyQuery {
  q?: string;
  drugClass?: string;
}

export interface PharmacyInterventionsQuery {
  rxId?: string;
  prescriberId?: string;
  pendingOnly?: boolean;
}

function mapFormularyItem(item: Record<string, unknown>): FormularyItem {
  const strength = typeof item.strength === "string" && item.strength ? item.strength : "";
  const unitCost = typeof item.unitCost === "number" ? item.unitCost : (typeof item.unit_cost === "number" ? item.unit_cost : 0);

  return {
    id: String(item.id),
    displayName: String(item.displayName ?? item.name ?? ""),
    genericName: String(item.canonicalName ?? item.genericName ?? item.name ?? ""),
    brandNames: typeof item.name === "string" && item.name ? [item.name] : [],
    drugClass: String(item.drugClass ?? ""),
    form: typeof item.unit === "string" && item.unit ? item.unit : "unit",
    strengths: strength ? [strength] : [],
    formularyStatus: String(item.formularyStatus ?? "formulary") as FormularyItem["formularyStatus"],
    stockLevel: Number(item.stockLevel ?? 0),
    reorderPoint: Number(item.reorderLevel ?? item.reorderPoint ?? 0),
    unitCost,
    requiresPriorAuth: false,
    controlledSchedule: undefined,
    rxnormCode: typeof item.rxnormCode === "string" ? item.rxnormCode : undefined,
    notes: typeof item.ndc === "string" && item.ndc ? `NDC: ${item.ndc}` : undefined,
  };
}

function withQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined>,
) {
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

export function getPharmacyDashboard(token?: string) {
  return apiFetch<PharmacyDashboardResponse>("/pharmacy/dashboard/", { token });
}

export function listPharmacyPrescriptions(query: PharmacyPrescriptionsQuery = {}, token?: string) {
  return getPaginatedList<PharmacyPrescription>(withQuery("/pharmacy/prescriptions/", query), token);
}

export function getPharmacyDispenseQueue(query: { q?: string } = {}, token?: string) {
  return getPaginatedList<PharmacyPrescription>(withQuery("/pharmacy/dispense/queue/", query), token);
}

export function dispensePharmacyPrescription(
  prescriptionId: string,
  payload: { quantity: number; lotNumber: string; expirationDate: string; daysSupply: number },
  token?: string,
) {
  return apiFetch<DispenseRecord>(`/pharmacy/prescriptions/${prescriptionId}/dispense/`, {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  });
}

export function listPharmacyProfiles(token?: string) {
  return apiFetch<PharmacyProfilesListResponse>("/pharmacy/profiles/", { token });
}

export function getPharmacyProfile(patientId: string, token?: string) {
  return apiFetch<PharmacyProfileResponse>(`/pharmacy/profiles/?patientId=${patientId}`, { token });
}

export async function listFormularyItems(query: FormularyQuery = {}, token?: string) {
  const items = await getPaginatedList<Record<string, unknown>>(withQuery("/pharmacy/formulary/", query), token);
  return items.map(mapFormularyItem);
}

export function listPharmacyInterventions(query: PharmacyInterventionsQuery = {}, token?: string) {
  return getPaginatedList<InterventionRecord>(withQuery("/pharmacy/interventions/", query), token);
}

export function listDoctorInterventions(prescriberId: string, token?: string) {
  return getPaginatedList<InterventionRecord>(
    `/pharmacy/interventions/?prescriberId=${prescriberId}`,
    token,
  );
}

export function listPharmacyRefills(query: { patientId?: string; rxId?: string } = {}, token?: string) {
  return getPaginatedList<RefillRecord>(withQuery("/pharmacy/refills/", query), token);
}

export function listPharmacySubstitutions(
  query: { status?: string; rxId?: string } = {},
  token?: string,
) {
  const params: Record<string, string> = {};
  if (query.status && query.status !== "all") params.status = query.status;
  if (query.rxId) params.rxId = query.rxId;
  return getPaginatedList<SubstitutionRequest>(withQuery("/pharmacy/substitutions/", params), token);
}

export function createSubstitution(
  payload: { prescriptionId: string; substituteMedication: string; reason: string },
  token?: string,
) {
  return apiFetch<SubstitutionRequest>("/pharmacy/substitutions/", {
    method: "POST",
    token,
    body: JSON.stringify({
      prescription: payload.prescriptionId,
      substitute_medication: payload.substituteMedication,
      reason: payload.reason,
    }),
  });
}

export function updateSubstitutionStatus(
  substitutionId: string,
  status: "approved" | "rejected",
  token?: string,
) {
  return apiFetch<SubstitutionRequest>(`/pharmacy/substitutions/${substitutionId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  });
}

export function verifyPharmacyPrescription(
  prescriptionId: string,
  verificationNotes: string,
  token?: string,
) {
  return apiFetch<PharmacyPrescription>(`/pharmacy/prescriptions/${prescriptionId}/verify/`, {
    method: "POST",
    token,
    body: JSON.stringify({ verificationNotes }),
  });
}

export function holdPharmacyPrescription(
  prescriptionId: string,
  reason: string,
  token?: string,
) {
  return apiFetch<PharmacyPrescription>(`/pharmacy/prescriptions/${prescriptionId}/hold/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ reason }),
  });
}

export function rejectPharmacyPrescription(
  prescriptionId: string,
  reason: string,
  token?: string,
) {
  return apiFetch<PharmacyPrescription>(`/pharmacy/prescriptions/${prescriptionId}/reject/`, {
    method: "POST",
    token,
    body: JSON.stringify({ reason }),
  });
}

export function respondToIntervention(
  interventionId: string,
  outcome: string,
  notes: string,
  token?: string,
) {
  return apiFetch<InterventionRecord>(`/pharmacy/interventions/${interventionId}/respond/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ outcome, response: notes }),
  });
}

export function createIntervention(
  payload: {
    prescriptionId: string;
    type: string;
    reason: string;
    recommendation: string;
  },
  token?: string,
) {
  return apiFetch<InterventionRecord>("/pharmacy/interventions/", {
    method: "POST",
    token,
    body: JSON.stringify({
      prescription: payload.prescriptionId,
      type: payload.type,
      reason: payload.reason,
      recommendation: payload.recommendation,
    }),
  });
}
