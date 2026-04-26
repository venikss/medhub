"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart } from "lucide-react";
import type { VitalEntry } from "@/types";
import { cn } from "@/lib/utils";

interface VitalsFlowsheetProps {
  vitals: VitalEntry[];
  className?: string;
}

function isAbnormal(key: string, value: number): boolean {
  switch (key) {
    case "systolic": return value > 140 || value < 90;
    case "diastolic": return value > 90 || value < 60;
    case "heartRate": return value > 100 || value < 60;
    case "temperature": return value > 100.4 || value < 96.8;
    case "spo2": return value < 95;
    case "respiratoryRate": return value > 20 || value < 12;
    case "painScore": return value >= 7;
    default: return false;
  }
}

const columns = [
  { key: "time", label: "Time" },
  { key: "systolic", label: "BP (S/D)" },
  { key: "heartRate", label: "HR" },
  { key: "temperature", label: "Temp" },
  { key: "spo2", label: "SpO2" },
  { key: "respiratoryRate", label: "RR" },
  { key: "painScore", label: "Pain" },
  { key: "gcs", label: "GCS" },
];

export function VitalsFlowsheet({ vitals, className }: VitalsFlowsheetProps) {
  return (
    <Card className={cn("border-border/50 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          Vitals Flowsheet
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                {columns.map((col) => (
                  <th key={col.key} className="text-left py-2 px-2 font-medium whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vitals.map((v) => {
                const t = new Date(v.timestamp);
                const timeStr = t.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <tr key={v.id} className="border-b border-border/30 hover:bg-muted/40 transition-colors">
                    <td className="py-2 px-2 text-xs font-medium whitespace-nowrap">{timeStr}</td>
                    <td className={cn("py-2 px-2 font-mono text-xs", (isAbnormal("systolic", v.systolic) || isAbnormal("diastolic", v.diastolic)) && "text-red-600 font-bold")}>
                      {v.systolic}/{v.diastolic}
                    </td>
                    <td className={cn("py-2 px-2 font-mono text-xs", isAbnormal("heartRate", v.heartRate) && "text-red-600 font-bold")}>
                      {v.heartRate}
                    </td>
                    <td className={cn("py-2 px-2 font-mono text-xs", isAbnormal("temperature", v.temperature) && "text-amber-600 font-bold")}>
                      {v.temperature}°
                    </td>
                    <td className={cn("py-2 px-2 font-mono text-xs", isAbnormal("spo2", v.spo2) && "text-red-600 font-bold")}>
                      {v.spo2}%
                    </td>
                    <td className={cn("py-2 px-2 font-mono text-xs", isAbnormal("respiratoryRate", v.respiratoryRate) && "text-amber-600 font-bold")}>
                      {v.respiratoryRate}
                    </td>
                    <td className={cn("py-2 px-2 font-mono text-xs", v.painScore !== undefined && isAbnormal("painScore", v.painScore) && "text-red-600 font-bold")}>
                      {v.painScore !== undefined ? `${v.painScore}/10` : "—"}
                    </td>
                    <td className="py-2 px-2 font-mono text-xs">
                      {v.gcs !== undefined ? v.gcs : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
