import type { Patient, Appointment, Encounter, Diagnosis, Procedure, OrderItem, Prescription, Referral, ResultItem } from "@/types";

// ── Patients ──────────────────────────────────────────────────────────

export const mockDoctorPatients: (Patient & { diagnosis?: string })[] = [
    {
        id: "pat-001", mrn: "MRN-2024-001", firstName: "Emily", lastName: "Johnson", dateOfBirth: "1985-03-15",
        gender: "female", phone: "+1-555-0101", email: "emily.j@email.com", address: "123 Oak Street",
        bloodType: "A+", allergies: ["Penicillin"], status: "admitted", ward: "Ward A", roomNumber: "201",
        admissionDate: "2026-03-08", assignedDoctor: "Dr. David Chen", diagnosis: "Type 2 Diabetes - management",
    },
    {
        id: "pat-002", mrn: "MRN-2024-002", firstName: "Robert", lastName: "Williams", dateOfBirth: "1972-07-22",
        gender: "male", phone: "+1-555-0102", email: "r.williams@email.com", address: "456 Maple Ave",
        bloodType: "O-", allergies: ["Sulfa drugs", "Latex"], status: "critical", ward: "ICU", roomNumber: "ICU-03",
        admissionDate: "2026-03-09", assignedDoctor: "Dr. David Chen", diagnosis: "Acute myocardial infarction",
    },
    {
        id: "pat-003", mrn: "MRN-2024-003", firstName: "Sarah", lastName: "Davis", dateOfBirth: "1990-11-08",
        gender: "female", phone: "+1-555-0103", email: "sarah.d@email.com", address: "789 Pine Road",
        bloodType: "B+", allergies: [], status: "stable", ward: "Ward B", roomNumber: "312",
        admissionDate: "2026-03-07", assignedDoctor: "Dr. David Chen", diagnosis: "Post-appendectomy recovery",
    },
    {
        id: "pat-004", mrn: "MRN-2024-004", firstName: "Michael", lastName: "Lee", dateOfBirth: "1968-01-30",
        gender: "male", phone: "+1-555-0104", email: "m.lee@email.com", address: "321 Elm Drive",
        bloodType: "AB+", allergies: ["Aspirin"], status: "active", ward: "Ward A", roomNumber: "215",
        admissionDate: "2026-03-10", assignedDoctor: "Dr. David Chen", diagnosis: "Chronic hypertension evaluation",
    },
    {
        id: "pat-005", mrn: "MRN-2024-005", firstName: "Jessica", lastName: "Martinez", dateOfBirth: "1995-06-12",
        gender: "female", phone: "+1-555-0105", email: "j.martinez@email.com", address: "654 Cedar Lane",
        status: "active", assignedDoctor: "Dr. David Chen", diagnosis: "Routine prenatal checkup",
    },
];

// ── Appointments ──────────────────────────────────────────────────────

export const mockDoctorAppointments: Appointment[] = [
    { id: "apt-001", patientId: "pat-001", patientName: "Emily Johnson", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "09:00", duration: 30, status: "scheduled", type: "follow-up" },
    { id: "apt-002", patientId: "pat-004", patientName: "Michael Lee", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "09:45", duration: 45, status: "in-progress", type: "consultation" },
    { id: "apt-003", patientId: "pat-005", patientName: "Jessica Martinez", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "10:30", duration: 30, status: "scheduled", type: "consultation" },
    { id: "apt-004", patientId: "pat-003", patientName: "Sarah Davis", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "11:15", duration: 20, status: "scheduled", type: "follow-up" },
    { id: "apt-005", patientId: "pat-002", patientName: "Robert Williams", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "14:00", duration: 45, status: "scheduled", type: "procedure", notes: "ECG + cardiac enzyme review" },
    { id: "apt-006", patientId: "pat-001", patientName: "Emily Johnson", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-11", time: "09:30", duration: 30, status: "scheduled", type: "follow-up" },
    { id: "apt-007", patientId: "pat-005", patientName: "Jessica Martinez", doctorId: "usr-002", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-11", time: "11:00", duration: 30, status: "scheduled", type: "follow-up", notes: "Prenatal checkup week 20" },
];

// ── Alerts ─────────────────────────────────────────────────────────────

export const mockDoctorAlerts = [
    { id: 1, message: "Critical lab result: Robert Williams — Troponin elevated", severity: "critical" as const, time: "5 min ago" },
    { id: 2, message: "Drug interaction alert: Michael Lee — Aspirin contraindicated", severity: "warning" as const, time: "20 min ago" },
    { id: 3, message: "Pending approval: Sarah Davis discharge summary", severity: "info" as const, time: "1 hr ago" },
];

// ── Encounters ─────────────────────────────────────────────────────────

export const mockEncounters: Encounter[] = [
    {
        id: "ENC-001", patientId: "pat-001", patientName: "Emily Johnson", date: "2026-03-10T09:00:00",
        subjective: "Patient reports feeling well. Blood sugar levels have been stable with current regimen. Occasional mild fatigue in the afternoon.",
        objective: "BP 128/82, HR 76, Temp 98.4°F, SpO2 99%. Fasting glucose 142 mg/dL. HbA1c 7.1%. No peripheral edema, foot exam normal.",
        assessment: "Type 2 Diabetes Mellitus — improving control with current therapy. HbA1c trending down from 7.8% three months ago.",
        plan: "1. Continue metformin 1000mg BID\n2. Add glipizide 5mg daily\n3. Recheck HbA1c in 3 months\n4. Refer to nutritionist\n5. Follow up in 4 weeks",
        status: "completed", authorId: "usr-002", authorName: "Dr. David Chen", visitType: "inpatient", signedAt: "2026-03-10T09:35:00",
    },
    {
        id: "ENC-002", patientId: "pat-002", patientName: "Robert Williams", date: "2026-03-09T14:30:00",
        subjective: "Patient presents with acute chest pain, radiating to left arm. Onset 2 hours ago. Associated with diaphoresis and nausea. History of smoking (20 pack-years).",
        objective: "BP 158/95, HR 102, Temp 98.6°F, SpO2 94%. ECG: ST elevation in leads II, III, aVF. Troponin I: 4.2 ng/mL (critical high). CK-MB: 42 U/L.",
        assessment: "Acute ST-elevation myocardial infarction (STEMI) — inferior wall. High-risk presentation with elevated troponin.",
        plan: "1. STAT: Cardiology consult for PCI\n2. Heparin drip per protocol\n3. Dual antiplatelet: ASA 325mg + Clopidogrel 600mg load\n4. Continuous telemetry monitoring\n5. Serial troponins q6h\n6. NPO for potential cath lab",
        status: "signed", authorId: "usr-002", authorName: "Dr. David Chen", visitType: "emergency", signedAt: "2026-03-09T15:10:00",
    },
    {
        id: "ENC-003", patientId: "pat-003", patientName: "Sarah Davis", date: "2026-03-10T08:00:00",
        subjective: "POD#3 from laparoscopic appendectomy. Patient reports wound pain improving. Tolerating clear liquids. No nausea or vomiting. First bowel movement this morning.",
        objective: "BP 118/72, HR 68, Temp 98.2°F. Abdomen soft, mild tenderness at incision sites. No erythema or drainage. Bowel sounds active.",
        assessment: "Post-appendectomy recovery — progressing well. Ready to advance diet and prepare for discharge.",
        plan: "1. Advance to regular diet\n2. Transition to oral pain meds (Tylenol 500mg q6h PRN)\n3. Discontinue IV fluids\n4. Plan discharge tomorrow AM\n5. Follow-up in 2 weeks",
        status: "in-progress", authorId: "usr-002", authorName: "Dr. David Chen", visitType: "inpatient",
    },
    {
        id: "ENC-004", patientId: "pat-004", patientName: "Michael Lee", date: "2026-03-10T09:45:00",
        subjective: "New consult for uncontrolled hypertension. Patient reports headaches and occasional dizziness. Currently on lisinopril 20mg daily. Home BP readings 145-160/90-100.",
        objective: "BP 152/96, HR 82, BMI 31. Fundoscopy: mild arteriolar narrowing. No S3/S4. ECG: LVH by voltage criteria. BMP: Cr 1.1, K 4.2.",
        assessment: "Chronic hypertension, uncontrolled on monotherapy. Target organ changes present (LVH, retinopathy).",
        plan: "1. Add amlodipine 5mg daily\n2. Low-sodium diet counseling\n3. 24-hour ambulatory BP monitoring\n4. Echocardiogram to assess LVH\n5. Recheck in 2 weeks",
        status: "in-progress", authorId: "usr-002", authorName: "Dr. David Chen", visitType: "outpatient",
    },
];

// ── Diagnoses ──────────────────────────────────────────────────────────

export const mockDiagnoses: Diagnosis[] = [
    { id: "DX-001", patientId: "pat-001", code: "E11.65", description: "Type 2 diabetes mellitus with hyperglycemia", type: "primary", diagnosedAt: "2026-01-15", diagnosedBy: "Dr. David Chen", status: "active" },
    { id: "DX-002", patientId: "pat-002", code: "I21.19", description: "ST elevation myocardial infarction involving other coronary artery of inferior wall", type: "admitting", diagnosedAt: "2026-03-09", diagnosedBy: "Dr. David Chen", status: "active" },
    { id: "DX-003", patientId: "pat-002", code: "I10", description: "Essential hypertension", type: "secondary", diagnosedAt: "2020-05-10", diagnosedBy: "Dr. Sarah Kim", status: "active" },
    { id: "DX-004", patientId: "pat-003", code: "K35.80", description: "Unspecified acute appendicitis", type: "admitting", diagnosedAt: "2026-03-07", diagnosedBy: "Dr. Sarah Kim", status: "resolved" },
    { id: "DX-005", patientId: "pat-004", code: "I10", description: "Essential hypertension", type: "primary", diagnosedAt: "2024-06-20", diagnosedBy: "Dr. David Chen", status: "active" },
    { id: "DX-006", patientId: "pat-005", code: "Z34.00", description: "Encounter for supervision of normal first pregnancy, unspecified trimester", type: "primary", diagnosedAt: "2026-01-10", diagnosedBy: "Dr. David Chen", status: "active" },
];

// ── Orders ─────────────────────────────────────────────────────────────

export const mockOrders: OrderItem[] = [
    { id: "ORD-001", patientId: "pat-001", patientName: "Emily Johnson", category: "lab", name: "HbA1c", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T09:30:00", priority: "normal", status: "pending" },
    { id: "ORD-002", patientId: "pat-001", patientName: "Emily Johnson", category: "lab", name: "Fasting Lipid Panel", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T09:30:00", priority: "normal", status: "pending" },
    { id: "ORD-003", patientId: "pat-002", patientName: "Robert Williams", category: "lab", name: "Troponin I — Serial", orderedBy: "Dr. David Chen", orderedAt: "2026-03-09T14:40:00", priority: "stat", status: "completed", completedAt: "2026-03-09T15:30:00" },
    { id: "ORD-004", patientId: "pat-002", patientName: "Robert Williams", category: "imaging", name: "Echocardiogram", orderedBy: "Dr. David Chen", orderedAt: "2026-03-09T15:00:00", priority: "urgent", status: "in-progress" },
    { id: "ORD-005", patientId: "pat-002", patientName: "Robert Williams", category: "consult", name: "Cardiology — PCI evaluation", orderedBy: "Dr. David Chen", orderedAt: "2026-03-09T14:45:00", priority: "stat", status: "completed" },
    { id: "ORD-006", patientId: "pat-004", patientName: "Michael Lee", category: "imaging", name: "Echocardiogram — LVH assessment", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T10:00:00", priority: "normal", status: "pending" },
    { id: "ORD-007", patientId: "pat-004", patientName: "Michael Lee", category: "lab", name: "BMP + Lipid Panel", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T10:00:00", priority: "normal", status: "pending" },
    { id: "ORD-008", patientId: "pat-003", patientName: "Sarah Davis", category: "lab", name: "CBC with Diff", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T08:15:00", priority: "normal", status: "completed", completedAt: "2026-03-10T09:00:00" },
    { id: "ORD-009", patientId: "pat-005", patientName: "Jessica Martinez", category: "imaging", name: "Obstetric Ultrasound — 20wk anatomy scan", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T10:45:00", priority: "normal", status: "pending" },
    { id: "ORD-010", patientId: "pat-001", patientName: "Emily Johnson", category: "consult", name: "Nutrition — Diabetes diet counseling", orderedBy: "Dr. David Chen", orderedAt: "2026-03-10T09:35:00", priority: "normal", status: "pending" },
];

// ── Prescriptions ──────────────────────────────────────────────────────

export const mockPrescriptions: Prescription[] = [
    { id: "RX-001", patientId: "pat-001", patientName: "Emily Johnson", medication: "Metformin", dosage: "1000mg", route: "oral", frequency: "BID (twice daily)", quantity: 60, refills: 3, sig: "Take 1 tablet by mouth twice daily with meals", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-10T09:35:00", startDate: "2026-03-10", status: "active" },
    { id: "RX-002", patientId: "pat-001", patientName: "Emily Johnson", medication: "Glipizide", dosage: "5mg", route: "oral", frequency: "QD (once daily)", quantity: 30, refills: 3, sig: "Take 1 tablet by mouth once daily before breakfast", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-10T09:35:00", startDate: "2026-03-10", status: "active" },
    { id: "RX-003", patientId: "pat-002", patientName: "Robert Williams", medication: "Heparin", dosage: "18 units/kg/hr", route: "iv", frequency: "Continuous infusion", quantity: 1, refills: 0, sig: "IV infusion per protocol — titrate to aPTT 60-80 sec", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-09T14:50:00", startDate: "2026-03-09", status: "active" },
    { id: "RX-004", patientId: "pat-002", patientName: "Robert Williams", medication: "Clopidogrel", dosage: "75mg", route: "oral", frequency: "QD", quantity: 30, refills: 5, sig: "Take 1 tablet by mouth once daily", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-09T15:00:00", startDate: "2026-03-09", status: "active" },
    { id: "RX-005", patientId: "pat-003", patientName: "Sarah Davis", medication: "Acetaminophen", dosage: "500mg", route: "oral", frequency: "Q6H PRN", quantity: 20, refills: 0, sig: "Take 1 tablet by mouth every 6 hours as needed for pain", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-10T08:20:00", startDate: "2026-03-10", status: "active" },
    { id: "RX-006", patientId: "pat-004", patientName: "Michael Lee", medication: "Lisinopril", dosage: "20mg", route: "oral", frequency: "QD", quantity: 30, refills: 5, sig: "Take 1 tablet by mouth once daily", prescribedBy: "Dr. David Chen", prescribedAt: "2024-06-20T00:00:00", startDate: "2024-06-20", status: "active" },
    { id: "RX-007", patientId: "pat-004", patientName: "Michael Lee", medication: "Amlodipine", dosage: "5mg", route: "oral", frequency: "QD", quantity: 30, refills: 5, sig: "Take 1 tablet by mouth once daily", prescribedBy: "Dr. David Chen", prescribedAt: "2026-03-10T10:00:00", startDate: "2026-03-10", status: "active" },
];

// ── Results ────────────────────────────────────────────────────────────

export const mockResults: ResultItem[] = [
    { id: "RES-001", patientId: "pat-002", patientName: "Robert Williams", orderId: "ORD-003", category: "lab", testName: "Troponin I", value: "4.2", unit: "ng/mL", referenceRange: "0.0 – 0.04", flag: "critical", reportedAt: "2026-03-09T15:30:00", notes: "Markedly elevated — consistent with acute MI" },
    { id: "RES-002", patientId: "pat-002", patientName: "Robert Williams", orderId: "ORD-003", category: "lab", testName: "CK-MB", value: "42", unit: "U/L", referenceRange: "0 – 25", flag: "high", reportedAt: "2026-03-09T15:30:00" },
    { id: "RES-003", patientId: "pat-002", patientName: "Robert Williams", orderId: "ORD-003", category: "lab", testName: "BNP", value: "820", unit: "pg/mL", referenceRange: "0 – 100", flag: "critical", reportedAt: "2026-03-09T16:00:00", notes: "Suggests heart failure" },
    { id: "RES-004", patientId: "pat-001", patientName: "Emily Johnson", orderId: "ORD-001", category: "lab", testName: "HbA1c", value: "7.1", unit: "%", referenceRange: "4.0 – 5.6", flag: "high", reportedAt: "2026-03-10T10:30:00" },
    { id: "RES-005", patientId: "pat-001", patientName: "Emily Johnson", orderId: "ORD-002", category: "lab", testName: "LDL Cholesterol", value: "142", unit: "mg/dL", referenceRange: "< 100", flag: "high", reportedAt: "2026-03-10T10:30:00" },
    { id: "RES-006", patientId: "pat-001", patientName: "Emily Johnson", orderId: "ORD-002", category: "lab", testName: "HDL Cholesterol", value: "52", unit: "mg/dL", referenceRange: "> 40", flag: "normal", reportedAt: "2026-03-10T10:30:00" },
    { id: "RES-007", patientId: "pat-003", patientName: "Sarah Davis", orderId: "ORD-008", category: "lab", testName: "WBC", value: "8.2", unit: "K/uL", referenceRange: "4.5 – 11.0", flag: "normal", reportedAt: "2026-03-10T09:00:00" },
    { id: "RES-008", patientId: "pat-003", patientName: "Sarah Davis", orderId: "ORD-008", category: "lab", testName: "Hemoglobin", value: "11.8", unit: "g/dL", referenceRange: "12.0 – 16.0", flag: "low", reportedAt: "2026-03-10T09:00:00", notes: "Mild anemia — likely post-surgical" },
    { id: "RES-009", patientId: "pat-004", patientName: "Michael Lee", orderId: "ORD-007", category: "lab", testName: "Creatinine", value: "1.1", unit: "mg/dL", referenceRange: "0.7 – 1.3", flag: "normal", reportedAt: "2026-03-10T11:00:00" },
    { id: "RES-010", patientId: "pat-004", patientName: "Michael Lee", orderId: "ORD-007", category: "lab", testName: "Potassium", value: "4.2", unit: "mEq/L", referenceRange: "3.5 – 5.0", flag: "normal", reportedAt: "2026-03-10T11:00:00" },
];

// ── CDSS Suggestions ──────────────────────────────────────────────────

export const mockCDSSSuggestions = [
    { id: "CDSS-001", patientId: "pat-001", type: "recommendation" as const, severity: "info" as const, title: "Consider statin therapy", message: "LDL 142 mg/dL exceeds ADA target of < 100 mg/dL. Consider atorvastatin 20mg per ADA guidelines.", source: "ADA Clinical Practice Standards 2026" },
    { id: "CDSS-002", patientId: "pat-002", type: "alert" as const, severity: "critical" as const, title: "Drug interaction warning", message: "Heparin + NSAIDs: Increased bleeding risk. Patient has Sulfa allergy — verify alternative choices.", source: "Drug Interaction Database" },
    { id: "CDSS-003", patientId: "pat-004", type: "alert" as const, severity: "warning" as const, title: "Aspirin contraindication", message: "Patient has documented Aspirin allergy. Ensure no aspirin-containing medications are ordered.", source: "Allergy Database" },
    { id: "CDSS-004", patientId: "pat-003", type: "recommendation" as const, severity: "info" as const, title: "DVT prophylaxis reminder", message: "Post-surgical patient POD#3. Consider enoxaparin 40mg SC daily until ambulating.", source: "ACCP Guidelines" },
    { id: "CDSS-005", patientId: "pat-005", type: "recommendation" as const, severity: "info" as const, title: "Prenatal screening due", message: "Week 20 — recommend anatomy ultrasound and quad screen if not already performed.", source: "ACOG Practice Bulletin" },
];

// ── Referrals ──────────────────────────────────────────────────────────

export const mockReferrals: Referral[] = [
    { id: "REF-001", patientId: "pat-002", patientName: "Robert Williams", fromDoctor: "Dr. David Chen", toDoctor: "Dr. James Park", toDepartment: "Cardiology", reason: "PCI evaluation — acute STEMI", urgency: "stat", status: "completed", createdAt: "2026-03-09T14:45:00" },
    { id: "REF-002", patientId: "pat-001", patientName: "Emily Johnson", fromDoctor: "Dr. David Chen", toDoctor: "Lisa Wong, RD", toDepartment: "Nutrition", reason: "Diabetes diet counseling — newly adjusted medications", urgency: "routine", status: "pending", createdAt: "2026-03-10T09:35:00" },
    { id: "REF-003", patientId: "pat-004", patientName: "Michael Lee", fromDoctor: "Dr. David Chen", toDoctor: "Dr. Sarah Kim", toDepartment: "Cardiology", reason: "Echocardiogram interpretation + LVH workup", urgency: "routine", status: "pending", createdAt: "2026-03-10T10:05:00" },
];
