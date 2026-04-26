import type { CDSSRecommendation, CDSSRecommendationType, UserRole } from "@/types";

export const RADIOLOGY_TYPES: CDSSRecommendationType[] = [
  "urgent_finding", "appropriateness_check", "follow_up_reminder",
];

const RADIOLOGIST_ROLE = "radiologist" as UserRole;

/**
 * Returns recommendations relevant to the Radiology (RIS) portal.
 */
export function filterForRadiology(recs: CDSSRecommendation[]): CDSSRecommendation[] {
  return recs.filter((r) => {
    if (r.targetRoles && r.targetRoles.length > 0) {
      return r.targetRoles.includes(RADIOLOGIST_ROLE);
    }
    if (r.sourceModule === "radiology") return true;
    if (!r.sourceModule) return RADIOLOGY_TYPES.includes(r.type);
    return false;
  });
}
