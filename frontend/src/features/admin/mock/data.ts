import type {
  AdminUser, AdminDepartment, Ward, Bed,
  LabCatalogItem, RadiologyCatalogItem, ServiceCatalogItem,
  RolePermission, AuditLogEntry, SystemSetting, AdminStats,
} from "@/types";

// ── Users ──────────────────────────────────────────────────────────

export const mockAdminUsers: AdminUser[] = [
  { id: "usr-001", firstName: "Sarah", lastName: "Mitchell", email: "admin@medhub.com", phone: "+1-555-001-0001", role: "admin", departmentId: "dept-admin", departmentName: "Administration", status: "active", lastLogin: "2026-03-16T08:12:00", createdAt: "2024-01-15", avatarInitials: "SM", employeeId: "EMP-0001" },
  { id: "usr-002", firstName: "David", lastName: "Chen", email: "dr.chen@medhub.com", phone: "+1-555-002-0001", role: "doctor", departmentId: "dept-01", departmentName: "Internal Medicine", status: "active", lastLogin: "2026-03-16T07:45:00", createdAt: "2024-02-01", avatarInitials: "DC", employeeId: "EMP-0002", specialization: "Internal Medicine", licenseNumber: "LIC-IM-4821" },
  { id: "usr-003", firstName: "Sarah", lastName: "Kim", email: "dr.kim@medhub.com", phone: "+1-555-002-0002", role: "doctor", departmentId: "dept-02", departmentName: "Surgery", status: "active", lastLogin: "2026-03-16T06:30:00", createdAt: "2024-02-10", avatarInitials: "SK", employeeId: "EMP-0003", specialization: "General Surgery", licenseNumber: "LIC-SU-3319" },
  { id: "usr-004", firstName: "Nina", lastName: "Patel", email: "dr.patel@medhub.com", phone: "+1-555-002-0003", role: "doctor", departmentId: "dept-08", departmentName: "Neurology", status: "active", lastLogin: "2026-03-16T08:00:00", createdAt: "2024-03-01", avatarInitials: "NP", employeeId: "EMP-0004", specialization: "Neurology", licenseNumber: "LIC-NE-7754" },
  { id: "usr-005", firstName: "Layla", lastName: "Hassan", email: "dr.hassan@medhub.com", phone: "+1-555-002-0004", role: "radiologist", departmentId: "dept-05", departmentName: "Radiology", status: "active", lastLogin: "2026-03-15T18:00:00", createdAt: "2024-02-15", avatarInitials: "LH", employeeId: "EMP-0005", specialization: "Diagnostic Radiology", licenseNumber: "LIC-RD-2233" },
  { id: "usr-006", firstName: "Maria", lastName: "Garcia", email: "nurse.garcia@medhub.com", phone: "+1-555-003-0001", role: "nurse", departmentId: "dept-01", departmentName: "Internal Medicine", status: "active", lastLogin: "2026-03-16T07:00:00", createdAt: "2024-02-20", avatarInitials: "MG", employeeId: "EMP-0006" },
  { id: "usr-007", firstName: "Carlos", lastName: "Rivera", email: "nurse.rivera@medhub.com", phone: "+1-555-003-0002", role: "nurse", departmentId: "dept-01", departmentName: "Internal Medicine", status: "active", lastLogin: "2026-03-16T07:15:00", createdAt: "2024-03-05", avatarInitials: "CR", employeeId: "EMP-0007" },
  { id: "usr-008", firstName: "James", lastName: "Wilson", email: "lab@medhub.com", phone: "+1-555-004-0001", role: "lab_tech", departmentId: "dept-lab", departmentName: "Clinical Lab", status: "active", lastLogin: "2026-03-16T06:45:00", createdAt: "2024-01-20", avatarInitials: "JW", employeeId: "EMP-0008" },
  { id: "usr-009", firstName: "Ahmed", lastName: "Hassan", email: "pharmacy@medhub.com", phone: "+1-555-005-0001", role: "pharmacist", departmentId: "dept-pharm", departmentName: "Pharmacy", status: "active", lastLogin: "2026-03-16T08:30:00", createdAt: "2024-02-01", avatarInitials: "AH", employeeId: "EMP-0009" },
  { id: "usr-010", firstName: "Rachel", lastName: "Kim", email: "billing@medhub.com", phone: "+1-555-006-0001", role: "billing_staff", departmentId: "dept-finance", departmentName: "Finance", status: "inactive", lastLogin: "2026-03-05T14:00:00", createdAt: "2024-03-10", avatarInitials: "RK", employeeId: "EMP-0010" },
  { id: "usr-011", firstName: "Tom", lastName: "Brown", email: "frontdesk@medhub.com", phone: "+1-555-007-0001", role: "front_desk", departmentId: "dept-rec", departmentName: "Reception", status: "active", lastLogin: "2026-03-16T07:50:00", createdAt: "2024-02-25", avatarInitials: "TB", employeeId: "EMP-0011" },
  { id: "usr-012", firstName: "Lisa", lastName: "Park", email: "lab2@medhub.com", phone: "+1-555-004-0002", role: "lab_tech", departmentId: "dept-lab", departmentName: "Clinical Lab", status: "suspended", lastLogin: "2026-03-10T10:00:00", createdAt: "2024-04-01", avatarInitials: "LP", employeeId: "EMP-0012" },
];

/** Backward-compatible alias used by admin dashboard page */
export const mockAllUsers = mockAdminUsers;

// ── Permissions ────────────────────────────────────────────────────

export const mockPermissions: RolePermission[] = [
  { role: "admin", resource: "patients", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { role: "admin", resource: "users", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { role: "admin", resource: "departments", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { role: "admin", resource: "settings", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { role: "admin", resource: "audit_logs", actions: ["view", "export"] },
  { role: "admin", resource: "invoices", actions: ["view", "create", "edit", "delete", "approve", "export"] },
  { role: "admin", resource: "beds", actions: ["view", "create", "edit", "delete"] },
  { role: "admin", resource: "catalogs", actions: ["view", "create", "edit", "delete"] },

  { role: "doctor", resource: "patients", actions: ["view", "create", "edit"] },
  { role: "doctor", resource: "encounters", actions: ["view", "create", "edit"] },
  { role: "doctor", resource: "orders", actions: ["view", "create", "edit", "approve"] },
  { role: "doctor", resource: "prescriptions", actions: ["view", "create", "edit", "approve"] },
  { role: "doctor", resource: "lab_results", actions: ["view"] },
  { role: "doctor", resource: "radiology_reports", actions: ["view"] },
  { role: "doctor", resource: "invoices", actions: ["view"] },

  { role: "nurse", resource: "patients", actions: ["view", "edit"] },
  { role: "nurse", resource: "encounters", actions: ["view", "create", "edit"] },
  { role: "nurse", resource: "orders", actions: ["view"] },
  { role: "nurse", resource: "prescriptions", actions: ["view"] },
  { role: "nurse", resource: "beds", actions: ["view", "edit"] },

  { role: "lab_tech", resource: "patients", actions: ["view"] },
  { role: "lab_tech", resource: "orders", actions: ["view", "edit"] },
  { role: "lab_tech", resource: "lab_results", actions: ["view", "create", "edit", "approve"] },

  { role: "radiologist", resource: "patients", actions: ["view"] },
  { role: "radiologist", resource: "orders", actions: ["view"] },
  { role: "radiologist", resource: "radiology_reports", actions: ["view", "create", "edit", "approve"] },

  { role: "pharmacist", resource: "patients", actions: ["view"] },
  { role: "pharmacist", resource: "prescriptions", actions: ["view", "edit", "approve"] },
  { role: "pharmacist", resource: "catalogs", actions: ["view"] },

  { role: "billing_staff", resource: "patients", actions: ["view"] },
  { role: "billing_staff", resource: "invoices", actions: ["view", "create", "edit", "approve"] },
  { role: "billing_staff", resource: "claims", actions: ["view", "create", "edit", "approve"] },
  { role: "billing_staff", resource: "payments", actions: ["view", "create", "edit"] },

  { role: "front_desk", resource: "patients", actions: ["view", "create", "edit"] },
  { role: "front_desk", resource: "encounters", actions: ["view", "create"] },

  { role: "patient", resource: "patients", actions: ["view"] },
  { role: "patient", resource: "prescriptions", actions: ["view"] },
  { role: "patient", resource: "lab_results", actions: ["view"] },
  { role: "patient", resource: "invoices", actions: ["view"] },
];

// ── Departments ────────────────────────────────────────────────────

export const mockAdminDepartments: AdminDepartment[] = [
  { id: "dept-01", name: "Internal Medicine", code: "INT-MED", type: "clinical", status: "active", headId: "usr-002", headName: "Dr. David Chen", floorNumber: 3, building: "Main", phone: "x4100", staffCount: 24, activePatients: 48, bedCount: 40 },
  { id: "dept-02", name: "Surgery", code: "SURG", type: "surgical", status: "active", headId: "usr-003", headName: "Dr. Sarah Kim", floorNumber: 4, building: "Main", phone: "x4200", staffCount: 32, activePatients: 28, bedCount: 24 },
  { id: "dept-03", name: "Pediatrics", code: "PEDS", type: "clinical", status: "active", headName: "Dr. Maria Lopez", floorNumber: 2, building: "East Wing", phone: "x4300", staffCount: 18, activePatients: 35, bedCount: 30 },
  { id: "dept-04", name: "Cardiology", code: "CARD", type: "clinical", status: "active", headName: "Dr. James Wright", floorNumber: 3, building: "Main", phone: "x4400", staffCount: 15, activePatients: 22, bedCount: 20 },
  { id: "dept-05", name: "Radiology", code: "RAD", type: "diagnostic", status: "active", headId: "usr-005", headName: "Dr. Layla Hassan", floorNumber: 1, building: "Main", phone: "x4500", staffCount: 12, activePatients: 0, bedCount: 0 },
  { id: "dept-06", name: "Emergency", code: "ED", type: "emergency", status: "active", headName: "Dr. Ahmed Hassan", floorNumber: 1, building: "Main", phone: "x4600", staffCount: 28, activePatients: 15, bedCount: 20, description: "24/7 emergency and trauma care" },
  { id: "dept-07", name: "Orthopedics", code: "ORTHO", type: "surgical", status: "active", headName: "Dr. Tom Brown", floorNumber: 4, building: "Main", phone: "x4700", staffCount: 14, activePatients: 19, bedCount: 16 },
  { id: "dept-08", name: "Neurology", code: "NEURO", type: "clinical", status: "active", headId: "usr-004", headName: "Dr. Nina Patel", floorNumber: 5, building: "Main", phone: "x4800", staffCount: 10, activePatients: 16, bedCount: 14 },
  { id: "dept-lab", name: "Clinical Laboratory", code: "LAB", type: "diagnostic", status: "active", headName: "James Wilson", floorNumber: 1, building: "Main", phone: "x4900", staffCount: 10, activePatients: 0, bedCount: 0 },
  { id: "dept-pharm", name: "Pharmacy", code: "PHARM", type: "support", status: "active", headId: "usr-009", headName: "Ahmed Hassan", floorNumber: 1, building: "Main", phone: "x5000", staffCount: 8, activePatients: 0, bedCount: 0 },
  { id: "dept-icu", name: "ICU / Critical Care", code: "ICU", type: "clinical", status: "active", headName: "Dr. David Chen", floorNumber: 5, building: "Main", phone: "x5100", staffCount: 20, activePatients: 8, bedCount: 12 },
  { id: "dept-admin", name: "Administration", code: "ADMIN", type: "administrative", status: "active", headId: "usr-001", headName: "Sarah Mitchell", floorNumber: 6, building: "Main", phone: "x5200", staffCount: 6, activePatients: 0, bedCount: 0 },
];

/** Backward-compatible alias used by admin dashboard page */
export const mockDepartments = mockAdminDepartments;

// ── Wards ──────────────────────────────────────────────────────────

export const mockWards: Ward[] = [
  { id: "ward-A", name: "Ward A", code: "WA", departmentId: "dept-01", departmentName: "Internal Medicine", type: "general", floorNumber: 3, building: "Main", totalBeds: 20, occupiedBeds: 14, status: "active", headNurseId: "usr-006", headNurseName: "Maria Garcia" },
  { id: "ward-B", name: "Ward B", code: "WB", departmentId: "dept-01", departmentName: "Internal Medicine", type: "general", floorNumber: 3, building: "Main", totalBeds: 20, occupiedBeds: 12, status: "active", headNurseId: "usr-007", headNurseName: "Carlos Rivera" },
  { id: "ward-ICU", name: "ICU", code: "ICU", departmentId: "dept-icu", departmentName: "ICU / Critical Care", type: "icu", floorNumber: 5, building: "Main", totalBeds: 12, occupiedBeds: 8, status: "active" },
  { id: "ward-SURG", name: "Surgical Ward", code: "SW", departmentId: "dept-02", departmentName: "Surgery", type: "surgical", floorNumber: 4, building: "Main", totalBeds: 24, occupiedBeds: 16, status: "active" },
  { id: "ward-PEDS", name: "Pediatric Ward", code: "PW", departmentId: "dept-03", departmentName: "Pediatrics", type: "general", floorNumber: 2, building: "East Wing", totalBeds: 20, occupiedBeds: 15, status: "active" },
  { id: "ward-NEURO", name: "Neurology Ward", code: "NW", departmentId: "dept-08", departmentName: "Neurology", type: "general", floorNumber: 5, building: "Main", totalBeds: 14, occupiedBeds: 8, status: "active" },
  { id: "ward-ED", name: "Emergency Obs", code: "EDO", departmentId: "dept-06", departmentName: "Emergency", type: "observation", floorNumber: 1, building: "Main", totalBeds: 10, occupiedBeds: 5, status: "active" },
  { id: "ward-ISO", name: "Isolation Ward", code: "ISO", departmentId: "dept-01", departmentName: "Internal Medicine", type: "isolation", floorNumber: 3, building: "East Wing", totalBeds: 6, occupiedBeds: 1, status: "active" },
];

// ── Beds ───────────────────────────────────────────────────────────

export const mockBeds: Bed[] = [
  // Ward A – Internal Medicine
  { id: "bed-WA-01", number: "A-101", wardId: "ward-A", wardName: "Ward A", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "occupied", roomNumber: "101", floorNumber: 3, patientId: "pat-001", patientName: "Emily Johnson", admittedAt: "2026-03-14" },
  { id: "bed-WA-02", number: "A-102", wardId: "ward-A", wardName: "Ward A", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "occupied", roomNumber: "101", floorNumber: 3, patientId: "pat-004", patientName: "Michael Lee", admittedAt: "2026-03-16" },
  { id: "bed-WA-03", number: "A-103", wardId: "ward-A", wardName: "Ward A", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "available", roomNumber: "102", floorNumber: 3 },
  { id: "bed-WA-04", number: "A-104", wardId: "ward-A", wardName: "Ward A", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "cleaning", roomNumber: "102", floorNumber: 3 },
  { id: "bed-WA-05", number: "A-105", wardId: "ward-A", wardName: "Ward A", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "reserved", roomNumber: "103", floorNumber: 3 },
  { id: "bed-WA-06", number: "A-106", wardId: "ward-A", wardName: "Ward A", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "available", roomNumber: "103", floorNumber: 3 },
  // Ward B
  { id: "bed-WB-01", number: "B-201", wardId: "ward-B", wardName: "Ward B", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "occupied", roomNumber: "201", floorNumber: 3, patientId: "pat-006", patientName: "Linda Thompson", admittedAt: "2026-03-15" },
  { id: "bed-WB-02", number: "B-202", wardId: "ward-B", wardName: "Ward B", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "available", roomNumber: "201", floorNumber: 3 },
  { id: "bed-WB-03", number: "B-203", wardId: "ward-B", wardName: "Ward B", departmentId: "dept-01", departmentName: "Internal Medicine", type: "standard", status: "maintenance", roomNumber: "202", floorNumber: 3 },
  // ICU
  { id: "bed-ICU-01", number: "ICU-501", wardId: "ward-ICU", wardName: "ICU", departmentId: "dept-icu", departmentName: "ICU / Critical Care", type: "icu", status: "occupied", roomNumber: "501", floorNumber: 5, patientId: "pat-002", patientName: "Robert Williams", admittedAt: "2026-03-12", features: ["ventilator", "cardiac_monitor", "art_line"] },
  { id: "bed-ICU-02", number: "ICU-502", wardId: "ward-ICU", wardName: "ICU", departmentId: "dept-icu", departmentName: "ICU / Critical Care", type: "icu", status: "occupied", roomNumber: "501", floorNumber: 5, features: ["ventilator", "cardiac_monitor"] },
  { id: "bed-ICU-03", number: "ICU-503", wardId: "ward-ICU", wardName: "ICU", departmentId: "dept-icu", departmentName: "ICU / Critical Care", type: "icu", status: "available", roomNumber: "502", floorNumber: 5, features: ["ventilator", "cardiac_monitor", "art_line"] },
  // Surgical
  { id: "bed-SW-01", number: "SW-401", wardId: "ward-SURG", wardName: "Surgical Ward", departmentId: "dept-02", departmentName: "Surgery", type: "standard", status: "occupied", roomNumber: "401", floorNumber: 4, patientId: "pat-003", patientName: "Sarah Davis", admittedAt: "2026-03-14" },
  { id: "bed-SW-02", number: "SW-402", wardId: "ward-SURG", wardName: "Surgical Ward", departmentId: "dept-02", departmentName: "Surgery", type: "standard", status: "cleaning", roomNumber: "401", floorNumber: 4 },
  { id: "bed-SW-03", number: "SW-403", wardId: "ward-SURG", wardName: "Surgical Ward", departmentId: "dept-02", departmentName: "Surgery", type: "standard", status: "available", roomNumber: "402", floorNumber: 4 },
  { id: "bed-SW-04", number: "SW-404", wardId: "ward-SURG", wardName: "Surgical Ward", departmentId: "dept-02", departmentName: "Surgery", type: "standard", status: "available", roomNumber: "402", floorNumber: 4 },
  // Peds
  { id: "bed-PW-01", number: "PW-201", wardId: "ward-PEDS", wardName: "Pediatric Ward", departmentId: "dept-03", departmentName: "Pediatrics", type: "pediatric", status: "occupied", roomNumber: "201", floorNumber: 2 },
  { id: "bed-PW-02", number: "PW-202", wardId: "ward-PEDS", wardName: "Pediatric Ward", departmentId: "dept-03", departmentName: "Pediatrics", type: "pediatric", status: "available", roomNumber: "201", floorNumber: 2 },
  // Isolation
  { id: "bed-ISO-01", number: "ISO-301", wardId: "ward-ISO", wardName: "Isolation Ward", departmentId: "dept-01", departmentName: "Internal Medicine", type: "isolation", status: "occupied", roomNumber: "301", floorNumber: 3, features: ["negative_pressure"] },
  { id: "bed-ISO-02", number: "ISO-302", wardId: "ward-ISO", wardName: "Isolation Ward", departmentId: "dept-01", departmentName: "Internal Medicine", type: "isolation", status: "available", roomNumber: "302", floorNumber: 3, features: ["negative_pressure"] },
];

// ── Lab Catalog ────────────────────────────────────────────────────

export const mockLabCatalog: LabCatalogItem[] = [
  { id: "lab-001", code: "CBC", name: "Complete Blood Count", category: "Hematology", specimen: "Whole Blood (EDTA)", turnaroundHours: 2, normalRange: "Various", unit: "panel", price: 45, requiresAuth: false, status: "active", cptCode: "85025" },
  { id: "lab-002", code: "BMP", name: "Basic Metabolic Panel", category: "Chemistry", specimen: "Serum", turnaroundHours: 2, unit: "panel", price: 38, requiresAuth: false, status: "active", cptCode: "80048" },
  { id: "lab-003", code: "CMP", name: "Comprehensive Metabolic Panel", category: "Chemistry", specimen: "Serum", turnaroundHours: 2, unit: "panel", price: 52, requiresAuth: false, status: "active", cptCode: "80053" },
  { id: "lab-004", code: "HBA1C", name: "Hemoglobin A1c", category: "Endocrinology", specimen: "Whole Blood (EDTA)", turnaroundHours: 4, normalRange: "<5.7%", unit: "%", price: 55, requiresAuth: false, status: "active", cptCode: "83036" },
  { id: "lab-005", code: "TROP-I", name: "Troponin I — High Sensitivity", category: "Cardiac", specimen: "Serum", turnaroundHours: 1, normalRange: "<0.04 ng/mL", unit: "ng/mL", price: 95, requiresAuth: false, status: "active", cptCode: "84484" },
  { id: "lab-006", code: "BNPRO", name: "NT-proBNP", category: "Cardiac", specimen: "Serum", turnaroundHours: 2, normalRange: "<125 pg/mL", unit: "pg/mL", price: 110, requiresAuth: true, status: "active", cptCode: "83880" },
  { id: "lab-007", code: "LFT", name: "Liver Function Tests", category: "Chemistry", specimen: "Serum", turnaroundHours: 3, unit: "panel", price: 62, requiresAuth: false, status: "active", cptCode: "80076" },
  { id: "lab-008", code: "TSH", name: "Thyroid Stimulating Hormone", category: "Endocrinology", specimen: "Serum", turnaroundHours: 4, normalRange: "0.4–4.0 mIU/L", unit: "mIU/L", price: 78, requiresAuth: false, status: "active", cptCode: "84443" },
  { id: "lab-009", code: "PT-INR", name: "Prothrombin Time / INR", category: "Coagulation", specimen: "Citrated Plasma", turnaroundHours: 1, normalRange: "11–13.5 sec", unit: "sec/ratio", price: 42, requiresAuth: false, status: "active", cptCode: "85610" },
  { id: "lab-010", code: "UACR", name: "Urine Albumin-Creatinine Ratio", category: "Nephrology", specimen: "Spot Urine", turnaroundHours: 4, normalRange: "<30 mg/g", unit: "mg/g", price: 58, requiresAuth: false, status: "active", cptCode: "82043" },
  { id: "lab-011", code: "CULT-BL", name: "Blood Culture (Aerobic + Anaerobic)", category: "Microbiology", specimen: "Blood", turnaroundHours: 72, unit: "set", price: 120, requiresAuth: false, status: "active", cptCode: "87040" },
  { id: "lab-012", code: "D-DIMER", name: "D-Dimer", category: "Coagulation", specimen: "Citrated Plasma", turnaroundHours: 1, normalRange: "<0.5 μg/mL FEU", unit: "μg/mL FEU", price: 88, requiresAuth: false, status: "active", cptCode: "85379" },
  { id: "lab-013", code: "CRP-HS", name: "C-Reactive Protein (High-Sensitivity)", category: "Immunology", specimen: "Serum", turnaroundHours: 2, normalRange: "<3 mg/L", unit: "mg/L", price: 48, requiresAuth: false, status: "active", cptCode: "86140" },
  { id: "lab-014", code: "PROCALC", name: "Procalcitonin", category: "Immunology", specimen: "Serum", turnaroundHours: 3, normalRange: "<0.25 ng/mL", unit: "ng/mL", price: 125, requiresAuth: true, status: "active", cptCode: "84145" },
  { id: "lab-015", code: "IRON-ST", name: "Iron Studies Panel", category: "Hematology", specimen: "Serum", turnaroundHours: 4, unit: "panel", price: 72, requiresAuth: false, status: "discontinued", cptCode: "83540" },
];

// ── Radiology Catalog ──────────────────────────────────────────────

export const mockRadiologyCatalog: RadiologyCatalogItem[] = [
  { id: "rad-001", code: "CR-CHEST", name: "Chest X-Ray (PA + Lateral)", modality: "CR", bodyPart: "Chest", withContrast: false, durationMinutes: 15, price: 180, requiresAuth: false, status: "active", cptCode: "71046" },
  { id: "rad-002", code: "CT-HEAD", name: "CT Head Without Contrast", modality: "CT", bodyPart: "Head", withContrast: false, durationMinutes: 20, price: 980, requiresAuth: false, status: "active", cptCode: "70450" },
  { id: "rad-003", code: "CT-HEAD-C", name: "CT Head With and Without Contrast", modality: "CT", bodyPart: "Head", withContrast: true, durationMinutes: 35, price: 1350, requiresAuth: true, status: "active", cptCode: "70470", preparation: "Contrast consent required. Check renal function and allergy history." },
  { id: "rad-004", code: "CT-ABD", name: "CT Abdomen & Pelvis With Contrast", modality: "CT", bodyPart: "Abdomen/Pelvis", withContrast: true, durationMinutes: 30, price: 1400, requiresAuth: true, status: "active", cptCode: "74177", preparation: "NPO 4 hours. Oral contrast prep if ordered." },
  { id: "rad-005", code: "CT-PE", name: "CT Pulmonary Angiography (PE Protocol)", modality: "CT", bodyPart: "Chest", withContrast: true, durationMinutes: 25, price: 2200, requiresAuth: true, status: "active", cptCode: "71275", preparation: "IV contrast required. Breath-hold instructions." },
  { id: "rad-006", code: "MRI-BRAIN", name: "MRI Brain With and Without Contrast", modality: "MRI", bodyPart: "Brain", withContrast: true, durationMinutes: 60, price: 2200, requiresAuth: true, status: "active", cptCode: "70553", preparation: "No metal implants. Screening form required." },
  { id: "rad-007", code: "MRI-SPINE-L", name: "MRI Lumbar Spine Without Contrast", modality: "MRI", bodyPart: "Lumbar Spine", withContrast: false, durationMinutes: 45, price: 1800, requiresAuth: true, status: "active", cptCode: "72148" },
  { id: "rad-008", code: "US-ABD", name: "Ultrasound Abdomen (Complete)", modality: "US", bodyPart: "Abdomen", withContrast: false, durationMinutes: 30, price: 420, requiresAuth: false, status: "active", cptCode: "76700", preparation: "NPO 4 hours for gallbladder evaluation." },
  { id: "rad-009", code: "US-RENAL", name: "Ultrasound Retroperitoneal (Renal)", modality: "US", bodyPart: "Kidneys", withContrast: false, durationMinutes: 25, price: 380, requiresAuth: false, status: "active", cptCode: "76770" },
  { id: "rad-010", code: "ECHO-2D", name: "2D Echocardiogram with Doppler", modality: "US", bodyPart: "Heart", withContrast: false, durationMinutes: 45, price: 980, requiresAuth: true, status: "active", cptCode: "93306" },
  { id: "rad-011", code: "MAMMO", name: "Mammography — Screening Bilateral", modality: "MG", bodyPart: "Breast", withContrast: false, durationMinutes: 20, price: 250, requiresAuth: false, status: "active", cptCode: "77067" },
  { id: "rad-012", code: "DEXA", name: "DEXA Bone Density Scan", modality: "DXA", bodyPart: "Spine/Hip", withContrast: false, durationMinutes: 20, price: 220, requiresAuth: false, status: "inactive", cptCode: "77080" },
];

// ── Service Catalog ────────────────────────────────────────────────

export const mockServiceCatalog: ServiceCatalogItem[] = [
  { id: "svc-001", code: "ED-VISIT-1", name: "Emergency Visit — Level 1", category: "Emergency", department: "Emergency", price: 220, unit: "visit", status: "active", cptCode: "99281" },
  { id: "svc-002", code: "ED-VISIT-5", name: "Emergency Visit — Level 5 (High)", category: "Emergency", department: "Emergency", price: 850, unit: "visit", status: "active", cptCode: "99285" },
  { id: "svc-003", code: "OV-EST-3", name: "Office Visit — Established, Moderate", category: "Outpatient", department: "Internal Medicine", price: 380, unit: "visit", status: "active", cptCode: "99214" },
  { id: "svc-004", code: "OV-NEW-4", name: "Office Visit — New Patient, Moderate-High", category: "Outpatient", department: "Internal Medicine", price: 480, unit: "visit", status: "active", cptCode: "99204" },
  { id: "svc-005", code: "HOSP-ADM", name: "Initial Hospital Admission — High Complexity", category: "Inpatient", department: "Various", price: 1400, unit: "admission", status: "active", cptCode: "99223" },
  { id: "svc-006", code: "HOSP-SUBSEQ", name: "Subsequent Hospital Care — High Complexity", category: "Inpatient", department: "Various", price: 1390, unit: "per day", status: "active", cptCode: "99233" },
  { id: "svc-007", code: "CC-FIRST", name: "Critical Care — First Hour", category: "Critical Care", department: "ICU / Critical Care", price: 1100, unit: "episode", status: "active", cptCode: "99291" },
  { id: "svc-008", code: "PHYS-THER", name: "Physical Therapy Session", category: "Rehabilitation", department: "Rehabilitation", price: 180, unit: "session", status: "active", cptCode: "97110" },
  { id: "svc-009", code: "SW-CONSULT", name: "Social Work Consultation", category: "Support Services", department: "Social Work", price: 120, unit: "consultation", status: "active" },
  { id: "svc-010", code: "DIET-CONSULT", name: "Dietitian Consultation", category: "Support Services", department: "Nutrition", price: 95, unit: "consultation", status: "active" },
  { id: "svc-011", code: "PROC-IV", name: "IV Insertion / Peripheral Access", category: "Nursing Procedures", department: "Nursing", price: 55, unit: "procedure", status: "active", cptCode: "36000" },
  { id: "svc-012", code: "PROC-FOLEY", name: "Foley Catheter Insertion", category: "Nursing Procedures", department: "Nursing", price: 75, unit: "procedure", status: "inactive" },
];

// ── Audit Log ──────────────────────────────────────────────────────

export const mockAuditLogs: AuditLogEntry[] = [
  { id: "aud-001", timestamp: "2026-03-16T08:12:00", userId: "usr-001", userName: "Sarah Mitchell", userRole: "admin", action: "login", resource: "auth", details: "Admin login from 10.0.1.5", ipAddress: "10.0.1.5", severity: "info", outcome: "success", sessionId: "sess-8812" },
  { id: "aud-002", timestamp: "2026-03-16T08:15:00", userId: "usr-001", userName: "Sarah Mitchell", userRole: "admin", action: "status_change", resource: "users", resourceId: "usr-012", details: "User Lisa Park suspended — 3 failed login attempts", ipAddress: "10.0.1.5", severity: "warning", outcome: "success" },
  { id: "aud-003", timestamp: "2026-03-16T08:20:00", userId: "usr-001", userName: "Sarah Mitchell", userRole: "admin", action: "permission_change", resource: "users", resourceId: "usr-010", details: "Billing staff permissions expanded to include payments.approve", ipAddress: "10.0.1.5", severity: "warning", outcome: "success" },
  { id: "aud-004", timestamp: "2026-03-16T07:45:00", userId: "usr-002", userName: "David Chen", userRole: "doctor", action: "login", resource: "auth", details: "Doctor login from 10.0.2.14", ipAddress: "10.0.2.14", severity: "info", outcome: "success", sessionId: "sess-7741" },
  { id: "aud-005", timestamp: "2026-03-16T07:50:00", userId: "usr-002", userName: "David Chen", userRole: "doctor", action: "create", resource: "encounters", resourceId: "enc-2026-0045", details: "New encounter created for patient Michael Lee (MRN-2024-004)", ipAddress: "10.0.2.14", severity: "info", outcome: "success" },
  { id: "aud-006", timestamp: "2026-03-16T07:55:00", userId: "usr-002", userName: "David Chen", userRole: "doctor", action: "approve", resource: "orders", resourceId: "ord-0122", details: "CT head order approved for Michael Lee — STAT priority", ipAddress: "10.0.2.14", severity: "info", outcome: "success" },
  { id: "aud-007", timestamp: "2026-03-16T08:00:00", userId: "usr-005", userName: "Layla Hassan", userRole: "radiologist", action: "approve", resource: "radiology_reports", resourceId: "rad-rpt-0088", details: "Radiology report signed — CT Head, Michael Lee. No acute intracranial abnormality.", ipAddress: "10.0.3.8", severity: "info", outcome: "success" },
  { id: "aud-008", timestamp: "2026-03-16T08:05:00", userId: "usr-012", userName: "Lisa Park", userRole: "lab_tech", action: "login", resource: "auth", details: "Failed login attempt — incorrect password (3rd attempt)", ipAddress: "10.0.4.22", severity: "critical", outcome: "failure", sessionId: "sess-FAIL" },
  { id: "aud-009", timestamp: "2026-03-16T08:30:00", userId: "usr-009", userName: "Ahmed Hassan", userRole: "pharmacist", action: "approve", resource: "prescriptions", resourceId: "rx-2026-0198", details: "Prescription dispensed — Metoprolol 50mg, Robert Williams (MRN-2024-002)", ipAddress: "10.0.5.3", severity: "info", outcome: "success" },
  { id: "aud-010", timestamp: "2026-03-16T08:45:00", userId: "usr-002", userName: "David Chen", userRole: "doctor", action: "delete", resource: "orders", resourceId: "ord-0123", details: "Order cancelled — duplicate MRI brain order for Michael Lee", ipAddress: "10.0.2.14", severity: "warning", outcome: "success" },
  { id: "aud-011", timestamp: "2026-03-16T09:00:00", userId: "usr-001", userName: "Sarah Mitchell", userRole: "admin", action: "export", resource: "audit_logs", details: "Audit log exported — date range 2026-03-01 to 2026-03-15, 1248 records", ipAddress: "10.0.1.5", severity: "info", outcome: "success" },
  { id: "aud-012", timestamp: "2026-03-16T09:15:00", userId: "usr-001", userName: "Sarah Mitchell", userRole: "admin", action: "create", resource: "users", details: "New user account created — Jessica Martinez, role: patient", ipAddress: "10.0.1.5", severity: "info", outcome: "success" },
  { id: "aud-013", timestamp: "2026-03-16T09:20:00", userId: "usr-008", userName: "James Wilson", userRole: "lab_tech", action: "create", resource: "lab_results", resourceId: "lab-res-0442", details: "Lab results published — CBC for Emily Johnson (MRN-2024-001): WBC 11.2, elevated", ipAddress: "10.0.4.5", severity: "info", outcome: "success" },
  { id: "aud-014", timestamp: "2026-03-16T09:30:00", userId: "usr-011", userName: "Tom Brown", userRole: "front_desk", action: "create", resource: "patients", details: "New patient registered — Jessica Martinez, DOB 1994-02-14", ipAddress: "10.0.6.2", severity: "info", outcome: "success" },
  { id: "aud-015", timestamp: "2026-03-16T09:45:00", userId: "usr-001", userName: "Sarah Mitchell", userRole: "admin", action: "update", resource: "settings", details: "System setting updated — session_timeout_minutes: 30 → 60", ipAddress: "10.0.1.5", severity: "warning", outcome: "success" },
  { id: "aud-016", timestamp: "2026-03-16T10:00:00", userId: "usr-003", userName: "Sarah Kim", userRole: "doctor", action: "bulk_action", resource: "orders", details: "Bulk discharge orders signed — 3 patients in Surgical Ward", ipAddress: "10.0.2.18", severity: "info", outcome: "success" },
  { id: "aud-017", timestamp: "2026-03-16T07:00:00", userId: "usr-010", userName: "Rachel Kim", userRole: "billing_staff", action: "export", resource: "invoices", details: "Invoice export attempted — unauthorized action", ipAddress: "192.168.10.55", severity: "critical", outcome: "failure" },
];

// ── System Settings ────────────────────────────────────────────────

export const mockSystemSettings: SystemSetting[] = [
  // General
  { key: "hospital_name", label: "Hospital Name", description: "Official name displayed in headers and documents", category: "general", type: "text", value: "MedHub Virtual Hospital" },
  { key: "hospital_address", label: "Hospital Address", description: "Physical address for documents and invoices", category: "general", type: "textarea", value: "1 MedHub Drive, Health City, HC 10001" },
  { key: "default_timezone", label: "Default Timezone", description: "System-wide timezone for timestamps", category: "general", type: "select", value: "America/New_York", options: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"] },
  { key: "date_format", label: "Date Format", description: "How dates are displayed throughout the system", category: "general", type: "select", value: "YYYY-MM-DD", options: ["YYYY-MM-DD", "MM/DD/YYYY", "DD/MM/YYYY"] },
  { key: "fiscal_year_start", label: "Fiscal Year Start Month", description: "Month when the fiscal year begins (1=Jan)", category: "general", type: "number", value: 1 },
  // Security
  { key: "session_timeout_minutes", label: "Session Timeout (minutes)", description: "Auto-logout after inactivity", category: "security", type: "number", value: 60 },
  { key: "max_failed_logins", label: "Max Failed Login Attempts", description: "Account locks after this many failures", category: "security", type: "number", value: 3 },
  { key: "password_min_length", label: "Minimum Password Length", description: "Minimum character count for passwords", category: "security", type: "number", value: 12 },
  { key: "require_2fa_admin", label: "Require 2FA for Admins", description: "Enforce two-factor authentication for admin accounts", category: "security", type: "boolean", value: true },
  { key: "audit_retention_days", label: "Audit Log Retention (days)", description: "How long audit logs are kept before archiving", category: "security", type: "number", value: 365 },
  // Notifications
  { key: "critical_alert_sms", label: "SMS Critical Alerts", description: "Send SMS for critical lab values and emergencies", category: "notifications", type: "boolean", value: true },
  { key: "critical_alert_email", label: "Email Critical Alerts", description: "Send email for critical findings to attending physician", category: "notifications", type: "boolean", value: true },
  { key: "daily_summary_email", label: "Daily Summary Email", description: "Send daily department summary to department heads", category: "notifications", type: "boolean", value: false },
  { key: "appointment_reminder_hours", label: "Appointment Reminder (hours before)", description: "How many hours before appointment to send reminder", category: "notifications", type: "number", value: 24 },
  // Integrations
  { key: "hl7_endpoint", label: "HL7 FHIR Endpoint", description: "External HL7/FHIR integration base URL", category: "integrations", type: "text", value: "https://fhir.medhub.internal/R4" },
  { key: "pacs_server", label: "PACS Server Address", description: "DICOM PACS server for radiology images", category: "integrations", type: "text", value: "pacs.medhub.internal:11112" },
  { key: "lab_analyzer_ip", label: "Lab Analyzer Interface IP", description: "IP address of lab analyzer middleware", category: "integrations", type: "text", value: "10.0.10.50" },
  { key: "pharmacy_bridge_enabled", label: "Pharmacy Bridge Enabled", description: "Enable real-time pharmacy system integration", category: "integrations", type: "boolean", value: true },
];

// ── Dashboard Stats ────────────────────────────────────────────────

export const mockAdminStats: AdminStats = {
  totalUsers: mockAdminUsers.length,
  activeUsers: mockAdminUsers.filter((u) => u.status === "active").length,
  totalDepartments: mockAdminDepartments.length,
  totalBeds: mockBeds.length,
  occupiedBeds: mockBeds.filter((b) => b.status === "occupied").length,
  totalLabTests: mockLabCatalog.filter((l) => l.status === "active").length,
  totalRadiologyStudies: mockRadiologyCatalog.filter((r) => r.status === "active").length,
  auditLogsToday: mockAuditLogs.length,
  systemUptime: 99.7,
};

// ── Recent Activity (backward-compat for dashboard) ───────────────

export const mockRecentActivity = [
  { id: 1, action: "New patient registered", user: "Tom Brown", timestamp: "2 min ago", type: "info" as const },
  { id: 2, action: "Lab results published", user: "James Wilson", timestamp: "15 min ago", type: "success" as const },
  { id: 3, action: "Emergency admission", user: "Maria Garcia", timestamp: "32 min ago", type: "warning" as const },
  { id: 4, action: "Prescription dispensed", user: "Ahmed Hassan", timestamp: "1 hr ago", type: "success" as const },
  { id: 5, action: "System backup completed", user: "System", timestamp: "2 hrs ago", type: "info" as const },
  { id: 6, action: "User account deactivated", user: "Sarah Mitchell", timestamp: "3 hrs ago", type: "warning" as const },
];
