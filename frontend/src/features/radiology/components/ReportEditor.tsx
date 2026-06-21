"use client";

import dynamic from "next/dynamic";
import { useState, useRef, useEffect, useCallback } from "react";
import { SaveIcon, Send, FileCheck, PenLine, ChevronDown, ChevronUp, History, ScanLine, BrainCircuit, UploadCloud, Check, CheckCheck, X, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ModalityBadge } from "./ModalityBadge";
import { getDicomFileUrl, analyzeDicomStudy, listDicomSeries, type DicomAnalysisResult } from "../api";
import type { DicomSeries, RadiologyReport, PriorStudy } from "@/types";
import { useAuthStore } from "@/features/auth/stores/auth-store";

const DicomViewer = dynamic(
  () => import("./DicomViewer").then((m) => ({ default: m.DicomViewer })),
  { ssr: false, loading: () => (
    <div className="flex items-center justify-center h-[460px] bg-zinc-950 rounded-lg">
      <span className="text-xs text-zinc-500">Loading viewer…</span>
    </div>
  )},
);

const STATUS_STYLES: Record<string, string> = {
  draft:       "bg-slate-100 text-slate-700",
  preliminary: "bg-amber-100 text-amber-700",
  final:       "bg-emerald-100 text-emerald-700",
  amended:     "bg-cyan-100 text-cyan-700",
  addendum:    "bg-purple-100 text-purple-700",
};

interface ReportEditorProps {
  report: RadiologyReport;
  priorStudies?: PriorStudy[];
  readOnly?: boolean;
  /** ImagingStudy UUID — enables DICOM viewer and AI analysis */
  studyId?: string;
  onSaveDraft?: (id: string, data: Partial<RadiologyReport>) => void;
  onSignPreliminary?: (id: string) => void;
  onSign?: (id: string) => void;
  className?: string;
}

export function ReportEditor({
  report,
  priorStudies = [],
  readOnly = false,
  studyId,
  onSaveDraft,
  onSignPreliminary,
  onSign,
  className,
}: ReportEditorProps) {
  const [technique, setTechnique]           = useState(report.technique);
  const [comparison, setComparison]         = useState(report.comparison ?? "");
  const [findings, setFindings]             = useState(report.findings);
  const [impression, setImpression]         = useState(report.impression);
  const [recommendations, setRecommendations] = useState(report.recommendations ?? "");
  const [showPriors, setShowPriors]         = useState(false);

  const [activeTab, setActiveTab]           = useState<"report" | "dicom">("report");
  const [analysing, setAnalysing]           = useState(false);
  const [aiAlerts, setAiAlerts]             = useState<string | null>(null);
  const [aiError, setAiError]               = useState<string | null>(null);
  const [viewerFiles, setViewerFiles]       = useState<File[] | null>(null);
  const [aiSuggestion, setAiSuggestion]     = useState<DicomAnalysisResult | null>(null);
  const [showAiSuggestion, setShowAiSuggestion] = useState(false);
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const token                               = useAuthStore((s) => s.token);

  const [series, setSeries]                 = useState<DicomSeries[]>([]);
  const [selectedSeriesId, setSelectedSeriesId] = useState<string | null>(null);
  const [loadingSeries, setLoadingSeries]   = useState(false);

  const fetchSeries = useCallback(() => {
    if (!studyId) return;
    setLoadingSeries(true);
    listDicomSeries(studyId, token)
      .then((data) => {
        setSeries(data);
        if (data.length > 0 && !selectedSeriesId) {
          setSelectedSeriesId(data[0].id);
        }
      })
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingSeries(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [studyId, token]);

  useEffect(() => {
    if (activeTab === "dicom") fetchSeries();
  }, [activeTab, fetchSeries]);

  const pacsUrl  = (report as any).pacsUrl as string | undefined;
  const hasDicom = !!studyId;

  const selectedSeries = series.find((s) => s.id === selectedSeriesId) ?? null;
  const viewerBlobFiles = viewerFiles ?? undefined;
  const viewerProxyUrl = (!viewerFiles && !selectedSeries && pacsUrl && studyId)
    ? getDicomFileUrl(studyId)
    : undefined;

  const isFinalised = report.status === "final" || report.status === "amended";
  const isEditable  = !readOnly && !isFinalised;

  function handleSave() {
    onSaveDraft?.(report.id, { technique, comparison, findings, impression, recommendations });
  }

  /** Store AI result as a suggestion panel — does NOT auto-fill the report */
  function handleAiResult(result: DicomAnalysisResult) {
    if (result.alerts) setAiAlerts(result.alerts);
    setAiSuggestion(result);
    setShowAiSuggestion(true);
    setActiveTab("report");
  }

  function applySuggestionField(field: "technique" | "comparison" | "findings" | "impression" | "recommendations") {
    if (!aiSuggestion) return;
    if (field === "technique" && aiSuggestion.technique)           setTechnique(aiSuggestion.technique);
    if (field === "comparison" && aiSuggestion.comparison)         setComparison(aiSuggestion.comparison);
    if (field === "findings" && aiSuggestion.findings)             setFindings(aiSuggestion.findings);
    if (field === "impression" && aiSuggestion.impression)         setImpression(aiSuggestion.impression);
    if (field === "recommendations" && aiSuggestion.recommendations) setRecommendations(aiSuggestion.recommendations);
  }

  function applyAllSuggestions() {
    if (!aiSuggestion) return;
    if (aiSuggestion.technique)       setTechnique(aiSuggestion.technique);
    if (aiSuggestion.comparison)      setComparison(aiSuggestion.comparison);
    if (aiSuggestion.findings)        setFindings(aiSuggestion.findings);
    if (aiSuggestion.impression)      setImpression(aiSuggestion.impression);
    if (aiSuggestion.recommendations) setRecommendations(aiSuggestion.recommendations);
    setShowAiSuggestion(false);
  }

  async function handleAnalyse(files?: File | File[]) {
    if (!studyId) return;

    if (files) {
      const fileList = Array.isArray(files) ? files : [files];
      if (fileList.length > 0) {
        setViewerFiles(fileList);
        setActiveTab("dicom");
      }
    }

    const filesToAnalyse: File | File[] | undefined = files ?? (viewerFiles ?? undefined);

    setAnalysing(true);
    setAiError(null);
    try {
      const seriesIdForAnalysis = !filesToAnalyse ? (selectedSeriesId ?? undefined) : undefined;
      const result = await analyzeDicomStudy(studyId, filesToAnalyse, seriesIdForAnalysis);
      handleAiResult(result);
      if (files) {
        fetchSeries();
        if (result.seriesId) setSelectedSeriesId(result.seriesId);
      }
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "AI analysis failed.");
    } finally {
      setAnalysing(false);
    }
  }

  return (
    <Card className={cn("h-full flex flex-col overflow-hidden", className)}>
      {/* Header */}
      <CardHeader className="pb-3 border-b">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <ModalityBadge modality={report.modality} />
              <CardTitle className="text-base">{report.examName}</CardTitle>
              <Badge
                variant="secondary"
                className={cn("capitalize", STATUS_STYLES[report.status])}
              >
                {report.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {report.patientName} · {report.mrn} · {report.examDate}
            </p>
            <p className="text-xs text-muted-foreground">
              Acc#: {report.accessionNumber} · Radiologist: {report.radiologist}
            </p>
          </div>
          {/* Actions */}
          {isEditable && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={handleSave}>
                <SaveIcon className="h-3.5 w-3.5" />
                Save Draft
              </Button>
              {report.status === "draft" && onSignPreliminary && (
                <Button size="sm" variant="secondary" className="gap-1" onClick={() => onSignPreliminary(report.id)}>
                  <Send className="h-3.5 w-3.5" />
                  Release Prelim
                </Button>
              )}
              {(report.status === "preliminary" || report.status === "draft") && onSign && (
                <Button size="sm" className="gap-1" onClick={() => onSign(report.id)}>
                  <FileCheck className="h-3.5 w-3.5" />
                  Sign Final
                </Button>
              )}
              {report.status === "final" && (
                <Button size="sm" variant="outline" className="gap-1">
                  <PenLine className="h-3.5 w-3.5" />
                  Addendum
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-3 pt-1 border-t">
          <button
            type="button"
            onClick={() => setActiveTab("report")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-colors",
              activeTab === "report"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
          >
            Report
          </button>
          {hasDicom && (
            <button
              type="button"
              onClick={() => setActiveTab("dicom")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1 text-xs rounded-md font-medium transition-colors",
                activeTab === "dicom"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <ScanLine className="h-3 w-3" />
              DICOM Viewer
            </button>
          )}
          {/* AI Analyse button — always visible when studyId present */}
          {studyId && isEditable && (
            <div className="ml-auto flex items-center gap-1">
              {/* Upload + analyse */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    handleAnalyse(Array.from(files));
                  }
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-xs"
                disabled={analysing}
                onClick={() => fileInputRef.current?.click()}
                title="Select one or more DICOM files (.dcm) to generate an AI report draft"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                {analysing ? "Analysing…" : "Upload DICOM"}
              </Button>
              {/* Analyse from loaded or stored files */}
              {(hasDicom || viewerFiles || series.length > 0) && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="gap-1 text-xs"
                  disabled={analysing}
                  onClick={() => handleAnalyse()}
                  title={
                    viewerFiles
                      ? `Re-analyse ${viewerFiles.length} loaded file(s)`
                      : selectedSeries
                        ? `Re-analyse Series ${selectedSeries.seriesNumber} (${selectedSeries.sliceCount} slices)`
                        : "AI report draft from stored DICOM"
                  }
                >
                  <BrainCircuit className="h-3.5 w-3.5" />
                  {analysing
                    ? "Analysing…"
                    : viewerFiles
                      ? `AI Analyse (${viewerFiles.length} file${viewerFiles.length > 1 ? "s" : ""})`
                      : selectedSeries
                        ? `AI Analyse · Series ${selectedSeries.seriesNumber}`
                        : "AI Analyse"}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Error banner */}
        {aiError && (
          <div className="mt-2 rounded bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive flex justify-between">
            <span>{aiError}</span>
            <button type="button" onClick={() => setAiError(null)} className="ml-2 font-bold">×</button>
          </div>
        )}

        {/* AI clinical alerts banner */}
        {aiAlerts && (
          <div className="mt-2 rounded bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex justify-between">
            <span><strong>AI Clinical Alerts:</strong> {aiAlerts}</span>
            <button type="button" onClick={() => setAiAlerts(null)} className="ml-2 font-bold">×</button>
          </div>
        )}
      </CardHeader>

      {/* Body */}
      <CardContent className="flex-1 overflow-hidden pt-4">

        {/* ── DICOM Viewer tab ─────────────────────────────────────────── */}
        {activeTab === "dicom" && (
          <div className="flex gap-3 h-full overflow-hidden">
            {/* Series history sidebar */}
            <div className="w-52 shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
              <div className="flex items-center gap-1.5 mb-1">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Scan History</span>
                {loadingSeries && <span className="text-[10px] text-muted-foreground animate-pulse ml-auto">loading…</span>}
              </div>

              {series.length === 0 && !loadingSeries && (
                <p className="text-xs text-zinc-400 italic">No scans uploaded yet.</p>
              )}

              {series.map((s) => {
                const isActive = s.id === selectedSeriesId && !viewerFiles;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedSeriesId(s.id); setViewerFiles(null); }}
                    className={cn(
                      "w-full text-left rounded-lg border p-2 text-xs transition-colors",
                      isActive
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-input bg-background hover:bg-muted/40 text-foreground",
                    )}
                  >
                    <div className="font-semibold">Series {s.seriesNumber}</div>
                    {s.description && <div className="text-muted-foreground truncate">{s.description}</div>}
                    <div className="text-muted-foreground">{s.sliceCount} slice{s.sliceCount !== 1 ? "s" : ""} · {s.modality ?? "—"}</div>
                    <div className="text-muted-foreground tabular-nums">{new Date(s.uploadedAt).toLocaleDateString()}</div>
                    {s.uploadedByName && <div className="text-muted-foreground truncate">{s.uploadedByName}</div>}
                  </button>
                );
              })}

              {viewerFiles && (
                <div className="rounded-lg border border-violet-300 bg-violet-50 p-2 text-xs">
                  <div className="font-semibold text-violet-700">Current session</div>
                  <div className="text-violet-600">{viewerFiles.length} file{viewerFiles.length !== 1 ? "s" : ""} loaded</div>
                  <button
                    type="button"
                    className="mt-1 text-[10px] text-violet-500 underline"
                    onClick={() => setViewerFiles(null)}
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-hidden">
              {viewerBlobFiles ? (
                <DicomViewer
                  blobFiles={viewerBlobFiles}
                  modality={report.modality}
                  className="w-full"
                />
              ) : selectedSeries && selectedSeries.files.length > 0 ? (
                <DicomViewer
                  blobFiles={undefined}
                  dicomUrl={undefined}
                  seriesFileUrls={selectedSeries.files.map((f) => f.fileUrl)}
                  modality={report.modality}
                  className="w-full"
                />
              ) : viewerProxyUrl ? (
                <DicomViewer
                  dicomUrl={viewerProxyUrl}
                  modality={report.modality}
                  className="w-full"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-[460px] rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 gap-3">
                  <ScanLine className="h-10 w-10 text-zinc-400" />
                  <p className="text-sm text-zinc-500 font-medium">No DICOM images loaded</p>
                  <p className="text-xs text-zinc-400">Upload a DICOM file or select a scan from the history</p>
                  {isEditable && (
                    <Button size="sm" variant="outline" className="gap-1.5 mt-1" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud className="h-3.5 w-3.5" />
                      Upload DICOM
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Report tab ───────────────────────────────────────────────── */}
        {activeTab === "report" && (
          <div className="space-y-4 overflow-y-auto h-full">
            {/* Indication (read-only) */}
            <div className="space-y-1">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Clinical History / Indication</Label>
              <p className="rounded bg-muted/50 p-2 text-sm">{report.indication}</p>
            </div>

            {/* ── AI Suggestion Panel ─────────────────────────────────── */}
            {aiSuggestion && showAiSuggestion && isEditable && (
              <div className="rounded-lg border border-violet-200 bg-violet-50/60 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-violet-600" />
                    <span className="text-xs font-semibold text-violet-700">AI Draft Suggestion</span>
                    <span className="text-[10px] rounded-full bg-violet-100 text-violet-600 border border-violet-200 px-1.5 py-0.5 font-medium">
                      {aiSuggestion.aiSource === "dicom_vision" ? "Vision" : "Metadata"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px] gap-1 border-violet-300 text-violet-700 hover:bg-violet-100"
                      onClick={applyAllSuggestions}
                    >
                      <CheckCheck className="h-3 w-3" />
                      Apply All
                    </Button>
                    <button
                      type="button"
                      onClick={() => setShowAiSuggestion(false)}
                      className="ml-1 p-0.5 rounded hover:bg-violet-100 text-violet-400 hover:text-violet-600"
                      title="Dismiss suggestion"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {([
                  { field: "technique",       label: "Technique",       value: aiSuggestion.technique },
                  { field: "comparison",      label: "Comparison",      value: aiSuggestion.comparison },
                  { field: "findings",        label: "Findings",        value: aiSuggestion.findings },
                  { field: "impression",      label: "Impression",      value: aiSuggestion.impression },
                  { field: "recommendations", label: "Recommendations", value: aiSuggestion.recommendations },
                ] as const).filter((f) => f.value).map(({ field, label, value }) => (
                  <div key={field} className="rounded border border-violet-200 bg-white p-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wide font-semibold text-violet-600">{label}</span>
                      <button
                        type="button"
                        onClick={() => applySuggestionField(field)}
                        className="flex items-center gap-0.5 text-[10px] font-medium text-violet-700 hover:text-violet-900 hover:bg-violet-50 rounded px-1.5 py-0.5"
                      >
                        <Check className="h-2.5 w-2.5" />
                        Apply
                      </button>
                    </div>
                    <p className="text-xs text-zinc-700 whitespace-pre-wrap leading-relaxed line-clamp-4">{value}</p>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* Technique */}
            <div className="space-y-1">
              <Label htmlFor="technique" className="text-xs uppercase tracking-wide text-muted-foreground">Technique</Label>
              {isEditable ? (
                <Textarea
                  id="technique"
                  value={technique}
                  onChange={(e) => setTechnique(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{technique}</p>
              )}
            </div>

            {/* Comparison */}
            <div className="space-y-1">
              <Label htmlFor="comparison" className="text-xs uppercase tracking-wide text-muted-foreground">Comparison</Label>
              {isEditable ? (
                <Textarea
                  id="comparison"
                  value={comparison}
                  onChange={(e) => setComparison(e.target.value)}
                  rows={1}
                  className="text-sm resize-none"
                  placeholder="No prior studies available."
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{comparison || "—"}</p>
              )}
            </div>

            <Separator />

            {/* Findings */}
            <div className="space-y-1">
              <Label htmlFor="findings" className="text-xs uppercase tracking-wide text-muted-foreground">Findings</Label>
              {isEditable ? (
                <Textarea
                  id="findings"
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  rows={6}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{findings}</p>
              )}
            </div>

            {/* Impression */}
            <div className="space-y-1">
              <Label htmlFor="impression" className="text-xs uppercase tracking-wide text-muted-foreground">Impression</Label>
              {isEditable ? (
                <Textarea
                  id="impression"
                  value={impression}
                  onChange={(e) => setImpression(e.target.value)}
                  rows={4}
                  className="text-sm"
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{impression}</p>
              )}
            </div>

            {/* Recommendations */}
            <div className="space-y-1">
              <Label htmlFor="recommendations" className="text-xs uppercase tracking-wide text-muted-foreground">Recommendations</Label>
              {isEditable ? (
                <Textarea
                  id="recommendations"
                  value={recommendations}
                  onChange={(e) => setRecommendations(e.target.value)}
                  rows={2}
                  className="text-sm resize-none"
                  placeholder="Optional follow-up recommendation..."
                />
              ) : (
                <p className="text-sm whitespace-pre-wrap">{recommendations || "—"}</p>
              )}
            </div>

            {/* Addendum */}
            {report.addendum && (
              <>
                <Separator />
                <div className="space-y-1">
                  <Label className="text-xs uppercase tracking-wide text-amber-600">Addendum</Label>
                  <p className="text-xs text-muted-foreground">
                    By {report.addendumBy}{report.addendumAt ? ` · ${new Date(report.addendumAt).toLocaleString()}` : ""}
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{report.addendum}</p>
                </div>
              </>
            )}

            {/* Prior Studies */}
            {priorStudies.length > 0 && (
              <>
                <Separator />
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPriors((p) => !p)}
                  >
                    <History className="h-3 w-3" />
                    Prior Studies ({priorStudies.length})
                    {showPriors ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </button>
                  {showPriors && (
                    <div className="mt-2 space-y-2">
                      {priorStudies.map((ps) => (
                        <div key={ps.id} className="rounded border p-2 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold">{ps.examName}</span>
                            <span className="text-muted-foreground">{ps.examDate}</span>
                            <span className="text-muted-foreground">· {ps.radiologist}</span>
                          </div>
                          {ps.impression && (
                            <p className="text-muted-foreground italic">{ps.impression}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

