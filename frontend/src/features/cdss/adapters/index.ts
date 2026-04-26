import type { CDSSRecommendation, CDSSSourceModule } from "@/types";
import { filterForDoctor }   from "./doctor";
import { filterForLab }      from "./lab";
import { filterForPharmacy } from "./pharmacy";
import { filterForNursing }  from "./nursing";
import { filterForRadiology } from "./radiology";
import { filterForEmergency } from "./emergency";

export interface CDSSModuleAdapter {
  module: CDSSSourceModule;
  label: string;
  filterRecommendations(recs: CDSSRecommendation[]): CDSSRecommendation[];
}

const ADAPTERS: Record<CDSSSourceModule, CDSSModuleAdapter> = {
  doctor:    { module: "doctor",    label: "Doctor",     filterRecommendations: filterForDoctor    },
  lab:       { module: "lab",       label: "Laboratory", filterRecommendations: filterForLab       },
  pharmacy:  { module: "pharmacy",  label: "Pharmacy",   filterRecommendations: filterForPharmacy  },
  nursing:   { module: "nursing",   label: "Nursing",    filterRecommendations: filterForNursing   },
  radiology: { module: "radiology", label: "Radiology",  filterRecommendations: filterForRadiology },
  emergency: { module: "emergency", label: "Emergency",  filterRecommendations: filterForEmergency },
  surgery:   {
    module: "surgery",
    label: "Surgery",
    filterRecommendations: (recs) =>
      recs.filter((r) => r.sourceModule === "surgery" || r.type === "perioperative_warning" || r.type === "checklist_gap"),
  },
  system: {
    module: "system",
    label: "System",
    filterRecommendations: (recs) => recs, // system adapter shows all
  },
};

/** Returns the adapter for a source module. Falls back to the system (all) adapter. */
export function getAdapter(module: CDSSSourceModule): CDSSModuleAdapter {
  return ADAPTERS[module] ?? ADAPTERS.system;
}

export {
  filterForDoctor, filterForLab, filterForPharmacy,
  filterForNursing, filterForRadiology, filterForEmergency,
};
