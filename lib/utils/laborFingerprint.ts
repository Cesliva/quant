/**
 * Quant Labor Fingerprint™ - Labor auto-fill for steel fabrication
 *
 * Architecture (prepared for company-seeded productivity):
 * 1. Detect subcategory / connection recipe
 * 2. Derive geometry (plate size, weld length, holes, parent context)
 * 3. Determine included labor buckets per recipe
 * 4. Look up productivity values (hardcoded → future: seed-driven)
 * 5. Populate bucket hours individually (traceable)
 * 6. Hours logic is distinct from cost rate usage
 */

import { calculateEdgePerimeter, calculatePlateProperties } from "./plateHelper";
import {
  MH_PER_FT_BY_WELD_SIZE,
  WELD_TYPE_MULTIPLIERS,
  WELD_CONDITION_MULTIPLIERS,
  type WeldType,
  type WeldCondition,
  type LaborSuggestionExplanation,
} from "@/lib/types/weldConnection";
import type { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export interface SuggestedLabor {
  laborUnload?: number;
  laborCut?: number;
  laborCope?: number;
  laborProcessPlate?: number;
  laborDrillPunch?: number;
  laborFit?: number;
  laborWeld?: number;
  laborPrepClean?: number;
  laborPaint?: number;
  laborHandleMove?: number;
  laborLoadShip?: number;
  totalLabor?: number;
}

export interface SuggestedLaborResult {
  labor: SuggestedLabor;
  explanation: LaborSuggestionExplanation;
}

/** MH per linear foot fillet 3/16" - fallback when weld fields missing */
const MH_PER_FT_FILLET_FALLBACK = 0.55;

/** MH per 100 lbs for handling */
const MH_PER_100_LBS_HANDLE = 0.15;

/** Base fit time (hours) */
const BASE_FIT_HOURS = 0.25;

/** Prep/clean per ft weld */
const PREP_PER_FT_WELD = 0.08;

/** Drill/punch per hole set */
const MH_PER_HOLE_SET = 0.05;

/** Layout labor - approximate MH for plate layout/marking */
const LAYOUT_MH_PER_PLATE = 0.08;

/** Connection subcategories supported by recipes */
export const CONNECTION_SUBCATEGORIES = [
  "Base Plate",
  "Cap Plate",
  "Shear Tab",
  "Gusset",
  "Stiffener",
  "Clip",
  "Brace",
] as const;

export type ConnectionSubcategory = (typeof CONNECTION_SUBCATEGORIES)[number];

/** Required fields per subcategory - when present, Quant can suggest labor */
export const REQUIRED_FIELDS_BY_SUBCATEGORY: Record<
  string,
  { required: string[]; optional?: string[] }
> = {
  "Base Plate": {
    required: ["parentLineId", "width", "plateLength", "thickness"],
    optional: ["weldType", "weldSize", "weldSides", "hardwareQuantity"],
  },
  "Cap Plate": {
    required: ["parentLineId", "width", "plateLength", "thickness"],
    optional: ["weldType", "weldSize", "weldSides"],
  },
  "Shear Tab": {
    required: ["parentLineId", "thickness", "width", "plateLength"],
    optional: ["weldType", "weldSize", "weldSides", "hardwareQuantity"],
  },
  Gusset: {
    required: ["parentLineId", "width", "plateLength", "thickness"],
    optional: ["weldType", "weldSize", "weldSides"],
  },
  Stiffener: {
    required: ["parentLineId"],
    optional: ["plateLength", "width", "thickness", "weldType", "weldSize"],
  },
  Clip: {
    required: ["parentLineId"],
    optional: ["width", "plateLength", "thickness", "weldType", "weldSize", "hardwareQuantity"],
  },
  Brace: {
    required: ["parentLineId"],
    optional: ["weldType", "weldSize", "hardwareQuantity"],
  },
};

/** Labor buckets included per recipe */
const RECIPE_BUCKETS: Record<string, (keyof SuggestedLabor)[]> = {
  "Base Plate": ["laborHandleMove", "laborProcessPlate", "laborDrillPunch", "laborFit", "laborWeld", "laborPrepClean"],
  "Cap Plate": ["laborHandleMove", "laborProcessPlate", "laborFit", "laborWeld", "laborPrepClean"],
  "Shear Tab": ["laborHandleMove", "laborProcessPlate", "laborDrillPunch", "laborFit", "laborWeld", "laborPrepClean"],
  Gusset: ["laborHandleMove", "laborProcessPlate", "laborFit", "laborWeld", "laborPrepClean"],
  Stiffener: ["laborHandleMove", "laborProcessPlate", "laborFit", "laborWeld", "laborPrepClean"],
  Clip: ["laborHandleMove", "laborProcessPlate", "laborDrillPunch", "laborFit", "laborWeld", "laborPrepClean"],
  Brace: ["laborHandleMove", "laborFit", "laborDrillPunch", "laborWeld", "laborPrepClean"],
};

/**
 * Check if required fields are present for a subcategory.
 */
export function canSuggestLabor(line: Partial<EstimatingLine>): boolean {
  const sub = (line.subCategory || "").trim();
  const config = REQUIRED_FIELDS_BY_SUBCATEGORY[sub];
  if (!config || !CONNECTION_SUBCATEGORIES.includes(sub as ConnectionSubcategory)) return false;

  const hasParent = !!(line.parentLineId && line.parentLineId.trim());
  if (!hasParent) return false;

  for (const field of config.required) {
    const val = (line as Record<string, unknown>)[field];
    if (val === undefined || val === null || val === "") return false;
    if (typeof val === "number" && isNaN(val)) return false;
    if (typeof val === "string" && val.trim() === "") return false;
  }
  return true;
}

/**
 * Get required field names for a subcategory (for UI).
 */
export function getRequiredFieldsForSubcategory(subCategory: string): string[] {
  return REQUIRED_FIELDS_BY_SUBCATEGORY[subCategory]?.required ?? [];
}

/**
 * Derive weld length (ft) from geometry and weld scheme.
 * Returns { length, source }.
 */
function deriveWeldLength(
  line: Partial<EstimatingLine>,
  parentLine: EstimatingLine | null,
  subCategory: string
): { lengthFt: number; source: "custom" | "geometry" | "fallback" } {
  if (line.customWeldLength != null && line.customWeldLength > 0) {
    return { lengthFt: line.customWeldLength, source: "custom" };
  }

  const materialType = line.materialType || "Plate";
  const qty = line.plateQty ?? line.qty ?? 1;
  const numQty = typeof qty === "number" ? qty : parseInt(String(qty), 10) || 1;
  const weldSides = line.weldSides;

  if (materialType === "Plate" && line.width && line.plateLength) {
    const perimeterFt =
      calculateEdgePerimeter({
        thickness: Number(line.thickness) || 0.75,
        width: Number(line.width),
        length: Number(line.plateLength),
        oneSideCoat: line.oneSideCoat || false,
      }) * numQty;

    if (perimeterFt > 0) {
      if (weldSides === "All Around") return { lengthFt: perimeterFt, source: "geometry" };
      if (weldSides === "Both Sides") return { lengthFt: perimeterFt, source: "geometry" };
      if (weldSides === "One Side") return { lengthFt: perimeterFt * 0.5, source: "geometry" };
      return { lengthFt: perimeterFt, source: "geometry" };
    }
  }

  if (subCategory === "Stiffener" && line.plateLength) {
    const weldFt = (Number(line.plateLength) / 12) * 2 * numQty;
    return { lengthFt: weldFt, source: "geometry" };
  }

  if (subCategory === "Gusset") {
    let perimeterFt = 0;
    if (materialType === "Plate" && line.width && line.plateLength) {
      perimeterFt =
        calculateEdgePerimeter({
          thickness: Number(line.thickness) || 0.5,
          width: Number(line.width),
          length: Number(line.plateLength),
          oneSideCoat: line.oneSideCoat || false,
        }) * numQty;
    }
    const weldFt = perimeterFt > 0 ? perimeterFt * 0.6 : 2 * numQty;
    return { lengthFt: weldFt, source: perimeterFt > 0 ? "geometry" : "fallback" };
  }

  if (subCategory === "Base Plate" || subCategory === "Cap Plate") {
    return { lengthFt: 4 * numQty, source: "fallback" };
  }
  if (subCategory === "Shear Tab") return { lengthFt: 1.5 * numQty, source: "fallback" };
  if (subCategory === "Clip") return { lengthFt: 1.2 * numQty, source: "fallback" };
  if (subCategory === "Brace") return { lengthFt: 2 * numQty, source: "fallback" };

  return { lengthFt: 2 * numQty, source: "fallback" };
}

/**
 * Get MH per ft for weld based on size/type/condition.
 * Fallback to generic rate when weld fields missing.
 */
function getWeldMHRate(line: Partial<EstimatingLine>): number {
  const weldType = line.weldType as WeldType | undefined;
  const weldSize = line.weldSize;
  const condition = line.weldCondition as WeldCondition | undefined;

  if (weldType === "None") return 0;

  let baseRate = MH_PER_FT_FILLET_FALLBACK;
  if (weldSize && MH_PER_FT_BY_WELD_SIZE[weldSize] != null) {
    baseRate = MH_PER_FT_BY_WELD_SIZE[weldSize];
  }
  const typeMult = weldType && WELD_TYPE_MULTIPLIERS[weldType] != null ? WELD_TYPE_MULTIPLIERS[weldType] : 1;
  const condMult = condition && WELD_CONDITION_MULTIPLIERS[condition] != null ? WELD_CONDITION_MULTIPLIERS[condition] : 1;

  return baseRate * typeMult * condMult;
}

/**
 * Get suggested labor with explanation metadata.
 * Populates individual buckets; does not hide behind one total.
 */
export function getSuggestedLaborWithExplanation(
  line: Partial<EstimatingLine>,
  parentLine?: EstimatingLine | null,
  options?: { overwriteNonZero?: boolean }
): SuggestedLaborResult {
  const overwrite = options?.overwriteNonZero ?? false;
  const subCategory = (line.subCategory || "").trim();
  const hasParent = !!(line.parentLineId && line.parentLineId.trim());

  const suggested: SuggestedLabor = {};
  const explanation: LaborSuggestionExplanation = {
    recipeUsed: subCategory || "unknown",
  };

  if (!hasParent || !CONNECTION_SUBCATEGORIES.includes(subCategory as ConnectionSubcategory)) {
    return { labor: suggested, explanation };
  }

  const materialType = line.materialType || "Plate";
  const qty = line.plateQty ?? line.qty ?? 1;
  const numQty = typeof qty === "number" ? qty : parseInt(String(qty), 10) || 1;

  let weightLbs = 0;
  if (materialType === "Plate") {
    const thickness = typeof line.thickness === "number" ? line.thickness : parseFloat(String(line.thickness || 0)) || 0;
    const width = Number(line.width) || 0;
    const length = Number(line.plateLength) || 0;
    if (thickness > 0 && width > 0 && length > 0) {
      const { totalWeight } = calculatePlateProperties({
        thickness,
        width,
        length,
        oneSideCoat: line.oneSideCoat || false,
      });
      weightLbs = (totalWeight || 0) * numQty;
    } else {
      weightLbs = (line.plateTotalWeight || 0) * numQty;
    }
  } else {
    weightLbs = (line.totalWeight || 0) * numQty;
  }

  const parentCategory = (parentLine?.category || "").toLowerCase();
  const isColumn = parentCategory.includes("column");
  const boltSets = line.hardwareQuantity ?? 0;
  const numBoltSets = typeof boltSets === "number" ? boltSets : parseInt(String(boltSets), 10) || 0;

  const shouldSet = (current: number | undefined) => overwrite || !current || current === 0;
  const set = (key: keyof SuggestedLabor, val: number) => {
    if (val >= 0 && shouldSet((line as Record<string, unknown>)[key] as number)) {
      (suggested as Record<string, number>)[key] = Math.round(val * 100) / 100;
    }
  };

  const { lengthFt: weldLengthFt, source: weldSource } = deriveWeldLength(line, parentLine ?? null, subCategory);
  const weldRate = getWeldMHRate(line);

  explanation.weldLengthUsed = weldLengthFt;
  explanation.weldLengthSource = weldSource;
  explanation.weldRateUsed = weldRate;
  explanation.weldSizeUsed = line.weldSize || "3/16 (fallback)";
  explanation.holeCountUsed = numBoltSets;

  if (subCategory === "Base Plate") {
    set("laborHandleMove", Math.max(0.06, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborProcessPlate", LAYOUT_MH_PER_PLATE * numQty);
    if (numBoltSets > 0) {
      set("laborDrillPunch", numBoltSets * MH_PER_HOLE_SET);
      explanation.handlingRuleUsed = "holeCount * MH_PER_HOLE_SET";
    }
    const fitHours = BASE_FIT_HOURS * numQty + (isColumn ? 0.15 : 0);
    if (numBoltSets > 0) {
      set("laborFit", (BASE_FIT_HOURS + 0.1) * numQty);
      explanation.fitRuleUsed = "BASE_FIT + 0.1 (with holes)";
    } else {
      set("laborFit", fitHours);
      explanation.fitRuleUsed = isColumn ? "BASE_FIT + 0.15 (column)" : "BASE_FIT";
    }
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
  } else if (subCategory === "Cap Plate") {
    set("laborHandleMove", Math.max(0.05, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborProcessPlate", LAYOUT_MH_PER_PLATE * numQty);
    set("laborFit", BASE_FIT_HOURS * numQty);
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
    explanation.fitRuleUsed = "BASE_FIT";
  } else if (subCategory === "Shear Tab") {
    set("laborHandleMove", Math.max(0.05, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborProcessPlate", LAYOUT_MH_PER_PLATE * numQty);
    if (numBoltSets > 0) set("laborDrillPunch", numBoltSets * MH_PER_HOLE_SET);
    set("laborFit", (BASE_FIT_HOURS + 0.05) * numQty);
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
    explanation.fitRuleUsed = "BASE_FIT + 0.05";
  } else if (subCategory === "Gusset") {
    set("laborHandleMove", Math.max(0.05, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborProcessPlate", LAYOUT_MH_PER_PLATE * numQty);
    set("laborFit", (BASE_FIT_HOURS + 0.1) * numQty);
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
    explanation.fitRuleUsed = "BASE_FIT + 0.1";
  } else if (subCategory === "Stiffener") {
    set("laborHandleMove", Math.max(0.05, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborProcessPlate", 0.15 * numQty);
    set("laborFit", BASE_FIT_HOURS * numQty);
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
    explanation.fitRuleUsed = "BASE_FIT";
  } else if (subCategory === "Clip") {
    set("laborHandleMove", Math.max(0.05, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborProcessPlate", LAYOUT_MH_PER_PLATE * numQty);
    if (numBoltSets > 0) set("laborDrillPunch", numBoltSets * MH_PER_HOLE_SET);
    set("laborFit", (BASE_FIT_HOURS + 0.05) * numQty);
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
    explanation.fitRuleUsed = "BASE_FIT + 0.05";
  } else if (subCategory === "Brace") {
    set("laborHandleMove", Math.max(0.1, (weightLbs / 100) * MH_PER_100_LBS_HANDLE));
    set("laborFit", (BASE_FIT_HOURS + 0.15) * numQty);
    if (numBoltSets > 0) set("laborDrillPunch", numBoltSets * MH_PER_HOLE_SET);
    set("laborWeld", weldLengthFt * weldRate);
    set("laborPrepClean", weldLengthFt * PREP_PER_FT_WELD);
    explanation.fitRuleUsed = "BASE_FIT + 0.15";
  }

  explanation.handlingRuleUsed =
    explanation.handlingRuleUsed ?? `weight/100 * ${MH_PER_100_LBS_HANDLE}`;

  const total =
    (suggested.laborUnload || 0) +
    (suggested.laborCut || 0) +
    (suggested.laborCope || 0) +
    (suggested.laborProcessPlate || 0) +
    (suggested.laborDrillPunch || 0) +
    (suggested.laborFit || 0) +
    (suggested.laborWeld || 0) +
    (suggested.laborPrepClean || 0) +
    (suggested.laborPaint || 0) +
    (suggested.laborHandleMove || 0) +
    (suggested.laborLoadShip || 0);
  if (total > 0) suggested.totalLabor = Math.round(total * 100) / 100;

  return { labor: suggested, explanation };
}

/**
 * Get suggested labor (backward-compatible).
 * Wraps getSuggestedLaborWithExplanation.
 */
export function getSuggestedLabor(
  line: Partial<EstimatingLine>,
  parentLine?: EstimatingLine | null,
  options?: { overwriteNonZero?: boolean }
): SuggestedLabor {
  return getSuggestedLaborWithExplanation(line, parentLine, options).labor;
}

/**
 * Check if a line has any labor entered (to avoid overwriting user input).
 */
export function hasLaborEntered(line: Partial<EstimatingLine>): boolean {
  const laborFields = [
    "laborUnload",
    "laborCut",
    "laborCope",
    "laborProcessPlate",
    "laborDrillPunch",
    "laborFit",
    "laborWeld",
    "laborPrepClean",
    "laborPaint",
    "laborHandleMove",
    "laborLoadShip",
  ] as const;
  return laborFields.some((f) => {
    const v = line[f];
    return typeof v === "number" && v > 0;
  });
}
