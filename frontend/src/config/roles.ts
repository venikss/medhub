import { UserRole } from "@/types";
import {
    ShieldCheck,
    Stethoscope,
    User,
    HeartPulse,
    FlaskConical,
    ScanLine,
    Pill,
    Receipt,
    Landmark,
    type LucideIcon,
} from "lucide-react";

interface RoleMeta {
    label: string;
    icon: LucideIcon;
    defaultRoute: string;
    color: string; // Tailwind color class
    description: string;
}

export const roleMeta: Record<UserRole, RoleMeta> = {
    [UserRole.ADMIN]: {
        label: "Administrator",
        icon: ShieldCheck,
        defaultRoute: "/admin",
        color: "text-violet-500",
        description: "System administration & configuration",
    },
    [UserRole.DOCTOR]: {
        label: "Doctor",
        icon: Stethoscope,
        defaultRoute: "/doctor",
        color: "text-teal-500",
        description: "Clinical care & patient management",
    },
    [UserRole.PATIENT]: {
        label: "Patient",
        icon: User,
        defaultRoute: "/patient",
        color: "text-sky-500",
        description: "Personal health dashboard",
    },
    [UserRole.NURSE]: {
        label: "Nurse",
        icon: HeartPulse,
        defaultRoute: "/nurse",
        color: "text-rose-500",
        description: "Ward management & patient care",
    },
    [UserRole.LAB_TECH]: {
        label: "Lab Technician",
        icon: FlaskConical,
        defaultRoute: "/lab",
        color: "text-amber-500",
        description: "Laboratory information system",
    },
    [UserRole.RADIOLOGIST]: {
        label: "Radiologist",
        icon: ScanLine,
        defaultRoute: "/radiology",
        color: "text-indigo-500",
        description: "Radiology information system",
    },
    [UserRole.PHARMACIST]: {
        label: "Pharmacist",
        icon: Pill,
        defaultRoute: "/pharmacy",
        color: "text-emerald-500",
        description: "Pharmacy & medication management",
    },
    [UserRole.BILLING_STAFF]: {
        label: "Billing Staff",
        icon: Receipt,
        defaultRoute: "/billing",
        color: "text-orange-500",
        description: "Revenue cycle & billing",
    },
    [UserRole.FRONT_DESK]: {
        label: "Front Desk",
        icon: Landmark,
        defaultRoute: "/frontdesk",
        color: "text-cyan-500",
        description: "Patient registration & ADT",
    },
};
