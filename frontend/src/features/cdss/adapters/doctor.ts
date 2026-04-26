import type { CDSSRecommendation, CDSSRecommendationType, UserRole } from "@/types";

/** Recommendation types the Doctor portal generates or primarily cares about */
export const DOCTOR_TYPES: CDSSRecommendationType[] = [
  "drug_interaction", "allergy", "dosage_warning", "guideline",
  "diagnostic", "preventive", "order_set", "abnormal_result",
  "care_gap", "sepsis_alert", "risk_score", "care_plan_deviation",
  "follow_up_reminder",
];

const DOCTOR_ROLE = "doctor" as UserRole;

/**
 * Returns recommendations relevant to the Doctor portal.
 * Priority order:
 *   1. Recs explicitly targeting the doctor role
 *   2. Recs from the "doctor" source module
 *   3. Legacy recs with no targetRoles (backward-compat)
 */
export function filterForDoctor(recs: CDSSRecommendation[]): CDSSRecommendation[] {
  return recs.filter((r) => {
    if (r.targetRoles && r.targetRoles.length > 0) {
      return r.targetRoles.includes(DOCTOR_ROLE);
    }
    // Legacy / untagged: show based on source module or type match
    if (r.sourceModule) {
      return r.sourceModule === "doctor" || DOCTOR_TYPES.includes(r.type);
    }
    return true; // fully untagged: show to all (legacy behaviour)
  });
}
