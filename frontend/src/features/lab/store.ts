import { create } from "zustand";

type WorklistFilter = "all" | "pending" | "in-progress" | "completed" | "stat";
type SpecimenView = "all" | "ordered" | "collected" | "received" | "processing" | "analyzed" | "resulted";

interface LabState {
  worklistFilter: WorklistFilter;
  specimenView: SpecimenView;
  selectedSpecimenId: string | null;
  selectedPanelId: string | null;
  showResultEntry: boolean;
  showVerification: boolean;

  setWorklistFilter: (f: WorklistFilter) => void;
  setSpecimenView: (v: SpecimenView) => void;
  setSelectedSpecimen: (id: string | null) => void;
  setSelectedPanel: (id: string | null) => void;
  toggleResultEntry: () => void;
  toggleVerification: () => void;
}

export const useLabStore = create<LabState>((set) => ({
  worklistFilter: "all",
  specimenView: "all",
  selectedSpecimenId: null,
  selectedPanelId: null,
  showResultEntry: false,
  showVerification: false,

  setWorklistFilter: (f) => set({ worklistFilter: f }),
  setSpecimenView: (v) => set({ specimenView: v }),
  setSelectedSpecimen: (id) => set({ selectedSpecimenId: id }),
  setSelectedPanel: (id) => set({ selectedPanelId: id }),
  toggleResultEntry: () => set((s) => ({ showResultEntry: !s.showResultEntry })),
  toggleVerification: () => set((s) => ({ showVerification: !s.showVerification })),
}));
