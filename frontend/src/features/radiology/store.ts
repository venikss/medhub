import { create } from "zustand";

type OrderStatusFilter = "all" | "ordered" | "protocoled" | "scheduled" | "arrived" | "in-progress" | "acquired" | "reading" | "reported" | "signed";
type ModalityFilter = "all" | "XR" | "CT" | "MRI" | "US" | "NM" | "PET" | "FLUORO";
type ReportStatusFilter = "all" | "draft" | "preliminary" | "final" | "amended";

interface RadiologyState {
  selectedOrderId: string | null;
  selectedStudyId: string | null;
  selectedReportId: string | null;
  orderStatusFilter: OrderStatusFilter;
  orderModalityFilter: ModalityFilter;
  worklistModalityFilter: ModalityFilter;
  reportStatusFilter: ReportStatusFilter;
  scheduleDate: string;
  showReportEditor: boolean;

  setSelectedOrder: (id: string | null) => void;
  setSelectedStudy: (id: string | null) => void;
  setSelectedReport: (id: string | null) => void;
  setOrderStatusFilter: (f: OrderStatusFilter) => void;
  setOrderModalityFilter: (f: ModalityFilter) => void;
  setWorklistModalityFilter: (f: ModalityFilter) => void;
  setReportStatusFilter: (f: ReportStatusFilter) => void;
  setScheduleDate: (d: string) => void;
  toggleReportEditor: () => void;
}

export const useRadiologyStore = create<RadiologyState>((set) => ({
  selectedOrderId: null,
  selectedStudyId: null,
  selectedReportId: null,
  orderStatusFilter: "all",
  orderModalityFilter: "all",
  worklistModalityFilter: "all",
  reportStatusFilter: "all",
  scheduleDate: "2026-03-16",
  showReportEditor: false,

  setSelectedOrder: (id) => set({ selectedOrderId: id }),
  setSelectedStudy: (id) => set({ selectedStudyId: id }),
  setSelectedReport: (id) => set({ selectedReportId: id }),
  setOrderStatusFilter: (f) => set({ orderStatusFilter: f }),
  setOrderModalityFilter: (f) => set({ orderModalityFilter: f }),
  setWorklistModalityFilter: (f) => set({ worklistModalityFilter: f }),
  setReportStatusFilter: (f) => set({ reportStatusFilter: f }),
  setScheduleDate: (d) => set({ scheduleDate: d }),
  toggleReportEditor: () => set((s) => ({ showReportEditor: !s.showReportEditor })),
}));
