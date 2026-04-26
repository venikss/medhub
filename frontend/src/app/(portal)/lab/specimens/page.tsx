"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SpecimenBadge } from "@/features/lab/components/SpecimenBadge";
import { listSpecimens } from "@/features/lab/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import type { Specimen, SpecimenStatus } from "@/types";
import { cn } from "@/lib/utils";

const statusSteps: SpecimenStatus[] = ["ordered", "collected", "in-transit", "received", "processing", "analyzed", "resulted"];
const statusFilters: ("all" | SpecimenStatus)[] = ["all", ...statusSteps, "rejected"];

function statusIndex(status: SpecimenStatus): number {
  return statusSteps.indexOf(status);
}

export default function SpecimenTrackingPage() {
  const token = useAuthStore((state) => state.token);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [specimens, setSpecimens] = useState<Specimen[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listSpecimens({}, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setSpecimens(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSpecimens([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filteredSpecimens = useMemo(
    () =>
      specimens
        .filter((specimen) => filter === "all" || specimen.status === filter)
        .filter((specimen) => {
          if (!search.trim()) return true;
          const query = search.toLowerCase();
          return specimen.barcode.toLowerCase().includes(query) || specimen.patientName.toLowerCase().includes(query);
        }),
    [filter, search, specimens],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Specimen Tracking</h1>
        <p className="text-sm text-muted-foreground mt-1">Lifecycle view from collection through final result</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input placeholder="Search by barcode or patient..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 h-10" />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {statusFilters.map((status) => (
            <button key={status} onClick={() => setFilter(status)} className={cn("px-2 py-1 rounded-full text-[10px] font-medium border transition-colors capitalize", filter === status ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 text-muted-foreground border-border/50 hover:bg-muted")}>
              {status.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {filteredSpecimens.length === 0 ? (
        <Card className="border-border/50"><CardContent className="py-12 text-center"><p className="text-sm text-muted-foreground">No specimens matching filter.</p></CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filteredSpecimens.map((specimen) => {
            const idx = statusIndex(specimen.status);
            return (
              <Card key={specimen.id} className={cn("border-border/50 shadow-sm", specimen.status === "rejected" && "border-red-500/40 bg-red-500/[0.02]")}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <SpecimenBadge barcode={specimen.barcode} status={specimen.status} specimenType={specimen.type} />
                      <span className="text-sm font-medium">{specimen.patientName}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {(specimen.testNames ?? []).join(", ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-0">
                    {statusSteps.map((step, index) => {
                      const isCompleted = idx >= index;
                      const isCurrent = idx === index;
                      return (
                        <div key={step} className="flex items-center flex-1">
                          <div className={cn(
                            "flex items-center justify-center h-6 w-6 rounded-full text-[9px] font-bold border-2 shrink-0",
                            isCompleted ? "bg-primary border-primary text-primary-foreground" : "border-border bg-muted text-muted-foreground",
                            isCurrent && "ring-2 ring-primary/30",
                          )}>
                            {isCompleted ? "OK" : index + 1}
                          </div>
                          {index < statusSteps.length - 1 && (
                            <div className={cn("flex-1 h-0.5 mx-1", isCompleted ? "bg-primary" : "bg-border")} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-1 px-0">
                    {statusSteps.map((step) => (
                      <span key={step} className="text-[8px] text-muted-foreground capitalize text-center flex-1">{step.replace("-", " ")}</span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
