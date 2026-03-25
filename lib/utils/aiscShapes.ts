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
    "A36",
    "A572 Grade 50",
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

/** Default grade to auto-seed when shape type is selected (most common for that shape) */
const SHAPE_DEFAULT_GRADES: Record<ShapeType, string> = {
  W: "A992",
  WT: "A992",
  S: "A992",
  M: "A992",
  MT: "A992",
  ST: "A992",
  HSS: "A500 Grade B",
  C: "A36",
  L: "A36",
  T: "A992",
  PIPE: "A53 Type E",
};

/** Grades valid for each shape type - narrowed to typical options for beginners */
const SHAPE_GRADES: Record<ShapeType, string[]> = {
  // Wide flange, tees, misc structural - high-strength options
  W: ["A992", "A913 Grade 65", "A913 Grade 70"],
  WT: ["A992", "A913 Grade 65", "A913 Grade 70"],
  S: ["A992", "A913 Grade 65", "A913 Grade 70"],
  M: ["A992", "A913 Grade 65", "A913 Grade 70"],
  MT: ["A992", "A913 Grade 65", "A913 Grade 70"],
  ST: ["A992", "A913 Grade 65", "A913 Grade 70"],
  // HSS
  HSS: ["A500 Grade B", "A500 Grade C", "A1085"],
  // Angles and channels - A36/A572 most common
  C: ["A36", "A572 Grade 50"],
  L: ["A36", "A572 Grade 50"],
  // Tees (cut from W or plate)
  T: ["A992", "A36", "A572 Grade 50"],
  // Pipe
  PIPE: ["A53 Type E", "A53 Type S", "A252 Grade 1", "A252 Grade 2", "A252 Grade 3"],
};

/**
 * Get valid grades for a shape type - narrowed list for beginners
 * Returns only grades that typically apply to that shape
 */
export function getValidGrades(shapeType?: ShapeType): string[] {
  if (!shapeType || !(shapeType in SHAPE_GRADES)) {
    return getAllMaterialGrades();
  }
  return SHAPE_GRADES[shapeType as ShapeType];
}

/**
 * Get the default (most common) grade for a shape type - for auto-seeding
 */
export function getDefaultGradeForShape(shapeType?: ShapeType): string | undefined {
  if (!shapeType || !(shapeType in SHAPE_DEFAULT_GRADES)) return undefined;
  return SHAPE_DEFAULT_GRADES[shapeType as ShapeType];
}

