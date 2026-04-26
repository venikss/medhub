import type { CDSSRecommendation, CDSSRecommendationType, UserRole } from "@/types";

export const LAB_TYPES: CDSSRecommendationType[] = [
  "panic_value", "delta_check", "critical_result", "abnormal_result",
];

const LAB_ROLE = "lab_tech" as UserRole;

/**
 * Returns recommendations relevant to the Laboratory (LIS) portal.
 * Lab sees all alerts it generated plus any results-class types from other modules.
 */
export function filterForLab(recs: CDSSRecommendation[]): CDSSRecommendation[] {
  return recs.filter((r) => {
    if (r.targetRoles && r.targetRoles.length > 0) {
      return r.targetRoles.includes(LAB_ROLE);
    }
    if (r.sourceModule === "lab") return true;
    if (!r.sourceModule) return LAB_TYPES.includes(r.type);
    return false;
  });
}
