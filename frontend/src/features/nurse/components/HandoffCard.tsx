"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClipboardList, ArrowRight, CheckCircle2 } from "lucide-react";
import type { HandoffEntry } from "@/types";
import { cn } from "@/lib/utils";

interface HandoffCardProps {
  handoff: HandoffEntry;
  className?: string;
}

const sbarSections = [
  { key: "situation", label: "Situation", letter: "S", color: "bg-sky-500/20 text-sky-700" },
  { key: "background", label: "Background", letter: "B", color: "bg-teal-500/20 text-teal-700" },
  { key: "assessment", label: "Assessment", letter: "A", color: "bg-amber-500/20 text-amber-700" },
  { key: "recommendation", label: "Recommendation", letter: "R", color: "bg-violet-500/20 text-violet-700" },
] as const;

export function HandoffCard({ handoff, className }: HandoffCardProps) {
  return (
    <Card className={cn("border-border/50 shadow-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            {handoff.patientName}
            <span className="text-xs font-normal text-muted-foreground">Rm {handoff.room}</span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{handoff.fromNurse}</span>
            <ArrowRight className="h-3 w-3" />
            {handoff.acknowledged ? (
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle2 className="h-3 w-3" />
                {handoff.toNurse}
              </span>
            ) : (
              <span className="italic text-muted-foreground/60">Pending acknowledgement</span>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{handoff.shiftType} shift</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {sbarSections.map((section) => (
          <div key={section.key} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold", section.color)}>
                {section.letter}
              </span>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{section.label}</span>
            </div>
            <p className="text-sm text-foreground/90 pl-7 leading-relaxed">{handoff[section.key]}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
