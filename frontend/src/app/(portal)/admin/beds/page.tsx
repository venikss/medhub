"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, Clock, Sparkles, User, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createBed, listBeds, listWards, updateBed } from "@/features/admin/api";
import { StatusChip } from "@/features/admin/components/StatusChip";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { Bed, BedStatus, Ward } from "@/types";

const BED_STATUS_COLORS: Record<BedStatus, string> = {
  available: "bg-emerald-500/15 border-emerald-400/40 text-emerald-700",
  occupied: "bg-blue-500/15 border-blue-400/40 text-blue-700",
  reserved: "bg-violet-500/15 border-violet-400/40 text-violet-700",
  maintenance: "bg-orange-500/15 border-orange-400/40 text-orange-700",
  cleaning: "bg-amber-500/15 border-amber-400/40 text-amber-700",
};

const BED_STATUS_ICONS: Record<BedStatus, React.ReactNode> = {
  available: <BedDouble className="h-4 w-4" />,
  occupied: <User className="h-4 w-4" />,
  reserved: <Clock className="h-4 w-4" />,
  maintenance: <Wrench className="h-4 w-4" />,
  cleaning: <Sparkles className="h-4 w-4" />,
};

const BED_STATUSES: BedStatus[] = ["available", "occupied", "reserved", "maintenance", "cleaning"];

export default function BedsPage() {
  const token = useAuthStore((state) => state.token);
  const [selectedWardId, setSelectedWardId] = useState("");
  const [statusFilter, setStatusFilter] = useState<BedStatus | "all">("all");
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);
  const [wards, setWards] = useState<Ward[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  interface BedForm { wardId: string; number: string; roomNumber: string; bedType: string; status: BedStatus }
  const EMPTY_BED: BedForm = { wardId: "", number: "", roomNumber: "", bedType: "general", status: "available" };
  const [formOpen, setFormOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [bedForm, setBedForm] = useState<BedForm>(EMPTY_BED);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusBed, setStatusBed] = useState<Bed | null>(null);
  const [newStatus, setNewStatus] = useState<BedStatus>("available");

  useEffect(() => {
    let cancelled = false;

    void Promise.all([listWards({}, token ?? undefined), listBeds({}, token ?? undefined)])
      .then(([loadedWards, loadedBeds]) => {
        if (cancelled) return;

        const wardMap = new Map(loadedWards.map((ward) => [ward.id, ward]));
        const enrichedBeds = loadedBeds.map((bed) => {
          const ward = wardMap.get(bed.wardId);
          return {
            ...bed,
            floorNumber: ward?.floorNumber ?? 0,
            departmentName: ward?.departmentName ?? bed.departmentName,
            departmentId: ward?.departmentId ?? bed.departmentId,
          };
        });

        setWards(loadedWards);
        setBeds(enrichedBeds);
        setSelectedWardId((current) => current || loadedWards[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) {
          setWards([]);
          setBeds([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedWard = wards.find((ward) => ward.id === selectedWardId);
  const wardBeds = useMemo(
    () =>
      beds.filter((bed) => {
        const matchWard = selectedWardId === "" || selectedWardId === "all" || bed.wardId === selectedWardId;
        const matchStatus = statusFilter === "all" || bed.status === statusFilter;
        return matchWard && matchStatus;
      }),
    [beds, selectedWardId, statusFilter],
  );

  const occupancyRate = beds.length > 0
    ? Math.round((beds.filter((bed) => bed.status === "occupied").length / beds.length) * 100)
    : 0;

  function setFeedback(nextMessage = "", nextError = "") {
    setMessage(nextMessage);
    setError(nextError);
  }

  function enrichBed(bed: Bed) {
    const ward = wards.find((item) => item.id === bed.wardId);
    return {
      ...bed,
      floorNumber: ward?.floorNumber ?? bed.floorNumber,
      departmentName: ward?.departmentName ?? bed.departmentName,
      departmentId: ward?.departmentId ?? bed.departmentId,
    };
  }

  function openAddBedDialog() {
    setEditingBed(null);
    setBedForm({ ...EMPTY_BED, wardId: selectedWardId });
    setFormError("");
    setFormOpen(true);
  }

  function openEditBedDialog(bed: Bed) {
    setEditingBed(bed);
    setBedForm({ wardId: bed.wardId, number: bed.number, roomNumber: bed.roomNumber ?? "", bedType: bed.type, status: bed.status });
    setFormError("");
    setFormOpen(true);
  }

  function openStatusDialog(bed: Bed) {
    setStatusBed(bed);
    setNewStatus(bed.status);
    setStatusOpen(true);
  }

  async function handleBedFormSubmit() {
    if (!bedForm.number.trim()) { setFormError("Bed number is required."); return; }
    if (!bedForm.wardId) { setFormError("Ward is required."); return; }
    setFormLoading(true);
    setFormError("");
    try {
      if (editingBed) {
        const updated = await updateBed(editingBed.id, { number: bedForm.number.trim(), roomNumber: bedForm.roomNumber || null, bedType: bedForm.bedType, features: editingBed.features ?? [] }, token ?? undefined);
        const nextBed = enrichBed(updated);
        setBeds((prev) => prev.map((item) => (item.id === editingBed.id ? nextBed : item)));
        setSelectedBed(nextBed);
        setFeedback(`Updated bed ${nextBed.number}.`);
      } else {
        const created = await createBed({ wardId: bedForm.wardId, number: bedForm.number.trim(), roomNumber: bedForm.roomNumber || null, bedType: bedForm.bedType, status: "available", features: [] }, token ?? undefined);
        const nextBed = enrichBed(created);
        setBeds((prev) => [...prev, nextBed]);
        setSelectedWardId(bedForm.wardId);
        setSelectedBed(nextBed);
        setFeedback(`Added bed ${nextBed.number}.`);
      }
      setFormOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Operation failed.");
    } finally {
      setFormLoading(false);
    }
  }

  async function handleStatusSubmit() {
    if (!statusBed) return;
    try {
      const updated = await updateBed(statusBed.id, { status: newStatus }, token ?? undefined);
      const nextBed = enrichBed(updated);
      setBeds((prev) => prev.map((item) => (item.id === statusBed.id ? nextBed : item)));
      setSelectedBed(nextBed);
      setFeedback(`Bed ${nextBed.number} is now ${nextBed.status}.`);
      setStatusOpen(false);
    } catch (err) {
      setFeedback("", err instanceof Error ? err.message : "Couldn't update status.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Rooms &amp; Beds</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {beds.length} beds total · {beds.filter((bed) => bed.status === "occupied").length} occupied ({occupancyRate}%)
          </p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={openAddBedDialog}>
          <BedDouble className="h-4 w-4" /> Add Bed
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BED_STATUSES.map((status) => (
          <div
            key={status}
            className={`cursor-pointer rounded-xl border p-3 text-center transition-all ${statusFilter === status ? "ring-2 ring-primary" : ""} ${BED_STATUS_COLORS[status]}`}
            onClick={() => setStatusFilter(statusFilter === status ? "all" : status)}
          >
            <div className="mb-1 flex justify-center">{BED_STATUS_ICONS[status]}</div>
            <p className="text-xl font-bold">{beds.filter((bed) => bed.status === status).length}</p>
            <p className="mt-0.5 text-xs capitalize">{status}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-6">
        <div className="w-56 shrink-0 space-y-2">
          <div className="mb-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inpatient &amp; Nursing</p>
            <p className="mt-0.5 text-xs text-muted-foreground/70">Nurses are assigned within inpatient wards</p>
          </div>
          {wards.length === 0 && (
            <p className="text-xs text-muted-foreground italic">No wards configured</p>
          )}
          {wards.map((ward) => {
            const wardBedList = beds.filter((bed) => bed.wardId === ward.id);
            const occupied = wardBedList.filter((bed) => bed.status === "occupied").length;
            const isSelected = selectedWardId === ward.id;

            return (
              <button
                key={ward.id}
                onClick={() => {
                  setSelectedWardId(ward.id);
                  setSelectedBed(null);
                }}
                className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-all ${isSelected ? "border-primary bg-primary text-primary-foreground" : "border-border/50 hover:bg-muted/50"}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <p className="truncate text-sm font-medium">{ward.name}</p>
                  <span className={`shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${isSelected ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {ward.type.replace("_", " ")}
                  </span>
                </div>
                <p className={`mt-0.5 text-xs ${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {occupied}/{ward.totalBeds} occupied
                  {ward.headNurseName ? ` · ${ward.headNurseName}` : ""}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/10">
                  <div
                    className="h-full rounded-full bg-current opacity-60"
                    style={{ width: `${ward.totalBeds > 0 ? Math.round((occupied / ward.totalBeds) * 100) : 0}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          {selectedWard && (
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold">{selectedWard.name}</h2>
                <p className="text-xs capitalize text-muted-foreground">
                  {selectedWard.type.replace("_", " ")} · Floor {selectedWard.floorNumber}, {selectedWard.building}
                  {selectedWard.headNurseName ? ` · Head: ${selectedWard.headNurseName}` : ""}
                </p>
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as BedStatus | "all")}>
                <SelectTrigger className="h-8 w-36 text-xs">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {BED_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {wardBeds.length === 0 ? (
              <div className="col-span-5 py-16 text-center text-sm text-muted-foreground">
                No beds in this ward or all are filtered out.
              </div>
            ) : (
              wardBeds.map((bed) => (
                <button
                  key={bed.id}
                  onClick={() => setSelectedBed(bed.id === selectedBed?.id ? null : bed)}
                  className={`rounded-xl border p-3 text-left transition-all hover:shadow-md ${BED_STATUS_COLORS[bed.status]} ${selectedBed?.id === bed.id ? "ring-2 ring-primary" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{bed.number}</span>
                    {BED_STATUS_ICONS[bed.status]}
                  </div>
                  {bed.roomNumber && <p className="mt-1 text-xs opacity-70">Room {bed.roomNumber}</p>}
                  <p className="mt-0.5 text-xs font-medium capitalize">{bed.status}</p>
                  {bed.patientName && <p className="mt-1 truncate text-xs opacity-80">{bed.patientName}</p>}
                  {bed.features && bed.features.length > 0 && (
                    <p className="mt-1 truncate text-xs opacity-60">{bed.features.slice(0, 2).join(", ")}</p>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {selectedBed && (
          <div className="w-64 shrink-0">
            <Card className="sticky top-6 border-border/50 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base font-semibold">Bed {selectedBed.number}</CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedBed(null)}>
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <StatusChip status={selectedBed.status} />
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ward</span>
                    <span>{selectedBed.wardName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span className="text-xs">{selectedBed.departmentName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="capitalize">{selectedBed.type.replace("_", " ")}</span>
                  </div>
                  {selectedBed.roomNumber && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Room</span>
                      <span>{selectedBed.roomNumber}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Floor</span>
                    <span>{selectedBed.floorNumber}</span>
                  </div>
                </div>
                {selectedBed.patientName && (
                  <div className="rounded-lg border border-blue-300/30 bg-blue-500/10 p-2.5">
                    <p className="text-xs font-semibold text-blue-700">Current Patient</p>
                    <p className="mt-0.5 text-sm font-medium">{selectedBed.patientName}</p>
                    {selectedBed.admittedAt && (
                      <p className="mt-0.5 text-xs text-muted-foreground">Admitted {selectedBed.admittedAt}</p>
                    )}
                  </div>
                )}
                {selectedBed.features && selectedBed.features.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Features</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedBed.features.map((feature) => (
                        <Badge key={feature} variant="outline" className="text-xs capitalize">
                          {feature.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => openEditBedDialog(selectedBed)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 flex-1 text-xs" onClick={() => openStatusDialog(selectedBed)}>
                    Change Status
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Add / Edit Bed Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBed ? "Edit Bed" : "Add Bed"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Ward *</Label>
              <Select value={bedForm.wardId} onValueChange={(v) => setBedForm({ ...bedForm, wardId: v })} disabled={!!editingBed}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select ward" /></SelectTrigger>
                <SelectContent>
                  {wards.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bed Number *</Label>
              <Input value={bedForm.number} onChange={(e) => setBedForm({ ...bedForm, number: e.target.value })} placeholder="e.g. B-101" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Room Number</Label>
              <Input value={bedForm.roomNumber} onChange={(e) => setBedForm({ ...bedForm, roomNumber: e.target.value })} placeholder="Optional" className="h-9" />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label className="text-xs">Bed Type</Label>
              <Select value={bedForm.bedType} onValueChange={(v) => setBedForm({ ...bedForm, bedType: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="icu">ICU</SelectItem>
                  <SelectItem value="nicu">NICU</SelectItem>
                  <SelectItem value="pediatric">Pediatric</SelectItem>
                  <SelectItem value="maternity">Maternity</SelectItem>
                  <SelectItem value="isolation">Isolation</SelectItem>
                  <SelectItem value="bariatric">Bariatric</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleBedFormSubmit()} disabled={formLoading}>
              {formLoading ? "Saving..." : editingBed ? "Save Changes" : "Add Bed"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Status Dialog */}
      <Dialog open={statusOpen} onOpenChange={setStatusOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change Bed Status</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label className="text-xs">Bed: {statusBed?.number}</Label>
            <Select value={newStatus} onValueChange={(v) => setNewStatus(v as BedStatus)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BED_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleStatusSubmit()}>Update Status</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
