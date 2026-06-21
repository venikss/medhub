"use client";

import { BrainCircuit } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PatientChatPanel } from "@/features/cdss/components/shared/PatientChatPanel";
import { useAIAssistantStore } from "@/features/ai-assistant/store";

export function AIAssistantFloating() {
  const open = useAIAssistantStore((s) => s.open);
  const patientId = useAIAssistantStore((s) => s.patientId);
  const patientName = useAIAssistantStore((s) => s.patientName);
  const initialMessage = useAIAssistantStore((s) => s.initialMessage);
  const openPanel = useAIAssistantStore((s) => s.openPanel);
  const closePanel = useAIAssistantStore((s) => s.closePanel);

  return (
    <>
      {/* Floating trigger button — always visible in the portal */}
      <button
        onClick={() => (open ? closePanel() : openPanel())}
        title={patientId ? "Open AI Assistant" : "Open a patient chart to use the AI Assistant"}
        className="fixed bottom-6 right-6 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-3 shadow-lg ring-2 ring-primary/20 transition-all hover:scale-105 hover:bg-primary/90 active:scale-95"
        aria-label="AI Assistant"
      >
        <BrainCircuit className="h-5 w-5 text-primary-foreground" />
      </button>

      {/* Right-side sheet drawer */}
      <Sheet open={open} onOpenChange={(o) => { if (!o) closePanel(); }}>
        <SheetContent
          side="right"
          className="flex w-[440px] flex-col p-0 sm:w-[480px] [&>button]:hidden"
        >
          <SheetHeader className="border-b px-4 py-3">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
              <BrainCircuit className="h-4 w-4 text-primary" />
              MedGemma AI Assistant
            </SheetTitle>
          </SheetHeader>

          {patientId ? (
            <PatientChatPanel
              key={`${patientId}-${initialMessage ?? "open"}`}
              patientId={patientId}
              patientName={patientName ?? undefined}
              initialMessage={initialMessage ?? undefined}
              className="flex-1 rounded-none border-0"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <BrainCircuit className="h-10 w-10 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground">
                Open a patient chart to start a conversation grounded in their clinical data.
              </p>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
