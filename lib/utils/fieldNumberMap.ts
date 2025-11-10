/**
 * Field Number Mapping - Estimation Workflow Order
 * Numbers follow the order estimators work: 1. Identification, 2. Material, 3. Coating, 4. Labor, 5. Admin
 */

export interface FieldNumberMapping {
  number: number;
  fieldName: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine;
  displayName: string;
  category: string;
  section: string;
}

export const FIELD_NUMBER_MAP: FieldNumberMapping[] = [
  // 1. IDENTIFICATION (1-6)
  { number: 1, fieldName: "drawingNumber", displayName: "Drawing #", category: "Identification", section: "Identification" },
  { number: 2, fieldName: "detailNumber", displayName: "Detail #", category: "Identification", section: "Identification" },
  { number: 3, fieldName: "itemDescription", displayName: "Item Description", category: "Identification", section: "Identification" },
  { number: 4, fieldName: "category", displayName: "Category", category: "Identification", section: "Identification" },
  { number: 5, fieldName: "subCategory", displayName: "Sub-Category", category: "Identification", section: "Identification" },
  { number: 6, fieldName: "materialType", displayName: "Material Type", category: "Identification", section: "Identification" },
  
  // 2. MATERIAL - Rolled (7-12)
  { number: 7, fieldName: "shapeType", displayName: "Shape Type", category: "Material", section: "Material" },
  { number: 8, fieldName: "sizeDesignation", displayName: "Size", category: "Material", section: "Material" },
  { number: 9, fieldName: "grade", displayName: "Grade", category: "Material", section: "Material" },
  { number: 10, fieldName: "qty", displayName: "Quantity", category: "Material", section: "Material" },
  { number: 11, fieldName: "lengthFt", displayName: "Length (ft)", category: "Material", section: "Material" },
  { number: 12, fieldName: "lengthIn", displayName: "Length (in)", category: "Material", section: "Material" },
  
  // 2. MATERIAL - Plate (7-12, same numbers, different fields based on materialType)
  // When materialType = "Plate", these fields replace 7-12:
  // 7 = thickness, 8 = width, 9 = plateLength, 10 = plateQty, 11 = plateGrade, 12 = oneSideCoat
  
  // Read-only calculated fields (not numbered - they're auto-calculated)
  // weightPerFoot, totalWeight, surfaceAreaPerFoot, totalSurfaceArea (Rolled)
  // plateArea, edgePerimeter, plateSurfaceArea, plateTotalWeight (Plate)
  
  // 3. COATING (13)
  { number: 13, fieldName: "coatingSystem", displayName: "Coating System", category: "Coating", section: "Coating" },
  
  // 4. LABOR (14-24)
  { number: 14, fieldName: "laborUnload", displayName: "Unload", category: "Labor", section: "Labor Breakdown" },
  { number: 15, fieldName: "laborCut", displayName: "Cut", category: "Labor", section: "Labor Breakdown" },
  { number: 16, fieldName: "laborCope", displayName: "Cope", category: "Labor", section: "Labor Breakdown" },
  { number: 17, fieldName: "laborProcessPlate", displayName: "Process", category: "Labor", section: "Labor Breakdown" },
  { number: 18, fieldName: "laborDrillPunch", displayName: "Drill/Punch", category: "Labor", section: "Labor Breakdown" },
  { number: 19, fieldName: "laborFit", displayName: "Fit", category: "Labor", section: "Labor Breakdown" },
  { number: 20, fieldName: "laborWeld", displayName: "Weld", category: "Labor", section: "Labor Breakdown" },
  { number: 21, fieldName: "laborPrepClean", displayName: "Prep/Clean", category: "Labor", section: "Labor Breakdown" },
  { number: 22, fieldName: "laborPaint", displayName: "Paint", category: "Labor", section: "Labor Breakdown" },
  { number: 23, fieldName: "laborHandleMove", displayName: "Handle/Move", category: "Labor", section: "Labor Breakdown" },
  { number: 24, fieldName: "laborLoadShip", displayName: "Load/Ship", category: "Labor", section: "Labor Breakdown" },
  // totalLabor is read-only (auto-calculated)
  
  // 5. ADMIN & NOTES (25-28)
  { number: 25, fieldName: "notes", displayName: "Notes", category: "Admin", section: "Admin & Notes" },
  { number: 26, fieldName: "hashtags", displayName: "Hashtags", category: "Admin", section: "Admin & Notes" },
  { number: 27, fieldName: "status", displayName: "Status", category: "Admin", section: "Admin & Notes" },
  { number: 28, fieldName: "useStockRounding", displayName: "Use Stock Rounding", category: "Admin", section: "Admin & Notes" },
  
  // Cost fields are read-only calculated (not numbered - they're auto-calculated from rates and quantities)
  // materialRate, materialCost, laborRate, laborCost, coatingRate, coatingCost, totalCost
];

/**
 * Get field name from number
 */
export function getFieldFromNumber(number: number, materialType?: "Rolled" | "Plate"): keyof import("@/components/estimating/EstimatingGrid").EstimatingLine | null {
  // Handle material-specific fields (7-12)
  if (number >= 7 && number <= 12 && materialType === "Plate") {
    const plateMap: Record<number, keyof import("@/components/estimating/EstimatingGrid").EstimatingLine> = {
      7: "thickness",
      8: "width",
      9: "plateLength",
      10: "plateQty",
      11: "plateGrade",
      12: "oneSideCoat",
    };
    return plateMap[number] || null;
  }
  
  const mapping = FIELD_NUMBER_MAP.find(m => m.number === number);
  return mapping ? mapping.fieldName : null;
}

/**
 * Get number from field name
 */
export function getNumberFromField(fieldName: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine): number | null {
  const mapping = FIELD_NUMBER_MAP.find(m => m.fieldName === fieldName);
  if (mapping) return mapping.number;
  
  // Handle plate-specific fields
  const plateFieldMap: Record<string, number> = {
    thickness: 7,
    width: 8,
    plateLength: 9,
    plateQty: 10,
    plateGrade: 11,
    oneSideCoat: 12,
  };
  return plateFieldMap[fieldName as string] || null;
}

/**
 * Get display name from number
 */
export function getDisplayNameFromNumber(number: number): string | null {
  const mapping = FIELD_NUMBER_MAP.find(m => m.number === number);
  return mapping ? mapping.displayName : null;
}

/**
 * Convert number words to digits (e.g., "one" -> "1", "two" -> "2")
 */
function convertNumberWordToDigit(text: string): string {
  const numberWords: Record<string, string> = {
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "ten": "10", "eleven": "11", "twelve": "12", "thirteen": "13",
    "fourteen": "14", "fifteen": "15", "sixteen": "16", "seventeen": "17",
    "eighteen": "18", "nineteen": "19", "twenty": "20", "thirty": "30",
    "forty": "40", "fifty": "50"
  };
  
  let converted = text.toLowerCase();
  // Replace number words with digits
  Object.entries(numberWords).forEach(([word, digit]) => {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    converted = converted.replace(regex, digit);
  });
  
  return converted;
}

/**
 * Parse "1. column" format to field and value
 * Handles formats like:
 * - "1. column"
 * - "1 column"
 * - "1, column"
 * - "number 1 column"
 * - "number one column"
 * - "number one s 2.0" (for "1. S2.0")
 */
export function parseNumberFieldFormat(text: string, materialType?: "Rolled" | "Plate"): { field: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine | null; value: string } | null {
  // First, convert number words to digits
  const normalizedText = convertNumberWordToDigit(text);
  
  // Match patterns like "1. column", "1 column", "1, column", "number 1 column"
  // Also handles "number 1 s 2.0" -> "1. S2.0"
  const match = normalizedText.match(/(?:^|\s)(?:number\s+)?(\d+)[.\s,]+(.+)$/i);
  if (match) {
    const number = parseInt(match[1], 10);
    const value = match[2].trim();
    const field = getFieldFromNumber(number, materialType);
    if (field) {
      return { field, value };
    }
  }
  return null;
}
