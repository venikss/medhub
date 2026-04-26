"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { StudyCard } from "@/features/radiology/components/StudyCard";
import { StudyStatusPipeline } from "@/features/radiology/components/StudyStatusPipeline";
import { ModalityBadge } from "@/features/radiology/components/ModalityBadge";
import { listImagingStudies, listPriorStudies, updateStudyStatus, createRadiologyReport } from "@/features/radiology/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ImagingModality, ImagingStudy, PriorStudy } from "@/types";
import { cn } from "@/lib/utils";

const MODALITIES: (ImagingModality | "all")[] = ["all", "XR", "CT", "MRI", "US", "NM", "PET"];
const READ_STATUSES: ImagingStudy["status"][] = ["acquired", "reading", "reported"];

export default function WorklistPage() {
  const token = useAuthStore((state) => state.token);
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [modality, setModality] = useState<ImagingModality | "all">("all");
  const [showAll, setShowAll] = useState(false);
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [priors, setPriors] = useState<PriorStudy[]>([]);

  useEffect(() => {
    let cancelled = false;

    void listImagingStudies({}, token ?? undefined)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setStudies(data);
        setSelectedId(
          data.find((study) => study.status === "acquired" || study.status === "reading")?.id ??
            data[0]?.id ??
            "",
        );
      })
      .catch(() => {
        if (!cancelled) {
          setStudies([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  const filtered = useMemo(() => {
    return studies.filter((study) => {
      const loweredQuery = query.toLowerCase();
      const matchQuery =
        !loweredQuery ||
        study.patientName.toLowerCase().includes(loweredQuery) ||
        study.examName.toLowerCase().includes(loweredQuery) ||
        study.accessionNumber.toLowerCase().includes(loweredQuery);
      const matchModality = modality === "all" || study.modality === modality;
      const matchStatus = showAll || READ_STATUSES.includes(study.status);

      return matchQuery && matchModality && matchStatus;
    });
  }, [modality, query, showAll, studies]);

  const selected = studies.find((study) => study.id === selectedId) ?? null;
  const visiblePriors = selected?.id ? priors : [];

  async function handleAdvanceStatus(newStatus: string) {
    if (!selected) return;
    try {
      const updated = await updateStudyStatus(selected.id, newStatus, token ?? undefined);
      setStudies((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));

      // When advancing to "reading", auto-create a draft report and navigate
      if (newStatus === "reading") {
        try {
          const report = await createRadiologyReport(
            { studyId: selected.id, indication: selected.clinicalHistory || "" },
            token ?? undefined,
          );
          router.push(`/radiology/reports?reportId=${report.id}`);
        } catch {
          // Report may already exist; navigate using the study's existing reportId
          if (updated.reportId) {
            router.push(`/radiology/reports?reportId=${updated.reportId}`);
          }
        }
      }
    } catch (err: any) {
      alert(err?.message ?? "Failed to update status");
    }
  }

  const nextAction = selected
    ? {
        arrived: { label: "Begin Exam", next: "in-progress" },
        "in-progress": { label: "Mark Acquired", next: "acquired" },
        acquired: { label: "Begin Reading", next: "reading" },
      }[selected.status] ?? null
    : null;

  useEffect(() => {
    if (!selected?.id) {
      return;
    }

    let cancelled = false;

    void listPriorStudies(selected.id, token ?? undefined)
      .then((data) => {
        if (!cancelled) {
          setPriors(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPriors([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selected?.id, token]);

  return (
    <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden p-4 pt-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Modality Worklist</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length} studies
          {!showAll && " awaiting read"}
        </p>
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
          {MODALITIES.map((value) => (
            <button
              key={value}
              onClick={() => setModality(value)}
              className={cn(
                "rounded border px-2.5 py-1 text-xs font-semibold transition-colors",
                modality === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background text-muted-foreground hover:bg-muted",
              )}
            >
              {value === "all" ? "All" : value}
            </button>
          ))}
        </div>
        <Button
          variant={showAll ? "secondary" : "outline"}
          size="sm"
          onClick={() => setShowAll((previous) => !previous)}
        >
          {showAll ? "Pending only" : "Show all"}
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="flex w-full max-w-md flex-col gap-2 overflow-y-auto pr-1">
          {filtered.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No studies match filters.</p>
          ) : (
            filtered.map((study) => (
              <StudyCard
                key={study.id}
                study={study}
                selected={selected?.id === study.id}
                onClick={() => setSelectedId(study.id)}
              />
            ))
          )}
        </div>

        <Separator orientation="vertical" />

        {selected ? (
          <div className="flex-1 overflow-y-auto">
            <Card className="h-full">
              <CardContent className="space-y-4 p-4">
                <div className="flex items-start gap-3">
                  <ModalityBadge modality={selected.modality} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{selected.patientName}</p>
                    <p className="text-sm text-muted-foreground">{selected.mrn}</p>
                    <p className="mt-0.5 text-sm font-medium">{selected.examName}</p>
                    <p className="text-xs text-muted-foreground">Acc#: {selected.accessionNumber}</p>
                  </div>
                  {selected.hasCritical && (
                    <Badge variant="destructive" className="shrink-0">
                      CRITICAL
                    </Badge>
                  )}
                </div>

                <div className="overflow-x-auto pb-1">
                  <StudyStatusPipeline status={selected.status} />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {[
                    { label: "Room", value: selected.room ?? "-" },
                    {
                      label: "Date / Time",
                      value: selected.examDate
                        ? `${new Date(selected.examDate).toLocaleDateString()} - ${selected.examTime ?? new Date(selected.examDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "-",
                    },
                    { label: "Technologist", value: selected.technologist ?? "-" },
                    { label: "Radiologist", value: selected.radiologist ?? "-" },
                    {
                      label: "Images",
                      value:
                        selected.imagesCount !== undefined
                          ? `${selected.imagesCount} images / ${selected.seriesCount} series`
                          : "-",
                    },
                    { label: "Priority", value: selected.priority },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="font-medium capitalize">{value}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted-foreground">
                    Clinical History
                  </p>
                  <p className="rounded bg-muted/50 p-2 text-sm">{selected.clinicalHistory}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {nextAction && (
                    <Button
                      className="flex-1 gap-2"
                      onClick={() => void handleAdvanceStatus(nextAction.next)}
                    >
                      {nextAction.label}
                    </Button>
                  )}
                  {selected.status === "reading" && selected.reportId && (
                    <Button className="flex-1 gap-2" asChild>
                      <Link href={`/radiology/reports?reportId=${selected.reportId}`}>Open Report Editor</Link>
                    </Button>
                  )}
                  <Button className="gap-2" variant="secondary">
                    <ExternalLink className="h-4 w-4" />
                    Open in PACS Viewer (Demo)
                  </Button>
                </div>

                {visiblePriors.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                        Prior Studies for {selected.patientName}
                      </p>
                      <div className="space-y-2">
                        {visiblePriors.map((prior) => (
                          <div key={prior.id} className="space-y-0.5 rounded border p-2 text-xs">
                            <div className="flex items-center gap-2">
                              <ModalityBadge modality={prior.modality} />
                              <span className="font-medium">{prior.examName}</span>
                              <span className="text-muted-foreground">{prior.examDate}</span>
                            </div>
                            {prior.impression && (
                              <p className="pl-1 italic text-muted-foreground">{prior.impression}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Select a study to view details.
          </div>
        )}
      </div>
    </div>
  );
}
