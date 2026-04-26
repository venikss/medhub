"use client";

import { ExternalLink, BookOpen, FileText, Database, BrainCircuit, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { SOURCE_COLORS, SOURCE_TYPE_LABELS } from "@/features/cdss/constants";
import type { CDSSEvidenceSource, CDSSEvidenceSourceType } from "@/types";

const SOURCE_ICONS: Record<CDSSEvidenceSourceType, React.ElementType> = {
  guideline:     BookOpen,
  drug_database: Database,
  literature:    FileText,
  ai_model:      BrainCircuit,
  ehr_pattern:   FlaskConical,
};

interface EvidenceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  sources: CDSSEvidenceSource[];
}

/**
 * Slide-over Sheet for displaying evidence sources.
 * Can be triggered from any module — completely store-free.
 */
export function EvidenceDrawer({ open, onOpenChange, title, sources }: EvidenceDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-md">
        <SheetHeader>
          <SheetTitle className="text-base font-semibold leading-snug">Evidence Sources</SheetTitle>
          {title && (
            <SheetDescription className="text-xs text-muted-foreground line-clamp-2">
              {title}
            </SheetDescription>
          )}
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-130px)] pr-1">
          <div className="space-y-4">
            {sources.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No evidence sources linked to this recommendation.
              </p>
            )}
            {sources.map((src) => {
              const Icon = SOURCE_ICONS[src.sourceType] ?? FileText;
              return (
                <div key={src.id} className="rounded-xl border border-border/50 p-4 space-y-2.5">
                  <div className="flex items-start gap-2">
                    <Icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{src.shortName}</span>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] border", SOURCE_COLORS[src.sourceType])}
                        >
                          {SOURCE_TYPE_LABELS[src.sourceType]}
                        </Badge>
                        {src.evidenceGrade && (
                          <Badge variant="outline" className="text-[10px] border border-border/40 text-muted-foreground">
                            {src.evidenceGrade}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{src.title}</p>
                      {src.publishedYear && (
                        <p className="text-[10px] text-muted-foreground/50 mt-0.5">{src.publishedYear}</p>
                      )}
                    </div>
                    {src.url && (
                      <a
                        href={src.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary shrink-0"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                  {src.excerpt && (
                    <p className="text-xs text-muted-foreground/80 italic border-l-2 border-border/40 pl-3 leading-relaxed">
                      &quot;{src.excerpt}&quot;
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
