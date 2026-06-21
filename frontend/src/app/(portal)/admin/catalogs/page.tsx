"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, FlaskConical, ScanLine, Stethoscope, Pencil } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusChip } from "@/features/admin/components/StatusChip";
import {
  listDepartments,
  listLabCatalog,
  listRadiologyCatalog,
  listServiceCatalog,
  createLabCatalogItem,
  updateLabCatalogItem,
  createRadiologyCatalogItem,
  updateRadiologyCatalogItem,
  createServiceCatalogItem,
  updateServiceCatalogItem,
} from "@/features/admin/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type {
  AdminDepartment,
  CatalogItemStatus,
  LabCatalogItem,
  RadiologyCatalogItem,
  ServiceCatalogItem,
} from "@/types";

type CatalogTab = "lab" | "radiology" | "services";

export default function CatalogsPage() {
  const token = useAuthStore((state) => state.token);
  const [activeTab, setActiveTab] = useState<CatalogTab>("lab");
  const [labSearch, setLabSearch] = useState("");
  const [labStatus, setLabStatus] = useState<CatalogItemStatus | "all">("all");
  const [radSearch, setRadSearch] = useState("");
  const [radStatus, setRadStatus] = useState<CatalogItemStatus | "all">("all");
  const [svcSearch, setSvcSearch] = useState("");
  const [svcStatus, setSvcStatus] = useState<CatalogItemStatus | "all">("all");
  const [labItems, setLabItems] = useState<LabCatalogItem[]>([]);
  const [radItems, setRadItems] = useState<RadiologyCatalogItem[]>([]);
  const [svcItems, setSvcItems] = useState<ServiceCatalogItem[]>([]);
  const [departments, setDepartments] = useState<AdminDepartment[]>([]);
  const [message, setMessage] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [formTab, setFormTab] = useState<CatalogTab>("lab");
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [f, setF] = useState<Record<string, string>>({});

  function openAddDialog() {
    setEditingId(null);
    setFormTab(activeTab);
    setFormError("");
    if (activeTab === "lab") setF({ code: "", name: "", category: "", specimen: "", turnaroundHours: "", price: "", requiresAuth: "false", cptCode: "" });
    else if (activeTab === "radiology") setF({ code: "", name: "", modality: "", bodyPart: "", withContrast: "false", durationMinutes: "", price: "", requiresAuth: "false", cptCode: "", preparation: "" });
    else setF({ code: "", name: "", category: "", price: "", departmentId: "" });
    setFormOpen(true);
  }

  function openEditLab(item: LabCatalogItem) {
    setEditingId(item.id); setFormTab("lab"); setFormError("");
    setF({ code: item.code, name: item.name, category: item.category, specimen: item.specimen, turnaroundHours: String(item.turnaroundHours), price: String(item.price), requiresAuth: String(item.requiresAuth), cptCode: item.cptCode ?? "" });
    setFormOpen(true);
  }

  function openEditRad(item: RadiologyCatalogItem) {
    setEditingId(item.id); setFormTab("radiology"); setFormError("");
    setF({ code: item.code, name: item.name, modality: item.modality, bodyPart: item.bodyPart, withContrast: String(item.withContrast), durationMinutes: String(item.durationMinutes), price: String(item.price), requiresAuth: String(item.requiresAuth), cptCode: item.cptCode ?? "", preparation: item.preparation ?? "" });
    setFormOpen(true);
  }

  function openEditSvc(item: ServiceCatalogItem) {
    setEditingId(item.id); setFormTab("services"); setFormError("");
    setF({ code: item.code, name: item.name, category: item.category, price: String(item.price), departmentId: "" });
    setFormOpen(true);
  }

  async function handleToggleActive(tab: CatalogTab, id: string, currentlyActive: boolean) {
    try {
      const isActive = !currentlyActive;
      if (tab === "lab") {
        await updateLabCatalogItem(id, { isActive }, token ?? undefined);
        setLabItems((prev) => prev.map((i) => i.id === id ? { ...i, status: isActive ? "active" : "inactive" } : i));
      } else if (tab === "radiology") {
        await updateRadiologyCatalogItem(id, { isActive }, token ?? undefined);
        setRadItems((prev) => prev.map((i) => i.id === id ? { ...i, status: isActive ? "active" : "inactive" } : i));
      } else {
        await updateServiceCatalogItem(id, { isActive }, token ?? undefined);
        setSvcItems((prev) => prev.map((i) => i.id === id ? { ...i, status: isActive ? "active" : "inactive" } : i));
      }
    } catch {
      setMessage("Failed to toggle active status.");
    }
  }

  async function handleFormSubmit() {
    if (!f.name?.trim() || !f.code?.trim()) { setFormError("Code and name are required."); return; }
    setFormLoading(true); setFormError("");
    try {
      if (formTab === "lab") {
        const payload = { code: f.code, name: f.name, category: f.category || "General", specimen: f.specimen || "Blood", turnaroundHours: Number(f.turnaroundHours) || 24, price: Number(f.price) || 0, requiresAuth: f.requiresAuth === "true", cptCode: f.cptCode || null };
        if (editingId) {
          await updateLabCatalogItem(editingId, payload, token ?? undefined);
          setLabItems((prev) => prev.map((i) => i.id === editingId ? { ...i, ...payload, cptCode: payload.cptCode ?? undefined } : i));
        } else {
          const created = await createLabCatalogItem(payload, token ?? undefined) as unknown as { id: string };
          setLabItems((prev) => [...prev, { id: String(created.id), ...payload, cptCode: payload.cptCode ?? undefined, status: "active" as const }]);
        }
      } else if (formTab === "radiology") {
        const payload = { code: f.code, name: f.name, modality: f.modality || "xray", bodyPart: f.bodyPart || "", withContrast: f.withContrast === "true", durationMinutes: Number(f.durationMinutes) || 30, price: Number(f.price) || 0, requiresAuth: f.requiresAuth === "true", cptCode: f.cptCode || null, preparation: f.preparation || null };
        if (editingId) {
          await updateRadiologyCatalogItem(editingId, payload, token ?? undefined);
          setRadItems((prev) => prev.map((i) => i.id === editingId ? { ...i, ...payload, cptCode: payload.cptCode ?? undefined, preparation: payload.preparation ?? undefined } : i));
        } else {
          const created = await createRadiologyCatalogItem(payload, token ?? undefined) as unknown as { id: string };
          setRadItems((prev) => [...prev, { id: String(created.id), ...payload, cptCode: payload.cptCode ?? undefined, preparation: payload.preparation ?? undefined, status: "active" as const }]);
        }
      } else {
        const payload = { code: f.code, name: f.name, category: f.category || "General", price: Number(f.price) || 0, departmentId: f.departmentId || null, isActive: true };
        if (editingId) {
          await updateServiceCatalogItem(editingId, payload, token ?? undefined);
          setSvcItems((prev) => prev.map((i) => i.id === editingId ? { ...i, code: payload.code, name: payload.name, category: payload.category, price: payload.price } : i));
        } else {
          const created = await createServiceCatalogItem(payload, token ?? undefined) as unknown as { id: string };
          setSvcItems((prev) => [...prev, { id: String(created.id), code: payload.code, name: payload.name, category: payload.category, price: payload.price, department: departments.find((d) => d.id === f.departmentId)?.name ?? "General", unit: "service", status: "active" as const }]);
        }
      }
      setFormOpen(false);
      setMessage(editingId ? "Item updated." : "Item created.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setFormLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const depts = await listDepartments({}, token ?? undefined);
        setDepartments(depts);
        const [labs, radiology, services] = await Promise.all([
          listLabCatalog(token ?? undefined),
          listRadiologyCatalog(token ?? undefined),
          listServiceCatalog(token ?? undefined, depts),
        ] as const);

        if (cancelled) {
          return;
        }

        setLabItems(labs);
        setRadItems(radiology);
        setSvcItems(services);
      } catch {
        if (!cancelled) {
          setLabItems([]);
          setRadItems([]);
          setSvcItems([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filteredLab = useMemo(() => {
    return labItems.filter((item) => {
      const query = labSearch.toLowerCase();
      const matchQuery = item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
      const matchStatus = labStatus === "all" || item.status === labStatus;
      return matchQuery && matchStatus;
    });
  }, [labItems, labSearch, labStatus]);

  const filteredRad = useMemo(() => {
    return radItems.filter((item) => {
      const query = radSearch.toLowerCase();
      const matchQuery = item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
      const matchStatus = radStatus === "all" || item.status === radStatus;
      return matchQuery && matchStatus;
    });
  }, [radItems, radSearch, radStatus]);

  const filteredSvc = useMemo(() => {
    return svcItems.filter((item) => {
      const query = svcSearch.toLowerCase();
      const matchQuery = item.name.toLowerCase().includes(query) || item.code.toLowerCase().includes(query);
      const matchStatus = svcStatus === "all" || item.status === svcStatus;
      return matchQuery && matchStatus;
    });
  }, [svcItems, svcSearch, svcStatus]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Service Catalogs</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Manage lab tests, radiology studies, and clinical services
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAddDialog}>
          <FlaskConical className="h-4 w-4" /> Add Item
        </Button>
      </div>

      {message && (
        <div className="rounded-lg border border-emerald-300/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
          {message}
        </div>
      )}

      <Tabs defaultValue="lab" className="space-y-4" onValueChange={(v) => setActiveTab(v as CatalogTab)}>
        <TabsList>
          <TabsTrigger value="lab" className="gap-1.5">
            <FlaskConical className="h-4 w-4" /> Lab Tests
            <Badge variant="secondary" className="ml-1 text-xs">{labItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="radiology" className="gap-1.5">
            <ScanLine className="h-4 w-4" /> Radiology
            <Badge variant="secondary" className="ml-1 text-xs">{radItems.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <Stethoscope className="h-4 w-4" /> Services
            <Badge variant="secondary" className="ml-1 text-xs">{svcItems.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lab" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search lab tests..."
                value={labSearch}
                onChange={(event) => setLabSearch(event.target.value)}
              />
            </div>
            <Select value={labStatus} onValueChange={(value) => setLabStatus(value as CatalogItemStatus | "all")}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Code</TableHead>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Category</TableHead>
                  <TableHead className="text-xs font-semibold">Specimen</TableHead>
                  <TableHead className="text-xs font-semibold">TAT (hrs)</TableHead>
                  <TableHead className="text-xs font-semibold">Price</TableHead>
                  <TableHead className="text-xs font-semibold">Auth</TableHead>
                  <TableHead className="text-xs font-semibold">CPT Code</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Active</TableHead>
                  <TableHead className="text-xs font-semibold w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLab.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs">{item.category}</TableCell>
                    <TableCell className="text-xs">{item.specimen}</TableCell>
                    <TableCell className="text-xs">{item.turnaroundHours}h</TableCell>
                    <TableCell className="text-xs">${item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      {item.requiresAuth ? (
                        <Badge variant="outline" className="border-amber-400/50 text-xs text-amber-700">
                          Required
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{item.cptCode ?? "-"}</TableCell>
                    <TableCell><StatusChip status={item.status} /></TableCell>
                    <TableCell>
                      <Switch checked={item.status === "active"} onCheckedChange={() => void handleToggleActive("lab", item.id, item.status === "active")} className="scale-75" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditLab(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="radiology" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search studies..."
                value={radSearch}
                onChange={(event) => setRadSearch(event.target.value)}
              />
            </div>
            <Select value={radStatus} onValueChange={(value) => setRadStatus(value as CatalogItemStatus | "all")}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Code</TableHead>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Modality</TableHead>
                  <TableHead className="text-xs font-semibold">Body Part</TableHead>
                  <TableHead className="text-xs font-semibold">Contrast</TableHead>
                  <TableHead className="text-xs font-semibold">Duration</TableHead>
                  <TableHead className="text-xs font-semibold">Price</TableHead>
                  <TableHead className="text-xs font-semibold">Auth</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Active</TableHead>
                  <TableHead className="text-xs font-semibold w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRad.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs uppercase">{item.modality}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{item.bodyPart}</TableCell>
                    <TableCell>
                      {item.withContrast ? (
                        <Badge variant="outline" className="border-blue-400/50 text-xs text-blue-700">
                          Yes
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{item.durationMinutes}min</TableCell>
                    <TableCell className="text-xs">${item.price.toFixed(2)}</TableCell>
                    <TableCell>
                      {item.requiresAuth ? (
                        <Badge variant="outline" className="border-amber-400/50 text-xs text-amber-700">
                          Required
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">No</span>
                      )}
                    </TableCell>
                    <TableCell><StatusChip status={item.status} /></TableCell>
                    <TableCell>
                      <Switch checked={item.status === "active"} onCheckedChange={() => void handleToggleActive("radiology", item.id, item.status === "active")} className="scale-75" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditRad(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-4 space-y-4">
          <div className="flex gap-3">
            <div className="relative max-w-xs flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search services..."
                value={svcSearch}
                onChange={(event) => setSvcSearch(event.target.value)}
              />
            </div>
            <Select value={svcStatus} onValueChange={(value) => setSvcStatus(value as CatalogItemStatus | "all")}>
              <SelectTrigger className="h-9 w-36 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="discontinued">Discontinued</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-hidden rounded-xl border border-border/50">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs font-semibold">Code</TableHead>
                  <TableHead className="text-xs font-semibold">Name</TableHead>
                  <TableHead className="text-xs font-semibold">Category</TableHead>
                  <TableHead className="text-xs font-semibold">Department</TableHead>
                  <TableHead className="text-xs font-semibold">Price</TableHead>
                  <TableHead className="text-xs font-semibold">Unit</TableHead>
                  <TableHead className="text-xs font-semibold">CPT</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Active</TableHead>
                  <TableHead className="text-xs font-semibold w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSvc.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.code}</TableCell>
                    <TableCell className="text-sm font-medium">{item.name}</TableCell>
                    <TableCell className="text-xs">{item.category}</TableCell>
                    <TableCell className="text-xs">{item.department}</TableCell>
                    <TableCell className="text-xs">${item.price.toFixed(2)}</TableCell>
                    <TableCell className="text-xs">{item.unit}</TableCell>
                    <TableCell className="font-mono text-xs">{item.cptCode ?? "-"}</TableCell>
                    <TableCell><StatusChip status={item.status} /></TableCell>
                    <TableCell>
                      <Switch checked={item.status === "active"} onCheckedChange={() => void handleToggleActive("services", item.id, item.status === "active")} className="scale-75" />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSvc(item)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add / Edit Catalog Item Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit" : "Add"} {formTab === "lab" ? "Lab Test" : formTab === "radiology" ? "Radiology Study" : "Service"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Code *</Label>
              <Input value={f.code ?? ""} onChange={(e) => setF({ ...f, code: e.target.value })} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input value={f.name ?? ""} onChange={(e) => setF({ ...f, name: e.target.value })} className="h-9" />
            </div>
            {formTab === "lab" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Specimen</Label>
                  <Input value={f.specimen ?? ""} onChange={(e) => setF({ ...f, specimen: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">TAT (hours)</Label>
                  <Input type="number" value={f.turnaroundHours ?? ""} onChange={(e) => setF({ ...f, turnaroundHours: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Price</Label>
                  <Input type="number" value={f.price ?? ""} onChange={(e) => setF({ ...f, price: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Requires Auth</Label>
                  <Select value={f.requiresAuth ?? "false"} onValueChange={(v) => setF({ ...f, requiresAuth: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CPT Code</Label>
                  <Input value={f.cptCode ?? ""} onChange={(e) => setF({ ...f, cptCode: e.target.value })} className="h-9" />
                </div>
              </>
            )}
            {formTab === "radiology" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Modality</Label>
                  <Select value={f.modality || "xray"} onValueChange={(v) => setF({ ...f, modality: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["xray", "ct", "mri", "ultrasound", "mammography", "fluoroscopy", "pet", "dexa"].map((m) => (
                        <SelectItem key={m} value={m} className="uppercase">{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Body Part</Label>
                  <Input value={f.bodyPart ?? ""} onChange={(e) => setF({ ...f, bodyPart: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">With Contrast</Label>
                  <Select value={f.withContrast ?? "false"} onValueChange={(v) => setF({ ...f, withContrast: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Duration (min)</Label>
                  <Input type="number" value={f.durationMinutes ?? ""} onChange={(e) => setF({ ...f, durationMinutes: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Price</Label>
                  <Input type="number" value={f.price ?? ""} onChange={(e) => setF({ ...f, price: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Requires Auth</Label>
                  <Select value={f.requiresAuth ?? "false"} onValueChange={(v) => setF({ ...f, requiresAuth: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="false">No</SelectItem>
                      <SelectItem value="true">Yes</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">CPT Code</Label>
                  <Input value={f.cptCode ?? ""} onChange={(e) => setF({ ...f, cptCode: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Preparation</Label>
                  <Input value={f.preparation ?? ""} onChange={(e) => setF({ ...f, preparation: e.target.value })} className="h-9" />
                </div>
              </>
            )}
            {formTab === "services" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-xs">Category</Label>
                  <Input value={f.category ?? ""} onChange={(e) => setF({ ...f, category: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Price</Label>
                  <Input type="number" value={f.price ?? ""} onChange={(e) => setF({ ...f, price: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label className="text-xs">Department</Label>
                  <Select value={f.departmentId || "none"} onValueChange={(v) => setF({ ...f, departmentId: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleFormSubmit()} disabled={formLoading}>
              {formLoading ? "Saving..." : editingId ? "Save Changes" : "Create Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
