import { create } from "zustand";

interface FrontDeskState {
    // Patient search
    searchQuery: string;
    setSearchQuery: (q: string) => void;

    // Selected patient for actions
    selectedPatientId: string | null;
    setSelectedPatientId: (id: string | null) => void;

    // Bed filter
    bedWardFilter: string | null;
    setBedWardFilter: (ward: string | null) => void;

    // Queue filter
    queueServiceFilter: string | null;
    setQueueServiceFilter: (service: string | null) => void;

    // Dialogs
    isAdmitDialogOpen: boolean;
    isTransferDialogOpen: boolean;
    isDischargeDialogOpen: boolean;
    openAdmitDialog: (patientId?: string) => void;
    openTransferDialog: (patientId?: string) => void;
    openDischargeDialog: (patientId?: string) => void;
    closeAllDialogs: () => void;
}

export const useFrontDeskStore = create<FrontDeskState>((set) => ({
    searchQuery: "",
    setSearchQuery: (q) => set({ searchQuery: q }),

    selectedPatientId: null,
    setSelectedPatientId: (id) => set({ selectedPatientId: id }),

    bedWardFilter: null,
    setBedWardFilter: (ward) => set({ bedWardFilter: ward }),

    queueServiceFilter: null,
    setQueueServiceFilter: (service) => set({ queueServiceFilter: service }),

    isAdmitDialogOpen: false,
    isTransferDialogOpen: false,
    isDischargeDialogOpen: false,
    openAdmitDialog: (patientId) => set({ isAdmitDialogOpen: true, selectedPatientId: patientId ?? null }),
    openTransferDialog: (patientId) => set({ isTransferDialogOpen: true, selectedPatientId: patientId ?? null }),
    openDischargeDialog: (patientId) => set({ isDischargeDialogOpen: true, selectedPatientId: patientId ?? null }),
    closeAllDialogs: () => set({ isAdmitDialogOpen: false, isTransferDialogOpen: false, isDischargeDialogOpen: false }),
}));
