import { apiFetch } from "@/lib/api";
import type {
  BillingStats,
  Denial,
  FinancialEvent,
  InsuranceClaim,
  Invoice,
  PatientAccount,
  Payment,
  PaymentMethod,
} from "@/types";

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface BillingDashboardResponse {
  stats: BillingStats;
  recentPayments: Payment[];
  activeDenials: Denial[];
  claimStatusSummary: Record<string, number>;
  billedToday: number;
}

interface BillingTimelineEntry {
  type: "invoice" | "payment" | "denial";
  date: string;
  data: Invoice | Payment | Denial;
}

interface BillingTimelineResponse {
  data: BillingTimelineEntry[];
  total: number;
}

function withQuery(path: string, params: Record<string, any>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function getPaginatedList<T>(path: string, token?: string | null): Promise<T[]> {
  const data = (await apiFetch(path, { token })) as
    | PaginatedResponse<T>
    | { data?: T[]; results?: T[] }
    | T[];

  if (Array.isArray(data)) {
    return data;
  }

  return (data as any).results ?? (data as any).data ?? [];
}

function mapTimelineEntryToEvent(entry: BillingTimelineEntry): FinancialEvent {
  if (entry.type === "invoice") {
    const invoice = entry.data as Invoice;
    return {
      id: `invoice-${invoice.id}`,
      patientId: invoice.patientId,
      type: "charge_posted",
      title: "Invoice Created",
      description: `${invoice.id} created for ${invoice.patientName}`,
      amount: invoice.totalCharges,
      referenceId: invoice.id,
      timestamp: entry.date,
    };
  }

  if (entry.type === "payment") {
    const payment = entry.data as Payment;
    return {
      id: `payment-${payment.id}`,
      patientId: payment.patientId,
      type: payment.payer?.toLowerCase() === "patient" ? "patient_payment" : "payment_posted",
      title: "Payment Posted",
      description: `${payment.payer} payment posted for ${payment.patientName}`,
      amount: payment.amount,
      referenceId: payment.id,
      postedBy: payment.postedBy,
      timestamp: entry.date,
    };
  }

  const denial = entry.data as Denial;
  return {
    id: `denial-${denial.id}`,
    patientId: denial.patientId,
    type: "denial_received",
    title: "Denial Recorded",
    description: `${denial.reasonCode} - ${denial.reasonDescription}`,
    amount: denial.deniedAmount,
    referenceId: denial.id,
    timestamp: entry.date,
  };
}

export function getBillingDashboard(token?: string) {
  return apiFetch("/billing/dashboard/", { token }) as Promise<BillingDashboardResponse>;
}

export function listInvoices(query: { patientId?: string; status?: string; q?: string } = {}, token?: string) {
  return getPaginatedList<Invoice>(withQuery("/billing/invoices/", query), token);
}

export function createInvoice(
  payload: {
    patient: string;
    encounter_type: string;
    status: string;
    charge_items: Array<Record<string, unknown>>;
    total_amount?: number;
    insurance_plan?: Record<string, unknown>;
    primary_diagnosis?: string;
  },
  token?: string,
) {
  return apiFetch("/billing/invoices/", {
    method: "POST",
    token,
    body: JSON.stringify(payload),
  }) as Promise<Invoice>;
}

export function listClaims(query: { patientId?: string; status?: string; q?: string } = {}, token?: string) {
  return getPaginatedList<InsuranceClaim>(withQuery("/billing/claims/", query), token);
}

export function listDenials(query: { claimId?: string; status?: string; q?: string } = {}, token?: string) {
  return getPaginatedList<Denial>(withQuery("/billing/denials/", query), token);
}

export function listPayments(query: { patientId?: string; invoiceId?: string; q?: string } = {}, token?: string) {
  return getPaginatedList<Payment>(withQuery("/billing/payments/", query), token);
}

export function listPatientAccounts(query: { search?: string } = {}, token?: string) {
  return getPaginatedList<PatientAccount>(withQuery("/billing/accounts/", query), token);
}

export async function getPatientAccountTimeline(patientId: string, token?: string) {
  const response = (await apiFetch(`/billing/accounts/${patientId}/timeline/`, { token })) as BillingTimelineResponse;
  return response.data.map(mapTimelineEntryToEvent);
}

export function sendInvoice(invoiceId: string, token?: string) {
  return apiFetch(`/billing/invoices/${invoiceId}/send/`, {
    method: "POST",
    token,
  }) as Promise<Invoice>;
}

export function appealDenial(denialId: string, appealNotes: string, token?: string) {
  return apiFetch(`/billing/denials/${denialId}/appeal/`, {
    method: "POST",
    token,
    body: JSON.stringify({ appealNotes }),
  }) as Promise<Denial>;
}

export function postPayment(
  payload: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    payer: string;
    referenceNumber: string;
    notes: string;
  },
  token?: string,
) {
  return apiFetch("/billing/payments/", {
    method: "POST",
    token,
    body: JSON.stringify({
      invoice: payload.invoiceId,
      amount: payload.amount,
      method: payload.method,
      payer: payload.payer,
      reference_number: payload.referenceNumber,
      notes: payload.notes,
    }),
  }) as Promise<Payment>;
}
