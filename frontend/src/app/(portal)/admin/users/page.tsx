"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  MoreHorizontal,
  Pencil,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  listDepartments,
  resetAdminUserPassword,
  updateAdminUser,
  updateAdminUserStatus,
} from "@/features/admin/api";
import { ConfirmDialog } from "@/features/admin/components/ConfirmDialog";
import { RoleBadge } from "@/features/admin/components/RoleBadge";
import { StatusChip } from "@/features/admin/components/StatusChip";
import type { AdminDepartment, AdminUser, AdminUserRole, AdminUserStatus } from "@/types";

const ROLE_OPTIONS: Array<{ value: AdminUserRole; label: string }> = [
  { value: "admin", label: "Admin" },
  { value: "doctor", label: "Doctor" },
  { value: "nurse", label: "Nurse" },
  { value: "lab_tech", label: "Lab Tech" },
  { value: "radiologist", label: "Radiologist" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "billing_staff", label: "Billing Staff" },
  { value: "front_desk", label: "Front Desk" },
  { value: "patient", label: "Patient" },
];

function toInitials(firstName: string, lastName: string) {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function exportUsersCsv(users: AdminUser[]) {
  const rows = [
    ["First Name", "Last Name", "Email", "Role", "Department", "Status", "Employee ID", "Last Login"].join(","),
    ...users.map((user) =>
      [
        user.firstName,
        user.lastName,
        user.email,
        user.role,
        user.departmentName ?? "",
        user.status,
        user.employeeId ?? "",
        user.lastLogin ?? "",
      ]
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(","),
    ),
  ];

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "admin-users.csv";
  link.click();
  URL.revokeObjectURL(url);
}

interface UserFormState {
  firstName: string;
  lastName: string;
  email: string;
  role: AdminUserRole;
  departmentId: string;
  employeeId: string;
  specialization: string;
  licenseNumber: string;
}

const EMPTY_FORM: UserFormState = {
  firstName: "",
  lastName: "",
  email: "",
  role: "doctor",
  departmentId: "",
  employeeId: "",
  specialization: "",
  licenseNumber: "",
};

export default function UsersPage() {
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AdminUserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AdminUserStatus | "all">("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([
      listAdminUsers({}, token ?? undefined),
      listDepartments({}, token ?? undefined),
    ])
      .then(([items, depts]) => {
        if (!cancelled) {
          setUsers(items);
          setDepartments(depts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUsers([]);
          setDepartments([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(
    () =>
      users.filter((user) => {
        const query = search.trim().toLowerCase();
        const matchSearch =
          query === "" ||
          `${user.firstName} ${user.lastName}`.toLowerCase().includes(query) ||
          user.email.toLowerCase().includes(query) ||
          (user.employeeId?.toLowerCase().includes(query) ?? false);
        const matchRole = roleFilter === "all" || user.role === roleFilter;
        const matchStatus = statusFilter === "all" || user.status === statusFilter;
        return matchSearch && matchRole && matchStatus;
      }),
    [roleFilter, search, statusFilter, users],
  );

  const allChecked = filtered.length > 0 && filtered.every((user) => selected.has(user.id));
  const someChecked = filtered.some((user) => selected.has(user.id)) && !allChecked;

  function setFeedback(nextMessage = "", nextError = "") {
    setMessage(nextMessage);
    setError(nextError);
  }

  function toggleAll() {
    if (allChecked) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((user) => next.delete(user.id));
        return next;
      });
      return;
    }

    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((user) => next.add(user.id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  async function bulkSetStatus(status: AdminUserStatus) {
    const targetIds = [...selected];
    try {
      await Promise.all(targetIds.map((id) => updateAdminUserStatus(id, status, token ?? undefined)));
      setUsers((prev) => prev.map((user) => (selected.has(user.id) ? { ...user, status } : user)));
      setSelected(new Set());
      setFeedback(`Updated ${targetIds.length} user${targetIds.length === 1 ? "" : "s"}.`);
    } catch (err) {
      setFeedback("", err instanceof Error ? err.message : "Couldn't update the selected users.");
    }
  }

  async function deleteUser(id: string) {
    try {
      await deleteAdminUser(id, token ?? undefined);
      setUsers((prev) => prev.filter((user) => user.id !== id));
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      if (selectedUser?.id === id) {
        setSelectedUser(null);
      }
      setFeedback("User deleted.");
    } catch (err) {
      setFeedback("", err instanceof Error ? err.message : "Couldn't delete this user.");
    }
  }

  async function toggleUserStatus(user: AdminUser) {
    const nextStatus: AdminUserStatus = user.status === "active" ? "suspended" : "active";

    try {
      await updateAdminUserStatus(user.id, nextStatus, token ?? undefined);
      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, status: nextStatus } : item)));
      setSelectedUser((current) => (current?.id === user.id ? { ...current, status: nextStatus } : current));
      setFeedback(`${user.firstName} ${user.lastName} is now ${nextStatus}.`);
    } catch (err) {
      setFeedback("", err instanceof Error ? err.message : "Couldn't update this user status.");
    }
  }

  function openAddDialog() {
    setEditingUser(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setFormOpen(true);
  }

  function openEditDialog(user: AdminUser) {
    setEditingUser(user);
    setForm({
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId ?? "",
      employeeId: user.employeeId ?? "",
      specialization: user.specialization ?? "",
      licenseNumber: user.licenseNumber ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleFormSubmit() {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setFormError("First name, last name, and email are required.");
      return;
    }
    setFormLoading(true);
    setFormError("");
    try {
      if (editingUser) {
        const updated = await updateAdminUser(
          editingUser.id,
          {
            firstName: form.firstName,
            lastName: form.lastName,
            role: form.role,
            departmentId: form.departmentId || null,
            employeeId: form.employeeId || undefined,
            specialization: form.specialization || undefined,
            licenseNumber: form.licenseNumber || undefined,
          },
          token ?? undefined,
        );
        const nextUser: AdminUser = {
          ...editingUser,
          firstName: updated.firstName,
          lastName: updated.lastName,
          role: updated.role,
          departmentId: updated.departmentId ?? undefined,
          departmentName: updated.department?.name ?? departments.find((d) => d.id === form.departmentId)?.name,
          employeeId: updated.employeeId ?? undefined,
          specialization: updated.specialization ?? undefined,
          licenseNumber: updated.licenseNumber ?? undefined,
          avatarInitials: toInitials(updated.firstName, updated.lastName),
        };
        setUsers((prev) => prev.map((item) => (item.id === editingUser.id ? nextUser : item)));
        setSelectedUser((current) => (current?.id === editingUser.id ? nextUser : current));
        setFeedback("User updated.");
      } else {
        const created = await createAdminUser(
          {
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            role: form.role,
            departmentId: form.departmentId || undefined,
            employeeId: form.employeeId || undefined,
            specialization: form.specialization || undefined,
            licenseNumber: form.licenseNumber || undefined,
          },
          token ?? undefined,
        );
        const nextUser: AdminUser = {
          id: created.id,
          firstName: created.firstName,
          lastName: created.lastName,
          email: created.email,
          role: created.role,
          departmentId: created.departmentId ?? undefined,
          departmentName: created.department?.name ?? departments.find((d) => d.id === form.departmentId)?.name,
          status: created.status,
          lastLogin: created.lastLogin ?? undefined,
          employeeId: created.employeeId ?? undefined,
          specialization: created.specialization ?? undefined,
          licenseNumber: created.licenseNumber ?? undefined,
          createdAt: created.createdAt,
          avatarInitials: toInitials(created.firstName, created.lastName),
        };
        setUsers((prev) => [nextUser, ...prev]);
        setSelectedUser(nextUser);
        setFeedback(`Created ${created.firstName} ${created.lastName}.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleResetPassword(user: AdminUser) {
    try {
      const result = await resetAdminUserPassword(user.id, token ?? undefined);
      setFeedback(result.message || `Password reset for ${user.firstName} ${user.lastName}.`);
    } catch (err) {
      setFeedback("", err instanceof Error ? err.message : "Couldn't reset this password.");
    }
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Users &amp; Roles</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {users.length} users · {users.filter((user) => user.status === "active").length} active
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAddDialog}>
            <UserPlus className="h-4 w-4" /> Add User
          </Button>
        </div>

        {message && (
          <div className="rounded-lg border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
            {String(message)}
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-300/50 bg-red-500/10 px-3 py-2 text-sm text-red-700">
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name, email, ID..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as AdminUserRole | "all")}>
            <SelectTrigger className="w-40 h-9 text-sm">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {ROLE_OPTIONS.map((role) => (
                <SelectItem key={role.value} value={role.value}>
                  {role.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as AdminUserStatus | "all")}>
            <SelectTrigger className="w-36 h-9 text-sm">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-auto border-l pl-3 border-border/50">
              <span className="text-sm text-muted-foreground">{selected.size} selected</span>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => void bulkSetStatus("active")}>
                <ShieldCheck className="h-3.5 w-3.5" /> Activate
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => void bulkSetStatus("suspended")}>
                <ShieldOff className="h-3.5 w-3.5" /> Suspend
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 text-xs"
                onClick={() => exportUsersCsv(filtered.filter((user) => selected.has(user.id)))}
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            </div>
          )}
        </div>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="w-10 py-3 px-3">
                      <Checkbox checked={allChecked ? true : someChecked ? true : false} onCheckedChange={toggleAll} />
                    </th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">User</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Department</th>
                    <th className="text-left py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Last Login</th>
                    <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="w-10 py-3 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                        No users match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((user) => (
                      <tr
                        key={user.id}
                        className={`border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer ${selectedUser?.id === user.id ? "bg-muted/40" : ""}`}
                        onClick={() => setSelectedUser(user)}
                      >
                        <td
                          className="py-3 px-3"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleOne(user.id);
                          }}
                        >
                          <Checkbox checked={selected.has(user.id)} onCheckedChange={() => toggleOne(user.id)} />
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                              {user.avatarInitials}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{user.firstName} {user.lastName}</p>
                              <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3"><RoleBadge role={user.role} /></td>
                        <td className="py-3 px-3 text-muted-foreground text-xs hidden md:table-cell">{user.departmentName ?? "—"}</td>
                        <td className="py-3 px-3 text-xs text-muted-foreground hidden lg:table-cell">
                          {user.lastLogin ? user.lastLogin.replace("T", " ").substring(0, 16) : "—"}
                        </td>
                        <td className="py-3 px-3 text-center"><StatusChip status={user.status} /></td>
                        <td className="py-3 px-3" onClick={(event) => event.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={<Button variant="ghost" size="icon" className="h-7 w-7" />}
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                <Pencil className="h-4 w-4 mr-2" /> Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void handleResetPassword(user)}>
                                <ShieldCheck className="h-4 w-4 mr-2" /> Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => void toggleUserStatus(user)}>
                                {user.status === "active"
                                  ? <><ShieldOff className="h-4 w-4 mr-2" /> Suspend</>
                                  : <><ShieldCheck className="h-4 w-4 mr-2" /> Activate</>}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => setDeleteTarget(user)}>
                                <Trash2 className="h-4 w-4 mr-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {selectedUser && (
        <div className="w-80 shrink-0">
          <Card className="border-border/50 shadow-sm sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base font-semibold">User Details</CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedUser(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-base font-bold text-primary">
                  {selectedUser.avatarInitials}
                </div>
                <div>
                  <p className="font-semibold">{selectedUser.firstName} {selectedUser.lastName}</p>
                  <p className="text-xs text-muted-foreground">{selectedUser.email}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <RoleBadge role={selectedUser.role} />
                <StatusChip status={selectedUser.status} />
              </div>
              <div className="space-y-2 text-sm">
                {selectedUser.employeeId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Employee ID</span>
                    <span className="font-mono text-xs">{selectedUser.employeeId}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Department</span>
                  <span>{selectedUser.departmentName ?? "—"}</span>
                </div>
                {selectedUser.specialization && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Specialization</span>
                    <span>{selectedUser.specialization}</span>
                  </div>
                )}
                {selectedUser.licenseNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">License</span>
                    <span className="font-mono text-xs">{selectedUser.licenseNumber}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{selectedUser.createdAt.substring(0, 10)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Login</span>
                  <span className="text-xs">{selectedUser.lastLogin?.substring(0, 10) ?? "—"}</span>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1 h-8 gap-1 text-xs" variant="outline" onClick={() => openEditDialog(selectedUser)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 gap-1 text-xs"
                  variant="outline"
                  onClick={() => void toggleUserStatus(selectedUser)}
                >
                  {selectedUser.status === "active"
                    ? <><ShieldOff className="h-3.5 w-3.5" /> Suspend</>
                    : <><ShieldCheck className="h-3.5 w-3.5" /> Activate</>}
                </Button>
              </div>
              <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => void handleResetPassword(selectedUser)}>
                <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Reset Password
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="w-full h-8 text-xs"
                onClick={() => setDeleteTarget(selectedUser)}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete User
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        title={`Delete ${deleteTarget?.firstName ?? ""} ${deleteTarget?.lastName ?? ""}?`}
        description="This action cannot be undone. The user's account and associated data will be permanently removed."
        confirmLabel="Delete User"
        onConfirm={() => {
          if (deleteTarget) {
            void deleteUser(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
      />

      {/* Add / Edit User Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingUser ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name *</Label>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Last Name *</Label>
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="h-9" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Email *</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="user@medhub.io" className="h-9" disabled={!!editingUser} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as AdminUserRole })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Department</Label>
              <Select value={form.departmentId || "none"} onValueChange={(v) => setForm({ ...form, departmentId: v === "none" ? "" : v })}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Employee ID</Label>
              <Input value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Specialization</Label>
              <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">License Number</Label>
              <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleFormSubmit()} disabled={formLoading}>
              {formLoading ? "Saving..." : editingUser ? "Save Changes" : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
