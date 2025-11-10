/**
 * Field Letter Mapping
 * Maps single letters to field names for quick voice and keyboard navigation
 */

export interface FieldLetterMapping {
  letter: string;
  fieldName: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine;
  displayName: string;
  category: string;
}

export const FIELD_LETTER_MAP: FieldLetterMapping[] = [
  // Identification Fields
  { letter: "a", fieldName: "itemDescription", displayName: "Item", category: "Identification" },
  { letter: "b", fieldName: "category", displayName: "Category", category: "Identification" },
  { letter: "c", fieldName: "subCategory", displayName: "Sub-Cat", category: "Identification" },
  { letter: "d", fieldName: "drawingNumber", displayName: "Drawing #", category: "Identification" },
  { letter: "e", fieldName: "detailNumber", displayName: "Detail #", category: "Identification" },
  { letter: "f", fieldName: "materialType", displayName: "Type", category: "Identification" },
  
  // Rolled Material Fields
  { letter: "g", fieldName: "shapeType", displayName: "Shape", category: "Rolled Material" },
  { letter: "h", fieldName: "sizeDesignation", displayName: "Size", category: "Rolled Material" },
  { letter: "i", fieldName: "grade", displayName: "Grade", category: "Rolled Material" },
  { letter: "j", fieldName: "lengthFt", displayName: "L (ft)", category: "Rolled Material" },
  { letter: "k", fieldName: "lengthIn", displayName: "L (in)", category: "Rolled Material" },
  { letter: "l", fieldName: "qty", displayName: "Qty", category: "Rolled Material" },
  
  // Plate Material Fields
  { letter: "m", fieldName: "thickness", displayName: "Thick", category: "Plate Material" },
  { letter: "n", fieldName: "width", displayName: "Width", category: "Plate Material" },
  { letter: "o", fieldName: "plateLength", displayName: "Length", category: "Plate Material" },
  { letter: "p", fieldName: "plateQty", displayName: "Qty", category: "Plate Material" },
  { letter: "q", fieldName: "plateGrade", displayName: "Grade", category: "Plate Material" },
  
  // Coating
  { letter: "r", fieldName: "coatingSystem", displayName: "Coating", category: "Coating" },
  
  // Labor Fields
  { letter: "s", fieldName: "laborUnload", displayName: "Unload", category: "Labor" },
  { letter: "t", fieldName: "laborCut", displayName: "Cut", category: "Labor" },
  { letter: "u", fieldName: "laborCope", displayName: "Cope", category: "Labor" },
  { letter: "v", fieldName: "laborProcessPlate", displayName: "Process", category: "Labor" },
  { letter: "w", fieldName: "laborDrillPunch", displayName: "Drill", category: "Labor" },
  { letter: "x", fieldName: "laborFit", displayName: "Fit", category: "Labor" },
  { letter: "y", fieldName: "laborWeld", displayName: "Weld", category: "Labor" },
  { letter: "z", fieldName: "laborPrepClean", displayName: "Prep", category: "Labor" },
  // Note: Additional labor fields can use double letters (aa, ab, etc.) if needed
];

/**
 * Get field name from letter
 */
export function getFieldFromLetter(letter: string): keyof import("@/components/estimating/EstimatingGrid").EstimatingLine | null {
  const mapping = FIELD_LETTER_MAP.find(m => m.letter.toLowerCase() === letter.toLowerCase());
  return mapping ? mapping.fieldName : null;
}

/**
 * Get letter from field name
 */
export function getLetterFromField(fieldName: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine): string | null {
  const mapping = FIELD_LETTER_MAP.find(m => m.fieldName === fieldName);
  return mapping ? mapping.letter : null;
}

/**
 * Get display name from letter
 */
export function getDisplayNameFromLetter(letter: string): string | null {
  const mapping = FIELD_LETTER_MAP.find(m => m.letter.toLowerCase() === letter.toLowerCase());
  return mapping ? mapping.displayName : null;
}

/**
 * Parse "a. column" format to field and value
 */
export function parseLetterFieldFormat(text: string): { field: keyof import("@/components/estimating/EstimatingGrid").EstimatingLine | null; value: string } | null {
  // Match patterns like "a. column", "a column", "a, column"
  const match = text.match(/^([a-z])[.\s,]+(.+)$/i);
  if (match) {
    const letter = match[1].toLowerCase();
    const value = match[2].trim();
    const field = getFieldFromLetter(letter);
    if (field) {
      return { field, value };
    }
  }
  return null;
}

