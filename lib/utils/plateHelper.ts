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
  const { width, length } = dimensions;
  // Convert inches to feet and calculate area
  return (width / 12) * (length / 12);
}

/**
 * Calculate edge perimeter in feet
 */
export function calculateEdgePerimeter(dimensions: PlateDimensions): number {
  const { width, length } = dimensions;
  // Perimeter = 2 * (width + length) in inches, convert to feet
  return (2 * (width + length)) / 12;
}

/**
 * Calculate surface area for coating in square feet
 */
export function calculateSurfaceArea(dimensions: PlateDimensions): number {
  const { width, length, oneSideCoat } = dimensions;
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
 * Steel density: 490 lb/ft³ or 0.2833 lb/in³
 */
export function calculatePlateWeight(dimensions: PlateDimensions): number {
  const { thickness, width, length } = dimensions;
  // Volume in cubic inches
  const volumeIn3 = thickness * width * length;
  // Convert to cubic feet
  const volumeFt3 = volumeIn3 / 1728; // 12^3 = 1728
  // Weight = volume * density
  return volumeFt3 * 490; // 490 lb/ft³
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

