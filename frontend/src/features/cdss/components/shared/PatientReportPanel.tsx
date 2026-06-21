"use client";

import { useState } from "react";
import { FileText, RefreshCw, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { generatePatientReport } from "@/features/cdss/api";
import { useAuthStore } from "@/features/auth/stores/auth-store";

interface PatientReportPanelProps {
  patientId: string;
  className?: string;
}

/** Render MedGemma's Markdown-style section headers and bullet points. */
function ReportRenderer({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3
              key={i}
              className="mt-4 pb-1 border-b border-slate-700/50 text-[13px] font-semibold text-sky-300 first:mt-0"
            >
              {line.slice(3)}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="mt-2 text-[12px] font-semibold text-slate-200">
              {line.slice(4)}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          const content = line.slice(2);
          const isCritical = /\bCRITICAL\b/.test(content);
          const isWarning = /\bWARNING\b/.test(content);
          return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span
                className={cn(
                  "mt-1.5 size-1.5 shrink-0 rounded-full",
                  isCritical
                    ? "bg-red-400"
                    : isWarning
                      ? "bg-amber-400"
                      : "bg-slate-500",
                )}
              />
              <span
                className={cn(
                  "text-slate-300",
                  isCritical && "font-medium text-red-300",
                  isWarning && "font-medium text-amber-300",
                )}
              >
                {content}
              </span>
            </div>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-slate-300">
            {parts.map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j} className="font-semibold text-slate-100">
                  {part.slice(2, -2)}
                </strong>
              ) : (
                part
              ),
            )}
          </p>
        );
      })}
    </div>
  );
}

export function PatientReportPanel({ patientId, className }: PatientReportPanelProps) {
  const token = useAuthStore((state) => state.token);
  const [report, setReport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generatePatientReport(patientId, token);
      setReport(result.report);
      setGeneratedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate report.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border border-slate-800/70 bg-slate-950 text-slate-100",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/70 px-4 py-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-sky-400" />
          <span className="text-sm font-semibold">AI Clinical Report</span>
          {generatedAt && (
            <span className="text-[11px] text-slate-500">
              · generated {generatedAt.toLocaleTimeString()}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 border-slate-700 bg-slate-900 text-xs text-slate-300 hover:bg-slate-800"
          onClick={() => void handleGenerate()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {report ? "Regenerate" : "Generate Report"}
        </Button>
      </div>

      {/* Body */}
      <div className="flex-1">
        {!report && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <FileText className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm font-medium text-slate-400">No report generated yet</p>
            <p className="mt-1 text-xs text-slate-600">
              Click "Generate Report" to get a live NLP clinical summary from MedGemma
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-sky-500" />
            <p className="text-sm font-medium text-slate-400">MedGemma is writing the report…</p>
            <p className="mt-1 text-xs text-slate-600">This may take up to 60 seconds</p>
          </div>
        )}

        {error && !loading && (
          <div className="m-4 flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {report && !loading && (
          <ScrollArea className="h-[500px]">
            <div className="px-4 py-3">
              <ReportRenderer text={report} />
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
