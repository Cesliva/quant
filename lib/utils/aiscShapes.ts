/**
 * AISC Shapes Utility
 * Loads and filters AISC shapes from JSON database
 */

import aiscData from "@/lib/data/aisc_shapes_database_filtered.json";

export interface AISCShape {
  Type: string;
  "Member Size": string;
  W: string; // Weight per foot (lb/ft)
  A: string; // Surface area per foot (sf/ft)
}

// Shape types available in AISC
export const SHAPE_TYPES = ["W", "HSS", "C", "L", "T", "WT", "S", "M", "MT", "ST", "PIPE"] as const;
export type ShapeType = typeof SHAPE_TYPES[number];

/**
 * Get all available shape types from AISC data
 */
export function getAvailableShapeTypes(): ShapeType[] {
  const types = new Set<string>();
  aiscData.forEach((shape: AISCShape) => {
    types.add(shape.Type);
  });
  return Array.from(types) as ShapeType[];
}

/**
 * Get shapes filtered by type
 */
export function getShapesByType(type: ShapeType): AISCShape[] {
  return aiscData.filter((shape: AISCShape) => shape.Type === type);
}

/**
 * Get shape by designation (e.g., "W12x65")
 */
export function getShapeByDesignation(designation: string): AISCShape | undefined {
  return aiscData.find((shape: AISCShape) => shape["Member Size"] === designation);
}

/**
 * Get weight per foot (lb/ft) for a shape
 */
export function getWeightPerFoot(designation: string): number {
  const shape = getShapeByDesignation(designation);
  if (!shape) return 0;
  return parseFloat(shape.W) || 0;
}

/**
 * Get surface area per foot (sf/ft) for a shape
 */
export function getSurfaceAreaPerFoot(designation: string): number {
  const shape = getShapeByDesignation(designation);
  if (!shape) return 0;
  return parseFloat(shape.A) || 0;
}

/**
 * Get all available Material (structural steel) grades
 */
export function getAllMaterialGrades(): string[] {
  return [
    "A992",
    "A913 Grade 65",
    "A913 Grade 70",
    "A500 Grade B",
    "A500 Grade C",
    "A1085",
    "A53 Type E",
    "A53 Type S",
    "A252 Grade 1",
    "A252 Grade 2",
    "A252 Grade 3",
    "Stainless 304",
    "Stainless 316",
  ];
}

/**
 * Get valid grades for a shape type (simplified - in reality, this would come from AISC specs)
 * Returns all Material grades by default, can be filtered by shape type if needed
 */
export function getValidGrades(shapeType?: ShapeType): string[] {
  // Return all Material grades - shape-specific filtering can be added later if needed
  return getAllMaterialGrades();
}

