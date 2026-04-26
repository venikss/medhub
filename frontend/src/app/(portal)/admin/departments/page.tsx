"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, MapPin, Phone, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { createDepartment, listDepartments, listWards, updateDepartment, updateDepartmentStatus } from "@/features/admin/api";
import { StatusChip } from "@/features/admin/components/StatusChip";
import type { AdminDepartment, DepartmentType, Ward } from "@/types";

const TYPE_COLORS: Record<DepartmentType, string> = {
  clinical: "bg-blue-500/10 text-blue-700",
  diagnostic: "bg-amber-500/10 text-amber-700",
  surgical: "bg-red-500/10 text-red-700",
  administrative: "bg-slate-500/10 text-slate-700",
  support: "bg-teal-500/10 text-teal-700",
  emergency: "bg-rose-500/10 text-rose-700",
  pharmacy: "bg-violet-500/10 text-violet-700",
};

const DEPARTMENT_TYPES: DepartmentType[] = [
  "clinical",
  "diagnostic",
  "surgical",
  "administrative",
  "support",
  "emergency",
  "pharmacy",
];

type DeptDisplayMode = "staff-only" | "inpatient" | "outpatient";

function getDeptDisplayMode(name: string): DeptDisplayMode {
  const n = name.toLowerCase();
  if (n.includes("inpatient")) return "inpatient";
  if (n.includes("outpatient")) return "outpatient";
  return "staff-only";
}

export default function DepartmentsPage() {
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<DepartmentType | "all">("all");
  const [selectedDept, setSelectedDept] = useState<AdminDepartment | null>(null);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [wards, setWards] = useState<Ward[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Dialog form state
  interface DeptForm { name: string; code: string; type: DepartmentType; building: string; floorNumber: string; phone: string; description: string }
  const EMPTY_DEPT: DeptForm = { name: "", code: "", type: "clinical", building: "", floorNumber: "", phone: "", description: "" };
  const [formOpen, setFormOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<AdminDepartment | null>(null);
  const [form, setForm] = useState<DeptForm>(EMPTY_DEPT);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  function openAddDeptDialog() {
    setEditingDept(null);
    setForm(EMPTY_DEPT);
    setFormError("");
    setFormOpen(true);
  }

  function openEditDeptDialog(dept: AdminDepartment) {
    setEditingDept(dept);
    setForm({
      name: dept.name,
      code: dept.code,
      type: dept.type,
      building: dept.building ?? "",
      floorNumber: dept.floorNumber !== undefined && dept.floorNumber !== null ? String(dept.floorNumber) : "",
      phone: dept.phone ?? "",
      description: dept.description ?? "",
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleDeptFormSubmit() {
    if (!form.name.trim() || !form.code.trim()) { setFormError("Name and code are required."); return; }
    setFormLoading(true);
    setFormError("");
    const payload = {
      name: form.name.trim(),
      code: form.code.trim(),
      type: form.type,
      status: "active" as const,
      building: form.building || undefined,
      floorNumber: form.floorNumber === "" ? null : Number(form.floorNumber),
      phone: form.phone || undefined,
      description: form.description || undefined,
    };
    try {
      if (editingDept) {
        const updated = await updateDepartment(editingDept.id, payload, token ?? undefined);
        setDepartments((prev) => prev.map((d) => (d.id === editingDept.id ? updated : d)));
        setSelectedDept((cur) => (cur?.id === editingDept.id ? updated : cur));
        setFeedback("Department updated.");
      } else {
        const created = await createDepartment(payload, token ?? undefined);
        setDepartments((prev) => [created, ...prev]);
        setSelectedDept(created);
        setFeedback(`Created ${created.name}.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setFormLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void Promise.all([listDepartments({}, token ?? undefined), listWards({}, token ?? undefined)])
      .then(([departmentItems, wardItems]) => {
        if (!cancelled) {
          setDepartments(departmentItems);
          setWards(wardItems);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDepartments([]);
          setWards([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(
    () =>
      departments.filter((department) => {
        const query = search.trim().toLowerCase();
        const matchSearch =
          query === "" ||
          department.name.toLowerCase().includes(query) ||
          department.code.toLowerCase().includes(query);
        const matchType = typeFilter === "all" || department.type === typeFilter;
        return matchSearch && matchType;
      }),
    [departments, search, typeFilter],
  );

  const selectedWards = useMemo(
    () => (selectedDept ? wards.filter((ward) => ward.departmentId === selectedDept.id) : []),
    [selectedDept, wards],
  );

  function setFeedback(nextMessage = "", nextError = "") {
    setMessage(nextMessage);
    setError(nextError);
  }

  async function toggleDepartmentStatus(department: AdminDepartment) {
    const nextStatus = department.status === "active" ? "inactive" : "active";

    try {
      await updateDepartmentStatus(department.id, nextStatus, token ?? undefined);
      setDepartments((prev) => prev.map((item) => (item.id === department.id ? { ...item, status: nextStatus } : item)));
      setSelectedDept((current) => (current?.id === department.id ? { ...current, status: nextStatus } : current));
      setFeedback(`${department.name} is now ${nextStatus}.`);
    } catch (err) {
      setFeedback("", err instanceof Error ? err.message : "Couldn't update this department.");
    }
  }

  // (Replaced by Dialog form above)

  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {departments.length} departments · {departments.filter((department) => department.status === "active").length} active
            </p>
          </div>
          <Button size="sm" className="gap-1.5" onClick={openAddDeptDialog}>
            <Building2 className="h-4 w-4" /> Add Department
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
              placeholder="Search name or code..."
              className="pl-9 h-9 text-sm"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as DepartmentType | "all")}>
            <SelectTrigger className="w-44 h-9 text-sm">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {DEPARTMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.length === 0 ? (
            <div className="col-span-3 py-16 text-center text-sm text-muted-foreground">
              No departments match the current filters.
            </div>
          ) : (
            filtered.map((department) => (
              <Card
                key={department.id}
                className={`border-border/50 shadow-sm cursor-pointer transition-all hover:shadow-md ${selectedDept?.id === department.id ? "ring-2 ring-primary" : ""}`}
                onClick={() => setSelectedDept(department.id === selectedDept?.id ? null : department)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">{department.name}</h3>
                        <p className="text-xs font-mono text-muted-foreground">{department.code}</p>
                      </div>
                    </div>
                    <StatusChip status={department.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs capitalize ${TYPE_COLORS[department.type]}`}>
                      {department.type}
                    </Badge>
                    {department.building && (
                      <span className="text-xs text-muted-foreground">
                        {department.building}{department.floorNumber !== undefined ? ` · Floor ${department.floorNumber}` : ""}
                      </span>
                    )}
                  </div>
                  {(() => {
                    const mode = getDeptDisplayMode(department.name);
                    if (mode === "inpatient") return (
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold text-blue-600">{department.activePatients}</p>
                          <p className="text-xs text-muted-foreground">Patients</p>
                        </div>
                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold text-teal-600">{department.bedCount}</p>
                          <p className="text-xs text-muted-foreground">Beds</p>
                        </div>
                      </div>
                    );
                    if (mode === "outpatient") return (
                      <div className="grid grid-cols-1 gap-2 text-center">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold text-blue-600">{department.activePatients}</p>
                          <p className="text-xs text-muted-foreground">Patients</p>
                        </div>
                      </div>
                    );
                    return (
                      <div className="grid grid-cols-1 gap-2 text-center">
                        <div className="rounded-lg bg-muted/40 p-2">
                          <p className="text-lg font-bold text-primary">{department.staffCount}</p>
                          <p className="text-xs text-muted-foreground">Staff</p>
                        </div>
                      </div>
                    );
                  })()}
                  {department.headName && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{department.headName}</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {selectedDept && (
        <div className="w-80 shrink-0">
          <Card className="border-border/50 shadow-sm sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base font-semibold">{selectedDept.name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{selectedDept.code}</p>
                </div>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedDept(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <StatusChip status={selectedDept.status} />
                <Badge variant="outline" className={`text-xs capitalize ${TYPE_COLORS[selectedDept.type]}`}>
                  {selectedDept.type}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                {selectedDept.headName && (
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Head:</span>
                    <span>{selectedDept.headName}</span>
                  </div>
                )}
                {(selectedDept.building || selectedDept.floorNumber !== undefined) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Location:</span>
                    <span>
                      {selectedDept.building ?? "Main"}{selectedDept.floorNumber !== undefined ? `, Floor ${selectedDept.floorNumber}` : ""}
                    </span>
                  </div>
                )}
                {selectedDept.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-mono text-xs">{selectedDept.phone}</span>
                  </div>
                )}
              </div>

              {(() => {
                const mode = getDeptDisplayMode(selectedDept.name);
                if (mode === "inpatient") return (
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-lg font-bold text-blue-600">{selectedDept.activePatients}</p>
                      <p className="text-xs text-muted-foreground">Patients</p>
                    </div>
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-lg font-bold text-teal-600">{selectedDept.bedCount}</p>
                      <p className="text-xs text-muted-foreground">Beds</p>
                    </div>
                  </div>
                );
                if (mode === "outpatient") return (
                  <div className="grid grid-cols-1 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-lg font-bold text-blue-600">{selectedDept.activePatients}</p>
                      <p className="text-xs text-muted-foreground">Patients</p>
                    </div>
                  </div>
                );
                return (
                  <div className="grid grid-cols-1 gap-2 text-center">
                    <div className="rounded-lg bg-muted/40 p-2">
                      <p className="text-lg font-bold text-primary">{selectedDept.staffCount}</p>
                      <p className="text-xs text-muted-foreground">Staff</p>
                    </div>
                  </div>
                );
              })()}

              {selectedDept.description && (
                <p className="text-xs text-muted-foreground border-t border-border/40 pt-3">{selectedDept.description}</p>
              )}

              {selectedWards.length > 0 && (
                <div className="border-t border-border/40 pt-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Wards ({selectedWards.length})
                  </p>
                  <div className="space-y-2">
                    {selectedWards.map((ward) => (
                      <div key={ward.id} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                        <div>
                          <p className="text-xs font-medium">{ward.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{ward.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold">{ward.occupiedBeds}/{ward.totalBeds}</p>
                          <p className="text-xs text-muted-foreground">beds</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button size="sm" className="flex-1 h-8 text-xs" variant="outline" onClick={() => openEditDeptDialog(selectedDept)}>
                  Edit
                </Button>
                <Button size="sm" className="flex-1 h-8 text-xs" variant="outline" onClick={() => void toggleDepartmentStatus(selectedDept)}>
                  {selectedDept.status === "active" ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add / Edit Department Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingDept ? "Edit Department" : "Add Department"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Department name" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Code *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DEPT" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as DepartmentType })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Building</Label>
              <Input value={form.building} onChange={(e) => setForm({ ...form, building: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Floor Number</Label>
              <Input type="number" value={form.floorNumber} onChange={(e) => setForm({ ...form, floorNumber: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleDeptFormSubmit()} disabled={formLoading}>
              {formLoading ? "Saving..." : editingDept ? "Save Changes" : "Create Department"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
