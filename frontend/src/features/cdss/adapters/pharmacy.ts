import type { CDSSRecommendation, CDSSRecommendationType, UserRole } from "@/types";

export const PHARMACY_TYPES: CDSSRecommendationType[] = [
  "drug_interaction", "allergy", "dosage_warning", "duplicate_therapy",
  "contraindication", "care_gap",
];

const PHARMACIST_ROLE = "pharmacist" as UserRole;

/**
 * Returns recommendations relevant to the Pharmacy (PIS) portal.
 * Pharmacy sees all drug-safety class alerts regardless of origin.
 */
export function filterForPharmacy(recs: CDSSRecommendation[]): CDSSRecommendation[] {
  return recs.filter((r) => {
    if (r.targetRoles && r.targetRoles.length > 0) {
      return r.targetRoles.includes(PHARMACIST_ROLE);
    }
    if (r.sourceModule === "pharmacy") return true;
    if (!r.sourceModule) return PHARMACY_TYPES.includes(r.type);
    return false;
  });
}
