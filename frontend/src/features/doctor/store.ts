import { create } from "zustand";

interface DoctorState {
    // Selected patient for chart view
    selectedPatientId: string | null;
    setSelectedPatientId: (id: string | null) => void;

    // Chart active tab
    chartTab: "summary" | "notes" | "orders" | "medications" | "results";
    setChartTab: (tab: DoctorState["chartTab"]) => void;

    // Encounter editor state
    isNoteEditorOpen: boolean;
    editingEncounterId: string | null;
    openNoteEditor: (encounterId?: string) => void;
    closeNoteEditor: () => void;

    // Order composer state
    isOrderComposerOpen: boolean;
    orderPatientId: string | null;
    openOrderComposer: (patientId?: string) => void;
    closeOrderComposer: () => void;

    // Prescriptions
    isPrescriptionWriterOpen: boolean;
    prescriptionPatientId: string | null;
    openPrescriptionWriter: (patientId?: string) => void;
    closePrescriptionWriter: () => void;
}

export const useDoctorStore = create<DoctorState>((set) => ({
    selectedPatientId: null,
    setSelectedPatientId: (id) => set({ selectedPatientId: id }),

    chartTab: "summary",
    setChartTab: (tab) => set({ chartTab: tab }),

    isNoteEditorOpen: false,
    editingEncounterId: null,
    openNoteEditor: (encounterId) => set({ isNoteEditorOpen: true, editingEncounterId: encounterId ?? null }),
    closeNoteEditor: () => set({ isNoteEditorOpen: false, editingEncounterId: null }),

    isOrderComposerOpen: false,
    orderPatientId: null,
    openOrderComposer: (patientId) => set({ isOrderComposerOpen: true, orderPatientId: patientId ?? null }),
    closeOrderComposer: () => set({ isOrderComposerOpen: false }),

    isPrescriptionWriterOpen: false,
    prescriptionPatientId: null,
    openPrescriptionWriter: (patientId) => set({ isPrescriptionWriterOpen: true, prescriptionPatientId: patientId ?? null }),
    closePrescriptionWriter: () => set({ isPrescriptionWriterOpen: false }),
}));
