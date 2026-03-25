/**
 * Field Number Mapping - Estimation Workflow Order
 * 1-2: Hierarchy (Main Member, Parent), 3-9: Identification, 10-15: Material, 16-20: Hardware, 21-22: Coating, 23-33: Labor, 34-38: Admin
 */

export interface FieldNumberMapping {
  number: number;
  fieldName: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine;
  displayName: string;
  category: string;
  section: string;
}

export const FIELD_NUMBER_MAP: FieldNumberMapping[] = [
  // 1-2. HIERARCHY (first - main member or small part)
  { number: 1, fieldName: "isMainMember", displayName: "Main Member", category: "Identification", section: "Identification" },
  { number: 2, fieldName: "parentLineId", displayName: "Parent Main Member", category: "Identification", section: "Identification" },
  
  // 3. IDENTIFICATION (3-9)
  { number: 3, fieldName: "drawingNumber", displayName: "Drawing #", category: "Identification", section: "Identification" },
  { number: 4, fieldName: "detailNumber", displayName: "Detail #", category: "Identification", section: "Identification" },
  { number: 5, fieldName: "itemDescription", displayName: "Item Description", category: "Identification", section: "Identification" },
  { number: 6, fieldName: "elevation", displayName: "Elevation", category: "Identification", section: "Identification" },
  { number: 7, fieldName: "category", displayName: "Category", category: "Identification", section: "Identification" },
  { number: 8, fieldName: "subCategory", displayName: "Sub-Category", category: "Identification", section: "Identification" },
  { number: 9, fieldName: "materialType", displayName: "Material Type", category: "Identification", section: "Identification" },
  
  // 4. MATERIAL - Rolled (10-15)
  { number: 10, fieldName: "shapeType", displayName: "Shape Type", category: "Material", section: "Material" },
  { number: 11, fieldName: "sizeDesignation", displayName: "Size", category: "Material", section: "Material" },
  { number: 12, fieldName: "grade", displayName: "Grade", category: "Material", section: "Material" },
  { number: 13, fieldName: "qty", displayName: "Quantity", category: "Material", section: "Material" },
  { number: 14, fieldName: "lengthFt", displayName: "Length (ft)", category: "Material", section: "Material" },
  { number: 15, fieldName: "lengthIn", displayName: "Length (in)", category: "Material", section: "Material" },
  
  // 4. MATERIAL - Plate (10-15, same numbers, different fields based on materialType)
  // When materialType = "Plate": 10=thickness, 11=width, 12=plateLength, 13=plateQty, 14=plateGrade, 15=oneSideCoat
  
  // 5. HARDWARE (16-20)
  { number: 16, fieldName: "hardwareQuantity", displayName: "Bolt Sets", category: "Hardware", section: "Hardware" },
  { number: 17, fieldName: "hardwareBoltDiameter", displayName: "Bolt Diameter", category: "Hardware", section: "Hardware" },
  { number: 18, fieldName: "hardwareBoltType", displayName: "Bolt Type / Grade", category: "Hardware", section: "Hardware" },
  { number: 19, fieldName: "hardwareBoltLength", displayName: "Bolt Length (in)", category: "Hardware", section: "Hardware" },
  { number: 20, fieldName: "hardwareCostPerSet", displayName: "Cost per Set", category: "Hardware", section: "Hardware" },
  
  // 6. COATING (21-22)
  { number: 21, fieldName: "sspcPrep", displayName: "SSPC Surface Prep", category: "Coating", section: "Coating" },
  { number: 22, fieldName: "coatingSystem", displayName: "Coating System", category: "Coating", section: "Coating" },
  
  // 7. LABOR (23-33)
  { number: 23, fieldName: "laborUnload", displayName: "Unload", category: "Labor", section: "Labor Breakdown" },
  { number: 24, fieldName: "laborCut", displayName: "Cut", category: "Labor", section: "Labor Breakdown" },
  { number: 25, fieldName: "laborCope", displayName: "Cope", category: "Labor", section: "Labor Breakdown" },
  { number: 26, fieldName: "laborProcessPlate", displayName: "Process", category: "Labor", section: "Labor Breakdown" },
  { number: 27, fieldName: "laborDrillPunch", displayName: "Drill/Punch", category: "Labor", section: "Labor Breakdown" },
  { number: 28, fieldName: "laborFit", displayName: "Fit", category: "Labor", section: "Labor Breakdown" },
  { number: 29, fieldName: "laborWeld", displayName: "Weld", category: "Labor", section: "Labor Breakdown" },
  { number: 30, fieldName: "laborPrepClean", displayName: "Prep/Clean", category: "Labor", section: "Labor Breakdown" },
  { number: 31, fieldName: "laborPaint", displayName: "Paint", category: "Labor", section: "Labor Breakdown" },
  { number: 32, fieldName: "laborHandleMove", displayName: "Handle/Move", category: "Labor", section: "Labor Breakdown" },
  { number: 33, fieldName: "laborLoadShip", displayName: "Load/Ship", category: "Labor", section: "Labor Breakdown" },
  
  // 8. ADMIN & NOTES (34-38)
  { number: 34, fieldName: "notes", displayName: "Notes", category: "Admin", section: "Admin & Notes" },
  { number: 35, fieldName: "hashtags", displayName: "Hashtags", category: "Admin", section: "Admin & Notes" },
  { number: 36, fieldName: "status", displayName: "Status", category: "Admin", section: "Admin & Notes" },
  { number: 37, fieldName: "useStockRounding", displayName: "Use Stock Rounding", category: "Admin", section: "Admin & Notes" },
  
  // Cost fields are read-only calculated (not numbered)
  // materialRate, materialCost, laborRate, laborCost, coatingRate, coatingCost, totalCost
];

/**
 * Get field name from number
 */
export function getFieldFromNumber(number: number, materialType?: "Material" | "Plate"): keyof import("@/components/estimating/EstimatingGrid").EstimatingLine | null {
  // Handle material-specific fields (10-15 for Plate)
  if (number >= 10 && number <= 15 && materialType === "Plate") {
    const plateMap: Record<number, keyof import("@/components/estimating/EstimatingGrid").EstimatingLine> = {
      10: "thickness",
      11: "width",
      12: "plateLength",
      13: "plateQty",
      14: "plateGrade",
      15: "oneSideCoat",
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
    thickness: 10,
    width: 11,
    plateLength: 12,
    plateQty: 13,
    plateGrade: 14,
    oneSideCoat: 15,
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
export function parseNumberFieldFormat(text: string, materialType?: "Material" | "Plate"): { field: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine | null; value: string } | null {
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
