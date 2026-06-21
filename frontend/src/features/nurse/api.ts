import { apiFetch } from "@/lib/api";
import { listAdmissions, listPatients } from "@/features/frontdesk/api";
import type {
  DischargeChecklistItem,
  HandoffEntry,
  IntakeOutput,
  MAREntry,
  NursingNote,
  NursingTask,
  PainEntry,
  Patient,
  VitalEntry,
  WoundNote,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface NurseTaskApi {
  id: string;
  patientId: string;
  patientName: string;
  room: string;
  type: string;
  description: string;
  priority: string;
  status: string;
  dueTime: string;
  completedTime?: string;
}

interface NurseWoundApi {
  id: string;
  patientId: string;
  patientName: string;
  type: string;
  location: string;
  description: string;
  care: string;
  createdAt: string;
  recordedByName?: string;
}

interface NurseChecklistApi {
  id: string;
  patientId: string;
  category: string;
  item: string;
  completed: boolean;
  completedByName?: string;
  completedAt?: string;
  notes?: string;
}

export type NurseWardPatient = Patient & {
  diagnosis?: string;
  assignedNurse?: string;
  acuity?: "low" | "medium" | "high" | "critical";
};

type QueryParams = Record<string, string | number | boolean | null | undefined>;

function withQuery(path: string, params: QueryParams) {
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
  const data = (await apiFetch(path, { token: token ?? undefined })) as
    | PaginatedResponse<T>
    | { data?: T[]; results?: T[] }
    | T[];

  if (Array.isArray(data)) {
    return data;
  }

  const objectData = data as PaginatedResponse<T> | { data?: T[]; results?: T[] };
  return objectData.results ?? objectData.data ?? [];
}

function inferAcuity(
  status: string,
  ward?: string | null,
  latestVital?: VitalEntry,
  overdueTaskCount = 0,
): NurseWardPatient["acuity"] {
  if (status === "critical" || ward?.toLowerCase().includes("icu")) return "critical";

  const news2 = latestVital?.news2Score ?? 0;
  const systolic = latestVital?.systolic ?? 0;
  const heartRate = latestVital?.heartRate ?? 0;
  const respiratoryRate = latestVital?.respiratoryRate ?? 0;
  const spo2 = latestVital?.spo2 ?? 0;

  if (
    news2 >= 7 ||
    (systolic > 0 && systolic <= 90) ||
    heartRate >= 130 ||
    respiratoryRate >= 30 ||
    (spo2 > 0 && spo2 <= 90) ||
    overdueTaskCount >= 4
  ) {
    return "critical";
  }

  if (
    news2 >= 5 ||
    (systolic > 0 && systolic <= 100) ||
    heartRate >= 110 ||
    respiratoryRate >= 22 ||
    (spo2 > 0 && spo2 <= 92) ||
    overdueTaskCount >= 2
  ) {
    return "high";
  }

  if (status === "stable" && news2 <= 1 && overdueTaskCount === 0) return "low";
  if (status === "admitted") return "medium";
  return "medium";
}

function normalizeIoType(type: string): IntakeOutput["type"] {
  switch (type) {
    case "blood-product":
    case "blood-loss":
      return "blood";
    case "irrigation":
      return "iv";
    default:
      return (type as IntakeOutput["type"]) || "oral";
  }
}

function normalizePainQuality(quality?: string): PainEntry["quality"] {
  const allowed: PainEntry["quality"][] = ["sharp", "dull", "burning", "throbbing", "aching", "stabbing"];
  return allowed.includes((quality ?? "") as PainEntry["quality"])
    ? (quality as PainEntry["quality"])
    : "aching";
}

function normalizeTaskType(type?: string): NursingTask["type"] {
  const mapping: Record<string, NursingTask["type"]> = {
    medication: "medication",
    med: "medication",
    wound: "wound-care",
    "wound-care": "wound-care",
    io: "io-check",
    "io-check": "io-check",
    ambulation: "ambulation",
    education: "education",
    discharge: "discharge",
    vitals: "vitals",
    assessment: "assessment",
  };
  return mapping[type ?? ""] ?? "other";
}

function normalizeWoundType(type?: string): WoundNote["type"] {
  const mapping: Record<string, WoundNote["type"]> = {
    surgical: "surgical",
    "pressure-injury": "pressure",
    traumatic: "laceration",
    diabetic: "pressure",
    vascular: "pressure",
    "moisture-associated": "pressure",
    catheter: "catheter",
    other: "drain",
  };
  return mapping[type ?? ""] ?? "drain";
}

function mapChecklistItem(item: NurseChecklistApi): DischargeChecklistItem {
  return {
    id: item.id,
    patientId: item.patientId,
    category: (item.category || "nursing") as DischargeChecklistItem["category"],
    description: item.item,
    completed: item.completed,
    completedBy: item.completedByName,
    completedAt: item.completedAt,
    notes: item.notes,
  };
}

export async function listNursePatients(token?: string | null): Promise<NurseWardPatient[]> {
  const [patients, admissions, vitals, tasks] = await Promise.all([
    listPatients({ status: "admitted" }, token ?? undefined),
    listAdmissions({ status: "admitted" }, token ?? undefined),
    listVitals({}, token),
    listNursingTasks({}, token),
  ]);

  const admissionByPatientId = new Map(admissions.map((admission) => [admission.patientId, admission]));
  const latestVitalByPatientId = new Map<string, VitalEntry>();
  for (const vital of vitals) {
    const existing = latestVitalByPatientId.get(vital.patientId);
    if (!existing || new Date(vital.timestamp).getTime() > new Date(existing.timestamp).getTime()) {
      latestVitalByPatientId.set(vital.patientId, vital);
    }
  }

  const overdueTaskCountByPatientId = new Map<string, number>();
  for (const task of tasks) {
    if (!task.isOverdue && task.status !== "overdue") {
      continue;
    }
    overdueTaskCountByPatientId.set(task.patientId, (overdueTaskCountByPatientId.get(task.patientId) ?? 0) + 1);
  }

  return patients.map((patient) => {
    const admission = admissionByPatientId.get(patient.id);
    const latestVital = latestVitalByPatientId.get(patient.id);
    const overdueTaskCount = overdueTaskCountByPatientId.get(patient.id) ?? 0;
    return {
      ...patient,
      diagnosis: admission?.reasonForAdmission ?? undefined,
      ward: admission?.ward ?? patient.ward,
      roomNumber: admission?.bed ?? patient.roomNumber,
      assignedDoctor: admission?.admittingDoctorName ?? patient.assignedDoctor,
      acuity: inferAcuity(patient.status, admission?.ward ?? patient.ward, latestVital, overdueTaskCount),
    };
  });
}

export function listVitals(query: { patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<Record<string, unknown>>(withQuery("/nurses/vitals/", query), token).then((records) =>
    records.map((record) => ({
      id: String(record.id),
      patientId: String(record.patientId),
      patientName: String(record.patientName ?? ""),
      timestamp: String(record.recordedAt),
      systolic: Number(record.systolic ?? 0),
      diastolic: Number(record.diastolic ?? 0),
      heartRate: Number(record.heartRate ?? 0),
      temperature: Number(record.temperature ?? 0),
      spo2: Number(record.spo2 ?? 0),
      respiratoryRate: Number(record.respiratoryRate ?? 0),
      news2Score: record.news2Score != null ? Number(record.news2Score) : undefined,
      painScore: record.painScore != null ? Number(record.painScore) : undefined,
      gcs: record.gcs != null ? Number(record.gcs) : undefined,
      recordedBy: String(record.recordedByName ?? ""),
      notes: typeof record.notes === "string" ? record.notes : undefined,
    })) as VitalEntry[],
  );
}

export function listIntakeOutput(query: { patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<Record<string, unknown>>(withQuery("/nurses/io/", query), token).then((records) =>
    records.map((record) => ({
      id: String(record.id),
      patientId: String(record.patientId),
      patientName: String(record.patientName ?? ""),
      timestamp: String(record.createdAt),
      direction: record.direction as IntakeOutput["direction"],
      type: normalizeIoType(String(record.type ?? "")),
      amount: Number(record.amountMl ?? 0),
      recordedBy: String(record.recordedByName ?? ""),
      notes: typeof record.notes === "string" ? record.notes : undefined,
    })) as IntakeOutput[],
  );
}

export function listPainAssessments(query: { patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<Record<string, unknown>>(withQuery("/nurses/pain/", query), token).then((records) =>
    records.map((record) => ({
      id: String(record.id),
      patientId: String(record.patientId),
      timestamp: String(record.createdAt),
      score: Number(record.score ?? 0),
      location: String(record.location ?? ""),
      quality: normalizePainQuality(typeof record.quality === "string" ? record.quality : undefined),
      intervention: typeof record.intervention === "string" ? record.intervention : undefined,
      recordedBy: String(record.recordedByName ?? ""),
    })) as PainEntry[],
  );
}

export function listMarEntries(query: { patientId?: string; date?: string } = {}, token?: string | null) {
  return getPaginatedList<MAREntry>(withQuery("/nurses/mar/", query), token);
}

export function listNursingTasks(query: { patientId?: string; status?: string } = {}, token?: string | null) {
  return getPaginatedList<NurseTaskApi>(withQuery("/nurses/tasks/", query), token).then((records) =>
    records.map((record) => ({
      id: record.id,
      patientId: record.patientId,
      patientName: record.patientName,
      room: record.room,
      type: normalizeTaskType(record.type),
      description: record.description,
      priority: (record.priority || "normal") as NursingTask["priority"],
      dueTime: record.dueTime,
      completedTime: record.completedTime,
      status: (record.status || "pending") as NursingTask["status"],
      isOverdue: record.status === "overdue",
    })) as NursingTask[],
  );
}

export function createNursingNote(
  payload: { patient: string; category: string; content: string },
  token?: string | null,
) {
  return apiFetch("/nurses/notes/", {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}

export function listNursingNotes(query: { patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<Record<string, unknown>>(withQuery("/nurses/notes/", query), token).then((records) =>
    records.map((record) => ({
      id: String(record.id),
      patientId: String(record.patientId),
      patientName: String(record.patientName ?? ""),
      category:
        record.category === "intervention"
          ? "care"
          : record.category === "general"
            ? "communication"
            : (record.category as NursingNote["category"]),
      content: String(record.content ?? ""),
      timestamp: String(record.createdAt),
      authorName: String(record.nurseName ?? "Nurse"),
    })) as NursingNote[],
  );
}

export function listWounds(query: { patientId?: string } = {}, token?: string | null) {
  return getPaginatedList<NurseWoundApi>(withQuery("/nurses/wounds/", query), token).then((records) =>
    records.map((record) => ({
      id: record.id,
      patientId: record.patientId,
      patientName: record.patientName,
      type: normalizeWoundType(record.type),
      location: record.location,
      description: record.description,
      care: record.care,
      timestamp: record.createdAt,
      recordedBy: record.recordedByName ?? "Nurse",
    })) as WoundNote[],
  );
}

export function listDischargeChecklist(patientId: string, token?: string | null) {
  return apiFetch(`/nurses/patients/${patientId}/discharge-checklist/`, {
    token: token ?? undefined,
  }).then((items) => (items as NurseChecklistApi[]).map(mapChecklistItem));
}

export function updateDischargeChecklistItem(
  patientId: string,
  itemId: string,
  payload: Partial<DischargeChecklistItem>,
  token?: string | null,
) {
  return apiFetch(`/nurses/patients/${patientId}/discharge-checklist/${itemId}/`, {
    method: "PUT",
    token: token ?? undefined,
    body: JSON.stringify({
      completed: payload.completed,
      notes: payload.notes,
    }),
  }).then((item) => mapChecklistItem(item as NurseChecklistApi));
}

export function listHandoffs(query: { shiftType?: string; shiftDate?: string } = {}, token?: string | null) {
  return getPaginatedList<Record<string, unknown>>(withQuery("/nurses/handoffs/", query), token).then((records) =>
    records.map((record) => ({
      id: String(record.id),
      patientId: String(record.patientId),
      patientName: String(record.patientName ?? ""),
      room: String(record.room ?? ""),
      situation: String(record.situation ?? ""),
      background: String(record.background ?? ""),
      assessment: String(record.assessment ?? ""),
      recommendation: String(record.recommendation ?? ""),
      fromNurse: String(record.fromNurseName ?? "Nurse"),
      toNurse: record.toNurseName ? String(record.toNurseName) : null,
      shiftDate: String(record.shiftDate ?? ""),
      shiftType: (record.shiftType || "day") as HandoffEntry["shiftType"],
      acknowledged: !!record.toNurseId,
    })) as HandoffEntry[],
  );
}

export function administerMedication(
  marEntryId: string,
  payload: { barcode?: string; notes?: string },
  token?: string | null,
) {
  return apiFetch<MAREntry>(`/nurses/mar/${marEntryId}/administer/`, {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}

export function updateMARStatus(
  marEntryId: string,
  newStatus: string,
  reason?: string,
  token?: string | null,
) {
  return apiFetch<MAREntry>(`/nurses/mar/${marEntryId}/status/`, {
    method: "PUT",
    token: token ?? undefined,
    body: JSON.stringify({ status: newStatus, reason }),
  });
}

export function completeTask(
  taskId: string,
  completionNotes?: string,
  token?: string | null,
) {
  return apiFetch(`/nurses/tasks/${taskId}/complete/`, {
    method: "PUT",
    token: token ?? undefined,
    body: JSON.stringify({ completionNotes: completionNotes ?? "" }),
  });
}

export function acknowledgeHandoff(handoffId: string, token?: string | null) {
  return apiFetch(`/nurses/handoffs/${handoffId}/acknowledge/`, {
    method: "POST",
    token: token ?? undefined,
  });
}

export function createHandoff(
  payload: {
    patient: string;
    situation: string;
    background: string;
    assessment: string;
    recommendation: string;
    shiftDate: string;
    shiftType: string;
  },
  token?: string | null,
) {
  return apiFetch(`/nurses/handoffs/`, {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify({
      patient: payload.patient,
      situation: payload.situation,
      background: payload.background,
      assessment: payload.assessment,
      recommendation: payload.recommendation,
      shift_date: payload.shiftDate,
      shift_type: payload.shiftType,
    }),
  });
}

export function createVitals(
  payload: {
    patient: string;
    systolic: number;
    diastolic: number;
    heart_rate: number;
    temperature: number;
    spo2: number;
    respiratory_rate: number;
    pain_score?: number;
    gcs?: number;
    notes?: string;
  },
  token?: string | null,
) {
  return apiFetch(`/nurses/vitals/`, {
    method: "POST",
    token: token ?? undefined,
    body: JSON.stringify(payload),
  });
}
