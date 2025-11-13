import { getWeightPerSqFtFromInches } from "./plateDatabase";

/**
 * Plate Helper Utility
 * Calculates plate properties from dimensions
 * 
 * Note: For reference data on standard plate sizes, see plateDatabase.ts
 * This utility performs calculations; plateDatabase.ts provides standard specifications
 */

export interface PlateDimensions {
  thickness: number; // inches
  width: number; // inches
  length: number; // inches
  oneSideCoat: boolean; // if true, only one side is coated
}

export interface PlateCalculations {
  area: number; // square feet
  edgePerimeter: number; // feet
  surfaceArea: number; // square feet (for coating)
  totalWeight: number; // pounds
}

/**
 * Calculate plate area in square feet
 */
export function calculatePlateArea(dimensions: PlateDimensions): number {
  const widthIn = Number(dimensions.width) || 0;
  const lengthIn = Number(dimensions.length) || 0;
  // Convert inches to feet and calculate area
  return (widthIn / 12) * (lengthIn / 12);
}

/**
 * Calculate edge perimeter in feet
 */
export function calculateEdgePerimeter(dimensions: PlateDimensions): number {
  const widthIn = Number(dimensions.width) || 0;
  const lengthIn = Number(dimensions.length) || 0;
  // Perimeter = 2 * (width + length) in inches, convert to feet
  return (2 * (widthIn + lengthIn)) / 12;
}

/**
 * Calculate surface area for coating in square feet
 */
export function calculateSurfaceArea(dimensions: PlateDimensions): number {
  const { oneSideCoat } = dimensions;
  const area = calculatePlateArea(dimensions);
  
  if (oneSideCoat) {
    // Only one side is coated
    return area;
  } else {
    // Both sides are coated
    return area * 2;
  }
}

/**
 * Calculate total weight in pounds
 * Uses the reference weight-per-square-foot database for accuracy,
 * falls back to density-based math if unavailable.
 */
export function calculatePlateWeight(dimensions: PlateDimensions): number {
  const areaSqFt = calculatePlateArea(dimensions);
  const thickness = Number(dimensions.thickness) || 0;
  const widthIn = Number(dimensions.width) || 0;
  const lengthIn = Number(dimensions.length) || 0;
  const weightPerSqFt = getWeightPerSqFtFromInches(thickness);

  if (weightPerSqFt > 0) {
    return areaSqFt * weightPerSqFt;
  }

  // Fallback to density-based calculation (490 lb/ft³)
  const volumeIn3 = thickness * widthIn * lengthIn;
  const volumeFt3 = volumeIn3 / 1728;
  return volumeFt3 * 490;
}

/**
 * Calculate all plate properties
 */
export function calculatePlateProperties(dimensions: PlateDimensions): PlateCalculations {
  return {
    area: calculatePlateArea(dimensions),
    edgePerimeter: calculateEdgePerimeter(dimensions),
    surfaceArea: calculateSurfaceArea(dimensions),
    totalWeight: calculatePlateWeight(dimensions),
  };
}

