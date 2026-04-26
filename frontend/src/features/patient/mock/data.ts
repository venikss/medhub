import { Appointment, Medication } from "@/types";

export const mockPatientAppointments: Appointment[] = [
    {
        id: "apt-101", patientId: "usr-003", patientName: "Emily Johnson", doctorId: "usr-002",
        doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-12",
        time: "10:00", duration: 30, status: "scheduled", type: "follow-up",
        notes: "Diabetes follow-up & blood work review",
    },
    {
        id: "apt-102", patientId: "usr-003", patientName: "Emily Johnson", doctorId: "usr-010",
        doctorName: "Dr. Nina Patel", department: "Neurology", date: "2026-03-15",
        time: "14:00", duration: 45, status: "scheduled", type: "consultation",
        notes: "Initial neurological assessment",
    },
    {
        id: "apt-103", patientId: "usr-003", patientName: "Emily Johnson", doctorId: "usr-002",
        doctorName: "Dr. David Chen", department: "Internal Medicine", date: "2026-03-05",
        time: "09:30", duration: 30, status: "completed", type: "consultation",
    },
    {
        id: "apt-104", patientId: "usr-003", patientName: "Emily Johnson", doctorId: "usr-012",
        doctorName: "Dr. Sarah Kim", department: "Surgery", date: "2026-02-20",
        time: "11:00", duration: 20, status: "completed", type: "follow-up",
    },
];

export const mockPatientMedications: Medication[] = [
    {
        id: "med-001", name: "Metformin", dosage: "500mg", frequency: "Twice daily",
        route: "Oral", startDate: "2026-01-15", prescribedBy: "Dr. David Chen", status: "active",
    },
    {
        id: "med-002", name: "Lisinopril", dosage: "10mg", frequency: "Once daily",
        route: "Oral", startDate: "2026-02-01", prescribedBy: "Dr. David Chen", status: "active",
    },
    {
        id: "med-003", name: "Amoxicillin", dosage: "250mg", frequency: "Three times daily",
        route: "Oral", startDate: "2026-02-15", endDate: "2026-02-25", prescribedBy: "Dr. Sarah Kim", status: "completed",
    },
];

export const mockPatientVitalsHistory = [
    { date: "Mar 10", systolic: 128, diastolic: 82, heartRate: 74, temp: 98.4, spo2: 98 },
    { date: "Mar 8", systolic: 132, diastolic: 85, heartRate: 78, temp: 98.6, spo2: 97 },
    { date: "Mar 5", systolic: 126, diastolic: 80, heartRate: 72, temp: 98.2, spo2: 99 },
    { date: "Mar 1", systolic: 135, diastolic: 88, heartRate: 80, temp: 98.8, spo2: 97 },
    { date: "Feb 25", systolic: 130, diastolic: 84, heartRate: 76, temp: 98.4, spo2: 98 },
];

export const mockLabResults = [
    { id: "lr-001", testName: "Complete Blood Count (CBC)", date: "2026-03-08", status: "completed" as const, result: "Normal range" },
    { id: "lr-002", testName: "HbA1c", date: "2026-03-08", status: "completed" as const, result: "7.2% — slightly elevated" },
    { id: "lr-003", testName: "Lipid Panel", date: "2026-03-10", status: "pending" as const, result: null },
    { id: "lr-004", testName: "Basic Metabolic Panel", date: "2026-03-10", status: "in-progress" as const, result: null },
];
