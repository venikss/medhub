import { z } from "zod";

// ── Patient Registration ──────────────────────────────────────────────

export const patientRegistrationSchema = z.object({
    firstName: z.string().min(2, "First name is required"),
    lastName: z.string().min(2, "Last name is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
    gender: z.enum(["male", "female", "other"], { message: "Gender is required" }),
    phone: z.string().min(7, "Phone number is required"),
    email: z.string().email("Valid email required").or(z.literal("")),
    address: z.string().min(5, "Address is required"),
    nationality: z.string().optional(),
    maritalStatus: z.enum(["single", "married", "divorced", "widowed"]).optional(),
    preferredLanguage: z.string().optional(),
    bloodType: z.string().optional(),
    allergies: z.string().optional(), // comma-separated
    // Emergency contact
    emergencyContactName: z.string().min(2, "Emergency contact name required"),
    emergencyContactRelationship: z.string().min(2, "Relationship required"),
    emergencyContactPhone: z.string().min(7, "Emergency contact phone required"),
    // Insurance (optional)
    insuranceProvider: z.string().optional(),
    insurancePolicyNumber: z.string().optional(),
    insuranceGroupNumber: z.string().optional(),
    insuranceValidFrom: z.string().optional(),
    insuranceValidTo: z.string().optional(),
    insuranceCopay: z.coerce.number().optional(),
    insuranceCoverageType: z.enum(["full", "partial", "none"]).optional(),
});

export type PatientRegistrationFormData = z.infer<typeof patientRegistrationSchema>;

// ── Admission ─────────────────────────────────────────────────────────

export const admissionSchema = z.object({
    patientId: z.string().min(1, "Patient is required"),
    type: z.enum(["inpatient", "outpatient", "emergency", "observation"], { message: "Admission type required" }),
    admittingDoctor: z.string().min(1, "Admitting doctor required"),
    department: z.string().min(1, "Department required"),
    ward: z.string().optional(),
    bed: z.string().optional(),
    reasonForAdmission: z.string().min(5, "Reason is required"),
    expectedDischarge: z.string().optional(),
});

export type AdmissionFormData = z.infer<typeof admissionSchema>;

// ── Transfer ──────────────────────────────────────────────────────────

export const transferSchema = z.object({
    admissionId: z.string().min(1),
    patientId: z.string().min(1),
    toWard: z.string().min(1, "Destination ward required"),
    toBed: z.string().min(1, "Destination bed required"),
    reason: z.string().min(5, "Transfer reason required"),
    approvedBy: z.string().min(1, "Approving physician required"),
});

export type TransferFormData = z.infer<typeof transferSchema>;

// ── Discharge ─────────────────────────────────────────────────────────

export const dischargeSchema = z.object({
    admissionId: z.string().min(1),
    patientId: z.string().min(1),
    dischargeType: z.enum(["home", "transfer", "ama", "expired"], { message: "Discharge type required" }),
    summary: z.string().min(10, "Discharge summary required (min 10 chars)"),
    followUpDate: z.string().optional(),
    dischargedBy: z.string().min(1, "Discharging physician required"),
});

export type DischargeFormData = z.infer<typeof dischargeSchema>;

// ── Appointment Booking ───────────────────────────────────────────────

export const appointmentBookingSchema = z.object({
    patientId: z.string().min(1, "Patient is required"),
    doctorId: z.string().min(1, "Doctor is required"),
    department: z.string().min(1, "Department is required"),
    date: z.string().min(1, "Date is required"),
    time: z.string().min(1, "Time is required"),
    duration: z.coerce.number().min(15, "Minimum 15 min").max(120, "Maximum 120 min"),
    type: z.enum(["consultation", "follow-up", "procedure", "telemedicine"], { message: "Type required" }),
    notes: z.string().optional(),
});

export type AppointmentBookingFormData = z.infer<typeof appointmentBookingSchema>;
