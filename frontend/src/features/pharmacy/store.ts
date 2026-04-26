import { create } from "zustand";

type QueueFilter = "all" | "ordered" | "pending-verification" | "verified" | "dispensing" | "dispensed";
type SettingFilter = "all" | "inpatient" | "outpatient" | "discharge";

interface PharmacyState {
  queueFilter: QueueFilter;
  settingFilter: SettingFilter;
  selectedRxId: string | null;
  formularySearch: string;
  showDispensePanel: boolean;

  setQueueFilter: (f: QueueFilter) => void;
  setSettingFilter: (f: SettingFilter) => void;
  setSelectedRx: (id: string | null) => void;
  setFormularySearch: (q: string) => void;
  toggleDispensePanel: () => void;
}

export const usePharmacyStore = create<PharmacyState>((set) => ({
  queueFilter: "all",
  settingFilter: "all",
  selectedRxId: null,
  formularySearch: "",
  showDispensePanel: false,

  setQueueFilter: (f) => set({ queueFilter: f }),
  setSettingFilter: (f) => set({ settingFilter: f }),
  setSelectedRx: (id) => set({ selectedRxId: id }),
  setFormularySearch: (q) => set({ formularySearch: q }),
  toggleDispensePanel: () => set((s) => ({ showDispensePanel: !s.showDispensePanel })),
}));
