/**
 * Plate Database Utility
 * Reference database for common plate specifications
 * Since AISC doesn't provide plate data, this database contains
 * standard plate thicknesses, common sizes, and weight references
 */

import plateData from "@/lib/data/plate_database.json";

export interface PlateSpec {
  thickness: string; // e.g., "1/4", "1/2", "1"
  thicknessInches: number; // Decimal inches for calculations
  weightPerSqFt: number; // Pounds per square foot
  commonWidths: number[]; // Common widths in inches
  commonLengths: number[]; // Common lengths in inches
  grade: string[]; // Available grades
  description: string;
}

/**
 * Get all available plate thicknesses
 */
export function getAvailableThicknesses(): PlateSpec[] {
  return plateData as PlateSpec[];
}

/**
 * Get plate specification by thickness string (e.g., "1/4", "1/2")
 */
export function getPlateByThickness(thickness: string): PlateSpec | undefined {
  return plateData.find((plate: PlateSpec) => plate.thickness === thickness);
}

/**
 * Get plate specification by thickness in inches
 */
export function getPlateByThicknessInches(thicknessInches: number): PlateSpec | undefined {
  return plateData.find((plate: PlateSpec) => 
    Math.abs(plate.thicknessInches - thicknessInches) < 0.001
  );
}

function parseFraction(input: string): number | null {
  const sanitized = input.replace(/"/g, "").trim();
  if (!sanitized) return null;

  // Mixed number like 1-1/8 or 1 1/8
  if (sanitized.includes("-") || sanitized.includes(" ")) {
    const parts = sanitized.split(/[-\s]+/).filter(Boolean);
    if (parts.length === 2) {
      const whole = parseFloat(parts[0]);
      const frac = parseFraction(parts[1]);
      if (!isNaN(whole) && frac !== null) {
        return whole + frac;
      }
    }
  }

  if (sanitized.includes("/")) {
    const [numerator, denominator] = sanitized.split("/");
    const num = parseFloat(numerator);
    const den = parseFloat(denominator);
    if (!isNaN(num) && !isNaN(den) && den !== 0) {
      return num / den;
    }
    return null;
  }

  const asNumber = parseFloat(sanitized);
  return isNaN(asNumber) ? null : asNumber;
}

/**
 * Normalize any user-entered thickness (fraction string, mixed number, decimal, or number)
 * to a decimal inches value.
 */
export function convertThicknessInputToInches(
  thickness: number | string | undefined | null
): number {
  if (typeof thickness === "number") {
    return thickness;
  }

  if (!thickness) {
    return 0;
  }

  const stringValue = thickness.toString().trim();
  if (!stringValue) {
    return 0;
  }

  const spec = getPlateByThickness(stringValue);
  if (spec) {
    return spec.thicknessInches;
  }

  const parsed = parseFraction(stringValue);
  return parsed ?? 0;
}

/**
 * Get the friendly label (e.g., "1/4") for a numeric thickness in inches
 */
export function getThicknessLabelFromInches(
  thicknessInches: number | undefined | null
): string | undefined {
  if (thicknessInches === undefined || thicknessInches === null) {
    return undefined;
  }
  const spec = getPlateByThicknessInches(thicknessInches);
  return spec?.thickness;
}

/**
 * Get weight per square foot for a given thickness
 */
export function getWeightPerSqFt(thickness: string): number {
  const plate = getPlateByThickness(thickness);
  return plate?.weightPerSqFt || 0;
}

/**
 * Get weight per square foot for a given thickness in inches
 */
export function getWeightPerSqFtFromInches(thicknessInches: number): number {
  const plate = getPlateByThicknessInches(thicknessInches);
  return plate?.weightPerSqFt || 0;
}

/**
 * Get common widths for a given thickness
 */
export function getCommonWidths(thickness: string): number[] {
  const plate = getPlateByThickness(thickness);
  return plate?.commonWidths || [];
}

/**
 * Get common lengths for a given thickness
 */
export function getCommonLengths(thickness: string): number[] {
  const plate = getPlateByThickness(thickness);
  return plate?.commonLengths || [];
}

/**
 * Get all available Plate grades
 */
export function getAllPlateGrades(): string[] {
  return [
    "A36",
    "A572 Grade 50",
    "A572 Grade 42",
    "A588 (Weathering)",
    "A514 (T-1)",
    "A516 Grade 70",
    "A529 Grade 50",
  ];
}

/**
 * Get available grades for a given thickness
 * Returns all Plate grades (thickness-specific filtering can be added later if needed)
 */
export function getAvailableGrades(thickness: string | number): string[] {
  return getAllPlateGrades();
}

/**
 * Get valid plate grades (alias for getAvailableGrades for backwards compatibility)
 */
export function getValidPlateGrades(thickness: string | number): string[] {
  return getAllPlateGrades();
}

/**
 * Calculate weight from plate dimensions using database reference
 * This is a quick reference - actual calculation should use plateHelper
 */
export function getQuickWeightEstimate(
  thickness: string,
  widthInches: number,
  lengthInches: number
): number {
  const weightPerSqFt = getWeightPerSqFt(thickness);
  const areaSqFt = (widthInches / 12) * (lengthInches / 12);
  return weightPerSqFt * areaSqFt;
}

/**
 * Get all unique common widths across all thicknesses
 */
export function getAllCommonWidths(): number[] {
  const widths = new Set<number>();
  plateData.forEach((plate: PlateSpec) => {
    plate.commonWidths.forEach(width => widths.add(width));
  });
  return Array.from(widths).sort((a, b) => a - b);
}

/**
 * Get all unique common lengths across all thicknesses
 */
export function getAllCommonLengths(): number[] {
  const lengths = new Set<number>();
  plateData.forEach((plate: PlateSpec) => {
    plate.commonLengths.forEach(length => lengths.add(length));
  });
  return Array.from(lengths).sort((a, b) => a - b);
}

