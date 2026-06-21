import { create } from "zustand";
import { respondToCDSSRecommendation } from "./api";
import type {
  CDSSRecommendation,
  CDSSOverrideRecord,
  CDSSAlertSeverity,
  CDSSRecommendationType,
  CDSSAlertStatus,
  CDSSOverrideAction,
  CDSSOverrideReasonCategory,
  CDSSSourceModule,
} from "@/types";

interface CDSSState {
  recommendations: CDSSRecommendation[];
  overrides: CDSSOverrideRecord[];

  severityFilter: CDSSAlertSeverity | "all";
  typeFilter: CDSSRecommendationType | "all";
  statusFilter: CDSSAlertStatus | "all";
  moduleFilter: CDSSSourceModule | "all";
  patientSearch: string;

  selectedRecommendationId: string | null;
  showExplanationPanel: boolean;
  showEvidenceViewer: boolean;

  showOverrideModal: boolean;
  overrideTargetId: string | null;

  historyActionFilter: CDSSOverrideAction | "all";
  historyDateFrom: string;
  historyDateTo: string;
  historyClinicianSearch: string;

  setSeverityFilter: (v: CDSSAlertSeverity | "all") => void;
  setTypeFilter: (v: CDSSRecommendationType | "all") => void;
  setStatusFilter: (v: CDSSAlertStatus | "all") => void;
  setModuleFilter: (v: CDSSSourceModule | "all") => void;
  setPatientSearch: (v: string) => void;
  setRecommendations: (items: CDSSRecommendation[]) => void;
  setOverrides: (items: CDSSOverrideRecord[]) => void;

  selectRecommendation: (id: string | null) => void;
  setShowExplanationPanel: (show: boolean) => void;
  setShowEvidenceViewer: (show: boolean) => void;

  openOverrideModal: (id: string) => void;
  closeOverrideModal: () => void;

  submitOverride: (payload: {
    action: CDSSOverrideAction;
    reasonCategory: CDSSOverrideReasonCategory;
    reason: string;
    notes?: string;
    clinicianName: string;
    clinicianRole: string;
    sourceModule?: CDSSSourceModule;
    recommendationId?: string;
    token?: string | null;
  }) => Promise<void>;

  submitFeedback: (id: string, rating: 1 | 2 | 3 | 4 | 5, comment: string) => void;

  setHistoryActionFilter: (v: CDSSOverrideAction | "all") => void;
  setHistoryDateFrom: (v: string) => void;
  setHistoryDateTo: (v: string) => void;
  setHistoryClinicianSearch: (v: string) => void;
}

export const useCDSSStore = create<CDSSState>((set, get) => ({
  recommendations: [],
  overrides: [],

  severityFilter: "all",
  typeFilter: "all",
  statusFilter: "active",
  moduleFilter: "all",
  patientSearch: "",

  selectedRecommendationId: null,
  showExplanationPanel: true,
  showEvidenceViewer: false,

  showOverrideModal: false,
  overrideTargetId: null,

  historyActionFilter: "all",
  historyDateFrom: "",
  historyDateTo: "",
  historyClinicianSearch: "",

  setSeverityFilter: (v) => set({ severityFilter: v }),
  setTypeFilter: (v) => set({ typeFilter: v }),
  setStatusFilter: (v) => set({ statusFilter: v }),
  setModuleFilter: (v) => set({ moduleFilter: v }),
  setPatientSearch: (v) => set({ patientSearch: v }),
  setRecommendations: (items) => set({ recommendations: items }),
  setOverrides: (items) => set({ overrides: items }),

  selectRecommendation: (id) =>
    set({ selectedRecommendationId: id, showExplanationPanel: true, showEvidenceViewer: false }),

  setShowExplanationPanel: (show) => set({ showExplanationPanel: show }),
  setShowEvidenceViewer: (show) => set({ showEvidenceViewer: show }),

  openOverrideModal: (id) => set({ showOverrideModal: true, overrideTargetId: id }),
  closeOverrideModal: () => set({ showOverrideModal: false, overrideTargetId: null }),

  submitOverride: async (payload) => {
    const state = get();
    const targetId = payload.recommendationId ?? state.overrideTargetId;
    const { recommendations, overrides } = state;
    if (!targetId) return;

    const rec = recommendations.find((r) => r.id === targetId);
    if (!rec) return;

    const response = await respondToCDSSRecommendation(
      targetId,
      {
        action: payload.action,
        reasonCategory: payload.reasonCategory,
        reason: payload.reason,
        notes: payload.notes,
      },
      payload.token,
    );

    set((prev) => ({
      recommendations: prev.recommendations.map((item) =>
        item.id === targetId ? response.recommendation : item
      ),
      overrides: [response.overrideRecord, ...prev.overrides],
      showOverrideModal: false,
      overrideTargetId: null,
      selectedRecommendationId:
        prev.selectedRecommendationId === targetId
          ? null
          : prev.selectedRecommendationId,
    }));
  },

  submitFeedback: (id, rating, comment) => {
    set((state) => ({
      recommendations: state.recommendations.map((r) =>
        r.id === id ? { ...r, feedbackRating: rating, feedbackComment: comment } : r
      ),
    }));
  },

  setHistoryActionFilter: (v) => set({ historyActionFilter: v }),
  setHistoryDateFrom: (v) => set({ historyDateFrom: v }),
  setHistoryDateTo: (v) => set({ historyDateTo: v }),
  setHistoryClinicianSearch: (v) => set({ historyClinicianSearch: v }),
}));
