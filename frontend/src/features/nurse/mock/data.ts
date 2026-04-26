import type { Patient, VitalEntry, IntakeOutput, PainEntry, WoundNote, MAREntry, NursingTask, NursingNote, HandoffEntry, DischargeChecklistItem } from "@/types";

// ── Ward Patients (reuse doctor patients with nurse-specific fields) ──

export const mockWardPatients: (Patient & { diagnosis?: string; assignedNurse?: string; acuity?: "low" | "medium" | "high" | "critical" })[] = [
    {
        id: "pat-001", mrn: "MRN-2024-001", firstName: "Emily", lastName: "Johnson", dateOfBirth: "1985-03-15",
        gender: "female", phone: "+1-555-0101", email: "emily.j@email.com", address: "123 Oak Street",
        bloodType: "A+", allergies: ["Penicillin"], status: "admitted", ward: "Ward A", roomNumber: "201",
        admissionDate: "2026-03-08", assignedDoctor: "Dr. David Chen", diagnosis: "Type 2 Diabetes - management",
        assignedNurse: "Maria Garcia", acuity: "medium",
    },
    {
        id: "pat-002", mrn: "MRN-2024-002", firstName: "Robert", lastName: "Williams", dateOfBirth: "1972-07-22",
        gender: "male", phone: "+1-555-0102", email: "r.williams@email.com", address: "456 Maple Ave",
        bloodType: "O-", allergies: ["Sulfa drugs", "Latex"], status: "critical", ward: "ICU", roomNumber: "ICU-03",
        admissionDate: "2026-03-09", assignedDoctor: "Dr. David Chen", diagnosis: "Acute MI — post PCI",
        assignedNurse: "Maria Garcia", acuity: "critical",
    },
    {
        id: "pat-003", mrn: "MRN-2024-003", firstName: "Sarah", lastName: "Davis", dateOfBirth: "1990-11-08",
        gender: "female", phone: "+1-555-0103", email: "sarah.d@email.com", address: "789 Pine Road",
        bloodType: "B+", allergies: [], status: "stable", ward: "Ward B", roomNumber: "312",
        admissionDate: "2026-03-07", assignedDoctor: "Dr. David Chen", diagnosis: "Post-appendectomy recovery",
        assignedNurse: "Maria Garcia", acuity: "low",
    },
    {
        id: "pat-004", mrn: "MRN-2024-004", firstName: "Michael", lastName: "Lee", dateOfBirth: "1968-01-30",
        gender: "male", phone: "+1-555-0104", email: "m.lee@email.com", address: "321 Elm Drive",
        bloodType: "AB+", allergies: ["Aspirin"], status: "admitted", ward: "Ward A", roomNumber: "215",
        admissionDate: "2026-03-10", assignedDoctor: "Dr. David Chen", diagnosis: "Hypertension evaluation",
        assignedNurse: "Maria Garcia", acuity: "medium",
    },
    {
        id: "pat-006", mrn: "MRN-2024-006", firstName: "Linda", lastName: "Thompson", dateOfBirth: "1958-09-14",
        gender: "female", phone: "+1-555-0106", email: "l.thompson@email.com", address: "147 Birch St",
        bloodType: "A-", allergies: ["Codeine"], status: "admitted", ward: "Ward A", roomNumber: "218",
        admissionDate: "2026-03-11", assignedDoctor: "Dr. Sarah Kim", diagnosis: "COPD exacerbation",
        assignedNurse: "Maria Garcia", acuity: "high",
    },
];

// ── Vitals Flowsheet ──────────────────────────────────────────────────

export const mockVitals: VitalEntry[] = [
    { id: "VIT-001", patientId: "pat-001", patientName: "Emily Johnson", timestamp: "2026-03-13T06:00:00", systolic: 128, diastolic: 82, heartRate: 76, temperature: 98.4, spo2: 99, respiratoryRate: 16, painScore: 2, recordedBy: "Maria Garcia" },
    { id: "VIT-002", patientId: "pat-001", patientName: "Emily Johnson", timestamp: "2026-03-13T10:00:00", systolic: 130, diastolic: 84, heartRate: 78, temperature: 98.6, spo2: 98, respiratoryRate: 16, painScore: 1, recordedBy: "Maria Garcia" },
    { id: "VIT-003", patientId: "pat-001", patientName: "Emily Johnson", timestamp: "2026-03-13T14:00:00", systolic: 126, diastolic: 80, heartRate: 74, temperature: 98.2, spo2: 99, respiratoryRate: 18, painScore: 0, recordedBy: "Maria Garcia" },
    { id: "VIT-004", patientId: "pat-002", patientName: "Robert Williams", timestamp: "2026-03-13T06:00:00", systolic: 148, diastolic: 92, heartRate: 98, temperature: 99.1, spo2: 94, respiratoryRate: 22, painScore: 7, gcs: 15, recordedBy: "Maria Garcia" },
    { id: "VIT-005", patientId: "pat-002", patientName: "Robert Williams", timestamp: "2026-03-13T08:00:00", systolic: 142, diastolic: 88, heartRate: 92, temperature: 98.8, spo2: 95, respiratoryRate: 20, painScore: 6, gcs: 15, recordedBy: "Maria Garcia" },
    { id: "VIT-006", patientId: "pat-002", patientName: "Robert Williams", timestamp: "2026-03-13T10:00:00", systolic: 138, diastolic: 86, heartRate: 88, temperature: 98.6, spo2: 96, respiratoryRate: 18, painScore: 4, gcs: 15, recordedBy: "Maria Garcia" },
    { id: "VIT-007", patientId: "pat-003", patientName: "Sarah Davis", timestamp: "2026-03-13T06:00:00", systolic: 118, diastolic: 72, heartRate: 68, temperature: 98.2, spo2: 99, respiratoryRate: 14, painScore: 3, recordedBy: "Maria Garcia" },
    { id: "VIT-008", patientId: "pat-003", patientName: "Sarah Davis", timestamp: "2026-03-13T10:00:00", systolic: 116, diastolic: 70, heartRate: 66, temperature: 98.0, spo2: 99, respiratoryRate: 14, painScore: 2, recordedBy: "Maria Garcia" },
    { id: "VIT-009", patientId: "pat-004", patientName: "Michael Lee", timestamp: "2026-03-13T06:00:00", systolic: 152, diastolic: 96, heartRate: 82, temperature: 98.4, spo2: 98, respiratoryRate: 16, painScore: 0, recordedBy: "Maria Garcia" },
    { id: "VIT-010", patientId: "pat-004", patientName: "Michael Lee", timestamp: "2026-03-13T10:00:00", systolic: 148, diastolic: 94, heartRate: 80, temperature: 98.6, spo2: 98, respiratoryRate: 16, painScore: 0, recordedBy: "Maria Garcia" },
    { id: "VIT-011", patientId: "pat-006", patientName: "Linda Thompson", timestamp: "2026-03-13T06:00:00", systolic: 134, diastolic: 78, heartRate: 88, temperature: 99.4, spo2: 91, respiratoryRate: 24, painScore: 4, recordedBy: "Maria Garcia" },
    { id: "VIT-012", patientId: "pat-006", patientName: "Linda Thompson", timestamp: "2026-03-13T10:00:00", systolic: 130, diastolic: 76, heartRate: 84, temperature: 99.0, spo2: 93, respiratoryRate: 22, painScore: 3, recordedBy: "Maria Garcia" },
];

// ── Intake / Output ───────────────────────────────────────────────────

export const mockIO: IntakeOutput[] = [
    { id: "IO-001", patientId: "pat-002", patientName: "Robert Williams", timestamp: "2026-03-13T06:00:00", direction: "intake", type: "iv", amount: 250, recordedBy: "Maria Garcia", notes: "NS 0.9% running @ 125mL/hr" },
    { id: "IO-002", patientId: "pat-002", patientName: "Robert Williams", timestamp: "2026-03-13T08:00:00", direction: "output", type: "urine", amount: 300, recordedBy: "Maria Garcia" },
    { id: "IO-003", patientId: "pat-002", patientName: "Robert Williams", timestamp: "2026-03-13T10:00:00", direction: "intake", type: "iv", amount: 250, recordedBy: "Maria Garcia" },
    { id: "IO-004", patientId: "pat-003", patientName: "Sarah Davis", timestamp: "2026-03-13T07:00:00", direction: "intake", type: "oral", amount: 240, recordedBy: "Maria Garcia", notes: "Clear liquids tolerated" },
    { id: "IO-005", patientId: "pat-003", patientName: "Sarah Davis", timestamp: "2026-03-13T09:00:00", direction: "output", type: "urine", amount: 350, recordedBy: "Maria Garcia" },
    { id: "IO-006", patientId: "pat-006", patientName: "Linda Thompson", timestamp: "2026-03-13T06:00:00", direction: "intake", type: "iv", amount: 200, recordedBy: "Maria Garcia" },
    { id: "IO-007", patientId: "pat-006", patientName: "Linda Thompson", timestamp: "2026-03-13T08:00:00", direction: "intake", type: "oral", amount: 120, recordedBy: "Maria Garcia" },
];

// ── eMAR ──────────────────────────────────────────────────────────────

export const mockMAR: MAREntry[] = [
    { id: "MAR-001", patientId: "pat-001", patientName: "Emily Johnson", medication: "Metformin 1000mg", dosage: "1000mg", route: "oral", scheduledTime: "2026-03-13T08:00:00", administeredTime: "2026-03-13T08:05:00", administeredBy: "Maria Garcia", status: "given", barcode: "RX001-MET" },
    { id: "MAR-002", patientId: "pat-001", patientName: "Emily Johnson", medication: "Glipizide 5mg", dosage: "5mg", route: "oral", scheduledTime: "2026-03-13T07:30:00", administeredTime: "2026-03-13T07:35:00", administeredBy: "Maria Garcia", status: "given", barcode: "RX002-GLI" },
    { id: "MAR-003", patientId: "pat-001", patientName: "Emily Johnson", medication: "Metformin 1000mg", dosage: "1000mg", route: "oral", scheduledTime: "2026-03-13T20:00:00", status: "scheduled", barcode: "RX001-MET" },
    { id: "MAR-004", patientId: "pat-002", patientName: "Robert Williams", medication: "Heparin drip", dosage: "18 units/kg/hr", route: "iv", scheduledTime: "2026-03-13T06:00:00", administeredTime: "2026-03-13T06:00:00", administeredBy: "Maria Garcia", status: "given", barcode: "RX003-HEP" },
    { id: "MAR-005", patientId: "pat-002", patientName: "Robert Williams", medication: "Clopidogrel 75mg", dosage: "75mg", route: "oral", scheduledTime: "2026-03-13T09:00:00", administeredTime: "2026-03-13T09:10:00", administeredBy: "Maria Garcia", status: "given", barcode: "RX004-CLO" },
    { id: "MAR-006", patientId: "pat-002", patientName: "Robert Williams", medication: "Atorvastatin 40mg", dosage: "40mg", route: "oral", scheduledTime: "2026-03-13T21:00:00", status: "scheduled", barcode: "RX005-ATO" },
    { id: "MAR-007", patientId: "pat-003", patientName: "Sarah Davis", medication: "Acetaminophen 500mg", dosage: "500mg", route: "oral", scheduledTime: "2026-03-13T06:00:00", administeredTime: "2026-03-13T06:15:00", administeredBy: "Maria Garcia", status: "given" },
    { id: "MAR-008", patientId: "pat-003", patientName: "Sarah Davis", medication: "Acetaminophen 500mg", dosage: "500mg", route: "oral", scheduledTime: "2026-03-13T12:00:00", status: "overdue" },
    { id: "MAR-009", patientId: "pat-004", patientName: "Michael Lee", medication: "Lisinopril 20mg", dosage: "20mg", route: "oral", scheduledTime: "2026-03-13T08:00:00", administeredTime: "2026-03-13T08:10:00", administeredBy: "Maria Garcia", status: "given" },
    { id: "MAR-010", patientId: "pat-004", patientName: "Michael Lee", medication: "Amlodipine 5mg", dosage: "5mg", route: "oral", scheduledTime: "2026-03-13T08:00:00", administeredTime: "2026-03-13T08:10:00", administeredBy: "Maria Garcia", status: "given" },
    { id: "MAR-011", patientId: "pat-006", patientName: "Linda Thompson", medication: "Albuterol nebulizer", dosage: "2.5mg", route: "inhaled", scheduledTime: "2026-03-13T06:00:00", administeredTime: "2026-03-13T06:10:00", administeredBy: "Maria Garcia", status: "given" },
    { id: "MAR-012", patientId: "pat-006", patientName: "Linda Thompson", medication: "Prednisone 40mg", dosage: "40mg", route: "oral", scheduledTime: "2026-03-13T09:00:00", status: "missed", notes: "Patient refused — nausea" },
    { id: "MAR-013", patientId: "pat-006", patientName: "Linda Thompson", medication: "Albuterol nebulizer", dosage: "2.5mg", route: "inhaled", scheduledTime: "2026-03-13T14:00:00", status: "overdue" },
];

// ── Nursing Tasks ─────────────────────────────────────────────────────

export const mockNursingTasks: NursingTask[] = [
    { id: "NT-001", patientId: "pat-002", patientName: "Robert Williams", room: "ICU-03", type: "vitals", description: "Q2H vital signs", priority: "urgent", dueTime: "2026-03-13T12:00:00", status: "overdue", isOverdue: true },
    { id: "NT-002", patientId: "pat-002", patientName: "Robert Williams", room: "ICU-03", type: "io-check", description: "Hourly I&O check — Foley catheter", priority: "high", dueTime: "2026-03-13T13:00:00", status: "pending", isOverdue: false },
    { id: "NT-003", patientId: "pat-001", patientName: "Emily Johnson", room: "201", type: "medication", description: "Blood glucose check + insulin PRN", priority: "normal", dueTime: "2026-03-13T11:30:00", status: "overdue", isOverdue: true },
    { id: "NT-004", patientId: "pat-003", patientName: "Sarah Davis", room: "312", type: "wound-care", description: "Surgical site dressing change", priority: "normal", dueTime: "2026-03-13T14:00:00", status: "pending", isOverdue: false },
    { id: "NT-005", patientId: "pat-003", patientName: "Sarah Davis", room: "312", type: "ambulation", description: "Assist with ambulation — 2nd today", priority: "low", dueTime: "2026-03-13T15:00:00", status: "pending", isOverdue: false },
    { id: "NT-006", patientId: "pat-004", patientName: "Michael Lee", room: "215", type: "vitals", description: "Q4H vital signs", priority: "normal", dueTime: "2026-03-13T14:00:00", status: "pending", isOverdue: false },
    { id: "NT-007", patientId: "pat-006", patientName: "Linda Thompson", room: "218", type: "assessment", description: "Respiratory assessment — SpO2 trending low", priority: "urgent", dueTime: "2026-03-13T12:30:00", status: "overdue", isOverdue: true },
    { id: "NT-008", patientId: "pat-006", patientName: "Linda Thompson", room: "218", type: "medication", description: "Nebulizer treatment due", priority: "high", dueTime: "2026-03-13T14:00:00", status: "pending", isOverdue: false },
    { id: "NT-009", patientId: "pat-001", patientName: "Emily Johnson", room: "201", type: "education", description: "Diabetes self-management education", priority: "low", dueTime: "2026-03-13T16:00:00", status: "pending", isOverdue: false },
    { id: "NT-010", patientId: "pat-002", patientName: "Robert Williams", room: "ICU-03", type: "assessment", description: "Neuro check — GCS assessment", priority: "urgent", dueTime: "2026-03-13T06:00:00", completedTime: "2026-03-13T06:05:00", completedBy: "Maria Garcia", status: "completed", isOverdue: false },
];

// ── Nursing Notes ─────────────────────────────────────────────────────

export const mockNursingNotes: NursingNote[] = [
    { id: "NN-001", patientId: "pat-002", patientName: "Robert Williams", category: "assessment", content: "Patient alert and oriented x3. Chest pain 4/10, down from 7/10 at admission. Telemetry shows NSR with occasional PVCs. O2 at 3L NC maintaining SpO2 94-96%. Peripheral pulses 2+ bilaterally. IV heparin infusing per protocol.", timestamp: "2026-03-13T06:15:00", authorName: "Maria Garcia" },
    { id: "NN-002", patientId: "pat-002", patientName: "Robert Williams", category: "care", content: "Assisted with oral care and bed bath. Skin intact. SCDs on bilaterally. HOB elevated 30°. Foley patent, draining clear yellow urine.", timestamp: "2026-03-13T07:30:00", authorName: "Maria Garcia" },
    { id: "NN-003", patientId: "pat-001", patientName: "Emily Johnson", category: "assessment", content: "Patient reports feeling well. Fasting blood glucose 138 mg/dL this AM. Feet examined — no lesions, pulses palpable. Diet tolerated well.", timestamp: "2026-03-13T06:30:00", authorName: "Maria Garcia" },
    { id: "NN-004", patientId: "pat-003", patientName: "Sarah Davis", category: "care", content: "Surgical incision sites clean, dry, and intact. No erythema or drainage. Patient ambulated in hallway with assistance x 1. Tolerated activity well. Advanced to regular diet per orders.", timestamp: "2026-03-13T08:00:00", authorName: "Maria Garcia" },
    { id: "NN-005", patientId: "pat-006", patientName: "Linda Thompson", category: "assessment", content: "Increased work of breathing noted at 0600. SpO2 91% on 2L NC — increased to 3L NC with improvement to 93%. Bilateral wheezes on auscultation. Nebulizer treatment administered. Notified Dr. Kim — orders received for Q4H nebs and chest X-ray.", timestamp: "2026-03-13T06:20:00", authorName: "Maria Garcia" },
    { id: "NN-006", patientId: "pat-006", patientName: "Linda Thompson", category: "communication", content: "Called Dr. Kim regarding persistent low SpO2. New orders: increase O2 to 4L NC if SpO2 < 92%, add Ipratropium to neb treatments, stat portable CXR.", timestamp: "2026-03-13T07:00:00", authorName: "Maria Garcia" },
    { id: "NN-007", patientId: "pat-004", patientName: "Michael Lee", category: "education", content: "Reviewed low-sodium diet with patient and wife. Discussed BP monitoring at home. Patient verbalized understanding of medication schedule (Lisinopril AM, Amlodipine AM). Provided written materials.", timestamp: "2026-03-13T09:30:00", authorName: "Maria Garcia" },
];

// ── Handoff (SBAR) ────────────────────────────────────────────────────

export const mockHandoffs: HandoffEntry[] = [
    {
        id: "HO-001", patientId: "pat-002", patientName: "Robert Williams", room: "ICU-03",
        situation: "53yo M admitted 3/9 with acute STEMI, s/p PCI. Currently on heparin drip, telemetry, cardiac monitoring.",
        background: "Hx: HTN, 20 pack-year smoking. Troponin peaked at 4.2. PCI to RCA with drug-eluting stent 3/9. EF 40% on echo.",
        assessment: "Chest pain improving (4/10 → 2/10). SpO2 stable 94-96% on 3L NC. BP trending down but still elevated. Alert and oriented.",
        recommendation: "Continue Q2H vitals, heparin per protocol, serial troponins. Watch for bleeding signs. Cardiology follow-up tomorrow AM. NPO after midnight for possible repeat cath.",
        fromNurse: "Maria Garcia", toNurse: "James Wilson", shiftDate: "2026-03-13", shiftType: "day",
    },
    {
        id: "HO-002", patientId: "pat-006", patientName: "Linda Thompson", room: "218",
        situation: "68yo F admitted 3/11 for COPD exacerbation. Respiratory distress this AM — SpO2 dropped to 91%.",
        background: "Severe COPD, FEV1 35%. Home on 2L O2. Current meds: albuterol nebs Q4H, prednisone 40mg daily, ipratropium added today.",
        assessment: "SpO2 improved to 93% on 3L NC after neb treatment. Bilateral wheezes persist. Refused prednisone this AM due to nausea. CXR ordered.",
        recommendation: "Re-attempt prednisone with anti-emetic. Continue Q4H nebs. Monitor SpO2 closely — escalate to 4L if < 92%. Follow up on CXR results. May need BiPAP if continues to decline.",
        fromNurse: "Maria Garcia", toNurse: "James Wilson", shiftDate: "2026-03-13", shiftType: "day",
    },
    {
        id: "HO-003", patientId: "pat-001", patientName: "Emily Johnson", room: "201",
        situation: "41yo F, admitted 3/8 for DM2 management. Blood sugars stabilizing on current regimen.",
        background: "HbA1c 7.1%, on Metformin 1000 BID + Glipizide 5mg daily. No complications. Penicillin allergy.",
        assessment: "FBG 138 today — improving trend. No hypo episodes. Tolerating diet. Ambulating independently.",
        recommendation: "Continue current meds. Check BG AC meals + HS. Nutritionist consult pending. Possible discharge tomorrow if BG stable.",
        fromNurse: "Maria Garcia", toNurse: "James Wilson", shiftDate: "2026-03-13", shiftType: "day",
    },
    {
        id: "HO-004", patientId: "pat-003", patientName: "Sarah Davis", room: "312",
        situation: "35yo F, POD#6 from lap appy. Discharge planning in progress.",
        background: "Uncomplicated appendectomy 3/7. Mild post-op anemia (Hgb 11.8). No surgical complications.",
        assessment: "Incisions healing well. Tolerating regular diet. Ambulating independently. Pain controlled on PO Tylenol.",
        recommendation: "Discharge checklist in progress. Needs: wound care instructions, follow-up appointment, Rx for Tylenol PRN. Target discharge today PM or tomorrow AM.",
        fromNurse: "Maria Garcia", toNurse: "James Wilson", shiftDate: "2026-03-13", shiftType: "day",
    },
];

// ── Discharge Checklist ───────────────────────────────────────────────

export const mockDischargeChecklist: DischargeChecklistItem[] = [
    { id: "DC-001", patientId: "pat-003", category: "medical", description: "Physician discharge order written", completed: true, completedBy: "Dr. David Chen", completedAt: "2026-03-13T08:30:00" },
    { id: "DC-002", patientId: "pat-003", category: "medical", description: "Discharge summary completed", completed: false },
    { id: "DC-003", patientId: "pat-003", category: "nursing", description: "Wound care instructions provided", completed: true, completedBy: "Maria Garcia", completedAt: "2026-03-13T09:00:00" },
    { id: "DC-004", patientId: "pat-003", category: "nursing", description: "Final vital signs recorded", completed: false },
    { id: "DC-005", patientId: "pat-003", category: "nursing", description: "IV access removed", completed: false },
    { id: "DC-006", patientId: "pat-003", category: "pharmacy", description: "Discharge medications reviewed", completed: true, completedBy: "Pharmacist Tom", completedAt: "2026-03-13T09:15:00" },
    { id: "DC-007", patientId: "pat-003", category: "pharmacy", description: "Prescription sent to pharmacy", completed: false },
    { id: "DC-008", patientId: "pat-003", category: "education", description: "Activity restrictions reviewed", completed: true, completedBy: "Maria Garcia", completedAt: "2026-03-13T09:00:00" },
    { id: "DC-009", patientId: "pat-003", category: "education", description: "Warning signs to watch for", completed: true, completedBy: "Maria Garcia", completedAt: "2026-03-13T09:00:00" },
    { id: "DC-010", patientId: "pat-003", category: "social", description: "Follow-up appointment scheduled", completed: false },
    { id: "DC-011", patientId: "pat-003", category: "transport", description: "Ride home confirmed", completed: true, completedBy: "Maria Garcia", completedAt: "2026-03-13T10:00:00", notes: "Husband picking up at 2 PM" },
];

// ── Wound Notes ───────────────────────────────────────────────────────

export const mockWoundNotes: WoundNote[] = [
    { id: "WN-001", patientId: "pat-003", patientName: "Sarah Davis", type: "surgical", location: "RLQ abdomen (3 port sites)", description: "3 laparoscopic port sites — 5mm each. Clean, dry, approximated.", care: "Steri-strips intact. No dressing needed. Patient instructed to keep dry x48hrs.", timestamp: "2026-03-13T08:15:00", recordedBy: "Maria Garcia" },
    { id: "WN-002", patientId: "pat-002", patientName: "Robert Williams", type: "catheter", location: "Right radial artery — cath lab access", description: "TR Band in place. No hematoma. Radial pulse 2+.", care: "TR Band deflated per protocol. Monitor for bleeding Q15min x 4, then Q30min x 2.", timestamp: "2026-03-13T06:00:00", recordedBy: "Maria Garcia" },
    { id: "WN-003", patientId: "pat-002", patientName: "Robert Williams", type: "iv-site", location: "Left AC — 20G PIV", description: "IV site clean, no erythema, swelling, or tenderness. Flushing easily.", care: "Tegaderm intact. Site rotated 3/11. Next rotation due 3/14.", timestamp: "2026-03-13T06:00:00", recordedBy: "Maria Garcia" },
];

// ── Pain Entries ──────────────────────────────────────────────────────

export const mockPainEntries: PainEntry[] = [
    { id: "PE-001", patientId: "pat-002", score: 7, location: "Substernal chest", quality: "sharp", intervention: "Morphine 2mg IV", reassessScore: 4, reassessTime: "2026-03-13T06:30:00", timestamp: "2026-03-13T06:00:00", recordedBy: "Maria Garcia" },
    { id: "PE-002", patientId: "pat-003", score: 3, location: "RLQ abdomen", quality: "aching", intervention: "Acetaminophen 500mg PO", reassessScore: 1, reassessTime: "2026-03-13T07:00:00", timestamp: "2026-03-13T06:00:00", recordedBy: "Maria Garcia" },
    { id: "PE-003", patientId: "pat-006", score: 4, location: "Bilateral chest wall", quality: "aching", intervention: "Positioning + deep breathing", reassessScore: 3, reassessTime: "2026-03-13T06:45:00", timestamp: "2026-03-13T06:15:00", recordedBy: "Maria Garcia" },
];
