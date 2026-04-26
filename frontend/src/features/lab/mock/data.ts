import type {
  Specimen, LabTestResult, LabPanel, AccessionRecord,
  AnalyzerQueueItem, RecollectionRequest, LabReport, LabOrder
} from "@/types";

// ── Lab Orders (worklist) ─────────────────────────────────────────────

export const mockLabOrders: LabOrder[] = [
    { id: "LO-001", patientId: "pat-002", patientName: "Robert Williams", orderedBy: "Dr. David Chen", testName: "Troponin I — Serial", priority: "stat", status: "in-progress", orderedAt: "2026-03-13T06:30:00" },
    { id: "LO-002", patientId: "pat-001", patientName: "Emily Johnson", orderedBy: "Dr. David Chen", testName: "HbA1c", priority: "normal", status: "pending", orderedAt: "2026-03-13T07:00:00" },
    { id: "LO-003", patientId: "pat-001", patientName: "Emily Johnson", orderedBy: "Dr. David Chen", testName: "Fasting Lipid Panel", priority: "normal", status: "pending", orderedAt: "2026-03-13T07:00:00" },
    { id: "LO-004", patientId: "pat-004", patientName: "Michael Lee", orderedBy: "Dr. David Chen", testName: "Basic Metabolic Panel", priority: "normal", status: "in-progress", orderedAt: "2026-03-13T07:15:00" },
    { id: "LO-005", patientId: "pat-003", patientName: "Sarah Davis", orderedBy: "Dr. David Chen", testName: "CBC with Differential", priority: "normal", status: "completed", orderedAt: "2026-03-13T06:45:00", completedAt: "2026-03-13T08:00:00" },
    { id: "LO-006", patientId: "pat-002", patientName: "Robert Williams", orderedBy: "Dr. David Chen", testName: "BNP", priority: "stat", status: "completed", orderedAt: "2026-03-13T06:30:00", completedAt: "2026-03-13T07:30:00" },
    { id: "LO-007", patientId: "pat-006", patientName: "Linda Thompson", orderedBy: "Dr. Sarah Kim", testName: "ABG", priority: "urgent", status: "in-progress", orderedAt: "2026-03-13T08:00:00" },
    { id: "LO-008", patientId: "pat-004", patientName: "Michael Lee", orderedBy: "Dr. David Chen", testName: "Lipid Panel", priority: "normal", status: "pending", orderedAt: "2026-03-13T09:00:00" },
    { id: "LO-009", patientId: "pat-006", patientName: "Linda Thompson", orderedBy: "Dr. Sarah Kim", testName: "Sputum Culture", priority: "high", status: "pending", orderedAt: "2026-03-13T08:15:00" },
    { id: "LO-010", patientId: "pat-002", patientName: "Robert Williams", orderedBy: "Dr. David Chen", testName: "PT/INR", priority: "high", status: "in-progress", orderedAt: "2026-03-13T09:30:00" },
];

// ── Specimens ─────────────────────────────────────────────────────────

export const mockSpecimens: Specimen[] = [
    { id: "SP-001", barcode: "LAB-2026-0001", patientId: "pat-002", patientName: "Robert Williams", type: "blood", collectionTime: "2026-03-13T06:35:00", collectedBy: "Maria Garcia", receivedAt: "2026-03-13T06:50:00", status: "analyzed", condition: "acceptable", orderId: "LO-001", testNames: ["Troponin I"] },
    { id: "SP-002", barcode: "LAB-2026-0002", patientId: "pat-001", patientName: "Emily Johnson", type: "blood", collectionTime: "2026-03-13T07:10:00", collectedBy: "Maria Garcia", receivedAt: "2026-03-13T07:25:00", status: "processing", condition: "acceptable", orderId: "LO-002", testNames: ["HbA1c"] },
    { id: "SP-003", barcode: "LAB-2026-0003", patientId: "pat-001", patientName: "Emily Johnson", type: "serum", collectionTime: "2026-03-13T07:10:00", collectedBy: "Maria Garcia", receivedAt: "2026-03-13T07:25:00", status: "received", condition: "acceptable", orderId: "LO-003", testNames: ["Total Cholesterol", "LDL", "HDL", "Triglycerides"] },
    { id: "SP-004", barcode: "LAB-2026-0004", patientId: "pat-004", patientName: "Michael Lee", type: "serum", collectionTime: "2026-03-13T07:20:00", collectedBy: "James Wilson", receivedAt: "2026-03-13T07:40:00", status: "processing", condition: "acceptable", orderId: "LO-004", testNames: ["Na", "K", "Cl", "CO2", "BUN", "Creatinine", "Glucose"] },
    { id: "SP-005", barcode: "LAB-2026-0005", patientId: "pat-003", patientName: "Sarah Davis", type: "blood", collectionTime: "2026-03-13T06:50:00", collectedBy: "Maria Garcia", receivedAt: "2026-03-13T07:05:00", status: "resulted", condition: "acceptable", orderId: "LO-005", testNames: ["WBC", "RBC", "Hemoglobin", "Hematocrit", "Platelets"] },
    { id: "SP-006", barcode: "LAB-2026-0006", patientId: "pat-002", patientName: "Robert Williams", type: "blood", collectionTime: "2026-03-13T06:35:00", collectedBy: "Maria Garcia", receivedAt: "2026-03-13T06:50:00", status: "resulted", condition: "acceptable", orderId: "LO-006", testNames: ["BNP"] },
    { id: "SP-007", barcode: "LAB-2026-0007", patientId: "pat-006", patientName: "Linda Thompson", type: "blood", collectionTime: "2026-03-13T08:10:00", collectedBy: "James Wilson", status: "processing", condition: "acceptable", orderId: "LO-007", testNames: ["pH", "pCO2", "pO2", "HCO3", "Base Excess"] },
    { id: "SP-008", barcode: "LAB-2026-0008", patientId: "pat-002", patientName: "Robert Williams", type: "plasma", collectionTime: "2026-03-13T09:35:00", collectedBy: "Maria Garcia", status: "collected", condition: "acceptable", orderId: "LO-010", testNames: ["PT", "INR"] },
    { id: "SP-009", barcode: "LAB-2026-0009", patientId: "pat-004", patientName: "Michael Lee", type: "serum", status: "ordered", condition: "acceptable", orderId: "LO-008", testNames: ["Total Cholesterol", "LDL", "HDL", "Triglycerides"] },
    { id: "SP-010", barcode: "LAB-2026-0010", patientId: "pat-006", patientName: "Linda Thompson", type: "swab", status: "ordered", condition: "acceptable", orderId: "LO-009", testNames: ["Sputum Culture"], notes: "Notify if MRSA positive" },
];

// ── Lab Panels + Results ──────────────────────────────────────────────

export const mockLabPanels: LabPanel[] = [
    {
        id: "PNL-001", name: "Troponin I — Serial", code: "TROP", specimenId: "SP-001", patientId: "pat-002", patientName: "Robert Williams",
        orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T06:30:00", status: "verified", turnaroundMinutes: 55,
        results: [
            { id: "TR-001", specimenId: "SP-001", testCode: "TROP-I", testName: "Troponin I", value: "4.2", unit: "ng/mL", referenceRange: "0.00 – 0.04", flag: "critical-high", previousValue: "2.8", delta: "+50%", analyzedAt: "2026-03-13T07:20:00", verifiedBy: "Lab Tech Ahmed", verifiedAt: "2026-03-13T07:25:00", status: "final" },
        ],
    },
    {
        id: "PNL-002", name: "BNP", code: "BNP", specimenId: "SP-006", patientId: "pat-002", patientName: "Robert Williams",
        orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T06:30:00", status: "released", turnaroundMinutes: 50,
        results: [
            { id: "TR-002", specimenId: "SP-006", testCode: "BNP", testName: "BNP", value: "820", unit: "pg/mL", referenceRange: "0 – 100", flag: "critical-high", analyzedAt: "2026-03-13T07:15:00", verifiedBy: "Lab Tech Ahmed", verifiedAt: "2026-03-13T07:20:00", status: "final" },
        ],
    },
    {
        id: "PNL-003", name: "CBC with Differential", code: "CBC", specimenId: "SP-005", patientId: "pat-003", patientName: "Sarah Davis",
        orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T06:45:00", status: "complete", turnaroundMinutes: 65,
        results: [
            { id: "TR-003", specimenId: "SP-005", testCode: "WBC", testName: "WBC", value: "8.2", unit: "K/uL", referenceRange: "4.5 – 11.0", flag: "normal", analyzedAt: "2026-03-13T07:45:00", status: "final" },
            { id: "TR-004", specimenId: "SP-005", testCode: "RBC", testName: "RBC", value: "4.1", unit: "M/uL", referenceRange: "4.0 – 5.5", flag: "normal", analyzedAt: "2026-03-13T07:45:00", status: "final" },
            { id: "TR-005", specimenId: "SP-005", testCode: "HGB", testName: "Hemoglobin", value: "11.8", unit: "g/dL", referenceRange: "12.0 – 16.0", flag: "low", previousValue: "12.1", delta: "-2.5%", analyzedAt: "2026-03-13T07:45:00", status: "final" },
            { id: "TR-006", specimenId: "SP-005", testCode: "HCT", testName: "Hematocrit", value: "35.4", unit: "%", referenceRange: "36.0 – 46.0", flag: "low", analyzedAt: "2026-03-13T07:45:00", status: "final" },
            { id: "TR-007", specimenId: "SP-005", testCode: "PLT", testName: "Platelets", value: "245", unit: "K/uL", referenceRange: "150 – 400", flag: "normal", analyzedAt: "2026-03-13T07:45:00", status: "final" },
        ],
    },
    {
        id: "PNL-004", name: "Basic Metabolic Panel", code: "BMP", specimenId: "SP-004", patientId: "pat-004", patientName: "Michael Lee",
        orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T07:15:00", status: "partial",
        results: [
            { id: "TR-008", specimenId: "SP-004", testCode: "NA", testName: "Sodium", value: "141", unit: "mEq/L", referenceRange: "136 – 145", flag: "normal", analyzedAt: "2026-03-13T08:30:00", status: "preliminary" },
            { id: "TR-009", specimenId: "SP-004", testCode: "K", testName: "Potassium", value: "4.2", unit: "mEq/L", referenceRange: "3.5 – 5.0", flag: "normal", analyzedAt: "2026-03-13T08:30:00", status: "preliminary" },
            { id: "TR-010", specimenId: "SP-004", testCode: "CL", testName: "Chloride", value: "103", unit: "mEq/L", referenceRange: "98 – 106", flag: "normal", analyzedAt: "2026-03-13T08:30:00", status: "preliminary" },
            { id: "TR-011", specimenId: "SP-004", testCode: "GLU", testName: "Glucose", value: "165", unit: "mg/dL", referenceRange: "70 – 100", flag: "high", analyzedAt: "2026-03-13T08:30:00", status: "preliminary" },
            { id: "TR-012", specimenId: "SP-004", testCode: "BUN", testName: "BUN", value: "", unit: "mg/dL", referenceRange: "7 – 20", flag: "normal", status: "pending" },
            { id: "TR-013", specimenId: "SP-004", testCode: "CR", testName: "Creatinine", value: "", unit: "mg/dL", referenceRange: "0.7 – 1.3", flag: "normal", status: "pending" },
        ],
    },
    {
        id: "PNL-005", name: "HbA1c", code: "A1C", specimenId: "SP-002", patientId: "pat-001", patientName: "Emily Johnson",
        orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T07:00:00", status: "pending",
        results: [
            { id: "TR-014", specimenId: "SP-002", testCode: "A1C", testName: "Hemoglobin A1c", value: "", unit: "%", referenceRange: "4.0 – 5.6", flag: "normal", status: "pending" },
        ],
    },
];

// ── Accession Records ─────────────────────────────────────────────────

export const mockAccessions: AccessionRecord[] = [
    { id: "ACC-001", accessionNumber: "A-2026-0001", specimenId: "SP-001", patientId: "pat-002", patientName: "Robert Williams", mrn: "MRN-2024-002", specimenType: "blood", receivedBy: "Lab Tech Ahmed", receivedAt: "2026-03-13T06:50:00", condition: "acceptable", testNames: ["Troponin I"], status: "accessioned" },
    { id: "ACC-002", accessionNumber: "A-2026-0002", specimenId: "SP-002", patientId: "pat-001", patientName: "Emily Johnson", mrn: "MRN-2024-001", specimenType: "blood", receivedBy: "Lab Tech Ahmed", receivedAt: "2026-03-13T07:25:00", condition: "acceptable", testNames: ["HbA1c"], status: "accessioned" },
    { id: "ACC-003", accessionNumber: "A-2026-0003", specimenId: "SP-003", patientId: "pat-001", patientName: "Emily Johnson", mrn: "MRN-2024-001", specimenType: "serum", receivedBy: "Lab Tech Ahmed", receivedAt: "2026-03-13T07:25:00", condition: "acceptable", testNames: ["Total Cholesterol", "LDL", "HDL", "Triglycerides"], status: "accessioned" },
    { id: "ACC-004", accessionNumber: "A-2026-0004", specimenId: "SP-004", patientId: "pat-004", patientName: "Michael Lee", mrn: "MRN-2024-004", specimenType: "serum", receivedBy: "Lab Tech Ahmed", receivedAt: "2026-03-13T07:40:00", condition: "acceptable", testNames: ["Na", "K", "Cl", "CO2", "BUN", "Creatinine", "Glucose"], status: "accessioned" },
    { id: "ACC-005", accessionNumber: "A-2026-0005", specimenId: "SP-005", patientId: "pat-003", patientName: "Sarah Davis", mrn: "MRN-2024-003", specimenType: "blood", receivedBy: "Lab Tech Ahmed", receivedAt: "2026-03-13T07:05:00", condition: "acceptable", testNames: ["WBC", "RBC", "Hemoglobin", "Hematocrit", "Platelets"], status: "accessioned" },
    { id: "ACC-006", accessionNumber: "A-2026-0006", specimenId: "SP-006", patientId: "pat-002", patientName: "Robert Williams", mrn: "MRN-2024-002", specimenType: "blood", receivedBy: "Lab Tech Ahmed", receivedAt: "2026-03-13T06:50:00", condition: "acceptable", testNames: ["BNP"], status: "accessioned" },
];

// ── Analyzer Queue ────────────────────────────────────────────────────

export const mockAnalyzerQueue: AnalyzerQueueItem[] = [
    { id: "AQ-001", instrument: "Roche Cobas e801", specimenBarcode: "LAB-2026-0002", specimenId: "SP-002", patientName: "Emily Johnson", testName: "HbA1c", priority: "normal", queuePosition: 1, estimatedMinutes: 15, status: "running", startedAt: "2026-03-13T09:00:00" },
    { id: "AQ-002", instrument: "Roche Cobas e801", specimenBarcode: "LAB-2026-0004", specimenId: "SP-004", patientName: "Michael Lee", testName: "BMP (remaining: BUN, Cr)", priority: "normal", queuePosition: 2, estimatedMinutes: 25, status: "queued" },
    { id: "AQ-003", instrument: "Siemens RAPIDPoint 500", specimenBarcode: "LAB-2026-0007", specimenId: "SP-007", patientName: "Linda Thompson", testName: "ABG Panel", priority: "urgent", queuePosition: 1, estimatedMinutes: 5, status: "running", startedAt: "2026-03-13T09:10:00" },
    { id: "AQ-004", instrument: "Beckman Coulter DxH 900", specimenBarcode: "LAB-2026-0003", specimenId: "SP-003", patientName: "Emily Johnson", testName: "Lipid Panel", priority: "normal", queuePosition: 1, estimatedMinutes: 20, status: "queued" },
    { id: "AQ-005", instrument: "Siemens BCS XP", specimenBarcode: "LAB-2026-0008", specimenId: "SP-008", patientName: "Robert Williams", testName: "PT/INR", priority: "high", queuePosition: 1, estimatedMinutes: 12, status: "queued" },
];

// ── Recollection Requests ─────────────────────────────────────────────

export const mockRecollections: RecollectionRequest[] = [
    { id: "RC-001", originalSpecimenId: "SP-011", patientId: "pat-004", patientName: "Michael Lee", reason: "hemolyzed", requestedBy: "Lab Tech Ahmed", requestedAt: "2026-03-13T07:45:00", notes: "Grossly hemolyzed — cannot run potassium. Please redraw in green-top.", resolved: false },
];

// ── Lab Reports ───────────────────────────────────────────────────────

export const mockLabReports: LabReport[] = [
    {
        id: "RPT-001", patientId: "pat-002", patientName: "Robert Williams", mrn: "MRN-2024-002",
        panelId: "PNL-001", panelName: "Troponin I — Serial",
        results: mockLabPanels[0].results,
        status: "final", orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T06:30:00",
        authorizedBy: "Dr. Lab Director Samir", authorizedAt: "2026-03-13T07:30:00", releasedAt: "2026-03-13T07:32:00",
        hasCritical: true, criticalNotifiedTo: "Dr. David Chen", criticalNotifiedAt: "2026-03-13T07:26:00",
    },
    {
        id: "RPT-002", patientId: "pat-002", patientName: "Robert Williams", mrn: "MRN-2024-002",
        panelId: "PNL-002", panelName: "BNP",
        results: mockLabPanels[1].results,
        status: "final", orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T06:30:00",
        authorizedBy: "Dr. Lab Director Samir", authorizedAt: "2026-03-13T07:22:00", releasedAt: "2026-03-13T07:25:00",
        hasCritical: true, criticalNotifiedTo: "Dr. David Chen", criticalNotifiedAt: "2026-03-13T07:21:00",
    },
    {
        id: "RPT-003", patientId: "pat-003", patientName: "Sarah Davis", mrn: "MRN-2024-003",
        panelId: "PNL-003", panelName: "CBC with Differential",
        results: mockLabPanels[2].results,
        status: "final", orderedBy: "Dr. David Chen", orderedAt: "2026-03-13T06:45:00",
        authorizedBy: "Lab Tech Ahmed", authorizedAt: "2026-03-13T08:00:00",
        hasCritical: false,
    },
];

// ── Dashboard Stats ───────────────────────────────────────────────────

export const mockLabStats = {
    pendingOrders: mockLabOrders.filter((o) => o.status === "pending").length,
    inProgress: mockLabOrders.filter((o) => o.status === "in-progress").length,
    completedToday: mockLabOrders.filter((o) => o.status === "completed").length,
    statOrders: mockLabOrders.filter((o) => o.priority === "stat").length,
    criticalResults: mockLabPanels.flatMap((p) => p.results).filter((r) => r.flag === "critical-high" || r.flag === "critical-low").length,
    avgTATMinutes: 57,
    specimensPending: mockSpecimens.filter((s) => s.status === "ordered" || s.status === "collected").length,
    recollections: mockRecollections.filter((r) => !r.resolved).length,
};
