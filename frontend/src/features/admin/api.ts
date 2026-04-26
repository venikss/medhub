import { apiFetch } from "@/lib/api";
import type {
  AdminDepartment,
  AdminStats,
  AdminUser,
  AuditLogEntry,
  Bed,
  CatalogItemStatus,
  LabCatalogItem,
  RadiologyCatalogItem,
  RolePermission,
  SystemSetting,
  ServiceCatalogItem,
  Ward,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface AdminUserBackend {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: AdminUser["role"];
  departmentId?: string | null;
  department?: { id: string; name: string } | null;
  status: AdminUser["status"];
  lastLogin?: string | null;
  employeeId?: string | null;
  specialization?: string | null;
  licenseNumber?: string | null;
  activePatientCount?: number | null;
  createdAt: string;
}

interface PermissionBackend {
  id: string;
  role: RolePermission["role"];
  resource: RolePermission["resource"];
  action: RolePermission["actions"][number];
  allowed: boolean;
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

function getAvatarInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function mapAdminUser(user: AdminUserBackend): AdminUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    departmentId: user.departmentId ?? undefined,
    departmentName: user.department?.name ?? undefined,
    status: user.status,
    lastLogin: user.lastLogin ?? undefined,
    employeeId: user.employeeId ?? undefined,
    specialization: user.specialization ?? undefined,
    licenseNumber: user.licenseNumber ?? undefined,
    activePatientCount: user.activePatientCount ?? undefined,
    createdAt: user.createdAt,
    avatarInitials: getAvatarInitials(user.firstName, user.lastName),
  };
}

export function getAdminStats(token?: string | null) {
  return apiFetch("/admin/stats/", { token }) as Promise<AdminStats>;
}

export async function listAdminUsers(
  query: { role?: string; department?: string; status?: string; search?: string } = {},
  token?: string | null,
) {
  const users = await getPaginatedList<AdminUserBackend>(withQuery("/admin/users/", query), token);
  return users.map(mapAdminUser);
}

export function updateAdminUserStatus(userId: string, status: string, token?: string | null) {
  return apiFetch(`/admin/users/${userId}/status/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  }) as Promise<{ status: string }>;
}

export function createAdminUser(
  payload: {
    firstName: string;
    lastName: string;
    email: string;
    role: AdminUser["role"];
    departmentId?: string;
    employeeId?: string;
    specialization?: string;
    licenseNumber?: string;
  },
  token?: string | null,
) {
  return apiFetch("/admin/users/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<AdminUserBackend>;
}

export function updateAdminUser(
  userId: string,
  payload: Partial<{
    firstName: string;
    lastName: string;
    role: AdminUser["role"];
    departmentId: string | null;
    employeeId: string;
    specialization: string;
    licenseNumber: string;
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/users/${userId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<AdminUserBackend>;
}

export function resetAdminUserPassword(userId: string, token?: string | null) {
  return apiFetch(`/admin/users/${userId}/reset-password/`, {
    method: "POST",
    token,
  }) as Promise<{ message: string }>;
}

export function deleteAdminUser(userId: string, token?: string | null) {
  return apiFetch(`/admin/users/${userId}/`, {
    method: "DELETE",
    token,
  });
}

export function listDepartments(
  query: { type?: string; status?: string } = {},
  token?: string | null,
) {
  return getPaginatedList<AdminDepartment>(withQuery("/admin/departments/", query), token);
}

export function updateDepartmentStatus(departmentId: string, status: string, token?: string | null) {
  return apiFetch(`/admin/departments/${departmentId}/status/`, {
    method: "PUT",
    token,
    body: JSON.stringify({ status }),
  }) as Promise<{ status: string }>;
}

export function createDepartment(
  payload: Partial<{
    name: string;
    code: string;
    type: AdminDepartment["type"];
    status: AdminDepartment["status"];
    headId: string | null;
    floorNumber: number | null;
    building: string;
    phone: string;
    description: string;
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/departments/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<AdminDepartment>;
}

export function updateDepartment(
  departmentId: string,
  payload: Partial<{
    name: string;
    code: string;
    type: AdminDepartment["type"];
    status: AdminDepartment["status"];
    headId: string | null;
    floorNumber: number | null;
    building: string;
    phone: string;
    description: string;
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/departments/${departmentId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<AdminDepartment>;
}

export function listWards(query: { departmentId?: string } = {}, token?: string | null) {
  return getPaginatedList<Ward>(withQuery("/admin/wards/", query), token);
}

export function createWard(
  payload: Partial<{
    name: string;
    departmentId: string;
    type: string;
    building: string;
    floorNumber: number;
    totalBeds: number;
    status: string;
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/wards/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Ward>;
}

export function updateWard(
  wardId: string,
  payload: Partial<{
    name: string;
    departmentId: string;
    type: string;
    building: string;
    floorNumber: number;
    totalBeds: number;
    status: string;
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/wards/${wardId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Ward>;
}

export function listBeds(query: { status?: string; wardId?: string } = {}, token?: string | null) {
  return getPaginatedList<Bed>(withQuery("/admin/beds/", query), token);
}

export function createBed(
  payload: Partial<{
    wardId: string;
    number: string;
    bedType: string;
    roomNumber: string | null;
    status: Bed["status"];
    features: string[];
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/beds/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Bed>;
}

export function updateBed(
  bedId: string,
  payload: Partial<{
    wardId: string;
    number: string;
    bedType: string;
    roomNumber: string | null;
    status: Bed["status"];
    features: string[];
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/beds/${bedId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Bed>;
}

export function deleteBed(bedId: string, token?: string | null) {
  return apiFetch(`/admin/beds/${bedId}/`, {
    method: "DELETE",
    token,
  }) as Promise<void>;
}

export function listAuditLogs(
  query: { severity?: string; action?: string; outcome?: string } = {},
  token?: string | null,
) {
  return getPaginatedList<AuditLogEntry>(withQuery("/admin/audit/", query), token);
}

export async function listLabCatalog(token?: string | null): Promise<LabCatalogItem[]> {
  const items = await getPaginatedList<Record<string, unknown>>("/admin/catalogs/lab/", token);
  return items.map((item) => ({
    id: String(item.id),
    code: String(item.code ?? ""),
    name: String(item.name ?? ""),
    category: String(item.category ?? "General"),
    specimen: String(item.specimen ?? "blood"),
    turnaroundHours: Number(item.turnaroundHours ?? 0),
    normalRange: undefined,
    unit: undefined,
    price: Number(item.price ?? 0),
    requiresAuth: Boolean(item.requiresAuth),
    status: (item.isActive ? "active" : "inactive") as CatalogItemStatus,
    cptCode: typeof item.cptCode === "string" ? item.cptCode : undefined,
  }));
}

export function createLabCatalogItem(
  payload: Partial<{
    code: string;
    name: string;
    category: string;
    specimen: string;
    turnaroundHours: number;
    price: number;
    requiresAuth: boolean;
    cptCode: string | null;
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/catalogs/lab/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Record<string, unknown>>;
}

export function updateLabCatalogItem(
  itemId: string,
  payload: Partial<{
    code: string;
    name: string;
    category: string;
    specimen: string;
    turnaroundHours: number;
    price: number;
    requiresAuth: boolean;
    cptCode: string | null;
    isActive: boolean;
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/catalogs/lab/${itemId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Record<string, unknown>>;
}

export async function listRadiologyCatalog(token?: string | null): Promise<RadiologyCatalogItem[]> {
  const items = await getPaginatedList<Record<string, unknown>>("/admin/catalogs/radiology/", token);
  return items.map((item) => ({
    id: String(item.id),
    code: String(item.code ?? ""),
    name: String(item.name ?? ""),
    modality: String(item.modality ?? ""),
    bodyPart: String(item.bodyPart ?? ""),
    withContrast: Boolean(item.withContrast),
    durationMinutes: Number(item.durationMinutes ?? 0),
    price: Number(item.price ?? 0),
    requiresAuth: Boolean(item.requiresAuth),
    status: (item.isActive ? "active" : "inactive") as CatalogItemStatus,
    cptCode: typeof item.cptCode === "string" ? item.cptCode : undefined,
    preparation: typeof item.preparation === "string" ? item.preparation : undefined,
  }));
}

export function createRadiologyCatalogItem(
  payload: Partial<{
    code: string;
    name: string;
    modality: string;
    bodyPart: string;
    withContrast: boolean;
    durationMinutes: number;
    price: number;
    requiresAuth: boolean;
    cptCode: string | null;
    preparation: string | null;
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/catalogs/radiology/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Record<string, unknown>>;
}

export function updateRadiologyCatalogItem(
  itemId: string,
  payload: Partial<{
    code: string;
    name: string;
    modality: string;
    bodyPart: string;
    withContrast: boolean;
    durationMinutes: number;
    price: number;
    requiresAuth: boolean;
    cptCode: string | null;
    preparation: string | null;
    isActive: boolean;
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/catalogs/radiology/${itemId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Record<string, unknown>>;
}

export async function listServiceCatalog(
  token?: string | null,
  departments?: AdminDepartment[],
): Promise<ServiceCatalogItem[]> {
  const items = await getPaginatedList<Record<string, unknown>>("/admin/catalogs/services/", token);
  const departmentLookup = new Map((departments ?? []).map((department) => [department.id, department.name]));

  return items.map((item) => ({
    id: String(item.id),
    code: String(item.code ?? ""),
    name: String(item.name ?? ""),
    category: String(item.category ?? "General"),
    department:
      String(item.departmentName ?? "") ||
      departmentLookup.get(String(item.departmentId ?? "")) ||
      "General",
    price: Number(item.price ?? 0),
    unit: "service",
    status: (item.isActive ? "active" : "inactive") as CatalogItemStatus,
    cptCode: undefined,
    description: undefined,
  }));
}

export function createServiceCatalogItem(
  payload: Partial<{
    code: string;
    name: string;
    category: string;
    price: number;
    departmentId: string | null;
    isActive: boolean;
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/catalogs/services/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Record<string, unknown>>;
}

export function updateServiceCatalogItem(
  itemId: string,
  payload: Partial<{
    code: string;
    name: string;
    category: string;
    price: number;
    departmentId: string | null;
    isActive: boolean;
  }>,
  token?: string | null,
) {
  return apiFetch(`/admin/catalogs/services/${itemId}/`, {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Record<string, unknown>>;
}

interface BackendSetting {
  id?: string;
  key: string;
  value: string | number | boolean;
  category: string;
  description?: string | null;
}

const SETTING_METADATA: Record<string, Partial<SystemSetting>> = {
  hospital_name: { label: "Hospital Name", type: "text", category: "general" },
  hospital_address: { label: "Hospital Address", type: "textarea", category: "general" },
  default_timezone: {
    label: "Default Timezone",
    type: "select",
    category: "general",
    options: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"],
  },
  date_format: {
    label: "Date Format",
    type: "select",
    category: "general",
    options: ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"],
  },
  fiscal_year_start: { label: "Fiscal Year Start Month", type: "number", category: "general" },
  session_timeout_minutes: { label: "Session Timeout (minutes)", type: "number", category: "security" },
  max_failed_logins: { label: "Max Failed Login Attempts", type: "number", category: "security" },
  password_min_length: { label: "Minimum Password Length", type: "number", category: "security" },
  require_2fa_admin: { label: "Require 2FA for Admins", type: "boolean", category: "security" },
  audit_retention_days: { label: "Audit Log Retention (days)", type: "number", category: "security" },
  critical_alert_sms: { label: "SMS Critical Alerts", type: "boolean", category: "notifications" },
  critical_alert_email: { label: "Email Critical Alerts", type: "boolean", category: "notifications" },
  daily_summary_email: { label: "Daily Summary Email", type: "boolean", category: "notifications" },
  appointment_reminder_hours: { label: "Appointment Reminder (hours before)", type: "number", category: "notifications" },
  hl7_endpoint: { label: "HL7 FHIR Endpoint", type: "text", category: "integrations" },
  pacs_server: { label: "PACS Server Address", type: "text", category: "integrations" },
  lab_analyzer_ip: { label: "Lab Analyzer Interface IP", type: "text", category: "integrations" },
  pharmacy_bridge_enabled: { label: "Pharmacy Bridge Enabled", type: "boolean", category: "integrations" },
};

function prettifySettingKey(key: string) {
  return key
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function listSystemSettings(token?: string | null): Promise<SystemSetting[]> {
  const grouped = (await apiFetch("/admin/settings/", { token }).catch(() => ({}))) as Record<string, BackendSetting[]>;
  const backendSettings = Object.values(grouped).flat();

  return Object.entries(SETTING_METADATA).map(([key, meta]) => {
    const backendMatch = backendSettings.find((s) => s.key === key);
    return {
      key,
      label: meta.label ?? prettifySettingKey(key),
      description: backendMatch?.description ?? meta.description ?? "",
      category: (backendMatch?.category ?? meta.category ?? "general") as SystemSetting["category"],
      type: meta.type ?? "text",
      value: backendMatch?.value ?? (meta.type === "boolean" ? false : meta.type === "number" ? 0 : ""),
      options: meta.options,
      requiresRestart: meta.requiresRestart,
    };
  });
}

export function updateSystemSettings(payload: Record<string, string | number | boolean>, token?: string | null) {
  return apiFetch("/admin/settings/", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  });
}

export async function listPermissions(token?: string | null): Promise<RolePermission[]> {
  const permissions = (await apiFetch("/admin/permissions/", { token })) as PermissionBackend[];
  const grouped = new Map<string, RolePermission>();

  permissions.forEach((permission) => {
    if (!permission.allowed) {
      return;
    }

    const key = `${permission.role}:${permission.resource}`;
    const current = grouped.get(key);

    if (current) {
      current.actions.push(permission.action);
      return;
    }

    grouped.set(key, {
      role: permission.role,
      resource: permission.resource,
      actions: [permission.action],
    });
  });

  return [...grouped.values()];
}

export function updatePermissions(
  payload: Array<{
    role: RolePermission["role"];
    resource: RolePermission["resource"];
    action: RolePermission["actions"][number];
    allowed: boolean;
  }>,
  token?: string | null,
) {
  return apiFetch("/admin/permissions/", {
    method: "PUT",
    token,
    body: JSON.stringify(payload),
  }) as Promise<{ message: string }>;
}
