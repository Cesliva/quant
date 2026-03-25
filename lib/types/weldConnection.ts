/**
 * Weld Connection Types
 * Used by the Labor Fingerprint for fabrication-aware labor suggestion.
 * Optional at type level for backward compatibility.
 */

export type WeldType = "Fillet" | "CJP" | "PJP" | "Plug/Slot" | "None";

export type WeldSize =
  | "3/16"
  | "1/4"
  | "5/16"
  | "3/8"
  | "1/2"
  | "Custom";

export type WeldSides =
  | "One Side"
  | "Both Sides"
  | "All Around"
  | "Custom";

export type WeldCondition =
  | "Shop Standard"
  | "AESS"
  | "Galvanized"
  | "Prime Painted"
  | "Powder Coat"
  | "Complex";

/** Option arrays for weld UI dropdowns */
export const WELD_TYPES: WeldType[] = ["Fillet", "CJP", "PJP", "Plug/Slot", "None"];
export const WELD_SIZES: WeldSize[] = ["3/16", "1/4", "5/16", "3/8", "1/2", "Custom"];
export const WELD_SIDES: WeldSides[] = ["One Side", "Both Sides", "All Around", "Custom"];
export const WELD_CONDITIONS: WeldCondition[] = [
  "Shop Standard",
  "AESS",
  "Galvanized",
  "Prime Painted",
  "Powder Coat",
  "Complex",
];

/** MH per linear foot by weld size (fillet) - industry typical range */
export const MH_PER_FT_BY_WELD_SIZE: Record<string, number> = {
  "3/16": 0.45,
  "1/4": 0.55,
  "5/16": 0.65,
  "3/8": 0.80,
  "1/2": 1.05,
  Custom: 0.55, // assume 1/4" equivalent
};

/** CJP/PJP multipliers vs fillet baseline */
export const WELD_TYPE_MULTIPLIERS: Record<WeldType, number> = {
  Fillet: 1.0,
  CJP: 2.5,
  PJP: 1.8,
  "Plug/Slot": 0.6,
  None: 0,
};

/** Condition multipliers for prep/finish sensitivity */
export const WELD_CONDITION_MULTIPLIERS: Record<WeldCondition, number> = {
  "Shop Standard": 1.0,
  AESS: 1.4,
  Galvanized: 1.25,
  "Prime Painted": 1.1,
  "Powder Coat": 1.15,
  Complex: 1.5,
};

/**
 * Explanation metadata for labor suggestions.
 * Enables traceability and debugging.
 */
export interface LaborSuggestionExplanation {
  recipeUsed: string;
  weldLengthUsed?: number;
  weldLengthSource?: "geometry" | "custom" | "fallback";
  weldRateUsed?: number;
  weldSizeUsed?: string;
  holeCountUsed?: number;
  handlingRuleUsed?: string;
  fitRuleUsed?: string;
  multiplierApplied?: number;
  notes?: string;
}
