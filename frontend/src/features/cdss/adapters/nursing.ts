import type { CDSSRecommendation, CDSSRecommendationType, UserRole } from "@/types";

export const NURSING_TYPES: CDSSRecommendationType[] = [
  "deterioration_alert", "overdue_task", "risk_score", "care_gap",
  "sepsis_alert", "care_plan_deviation",
];

const NURSE_ROLE = "nurse" as UserRole;

/**
 * Returns recommendations relevant to the Nursing / Ward portal.
 * Nursing sees deterioration, overdue-care, and cross-module safety alerts
 * that are explicitly targeted at nurses.
 */
export function filterForNursing(recs: CDSSRecommendation[]): CDSSRecommendation[] {
  return recs.filter((r) => {
    if (r.targetRoles && r.targetRoles.length > 0) {
      return r.targetRoles.includes(NURSE_ROLE);
    }
    if (r.sourceModule === "nursing") return true;
    if (!r.sourceModule) return NURSING_TYPES.includes(r.type);
    return false;
  });
}
