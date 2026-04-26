import type {
  PharmacyPrescription, DrugWarning, FormularyItem, DispenseRecord,
  InterventionRecord, RefillRecord, SubstitutionRequest
} from "@/types";

// ── Prescriptions Queue ───────────────────────────────────────────────

export const mockPrescriptions: PharmacyPrescription[] = [
    {
        id: "RX-001", patientId: "pat-001", patientName: "Emily Johnson", mrn: "MRN-2024-001",
        medication: "Metformin HCl", genericName: "Metformin", dosage: "1000mg", route: "oral", frequency: "BID",
        quantity: 60, refillsAllowed: 5, refillsRemaining: 5, setting: "outpatient", priority: "normal",
        status: "pending-verification", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-13T09:00:00",
        warnings: [], allergies: ["Penicillin"],
    },
    {
        id: "RX-002", patientId: "pat-002", patientName: "Robert Williams", mrn: "MRN-2024-002",
        medication: "Clopidogrel", genericName: "Clopidogrel", dosage: "75mg", route: "oral", frequency: "daily",
        quantity: 30, refillsAllowed: 3, refillsRemaining: 3, setting: "inpatient", priority: "stat",
        status: "pending-verification", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-13T06:45:00",
        warnings: [
            { id: "W-001", type: "interaction", severity: "severe", title: "Drug Interaction: Heparin + Clopidogrel", description: "Concurrent use increases bleeding risk. Monitor for signs of hemorrhage. INR monitoring recommended.", interactingDrug: "Heparin", overridable: true },
        ],
        allergies: ["Sulfa drugs", "Latex"],
    },
    {
        id: "RX-003", patientId: "pat-004", patientName: "Michael Lee", mrn: "MRN-2024-004",
        medication: "Lisinopril", genericName: "Lisinopril", dosage: "20mg", route: "oral", frequency: "daily",
        quantity: 30, refillsAllowed: 11, refillsRemaining: 11, setting: "outpatient", priority: "normal",
        status: "verified", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-13T07:30:00",
        verifiedBy: "Pharm. Sarah Adams", verifiedAt: "2026-03-13T08:00:00",
        warnings: [
            { id: "W-002", type: "allergy", severity: "info", title: "Aspirin allergy noted", description: "Patient has documented Aspirin allergy. No cross-reactivity with ACE inhibitors expected.", overridable: true, overriddenBy: "Pharm. Sarah Adams", overriddenAt: "2026-03-13T08:00:00" },
        ],
        allergies: ["Aspirin"],
    },
    {
        id: "RX-004", patientId: "pat-003", patientName: "Sarah Davis", mrn: "MRN-2024-003",
        medication: "Acetaminophen", genericName: "Acetaminophen", dosage: "500mg", route: "oral", frequency: "Q6H PRN",
        quantity: 30, refillsAllowed: 0, refillsRemaining: 0, setting: "discharge", priority: "normal",
        status: "dispensed", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-13T06:30:00",
        verifiedBy: "Pharm. Sarah Adams", verifiedAt: "2026-03-13T07:00:00",
        dispensedBy: "Pharm. Sarah Adams", dispensedAt: "2026-03-13T07:15:00",
        warnings: [], allergies: [],
    },
    {
        id: "RX-005", patientId: "pat-006", patientName: "Linda Thompson", mrn: "MRN-2024-006",
        medication: "Prednisone", genericName: "Prednisone", dosage: "40mg", route: "oral", frequency: "daily",
        quantity: 14, refillsAllowed: 0, refillsRemaining: 0, setting: "inpatient", priority: "high",
        status: "verified", prescribedBy: "Dr. Sarah Kim", prescribedAt: "2026-03-13T08:00:00",
        verifiedBy: "Pharm. Sarah Adams", verifiedAt: "2026-03-13T08:20:00",
        warnings: [
            { id: "W-003", type: "interaction", severity: "moderate", title: "Prednisone + Albuterol", description: "Both drugs may lower potassium. Monitor serum K+ levels.", overridable: true, overriddenBy: "Pharm. Sarah Adams", overriddenAt: "2026-03-13T08:20:00" },
            { id: "W-004", type: "dose-range", severity: "info", title: "High-dose steroid burst", description: "40mg daily for COPD exacerbation is within guideline range (30-60mg).", overridable: true, overriddenBy: "Pharm. Sarah Adams", overriddenAt: "2026-03-13T08:20:00" },
        ],
        allergies: ["Codeine"],
    },
    {
        id: "RX-006", patientId: "pat-002", patientName: "Robert Williams", mrn: "MRN-2024-002",
        medication: "Atorvastatin", genericName: "Atorvastatin", dosage: "40mg", route: "oral", frequency: "QHS",
        quantity: 30, refillsAllowed: 5, refillsRemaining: 5, setting: "inpatient", priority: "normal",
        status: "dispensing", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-13T06:45:00",
        verifiedBy: "Pharm. Sarah Adams", verifiedAt: "2026-03-13T07:30:00",
        warnings: [], allergies: ["Sulfa drugs", "Latex"],
    },
    {
        id: "RX-007", patientId: "pat-001", patientName: "Emily Johnson", mrn: "MRN-2024-001",
        medication: "Glipizide", genericName: "Glipizide", dosage: "5mg", route: "oral", frequency: "daily AC breakfast",
        quantity: 30, refillsAllowed: 5, refillsRemaining: 5, setting: "outpatient", priority: "normal",
        status: "ordered", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-13T09:00:00",
        warnings: [
            { id: "W-005", type: "duplication", severity: "moderate", title: "Therapeutic Duplication", description: "Patient already on Metformin (anti-diabetic). Verify dual therapy intended for DM2 management.", overridable: true },
        ],
        allergies: ["Penicillin"],
    },
    {
        id: "RX-008", patientId: "pat-006", patientName: "Linda Thompson", mrn: "MRN-2024-006",
        medication: "Ipratropium Bromide", genericName: "Ipratropium", dosage: "0.5mg/2.5mL", route: "inhaled", frequency: "Q6H",
        quantity: 28, refillsAllowed: 2, refillsRemaining: 2, setting: "inpatient", priority: "urgent",
        status: "pending-verification", prescribedBy: "Dr. Sarah Kim", prescribedAt: "2026-03-13T08:30:00",
        warnings: [], allergies: ["Codeine"],
    },
];

// ── Drug Warnings (standalone alerts) ─────────────────────────────────

export const mockStandaloneWarnings: DrugWarning[] = [
    { id: "SW-001", type: "interaction", severity: "severe", title: "Heparin + Clopidogrel — bleeding risk", description: "Patient Robert Williams is on both anticoagulant and antiplatelet therapy.", interactingDrug: "Heparin", overridable: true },
    { id: "SW-002", type: "duplication", severity: "moderate", title: "Metformin + Glipizide — therapeutic duplication", description: "Patient Emily Johnson: dual anti-diabetic agents ordered. Verify intended.", overridable: true },
    { id: "SW-003", type: "renal", severity: "info", title: "Metformin — renal function check", description: "Verify eGFR > 30 mL/min before dispensing Metformin for Emily Johnson.", overridable: true },
];

// ── Formulary ─────────────────────────────────────────────────────────

export const mockFormulary: FormularyItem[] = [
    { id: "FM-001", genericName: "Metformin HCl", brandNames: ["Glucophage", "Fortamet"], drugClass: "Biguanide — Antidiabetic", form: "tablet", strengths: ["500mg", "850mg", "1000mg"], formularyStatus: "formulary", stockLevel: 450, reorderPoint: 100, unitCost: 0.12, requiresPriorAuth: false },
    { id: "FM-002", genericName: "Lisinopril", brandNames: ["Zestril", "Prinivil"], drugClass: "ACE Inhibitor", form: "tablet", strengths: ["5mg", "10mg", "20mg", "40mg"], formularyStatus: "formulary", stockLevel: 320, reorderPoint: 80, unitCost: 0.08, requiresPriorAuth: false },
    { id: "FM-003", genericName: "Clopidogrel", brandNames: ["Plavix"], drugClass: "Antiplatelet", form: "tablet", strengths: ["75mg", "300mg"], formularyStatus: "formulary", stockLevel: 180, reorderPoint: 50, unitCost: 0.45, requiresPriorAuth: false },
    { id: "FM-004", genericName: "Atorvastatin", brandNames: ["Lipitor"], drugClass: "HMG-CoA Reductase Inhibitor", form: "tablet", strengths: ["10mg", "20mg", "40mg", "80mg"], formularyStatus: "formulary", stockLevel: 280, reorderPoint: 60, unitCost: 0.15, requiresPriorAuth: false },
    { id: "FM-005", genericName: "Acetaminophen", brandNames: ["Tylenol"], drugClass: "Analgesic / Antipyretic", form: "tablet", strengths: ["325mg", "500mg", "650mg ER"], formularyStatus: "formulary", stockLevel: 800, reorderPoint: 200, unitCost: 0.03, requiresPriorAuth: false },
    { id: "FM-006", genericName: "Prednisone", brandNames: ["Deltasone", "Rayos"], drugClass: "Corticosteroid", form: "tablet", strengths: ["5mg", "10mg", "20mg", "50mg"], formularyStatus: "formulary", stockLevel: 220, reorderPoint: 50, unitCost: 0.10, requiresPriorAuth: false },
    { id: "FM-007", genericName: "Albuterol Sulfate", brandNames: ["ProAir", "Ventolin"], drugClass: "Beta-2 Agonist", form: "nebulizer solution", strengths: ["0.63mg/3mL", "1.25mg/3mL", "2.5mg/3mL"], formularyStatus: "formulary", stockLevel: 120, reorderPoint: 40, unitCost: 0.80, requiresPriorAuth: false },
    { id: "FM-008", genericName: "Ipratropium Bromide", brandNames: ["Atrovent"], drugClass: "Anticholinergic Bronchodilator", form: "nebulizer solution", strengths: ["0.5mg/2.5mL"], formularyStatus: "formulary", stockLevel: 90, reorderPoint: 30, unitCost: 1.20, requiresPriorAuth: false },
    { id: "FM-009", genericName: "Rosuvastatin", brandNames: ["Crestor"], drugClass: "HMG-CoA Reductase Inhibitor", form: "tablet", strengths: ["5mg", "10mg", "20mg", "40mg"], formularyStatus: "non-formulary", stockLevel: 40, reorderPoint: 20, unitCost: 2.50, requiresPriorAuth: true, notes: "Non-formulary. Recommend Atorvastatin as therapeutic alternative." },
    { id: "FM-010", genericName: "Gabapentin", brandNames: ["Neurontin"], drugClass: "Anticonvulsant / Neuropathic Pain", form: "capsule", strengths: ["100mg", "300mg", "400mg"], formularyStatus: "formulary", stockLevel: 15, reorderPoint: 50, unitCost: 0.20, requiresPriorAuth: false, notes: "LOW STOCK — reorder initiated" },
];

// ── Dispense Records ──────────────────────────────────────────────────

export const mockDispenseRecords: DispenseRecord[] = [
    { id: "DSP-001", prescriptionId: "RX-004", patientName: "Sarah Davis", medication: "Acetaminophen 500mg", dosage: "500mg", quantityDispensed: 30, lotNumber: "LOT-2025-A443", expirationDate: "2027-06-30", dispensedBy: "Pharm. Sarah Adams", dispensedAt: "2026-03-13T07:15:00", setting: "discharge", verifiedBy: "Pharm. Sarah Adams", labelPrinted: true, barcodeScan: true },
    { id: "DSP-002", prescriptionId: "RX-003", patientName: "Michael Lee", medication: "Lisinopril 20mg", dosage: "20mg", quantityDispensed: 30, lotNumber: "LOT-2025-L112", expirationDate: "2027-09-15", dispensedBy: "Pharm. Sarah Adams", dispensedAt: "2026-03-13T08:30:00", setting: "outpatient", verifiedBy: "Pharm. Sarah Adams", labelPrinted: true, barcodeScan: true },
    { id: "DSP-003", prescriptionId: "RX-005", patientName: "Linda Thompson", medication: "Prednisone 40mg", dosage: "40mg", quantityDispensed: 14, lotNumber: "LOT-2025-P221", expirationDate: "2027-12-01", dispensedBy: "Pharm. Tom Parker", dispensedAt: "2026-03-13T09:00:00", setting: "inpatient", verifiedBy: "Pharm. Sarah Adams", labelPrinted: true, barcodeScan: true },
];

// ── Interventions ─────────────────────────────────────────────────────

export const mockInterventions: InterventionRecord[] = [
    { id: "INT-001", prescriptionId: "RX-002", patientName: "Robert Williams", medication: "Clopidogrel 75mg", type: "monitoring", reason: "Concurrent heparin therapy increases hemorrhage risk", recommendation: "Add INR monitoring Q12H while on dual anticoagulant/antiplatelet therapy. Consider gastric prophylaxis with PPI.", prescriberContact: "Dr. David Chen (paged)", outcome: "accepted", pharmacistName: "Pharm. Sarah Adams", createdAt: "2026-03-13T07:00:00", resolvedAt: "2026-03-13T07:20:00", prescriberResponse: "Agreed. Added pantoprazole 40mg daily and INR monitoring." },
    { id: "INT-002", prescriptionId: "RX-007", patientName: "Emily Johnson", medication: "Glipizide 5mg", type: "clarification", reason: "Therapeutic duplication with Metformin — both are anti-diabetic agents", recommendation: "Verify dual oral hypoglycemic therapy is intended for DM2 management. If so, ensure patient counseling on hypoglycemia signs.", prescriberContact: "Dr. David Chen", outcome: "pending", pharmacistName: "Pharm. Sarah Adams", createdAt: "2026-03-13T09:15:00" },
    { id: "INT-003", prescriptionId: "RX-009", patientName: "Linda Thompson", medication: "Prednisone 40mg", type: "monitoring", reason: "High-dose steroid therapy — metabolic monitoring needed", recommendation: "Monitor blood glucose Q6H (steroid-induced hyperglycemia risk). Check potassium level daily with concurrent albuterol use.", prescriberContact: "Dr. Sarah Kim", outcome: "accepted", pharmacistName: "Pharm. Sarah Adams", createdAt: "2026-03-13T08:25:00", resolvedAt: "2026-03-13T08:45:00", prescriberResponse: "Agreed. Added glucose monitoring and daily K+ check." },
];

// ── Refill History ────────────────────────────────────────────────────

export const mockRefills: RefillRecord[] = [
    { id: "RF-001", prescriptionId: "RX-003", patientName: "Michael Lee", medication: "Lisinopril", dosage: "20mg", refillNumber: 1, totalRefills: 11, dispensedDate: "2026-02-13", quantity: 30, pharmacist: "Pharm. Sarah Adams", daysSupply: 30, nextRefillDate: "2026-03-13" },
    { id: "RF-002", prescriptionId: "RX-003", patientName: "Michael Lee", medication: "Lisinopril", dosage: "20mg", refillNumber: 2, totalRefills: 11, dispensedDate: "2026-03-13", quantity: 30, pharmacist: "Pharm. Sarah Adams", daysSupply: 30, nextRefillDate: "2026-04-12" },
    { id: "RF-003", prescriptionId: "RX-001-OLD", patientName: "Emily Johnson", medication: "Metformin", dosage: "500mg", refillNumber: 3, totalRefills: 5, dispensedDate: "2026-01-15", quantity: 60, pharmacist: "Pharm. Tom Parker", daysSupply: 30, nextRefillDate: "2026-02-14" },
    { id: "RF-004", prescriptionId: "RX-001-OLD", patientName: "Emily Johnson", medication: "Metformin", dosage: "500mg", refillNumber: 4, totalRefills: 5, dispensedDate: "2026-02-14", quantity: 60, pharmacist: "Pharm. Sarah Adams", daysSupply: 30, nextRefillDate: "2026-03-16" },
];

// ── Substitution Requests ─────────────────────────────────────────────

export const mockSubstitutions: SubstitutionRequest[] = [
    { id: "SUB-001", prescriptionId: "RX-009-EXT", patientName: "External Patient", originalMedication: "Rosuvastatin 20mg (Crestor)", substituteMedication: "Atorvastatin 40mg (Lipitor)", reason: "formulary-preference", status: "approved", requestedBy: "Pharm. Sarah Adams", requestedAt: "2026-03-12T14:00:00", approvedBy: "Dr. Nina Patel", approvedAt: "2026-03-12T14:30:00", costSavings: 72.50 },
    { id: "SUB-002", prescriptionId: "RX-010-EXT", patientName: "John Smith", originalMedication: "Gabapentin 300mg (Neurontin brand)", substituteMedication: "Gabapentin 300mg (generic)", reason: "generic-available", status: "pending", requestedBy: "Pharm. Tom Parker", requestedAt: "2026-03-13T08:00:00", costSavings: 45.00 },
];

// ── Dashboard Stats ───────────────────────────────────────────────────

export const mockPharmStats = {
    pendingVerification: mockPrescriptions.filter((r) => r.status === "pending-verification" || r.status === "ordered").length,
    verified: mockPrescriptions.filter((r) => r.status === "verified").length,
    dispensing: mockPrescriptions.filter((r) => r.status === "dispensing").length,
    dispensedToday: mockDispenseRecords.length,
    activeWarnings: mockStandaloneWarnings.length,
    pendingInterventions: mockInterventions.filter((i) => i.outcome === "pending").length,
    lowStockItems: mockFormulary.filter((f) => f.stockLevel <= f.reorderPoint).length,
    pendingSubstitutions: mockSubstitutions.filter((s) => s.status === "pending").length,
};
