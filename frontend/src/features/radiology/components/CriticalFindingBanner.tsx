"use client";

import { AlertTriangle, Phone, CheckCircle2, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CriticalFinding } from "@/types";

interface CriticalFindingBannerProps {
  finding: CriticalFinding;
  onNotify?: (id: string) => void;
  onAcknowledge?: (id: string) => void;
  className?: string;
}

export function CriticalFindingBanner({
  finding, onNotify, onAcknowledge, className,
}: CriticalFindingBannerProps) {
  const isCritical = finding.severity === "critical";

  return (
    <Card
      className={cn(
        "border-l-4 p-4",
        isCritical ? "border-l-red-600 bg-red-50" : "border-l-amber-500 bg-amber-50",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        {/* Left — info */}
        <div className="flex items-start gap-3">
          <AlertTriangle
            className={cn(
              "mt-0.5 h-5 w-5 shrink-0",
              isCritical ? "text-red-600" : "text-amber-600",
            )}
          />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className={cn(isCritical ? "" : "bg-amber-600")}>
                {finding.severity.toUpperCase()}
              </Badge>
              <span className="font-semibold text-sm">
                {finding.patientName}
              </span>
              <span className="text-sm text-muted-foreground">
                MRN: {finding.mrn}
              </span>
              <span className="text-sm text-muted-foreground">
                · {finding.modality} · {finding.examName}
              </span>
            </div>

            <p className="text-sm font-medium leading-snug">{finding.finding}</p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Identified: {new Date(finding.identifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                {" "}by {finding.identifiedBy}
              </span>
              {finding.notifiedTo && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  Notified: {finding.notifiedTo}
                  {finding.notifiedAt && (
                    <> at {new Date(finding.notifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                  {finding.callbackNumber && <> ({finding.callbackNumber})</>}
                </span>
              )}
              {finding.acknowledgedBy && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  Acknowledged by {finding.acknowledgedBy}
                  {finding.acknowledgedAt && (
                    <> at {new Date(finding.acknowledgedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                </span>
              )}
            </div>

            {finding.notes && (
              <p className="text-xs text-muted-foreground italic">{finding.notes}</p>
            )}
          </div>
        </div>

        {/* Right — actions */}
        <div className="flex shrink-0 gap-2 sm:flex-col sm:items-end">
          {finding.status === "pending" && onNotify && (
            <Button
              size="sm"
              variant="destructive"
              className="gap-1"
              onClick={() => onNotify(finding.id)}
            >
              <Phone className="h-3.5 w-3.5" />
              Notify Clinician
            </Button>
          )}
          {finding.status === "notified" && onAcknowledge && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
              onClick={() => onAcknowledge(finding.id)}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Mark Acknowledged
            </Button>
          )}
          {finding.status === "acknowledged" && (
            <Badge variant="outline" className="gap-1 border-emerald-600 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              Acknowledged
            </Badge>
          )}
        </div>
      </div>
    </Card>
  );
}
