import { create } from "zustand";
import type { BillingInvoiceStatus, ClaimStatus, DenialStatus } from "@/types";

interface BillingStore {
  // Selected IDs (split-panel pattern)
  selectedPatientId: string | null;
  selectedInvoiceId: string | null;
  selectedClaimId: string | null;
  selectedDenialId: string | null;
  selectedPaymentInvoiceId: string | null;

  // Filters
  invoiceStatusFilter: BillingInvoiceStatus | "all";
  claimStatusFilter: ClaimStatus | "all";
  denialStatusFilter: DenialStatus | "all";
  paymentDateFilter: string;

  // Invoice builder toggle
  showInvoiceBuilder: boolean;

  // Actions
  setSelectedPatient: (id: string | null) => void;
  setSelectedInvoice: (id: string | null) => void;
  setSelectedClaim: (id: string | null) => void;
  setSelectedDenial: (id: string | null) => void;
  setSelectedPaymentInvoice: (id: string | null) => void;
  setInvoiceStatusFilter: (f: BillingInvoiceStatus | "all") => void;
  setClaimStatusFilter: (f: ClaimStatus | "all") => void;
  setDenialStatusFilter: (f: DenialStatus | "all") => void;
  setPaymentDateFilter: (d: string) => void;
  toggleInvoiceBuilder: () => void;
}

export const useBillingStore = create<BillingStore>((set) => ({
  selectedPatientId: null,
  selectedInvoiceId: null,
  selectedClaimId: null,
  selectedDenialId: null,
  selectedPaymentInvoiceId: null,
  invoiceStatusFilter: "all",
  claimStatusFilter: "all",
  denialStatusFilter: "all",
  paymentDateFilter: "2026-03-16",
  showInvoiceBuilder: false,

  setSelectedPatient: (id) => set({ selectedPatientId: id }),
  setSelectedInvoice: (id) => set({ selectedInvoiceId: id }),
  setSelectedClaim: (id) => set({ selectedClaimId: id }),
  setSelectedDenial: (id) => set({ selectedDenialId: id }),
  setSelectedPaymentInvoice: (id) => set({ selectedPaymentInvoiceId: id }),
  setInvoiceStatusFilter: (f) => set({ invoiceStatusFilter: f }),
  setClaimStatusFilter: (f) => set({ claimStatusFilter: f }),
  setDenialStatusFilter: (f) => set({ denialStatusFilter: f }),
  setPaymentDateFilter: (d) => set({ paymentDateFilter: d }),
  toggleInvoiceBuilder: () => set((s) => ({ showInvoiceBuilder: !s.showInvoiceBuilder })),
}));
