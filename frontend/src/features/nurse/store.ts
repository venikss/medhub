import { create } from "zustand";

type ShiftType = "day" | "evening" | "night";
type TaskFilter = "all" | "overdue" | "pending" | "completed";
type FlowsheetTab = "vitals" | "io" | "pain";

interface NurseState {
  selectedPatientId: string | null;
  activeWard: string;
  currentShift: ShiftType;
  taskFilter: TaskFilter;
  flowsheetTab: FlowsheetTab;
  showNoteEditor: boolean;
  showVitalsForm: boolean;

  setSelectedPatient: (id: string | null) => void;
  setActiveWard: (ward: string) => void;
  setCurrentShift: (shift: ShiftType) => void;
  setTaskFilter: (filter: TaskFilter) => void;
  setFlowsheetTab: (tab: FlowsheetTab) => void;
  toggleNoteEditor: () => void;
  toggleVitalsForm: () => void;
}

export const useNurseStore = create<NurseState>((set) => ({
  selectedPatientId: null,
  activeWard: "Ward A",
  currentShift: "day",
  taskFilter: "all",
  flowsheetTab: "vitals",
  showNoteEditor: false,
  showVitalsForm: false,

  setSelectedPatient: (id) => set({ selectedPatientId: id }),
  setActiveWard: (ward) => set({ activeWard: ward }),
  setCurrentShift: (shift) => set({ currentShift: shift }),
  setTaskFilter: (filter) => set({ taskFilter: filter }),
  setFlowsheetTab: (tab) => set({ flowsheetTab: tab }),
  toggleNoteEditor: () => set((s) => ({ showNoteEditor: !s.showNoteEditor })),
  toggleVitalsForm: () => set((s) => ({ showVitalsForm: !s.showVitalsForm })),
}));
