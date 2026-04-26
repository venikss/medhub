"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Printer, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResultEntryRow } from "./ResultEntryRow";
import type { LabReport } from "@/types";
import { cn } from "@/lib/utils";

interface ReportPreviewProps {
  report: LabReport;
  className?: string;
}

export function ReportPreview({ report, className }: ReportPreviewProps) {
  return (
    <Card className={cn("border-border/50 shadow-sm print:shadow-none print:border", className)}>
      {/* Report Header */}
      <CardHeader className="pb-2 space-y-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary print:hidden" />
            Laboratory Report
          </CardTitle>
          <div className="flex items-center gap-2 print:hidden">
            <Badge variant="outline" className={cn("text-[10px] capitalize", report.status === "final" ? "text-emerald-600 border-emerald-500/30" : "text-amber-600 border-amber-500/30")}>{report.status}</Badge>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => window.print()}>
              <Printer className="h-3 w-3" /> Print
            </Button>
          </div>
        </div>

        {/* Patient info */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs border rounded-lg p-3 bg-muted/30">
          <div className="flex gap-2"><span className="text-muted-foreground">Patient:</span> <span className="font-medium">{report.patientName}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground">MRN:</span> <span className="font-mono">{report.mrn}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground">Panel:</span> <span className="font-medium">{report.panelName}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground">Ordered by:</span> <span>{report.orderedBy}</span></div>
          <div className="flex gap-2"><span className="text-muted-foreground">Ordered:</span> <span>{new Date(report.orderedAt).toLocaleString()}</span></div>
          {report.releasedAt && <div className="flex gap-2"><span className="text-muted-foreground">Released:</span> <span>{new Date(report.releasedAt).toLocaleString()}</span></div>}
        </div>

        {/* Critical notification */}
        {report.hasCritical && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/[0.08] border border-red-500/30 text-xs">
            <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
            <span className="font-semibold text-red-700">Critical value reported</span>
            {report.criticalNotifiedTo && (
              <span className="text-red-600">— Notified: {report.criticalNotifiedTo} at {report.criticalNotifiedAt ? new Date(report.criticalNotifiedAt).toLocaleTimeString() : ""}</span>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
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
              {report.results.map((r) => (
                <ResultEntryRow key={r.id} result={r} />
              ))}
            </tbody>
          </table>
        </div>

        <Separator className="my-4" />

        {/* Authorization */}
        <div className="flex items-center justify-between text-xs">
          <div className="space-y-1">
            {report.authorizedBy && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span className="text-muted-foreground">Authorized by:</span>
                <span className="font-medium">{report.authorizedBy}</span>
                {report.authorizedAt && <span className="text-muted-foreground">at {new Date(report.authorizedAt).toLocaleString()}</span>}
              </div>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground italic">Report ID: {report.id}</span>
        </div>
      </CardContent>
    </Card>
  );
}
