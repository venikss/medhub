"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Filter, Link as LinkIcon, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import {
  listImagingOrders,
  protocolImagingOrder,
  scheduleImagingOrder,
  cancelImagingOrder,
  createImagingStudy,
} from "@/features/radiology/api";
import { ModalityBadge } from "@/features/radiology/components/ModalityBadge";
import { StudyStatusPipeline } from "@/features/radiology/components/StudyStatusPipeline";
import type { ImagingModality, ImagingOrder, ImagingStudyStatus } from "@/types";
import { cn } from "@/lib/utils";

const MODALITIES: (ImagingModality | "all")[] = ["all", "XR", "CT", "MRI", "US", "NM", "PET"];
const STATUSES: { label: string; value: ImagingStudyStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Ordered", value: "ordered" },
  { label: "Protocoled", value: "protocoled" },
  { label: "Scheduled", value: "scheduled" },
  { label: "In Progress", value: "in-progress" },
  { label: "Acquired", value: "acquired" },
  { label: "Reading", value: "reading" },
  { label: "Reported", value: "reported" },
  { label: "Signed", value: "signed" },
];

const PRIORITY_STYLES: Record<string, string> = {
  stat: "bg-red-100 text-red-700 border-red-300",
  urgent: "bg-orange-100 text-orange-700 border-orange-300",
  high: "bg-amber-100 text-amber-700 border-amber-300",
  normal: "bg-slate-100 text-slate-600 border-slate-300",
};

export default function OrdersBoardPage() {
  const token = useAuthStore((state) => state.token);
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<ImagingModality | "all">("all");
  const [statusFilter, setStatus] = useState<ImagingStudyStatus | "all">("all");
  const [orders, setOrders] = useState<ImagingOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [protocolOpen, setProtocolOpen] = useState(false);
  const [protocolNotes, setProtocolNotes] = useState("");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [scheduleRoom, setScheduleRoom] = useState("");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    let cancelled = false;

    void listImagingOrders(
      {
        q: query || undefined,
        modality: modality === "all" ? undefined : modality,
        status: statusFilter === "all" ? undefined : statusFilter,
      },
      token ?? undefined,
    )
      .then((data) => {
        if (!cancelled) {
          setOrders(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setOrders([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [modality, query, statusFilter, token]);

  const filtered = useMemo(() => orders, [orders]);
  const selected = useMemo(
    () => filtered.find((order) => order.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  async function handleProtocol() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await protocolImagingOrder(selected.id, { protocolNotes: protocolNotes || undefined }, token ?? undefined);
      setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setProtocolOpen(false);
      setProtocolNotes("");
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to protocol order.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSchedule() {
    if (!selected || !scheduleAt) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await scheduleImagingOrder(
        selected.id,
        { scheduledAt: new Date(scheduleAt).toISOString(), scheduledRoom: scheduleRoom || undefined },
        token ?? undefined,
      );
      setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setScheduleOpen(false);
      setScheduleAt("");
      setScheduleRoom("");
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to schedule order.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCheckIn() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      await createImagingStudy(
        {
          orderId: selected.id,
          examDate: new Date().toISOString(),
          room: selected.scheduledRoom ?? undefined,
          status: "arrived",
        },
        token ?? undefined,
      );
      const refreshed = await listImagingOrders(
        {
          q: query || undefined,
          modality: modality === "all" ? undefined : modality,
          status: statusFilter === "all" ? undefined : statusFilter,
        },
        token ?? undefined,
      );
      setOrders(refreshed);
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to check in patient.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!selected) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await cancelImagingOrder(
        selected.id,
        { reason: cancelReason || undefined },
        token ?? undefined,
      );
      setOrders((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setCancelOpen(false);
      setCancelReason("");
    } catch (err: any) {
      setActionError(err?.message ?? "Failed to cancel order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4 pt-0">
      {/* Protocol Dialog */}
      <Dialog open={protocolOpen} onOpenChange={setProtocolOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Protocol Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Protocol Notes (optional)</Label>
              <Textarea
                placeholder="Enter protocol notes…"
                rows={3}
                value={protocolNotes}
                onChange={(e) => setProtocolNotes(e.target.value)}
              />
            </div>
            {actionError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />{actionError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProtocolOpen(false); setProtocolNotes(""); setActionError(null); }}>Cancel</Button>
            <Button onClick={() => void handleProtocol()} disabled={busy}>{busy ? "Saving…" : "Confirm Protocol"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Schedule Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Date &amp; Time <span className="text-destructive">*</span></Label>
              <Input
                type="datetime-local"
                value={scheduleAt}
                onChange={(e) => setScheduleAt(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Room (optional)</Label>
              <Input
                placeholder="e.g. Room 3 – CT Suite"
                value={scheduleRoom}
                onChange={(e) => setScheduleRoom(e.target.value)}
              />
            </div>
            {actionError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />{actionError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setScheduleOpen(false); setScheduleAt(""); setScheduleRoom(""); setActionError(null); }}>Cancel</Button>
            <Button onClick={() => void handleSchedule()} disabled={busy || !scheduleAt}>{busy ? "Saving…" : "Confirm Schedule"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              This will cancel the imaging order for <span className="font-semibold text-foreground">{selected?.patientName}</span> ({selected?.examName}). This action cannot be undone.
            </p>
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Reason (optional)</Label>
              <Textarea
                placeholder="Enter cancellation reason…"
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            {actionError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" />{actionError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCancelOpen(false); setCancelReason(""); setActionError(null); }}>Keep Order</Button>
            <Button variant="destructive" onClick={() => void handleCancel()} disabled={busy}>{busy ? "Cancelling…" : "Cancel Order"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orders Board</h1>
        <p className="text-sm text-muted-foreground">{filtered.length} orders</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search patient, exam, accession..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {MODALITIES.map((item) => (
            <button
              key={item}
              onClick={() => setModality(item)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs font-semibold transition-colors",
                modality === item
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {item === "all" ? "All Modalities" : item}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        <Filter className="mr-1 h-4 w-4 self-center text-muted-foreground" />
        {STATUSES.map((status) => (
          <button
            key={status.value}
            onClick={() => setStatus(status.value)}
            className={cn(
              "rounded-full border px-3 py-0.5 text-xs capitalize transition-colors",
              statusFilter === status.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input bg-background text-muted-foreground hover:bg-muted",
            )}
          >
            {status.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex w-full max-w-md flex-col gap-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No orders match.</p>
          ) : (
            filtered.map((order) => (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(order.id)}
                onKeyDown={(event) => event.key === "Enter" && setSelectedId(order.id)}
                className={cn(
                  "flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors",
                  selected?.id === order.id ? "border-primary bg-primary/5" : "hover:bg-muted/40",
                  order.priority === "stat" && "border-l-4 border-l-red-500",
                  order.priority === "urgent" && "border-l-4 border-l-orange-400",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ModalityBadge modality={order.modality} />
                    <span className="truncate text-sm font-medium">{order.patientName}</span>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-1.5 py-0.5 text-xs font-semibold uppercase",
                      PRIORITY_STYLES[order.priority],
                    )}
                  >
                    {order.priority}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{order.examName}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{order.accessionNumber}</span>
                  <Badge variant="outline" className="text-xs capitalize">{order.status}</Badge>
                </div>
              </div>
            ))
          )}
        </div>

        <Separator orientation="vertical" />

        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <Card className="h-full">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <ModalityBadge modality={selected.modality} />
                      <h2 className="font-bold">{selected.patientName}</h2>
                      <span className="text-sm text-muted-foreground">{selected.mrn}</span>
                    </div>
                    <p className="text-sm font-medium">{selected.examName}</p>
                    <p className="text-xs text-muted-foreground">
                      Acc#: {selected.accessionNumber} - Room: {selected.scheduledRoom ?? "TBD"} -{" "}
                      {selected.scheduledAt
                        ? new Date(selected.scheduledAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Not scheduled"}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded border px-2 py-0.5 text-xs font-bold uppercase",
                      PRIORITY_STYLES[selected.priority],
                    )}
                  >
                    {selected.priority}
                  </span>
                </div>

                <div className="overflow-x-auto pb-2">
                  <StudyStatusPipeline status={selected.status} />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    { label: "DOB", value: selected.dateOfBirth },
                    { label: "Gender", value: selected.gender },
                    { label: "Requested by", value: selected.requestedBy },
                    { label: "Department", value: selected.department },
                    { label: "Requested at", value: new Date(selected.requestedAt).toLocaleString() },
                    { label: "Body Region", value: `${selected.bodyRegion}${selected.laterality ? ` (${selected.laterality})` : ""}` },
                    { label: "Contrast", value: selected.contrastRequired ? "Required" : "Not required" },
                    { label: "Technologist", value: selected.assignedTechnologist ?? "-" },
                    { label: "Radiologist", value: selected.assignedRadiologist ?? "-" },
                    { label: "Protocoled by", value: selected.protocoledBy ?? "-" },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="font-medium">{value}</p>
                    </div>
                  ))}
                </div>

                <Separator />

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Clinical History</p>
                  <p className="rounded bg-muted/50 p-2 text-sm">{selected.clinicalHistory}</p>
                </div>

                {selected.notes && (
                  <div>
                    <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
                    <p className="rounded bg-muted/50 p-2 text-sm">{selected.notes}</p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selected.status === "ordered" && (
                    <Button size="sm" onClick={() => { setActionError(null); setProtocolOpen(true); }}>Protocol Order</Button>
                  )}
                  {selected.status === "protocoled" && (
                    <Button size="sm" onClick={() => { setActionError(null); setScheduleOpen(true); }}>Schedule</Button>
                  )}
                  {selected.status === "scheduled" && (
                    <Button size="sm" disabled={busy} onClick={() => void handleCheckIn()}>
                      {busy ? "Checking in…" : "Check In Patient"}
                    </Button>
                  )}
                  {["ordered", "protocoled", "scheduled", "arrived"].includes(selected.status) && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => { setActionError(null); setCancelOpen(true); }}
                    >
                      Cancel Order
                    </Button>
                  )}
                  {selected.reportId && (
                    <Link href={`/radiology/reports?reportId=${selected.reportId}`}>
                      <Button size="sm" variant="outline" className="gap-1">
                        <LinkIcon className="h-3.5 w-3.5" />
                        View Report
                      </Button>
                    </Link>
                  )}
                  {actionError && (
                    <p className="w-full text-xs text-destructive flex items-center gap-1 mt-1">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />{actionError}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select an order to view details.
          </div>
        )}
      </div>
    </div>
  );
}
