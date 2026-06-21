import { create } from "zustand";

interface AIAssistantState {
  open: boolean;
  patientId: string | null;
  patientName: string | null;
  /** Pre-seeded first message — auto-sent when the panel opens */
  initialMessage: string | null;

  /** Called by the patient chart page on mount to register the active patient */
  setActivePatient: (patientId: string | null, patientName?: string) => void;

  /** Open the panel (uses whichever patient is currently active) */
  openPanel: () => void;

  /** Open the panel pre-seeded with a context question */
  openWithContext: (patientId: string, patientName: string, message: string) => void;

  closePanel: () => void;
}

export const useAIAssistantStore = create<AIAssistantState>((set) => ({
  open: false,
  patientId: null,
  patientName: null,
  initialMessage: null,

  setActivePatient: (patientId, patientName) =>
    set({ patientId: patientId ?? null, patientName: patientName ?? null }),

  openPanel: () => set({ open: true, initialMessage: null }),

  openWithContext: (patientId, patientName, message) =>
    set({ open: true, patientId, patientName, initialMessage: message }),

  closePanel: () => set({ open: false, initialMessage: null }),
}));
