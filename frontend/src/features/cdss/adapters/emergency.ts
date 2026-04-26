import type { CDSSRecommendation, CDSSRecommendationType, UserRole } from "@/types";

export const EMERGENCY_TYPES: CDSSRecommendationType[] = [
  "triage_support", "sepsis_alert", "trauma_alert", "deterioration_alert",
  "drug_interaction", "allergy", "critical_result", "panic_value",
];

// Emergency module is accessed by doctors and nurses working in the ED
const EMERGENCY_ROLES = ["doctor", "nurse"] as UserRole[];

/**
 * Returns recommendations relevant to the Emergency Department portal.
 * Emergency gets the broadest scope — all critical + triage-class alerts.
 */
export function filterForEmergency(recs: CDSSRecommendation[]): CDSSRecommendation[] {
  return recs.filter((r) => {
    if (r.targetRoles && r.targetRoles.length > 0) {
      return r.targetRoles.some((role) => EMERGENCY_ROLES.includes(role));
    }
    if (r.sourceModule === "emergency") return true;
    // Show all critical severity when no targeting info is present
    if (!r.sourceModule && r.severity === "critical") return true;
    if (!r.sourceModule) return EMERGENCY_TYPES.includes(r.type);
    return false;
  });
}
