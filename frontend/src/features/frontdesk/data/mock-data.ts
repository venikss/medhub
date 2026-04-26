import type {
    ADTPatient,
    BedInfo,
    Admission,
    QueueEntry,
    Appointment,
    DuplicateCandidate,
    ConsentDocument,
} from "@/types";

// ── Patients ──────────────────────────────────────────────────────────

export const mockADTPatients: ADTPatient[] = [
    {
        id: "P001", mrn: "MRN-2026-0001", firstName: "Emily", lastName: "Johnson",
        dateOfBirth: "1985-03-15", gender: "female", phone: "+1-555-0101", email: "emily.j@mail.com",
        address: "123 Oak Lane, Springfield", bloodType: "A+", allergies: ["Penicillin"],
        status: "active", insuranceProvider: "Blue Cross", insuranceId: "BC-99281",
        consentSigned: true, registeredAt: "2026-01-10T08:30:00",
        nationality: "American", maritalStatus: "married", preferredLanguage: "English",
        emergencyContact: { name: "Robert Johnson", relationship: "Spouse", phone: "+1-555-0102" },
        insurance: { id: "INS-001", provider: "Blue Cross Blue Shield", policyNumber: "BC-99281", groupNumber: "GRP-44", validFrom: "2026-01-01", validTo: "2026-12-31", copay: 30, coverageType: "full" },
    },
    {
        id: "P002", mrn: "MRN-2026-0002", firstName: "Robert", lastName: "Williams",
        dateOfBirth: "1972-08-22", gender: "male", phone: "+1-555-0201", email: "rwilliams@mail.com",
        address: "456 Elm St, Springfield", bloodType: "O-", allergies: ["Aspirin", "Latex"],
        status: "admitted", insuranceProvider: "Aetna", insuranceId: "AE-77341",
        ward: "ICU", roomNumber: "ICU-03", admissionDate: "2026-03-08",
        assignedDoctor: "Dr. David Chen", consentSigned: true, registeredAt: "2025-11-20T10:00:00",
        nationality: "American", maritalStatus: "married", preferredLanguage: "English",
        emergencyContact: { name: "Linda Williams", relationship: "Spouse", phone: "+1-555-0202" },
        insurance: { id: "INS-002", provider: "Aetna", policyNumber: "AE-77341", validFrom: "2025-06-01", validTo: "2026-05-31", copay: 25, coverageType: "full" },
    },
    {
        id: "P003", mrn: "MRN-2026-0003", firstName: "Sarah", lastName: "Davis",
        dateOfBirth: "1990-11-03", gender: "female", phone: "+1-555-0301", email: "sarah.d@mail.com",
        address: "789 Pine Rd, Springfield", bloodType: "B+", allergies: [],
        status: "admitted", ward: "Ward B", roomNumber: "312",
        admissionDate: "2026-03-07", assignedDoctor: "Dr. Sarah Kim",
        consentSigned: true, registeredAt: "2026-02-14T14:20:00",
        nationality: "Canadian", maritalStatus: "single", preferredLanguage: "English",
        emergencyContact: { name: "Tom Davis", relationship: "Father", phone: "+1-555-0302" },
        insurance: { id: "INS-003", provider: "UnitedHealth", policyNumber: "UH-55123", validFrom: "2026-01-01", validTo: "2026-12-31", coverageType: "partial" },
    },
    {
        id: "P004", mrn: "MRN-2026-0004", firstName: "Michael", lastName: "Lee",
        dateOfBirth: "1968-05-17", gender: "male", phone: "+1-555-0401", email: "mlee@mail.com",
        address: "321 Maple Ave, Springfield", bloodType: "AB+", allergies: ["Sulfa"],
        status: "active", consentSigned: true, registeredAt: "2026-01-05T09:15:00",
        nationality: "Korean-American", maritalStatus: "married", preferredLanguage: "English",
        emergencyContact: { name: "Sun Lee", relationship: "Spouse", phone: "+1-555-0402" },
        insurance: { id: "INS-004", provider: "Cigna", policyNumber: "CG-88412", validFrom: "2025-09-01", validTo: "2026-08-31", copay: 40, coverageType: "full" },
    },
    {
        id: "P005", mrn: "MRN-2026-0005", firstName: "Linda", lastName: "Thompson",
        dateOfBirth: "1955-12-28", gender: "female", phone: "+1-555-0501", email: "linda.t@mail.com",
        address: "654 Cedar Dr, Springfield", bloodType: "O+", allergies: ["Morphine"],
        status: "active", consentSigned: false, registeredAt: "2026-03-09T16:45:00",
        nationality: "American", maritalStatus: "widowed", preferredLanguage: "English",
        emergencyContact: { name: "Karen Thompson", relationship: "Daughter", phone: "+1-555-0502" },
    },
    {
        id: "P006", mrn: "MRN-2026-0006", firstName: "James", lastName: "Martinez",
        dateOfBirth: "1995-07-09", gender: "male", phone: "+1-555-0601", email: "jmartinez@mail.com",
        address: "987 Birch Ln, Springfield", bloodType: "A-", allergies: [],
        status: "active", consentSigned: true, registeredAt: "2026-03-10T07:00:00",
        nationality: "Mexican-American", maritalStatus: "single", preferredLanguage: "Spanish",
        emergencyContact: { name: "Rosa Martinez", relationship: "Mother", phone: "+1-555-0602" },
        insurance: { id: "INS-006", provider: "Humana", policyNumber: "HM-33019", validFrom: "2026-01-01", validTo: "2026-12-31", copay: 20, coverageType: "full" },
    },
    {
        id: "P007", mrn: "MRN-2026-0007", firstName: "Anna", lastName: "White",
        dateOfBirth: "2001-04-12", gender: "female", phone: "+1-555-0701", email: "anna.w@mail.com",
        address: "147 Spruce St, Springfield", bloodType: "B-", allergies: ["Ibuprofen"],
        status: "admitted", ward: "Ward A", roomNumber: "201",
        admissionDate: "2026-03-10", assignedDoctor: "Dr. David Chen",
        consentSigned: true, registeredAt: "2026-03-10T08:30:00",
        nationality: "British-American", maritalStatus: "single", preferredLanguage: "English",
        emergencyContact: { name: "John White", relationship: "Father", phone: "+1-555-0702" },
        insurance: { id: "INS-007", provider: "Blue Cross Blue Shield", policyNumber: "BC-44812", validFrom: "2026-01-01", validTo: "2026-12-31", copay: 30, coverageType: "full" },
    },
    {
        id: "P008", mrn: "MRN-2026-0008", firstName: "David", lastName: "Park",
        dateOfBirth: "1988-09-25", gender: "male", phone: "+1-555-0801", email: "dpark@mail.com",
        address: "258 Ash Ct, Springfield", bloodType: "O+", allergies: [],
        status: "active", consentSigned: true, registeredAt: "2026-02-28T11:00:00",
        nationality: "Korean-American", maritalStatus: "married", preferredLanguage: "English",
        emergencyContact: { name: "Jane Park", relationship: "Spouse", phone: "+1-555-0802" },
        insurance: { id: "INS-008", provider: "Aetna", policyNumber: "AE-91023", validFrom: "2025-10-01", validTo: "2026-09-30", copay: 35, coverageType: "full" },
    },
];

// ── Beds ───────────────────────────────────────────────────────────────

export const mockBeds: BedInfo[] = [
    // Ward A — 10 beds
    { bedId: "A-101-1", ward: "Ward A", roomNumber: "101", bedNumber: "1", type: "general", status: "occupied", patientId: "P007", patientName: "Anna White" },
    { bedId: "A-101-2", ward: "Ward A", roomNumber: "101", bedNumber: "2", type: "general", status: "available" },
    { bedId: "A-102-1", ward: "Ward A", roomNumber: "102", bedNumber: "1", type: "general", status: "occupied", patientId: "P004", patientName: "Michael Lee" },
    { bedId: "A-102-2", ward: "Ward A", roomNumber: "102", bedNumber: "2", type: "general", status: "available" },
    { bedId: "A-103-1", ward: "Ward A", roomNumber: "103", bedNumber: "1", type: "semi-private", status: "reserved" },
    { bedId: "A-103-2", ward: "Ward A", roomNumber: "103", bedNumber: "2", type: "semi-private", status: "available" },
    { bedId: "A-104-1", ward: "Ward A", roomNumber: "104", bedNumber: "1", type: "private", status: "occupied", patientName: "Tom Brown" },
    { bedId: "A-105-1", ward: "Ward A", roomNumber: "105", bedNumber: "1", type: "general", status: "maintenance" },
    { bedId: "A-105-2", ward: "Ward A", roomNumber: "105", bedNumber: "2", type: "general", status: "available" },
    { bedId: "A-106-1", ward: "Ward A", roomNumber: "106", bedNumber: "1", type: "general", status: "available" },
    // Ward B — 8 beds
    { bedId: "B-201-1", ward: "Ward B", roomNumber: "201", bedNumber: "1", type: "general", status: "occupied", patientName: "Lisa Chen" },
    { bedId: "B-201-2", ward: "Ward B", roomNumber: "201", bedNumber: "2", type: "general", status: "occupied", patientName: "Mark Evans" },
    { bedId: "B-202-1", ward: "Ward B", roomNumber: "202", bedNumber: "1", type: "semi-private", status: "available" },
    { bedId: "B-202-2", ward: "Ward B", roomNumber: "202", bedNumber: "2", type: "semi-private", status: "occupied", patientId: "P003", patientName: "Sarah Davis" },
    { bedId: "B-203-1", ward: "Ward B", roomNumber: "203", bedNumber: "1", type: "general", status: "available" },
    { bedId: "B-203-2", ward: "Ward B", roomNumber: "203", bedNumber: "2", type: "general", status: "available" },
    { bedId: "B-204-1", ward: "Ward B", roomNumber: "204", bedNumber: "1", type: "private", status: "occupied", patientName: "Grace Kim" },
    { bedId: "B-205-1", ward: "Ward B", roomNumber: "205", bedNumber: "1", type: "general", status: "reserved" },
    // ICU — 6 beds
    { bedId: "ICU-01", ward: "ICU", roomNumber: "ICU", bedNumber: "01", type: "icu", status: "occupied", patientId: "P002", patientName: "Robert Williams" },
    { bedId: "ICU-02", ward: "ICU", roomNumber: "ICU", bedNumber: "02", type: "icu", status: "occupied", patientName: "Helen Parker" },
    { bedId: "ICU-03", ward: "ICU", roomNumber: "ICU", bedNumber: "03", type: "icu", status: "available" },
    { bedId: "ICU-04", ward: "ICU", roomNumber: "ICU", bedNumber: "04", type: "icu", status: "occupied", patientName: "Frank Miller" },
    { bedId: "ICU-05", ward: "ICU", roomNumber: "ICU", bedNumber: "05", type: "icu", status: "available" },
    { bedId: "ICU-06", ward: "ICU", roomNumber: "ICU", bedNumber: "06", type: "icu", status: "maintenance" },
];

// ── Admissions ────────────────────────────────────────────────────────

export const mockAdmissions: Admission[] = [
    { id: "ADM-001", patientId: "P002", patientName: "Robert Williams", mrn: "MRN-2026-0002", type: "emergency", admittingDoctor: "Dr. David Chen", department: "Cardiology", ward: "ICU", bed: "ICU-01", reasonForAdmission: "Acute myocardial infarction", admittedAt: "2026-03-08T02:30:00", status: "admitted", expectedDischarge: "2026-03-14" },
    { id: "ADM-002", patientId: "P003", patientName: "Sarah Davis", mrn: "MRN-2026-0003", type: "inpatient", admittingDoctor: "Dr. Sarah Kim", department: "Surgery", ward: "Ward B", bed: "B-202-2", reasonForAdmission: "Post-operative recovery — appendectomy", admittedAt: "2026-03-07T14:00:00", status: "admitted", expectedDischarge: "2026-03-11" },
    { id: "ADM-003", patientId: "P007", patientName: "Anna White", mrn: "MRN-2026-0007", type: "inpatient", admittingDoctor: "Dr. David Chen", department: "Internal Medicine", ward: "Ward A", bed: "A-101-1", reasonForAdmission: "Pneumonia — IV antibiotics", admittedAt: "2026-03-10T08:45:00", status: "admitted", expectedDischarge: "2026-03-13" },
    { id: "ADM-004", patientId: "P001", patientName: "Emily Johnson", mrn: "MRN-2026-0001", type: "outpatient", admittingDoctor: "Dr. David Chen", department: "Internal Medicine", ward: undefined, bed: undefined, reasonForAdmission: "Diabetes follow-up & blood work", admittedAt: "2026-03-10T09:00:00", status: "admitted" },
    { id: "ADM-005", patientId: "P006", patientName: "James Martinez", mrn: "MRN-2026-0006", type: "observation", admittingDoctor: "Dr. Nina Patel", department: "Neurology", ward: "Ward A", bed: "A-102-1", reasonForAdmission: "Syncope — cardiac workup pending", admittedAt: "2026-03-10T07:15:00", status: "admitted", expectedDischarge: "2026-03-11" },
];

// ── Queue ──────────────────────────────────────────────────────────────

export const mockQueue: QueueEntry[] = [
    { id: "Q001", ticketNo: "A-001", patientId: "P001", patientName: "Emily Johnson", service: "consultation", priority: "normal", status: "serving", waitingSince: "2026-03-10T08:45:00", window: "Window 2", estimatedWait: 0 },
    { id: "Q002", ticketNo: "A-002", patientId: "P004", patientName: "Michael Lee", service: "registration", priority: "normal", status: "waiting", waitingSince: "2026-03-10T09:00:00", estimatedWait: 8 },
    { id: "Q003", ticketNo: "A-003", patientId: "P005", patientName: "Linda Thompson", service: "insurance", priority: "high", status: "waiting", waitingSince: "2026-03-10T09:05:00", estimatedWait: 12 },
    { id: "Q004", ticketNo: "A-004", patientId: "P006", patientName: "James Martinez", service: "lab", priority: "normal", status: "called", waitingSince: "2026-03-10T09:10:00", window: "Window 4", estimatedWait: 3 },
    { id: "Q005", ticketNo: "A-005", patientId: "P008", patientName: "David Park", service: "pharmacy", priority: "normal", status: "waiting", waitingSince: "2026-03-10T09:15:00", estimatedWait: 18 },
    { id: "Q006", ticketNo: "A-006", patientId: "P001", patientName: "Emily Johnson", service: "billing", priority: "low", status: "waiting", waitingSince: "2026-03-10T09:20:00", estimatedWait: 25 },
    { id: "Q007", ticketNo: "B-001", patientId: "P004", patientName: "Michael Lee", service: "radiology", priority: "urgent", status: "waiting", waitingSince: "2026-03-10T09:22:00", estimatedWait: 5 },
    { id: "Q008", ticketNo: "B-002", patientId: "P008", patientName: "David Park", service: "consultation", priority: "normal", status: "completed", waitingSince: "2026-03-10T08:00:00", window: "Window 1" },
];

// ── Appointments (today) ──────────────────────────────────────────────

export const mockFrontdeskAppointments: Appointment[] = [
    { id: "APT-101", patientId: "P001", patientName: "Emily Johnson", doctorId: "D001", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "09:00", duration: 30, status: "scheduled", type: "follow-up", notes: "Diabetes management review" },
    { id: "APT-102", patientId: "P004", patientName: "Michael Lee", doctorId: "D001", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-10", time: "09:45", duration: 45, status: "scheduled", type: "consultation" },
    { id: "APT-103", patientId: "P008", patientName: "David Park", doctorId: "D002", doctorName: "Dr. Sarah Kim", department: "Cardiology", date: "2026-03-10", time: "10:00", duration: 30, status: "in-progress", type: "follow-up" },
    { id: "APT-104", patientId: "P005", patientName: "Linda Thompson", doctorId: "D003", doctorName: "Dr. Nina Patel", department: "Neurology", date: "2026-03-10", time: "10:30", duration: 30, status: "scheduled", type: "consultation", notes: "Initial neuro assessment" },
    { id: "APT-105", patientId: "P006", patientName: "James Martinez", doctorId: "D002", doctorName: "Dr. Sarah Kim", department: "Cardiology", date: "2026-03-10", time: "11:00", duration: 30, status: "scheduled", type: "consultation" },
    { id: "APT-106", patientId: "P001", patientName: "Emily Johnson", doctorId: "D003", doctorName: "Dr. Nina Patel", department: "Neurology", date: "2026-03-10", time: "14:00", duration: 30, status: "scheduled", type: "follow-up" },
    { id: "APT-107", patientId: "P004", patientName: "Michael Lee", doctorId: "D001", doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-11", time: "09:00", duration: 30, status: "scheduled", type: "follow-up" },
    { id: "APT-108", patientId: "P008", patientName: "David Park", doctorId: "D002", doctorName: "Dr. Sarah Kim", department: "Cardiology", date: "2026-03-11", time: "10:30", duration: 45, status: "scheduled", type: "procedure", notes: "Echocardiogram" },
];

// ── Duplicate candidates ──────────────────────────────────────────────

export const mockDuplicates: DuplicateCandidate[] = [
    {
        patientA: { id: "P-NEW", mrn: "", firstName: "Emily", lastName: "Johnson", dateOfBirth: "1985-03-15", phone: "+1-555-9999" },
        patientB: { id: "P001", mrn: "MRN-2026-0001", firstName: "Emily", lastName: "Johnson", dateOfBirth: "1985-03-15", phone: "+1-555-0101" },
        matchScore: 92,
        matchReasons: ["Exact name match", "Exact date of birth", "Similar address"],
    },
];

// ── Consent documents ─────────────────────────────────────────────────

export const mockConsents: ConsentDocument[] = [
    { id: "CON-001", patientId: "P001", type: "general", signedAt: "2026-01-10T08:35:00", signedBy: "Emily Johnson", status: "signed" },
    { id: "CON-002", patientId: "P001", type: "hipaa", signedAt: "2026-01-10T08:36:00", signedBy: "Emily Johnson", status: "signed" },
    { id: "CON-003", patientId: "P002", type: "general", signedAt: "2025-11-20T10:05:00", signedBy: "Robert Williams", status: "signed" },
    { id: "CON-004", patientId: "P002", type: "surgery", signedAt: "2026-03-08T02:45:00", signedBy: "Linda Williams", status: "signed" },
    { id: "CON-005", patientId: "P005", type: "general", status: "pending" },
    { id: "CON-006", patientId: "P005", type: "hipaa", status: "pending" },
];
