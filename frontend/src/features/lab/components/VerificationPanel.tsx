"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, XCircle, Clock, CheckCircle2, Loader2 } from "lucide-react";
import { ResultEntryRow } from "./ResultEntryRow";
import { verifyPanel, releaseLabReport, rejectSpecimen, recollectSpecimen } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { LabPanel } from "@/types";
import { cn } from "@/lib/utils";

interface VerificationPanelProps {
  panel: LabPanel;
  className?: string;
  onStatusChange?: () => void;
}

export function VerificationPanel({ panel, className, onStatusChange }: VerificationPanelProps) {
  const token = useAuthStore((state) => state.token);
  const [loading, setLoading] = useState(false);
  const [comment, setComment] = useState("");
  const hasCritical = panel.results.some((r) => r.flag === "critical-high" || r.flag === "critical-low");
  const allFinal = panel.results.every((r) => r.status === "final" || r.status === "corrected" || r.status === "verified");
  const isVerified = panel.status === "verified" || panel.status === "released";

  async function handleAuthorizeRelease() {
    if (!token || loading) return;
    try {
      setLoading(true);
      if (panel.status !== "verified") {
        await verifyPanel(panel.id, token);
      }
      try {
        const { listLabReports } = await import("@/features/lab/api");
        const reports = await listLabReports({ patientId: panel.patientId }, token);
        const report = reports.find((r) => r.panelId === panel.id);
        if (report) {
          await releaseLabReport(report.id, comment || undefined, token);
        }
      } catch {
      }
      onStatusChange?.();
    } catch (err: any) {
      alert(err?.message ?? "Failed to verify panel");
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!token || loading) return;
    const reason = window.prompt("Reason for rejection / recollection:");
    if (!reason?.trim()) return;
    try {
      setLoading(true);
      await recollectSpecimen({ specimenId: panel.specimenId, reason: reason.trim() }, token);
      onStatusChange?.();
    } catch (err: any) {
      alert(err?.message ?? "Failed to request recollection");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className={cn("border-border/50 shadow-sm", hasCritical && "border-red-500/40", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            {panel.name}
            <span className="text-xs text-muted-foreground font-normal">({panel.code})</span>
            {hasCritical && <Badge variant="destructive" className="text-[10px]">⚠ Critical</Badge>}
          </CardTitle>
          <Badge variant="outline" className="text-[10px] capitalize">{panel.status}</Badge>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-1">
          <span>Patient: {panel.patientName}</span>
          <span>· Ordered by: {panel.orderedBy}</span>
          <span>· Specimen: {panel.specimenId}</span>
          {panel.turnaroundMinutes && <span>· TAT: {panel.turnaroundMinutes} min</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Results table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2 px-3 font-medium">Code</th>
                <th className="text-left py-2 px-3 font-medium">Test</th>
                <th className="text-left py-2 px-3 font-medium">Value</th>
                <th className="text-left py-2 px-3 font-medium">Unit</th>
                <th className="text-left py-2 px-3 font-medium">Ref Range</th>
                <th className="text-left py-2 px-3 font-medium">Flag</th>
                <th className="text-left py-2 px-3 font-medium">Delta</th>
                <th className="text-left py-2 px-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {panel.results.map((r) => (
                <ResultEntryRow key={r.id} result={r} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Verification comment */}
        {!isVerified && (
          <Textarea
            placeholder="Verification comment (optional)…"
            rows={2}
            className="text-xs resize-none"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        )}

        {/* Audit trail */}
        <div className="flex items-center gap-4 text-[10px] text-muted-foreground border-t pt-3">
          <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> Analyzed: {panel.results[0]?.analyzedAt ? new Date(panel.results[0].analyzedAt).toLocaleString() : "—"}</span>
          {panel.results[0]?.verifiedBy && (
            <span className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Verified by: {panel.results[0].verifiedBy}</span>
          )}
        </div>

        {/* Actions */}
        {!isVerified && (
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs text-red-600 border-red-500/30 hover:bg-red-500/10"
              onClick={() => void handleReject()}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />} Reject / Recollect
            </Button>
            <Button
              size="sm"
              className="gap-1.5 text-xs"
              disabled={!allFinal || loading}
              onClick={() => void handleAuthorizeRelease()}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />} Authorize & Release
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
