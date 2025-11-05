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
 * Get available grades for a given thickness
 */
export function getAvailableGrades(thickness: string): string[] {
  const plate = getPlateByThickness(thickness);
  return plate?.grade || ["A36"];
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

