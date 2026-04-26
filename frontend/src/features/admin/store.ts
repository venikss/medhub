import { create } from "zustand";
import type {
  AdminUserStatus, AdminUserRole, DepartmentStatus,
  BedStatus, CatalogItemStatus, AuditSeverity, AuditAction,
} from "@/types";

interface AdminStore {
  // Users
  selectedUserId: string | null;
  userStatusFilter: AdminUserStatus | "all";
  userRoleFilter: AdminUserRole | "all";
  userSearch: string;
  selectedUserIds: string[];

  // Departments
  selectedDepartmentId: string | null;
  departmentStatusFilter: DepartmentStatus | "all";

  // Beds
  selectedWardId: string | null;
  bedStatusFilter: BedStatus | "all";
  selectedBedIds: string[];

  // Catalogs
  activeCatalogTab: "lab" | "radiology" | "services";
  catalogStatusFilter: CatalogItemStatus | "all";
  catalogSearch: string;

  // Audit
  auditSeverityFilter: AuditSeverity | "all";
  auditActionFilter: AuditAction | "all";
  auditUserFilter: string;
  auditDateFrom: string;
  auditDateTo: string;

  // Modals
  showUserForm: boolean;
  showDepartmentForm: boolean;
  showBedForm: boolean;
  showCatalogForm: boolean;
  showDeleteConfirm: boolean;
  deleteTarget: { type: string; id: string; name: string } | null;

  // Actions
  setSelectedUser: (id: string | null) => void;
  setUserStatusFilter: (f: AdminUserStatus | "all") => void;
  setUserRoleFilter: (f: AdminUserRole | "all") => void;
  setUserSearch: (q: string) => void;
  toggleUserSelection: (id: string) => void;
  clearUserSelection: () => void;

  setSelectedDepartment: (id: string | null) => void;
  setDepartmentStatusFilter: (f: DepartmentStatus | "all") => void;

  setSelectedWard: (id: string | null) => void;
  setBedStatusFilter: (f: BedStatus | "all") => void;
  toggleBedSelection: (id: string) => void;
  clearBedSelection: () => void;

  setActiveCatalogTab: (tab: "lab" | "radiology" | "services") => void;
  setCatalogStatusFilter: (f: CatalogItemStatus | "all") => void;
  setCatalogSearch: (q: string) => void;

  setAuditSeverityFilter: (f: AuditSeverity | "all") => void;
  setAuditActionFilter: (f: AuditAction | "all") => void;
  setAuditUserFilter: (q: string) => void;
  setAuditDateFrom: (d: string) => void;
  setAuditDateTo: (d: string) => void;

  openUserForm: () => void;
  closeUserForm: () => void;
  openDeleteConfirm: (type: string, id: string, name: string) => void;
  closeDeleteConfirm: () => void;
}

export const useAdminStore = create<AdminStore>((set) => ({
  selectedUserId: null,
  userStatusFilter: "all",
  userRoleFilter: "all",
  userSearch: "",
  selectedUserIds: [],

  selectedDepartmentId: null,
  departmentStatusFilter: "all",

  selectedWardId: null,
  bedStatusFilter: "all",
  selectedBedIds: [],

  activeCatalogTab: "lab",
  catalogStatusFilter: "all",
  catalogSearch: "",

  auditSeverityFilter: "all",
  auditActionFilter: "all",
  auditUserFilter: "",
  auditDateFrom: "2026-03-01",
  auditDateTo: "2026-03-16",

  showUserForm: false,
  showDepartmentForm: false,
  showBedForm: false,
  showCatalogForm: false,
  showDeleteConfirm: false,
  deleteTarget: null,

  setSelectedUser: (id) => set({ selectedUserId: id }),
  setUserStatusFilter: (f) => set({ userStatusFilter: f }),
  setUserRoleFilter: (f) => set({ userRoleFilter: f }),
  setUserSearch: (q) => set({ userSearch: q }),
  toggleUserSelection: (id) =>
    set((s) => ({
      selectedUserIds: s.selectedUserIds.includes(id)
        ? s.selectedUserIds.filter((x) => x !== id)
        : [...s.selectedUserIds, id],
    })),
  clearUserSelection: () => set({ selectedUserIds: [] }),

  setSelectedDepartment: (id) => set({ selectedDepartmentId: id }),
  setDepartmentStatusFilter: (f) => set({ departmentStatusFilter: f }),

  setSelectedWard: (id) => set({ selectedWardId: id }),
  setBedStatusFilter: (f) => set({ bedStatusFilter: f }),
  toggleBedSelection: (id) =>
    set((s) => ({
      selectedBedIds: s.selectedBedIds.includes(id)
        ? s.selectedBedIds.filter((x) => x !== id)
        : [...s.selectedBedIds, id],
    })),
  clearBedSelection: () => set({ selectedBedIds: [] }),

  setActiveCatalogTab: (tab) => set({ activeCatalogTab: tab }),
  setCatalogStatusFilter: (f) => set({ catalogStatusFilter: f }),
  setCatalogSearch: (q) => set({ catalogSearch: q }),

  setAuditSeverityFilter: (f) => set({ auditSeverityFilter: f }),
  setAuditActionFilter: (f) => set({ auditActionFilter: f }),
  setAuditUserFilter: (q) => set({ auditUserFilter: q }),
  setAuditDateFrom: (d) => set({ auditDateFrom: d }),
  setAuditDateTo: (d) => set({ auditDateTo: d }),

  openUserForm: () => set({ showUserForm: true }),
  closeUserForm: () => set({ showUserForm: false }),
  openDeleteConfirm: (type, id, name) =>
    set({ showDeleteConfirm: true, deleteTarget: { type, id, name } }),
  closeDeleteConfirm: () => set({ showDeleteConfirm: false, deleteTarget: null }),
}));
