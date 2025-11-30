/**
 * Structured Voice Parser
 * Parses voice input in a structured format where field names must be spoken first
 * 
 * Format:
 * - "Material" or "Labor" to switch context
 * - Field name (e.g., "Category", "Shape", "Size", "Quantity")
 * - Value
 * - "Enter" to process and create line
 * 
 * Examples:
 * - "Material, Category, Columns, Shape, W, Size, W10X15, Quantity, 5, Length, 15 feet, Enter"
 * - "Labor, Welding, 1 hour 15 minutes, Handling, 15 minutes, Enter"
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getShapeByDesignation, SHAPE_TYPES } from "@/lib/utils/aiscShapes";
import { getWeightPerFoot, getSurfaceAreaPerFoot } from "@/lib/utils/aiscShapes";

export interface StructuredVoiceState {
  context: "material" | "labor" | null; // Current context
  currentField: string | null; // Current field being filled
  accumulatedData: Partial<EstimatingLine>; // Data being built up
  isComplete: boolean; // Ready to process
}

  // Field name mappings
const FIELD_MAPPINGS: Record<string, keyof EstimatingLine> = {
  // Material fields
  "item": "itemDescription",
  "item description": "itemDescription",
  "description": "itemDescription",
  "category": "category",
  "subcategory": "subCategory",
  "sub category": "subCategory",
  "type": "shapeType", // "Type" can mean shape type
  "shape": "shapeType",
  "spec": "sizeDesignation", // "Spec" means size designation
  "size": "sizeDesignation",
  "grade": "grade",
  "quantity": "qty",
  "qty": "qty",
  "length": "lengthFt",
  "length feet": "lengthFt",
  "length foot": "lengthFt",
  "feet": "lengthFt",
  "foot": "lengthFt",
  "inches": "lengthIn",
  "inch": "lengthIn",
  "thickness": "thickness",
  "thick": "thickness",
  "width": "width",
  "plate length": "plateLength",
  "plate quantity": "plateQty",
  "plate qty": "plateQty",
  "plate grade": "plateGrade",
  "coating": "coatingSystem",
  "item": "itemDescription",
  "item description": "itemDescription",
  "description": "itemDescription",
  "drawing": "drawingNumber",
  "drawing number": "drawingNumber",
  "detail": "detailNumber",
  "detail number": "detailNumber",
  
  // Labor fields
  "unload": "laborUnload",
  "unloading": "laborUnload",
  "cut": "laborCut",
  "cutting": "laborCut",
  "cope": "laborCope",
  "coping": "laborCope",
  "process plate": "laborProcessPlate",
  "process": "laborProcessPlate",
  "drill": "laborDrillPunch",
  "punch": "laborDrillPunch",
  "drill punch": "laborDrillPunch",
  "fit": "laborFit",
  "fitting": "laborFit",
  "weld": "laborWeld",
  "welding": "laborWeld",
  "prep": "laborPrepClean",
  "clean": "laborPrepClean",
  "prep clean": "laborPrepClean",
  "paint": "laborPaint",
  "painting": "laborPaint",
  "handle": "laborHandleMove",
  "move": "laborHandleMove",
  "handling": "laborHandleMove",
  "handle move": "laborHandleMove",
  "load": "laborLoadShip",
  "ship": "laborLoadShip",
  "load ship": "laborLoadShip",
};

// Category mappings
const CATEGORY_MAPPINGS: Record<string, string> = {
  "columns": "Columns",
  "column": "Columns",
  "beams": "Beams",
  "beam": "Beams",
  "misc": "Misc Metals",
  "misc metals": "Misc Metals",
  "miscellaneous": "Misc Metals",
  "plates": "Plates",
  "plate": "Plates",
};

// Sub-category mappings
const SUB_CATEGORY_MAPPINGS: Record<string, string> = {
  "base plate": "Base Plate",
  "gusset": "Gusset",
  "stiffener": "Stiffener",
  "clip": "Clip",
  "brace": "Brace",
  "other": "Other",
};

/**
 * Parse a single voice input in structured format
 * Returns the updated state and whether to process
 */
export function parseStructuredVoiceInput(
  text: string,
  currentState: StructuredVoiceState
): { state: StructuredVoiceState; shouldProcess: boolean; stopRecording?: boolean; createNewLine?: boolean; lineId?: string } {
  const normalized = text.toLowerCase().trim();
  let newState = { ...currentState };
  let shouldProcess = false;

  // Check for "stop recording" command
  if (normalized.includes("stop recording") || normalized.includes("stop") && normalized.includes("recording")) {
    // Return a special flag that the component can handle
    return { state: newState, shouldProcess: false, stopRecording: true } as any;
  }

  // Check for "enter" command
  if (normalized === "enter" || normalized === "done" || normalized === "complete" || normalized === "finish") {
    if (Object.keys(newState.accumulatedData).length > 0 || newState.accumulatedData.lineId) {
      newState.isComplete = true;
      shouldProcess = true;
    }
    return { state: newState, shouldProcess };
  }

  // Check for "new line" command
  if (normalized === "new line" || normalized === "newline" || normalized.startsWith("new line")) {
    // Signal that a new blank line should be created
    return { state: newState, shouldProcess: false, createNewLine: true } as any;
  }

  // Check for "Line Id L3" or "Line ID L3" format at the start
  const lineIdMatch = normalized.match(/^(?:line\s+id|lineid)\s*(?:L\s*(\d+)|(\d+))/i);
  if (lineIdMatch) {
    const lineIdNum = lineIdMatch[1] || lineIdMatch[2];
    if (lineIdNum) {
      newState.accumulatedData.lineId = `L${lineIdNum}`;
      // Signal that a new line should be created with this ID
      const result: any = { 
        state: newState, 
        shouldProcess: false, 
        createNewLine: true,
        lineId: `L${lineIdNum}`
      };
      
      // Remove the line ID part from the text and continue parsing
      const remainingText = normalized.replace(/^(?:line\s+id|lineid)\s*(?:L\s*)?\d+\s*,?\s*/i, "").trim();
      if (remainingText) {
        // Recursively parse the remaining text
        const parsed = parseStructuredVoiceInput(remainingText, newState);
        result.state = parsed.state;
        return result;
      }
      return result;
    }
  }

  // Check for context switch: "Material" or "Labor" (default to material if not set)
  if (normalized === "material" || normalized.startsWith("material")) {
    newState.context = "material";
    newState.currentField = null;
    return { state: newState, shouldProcess: false };
  }

  if (normalized === "labor" || normalized.startsWith("labor")) {
    newState.context = "labor";
    newState.currentField = null;
    return { state: newState, shouldProcess: false };
  }

  // Default to material context if not set
  if (!newState.context) {
    newState.context = "material";
  }

  // Check if this is a field name (handle comma-separated values)
  // Split by comma first to handle multiple fields in one phrase like "Item - Column, Type, Wide Flange"
  const parts = normalized.split(',').map(p => p.trim()).filter(p => p);
  
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];
    
    // Check each field mapping
    for (const [spokenName, fieldName] of Object.entries(FIELD_MAPPINGS)) {
      // Match field name at start, optionally followed by dash, colon, or space
      const fieldPattern = new RegExp(`^${spokenName}\\s*[:-]?\\s*(.*)$`, "i");
      const match = part.match(fieldPattern);
      if (match) {
        // Extract the value after the field name
        let valueText = match[1] ? match[1].trim() : "";
        
        // If no value in this part, check next part (e.g., "Type, Wide Flange")
        if (!valueText && partIndex < parts.length - 1) {
          valueText = parts[partIndex + 1].trim();
          partIndex++; // Skip next part since we used it
        }
        
        // If there's a value, parse it immediately and set it
        if (valueText) {
          const parsed = parseFieldValue(fieldName, valueText, newState.context);
          if (parsed !== undefined) {
            newState.accumulatedData[fieldName] = parsed as any;
          }
        } else {
          // No value yet, set current field to wait for next input
          newState.currentField = fieldName;
        }
        
        // Continue processing remaining parts
        if (partIndex < parts.length - 1) {
          const remainingParts = parts.slice(partIndex + 1).join(', ');
          if (remainingParts) {
            return parseStructuredVoiceInput(remainingParts, newState);
          }
        }
        
        return { state: newState, shouldProcess: false };
      }
    }
  }

  // If we have a current field, try to parse the value
  if (newState.currentField) {
    const parsed = parseFieldValue(newState.currentField, normalized, newState.context);
    if (parsed !== undefined) {
      newState.accumulatedData[newState.currentField] = parsed as any;
      newState.currentField = null; // Clear after setting value
    }
    return { state: newState, shouldProcess: false };
  }

  // If no field is set, try to infer from context
  // This handles cases like "W10X15" when in material context
  if (newState.context === "material") {
    // Try to parse as material specification
    const materialParsed = parseMaterialValue(normalized);
    if (materialParsed) {
      Object.assign(newState.accumulatedData, materialParsed);
    }
  } else if (newState.context === "labor") {
    // Try to parse as labor value
    const laborParsed = parseLaborValue(normalized);
    if (laborParsed) {
      Object.assign(newState.accumulatedData, laborParsed);
    }
  }

  return { state: newState, shouldProcess: false };
}

/**
 * Parse a field value based on field name
 */
function parseFieldValue(
  fieldName: keyof EstimatingLine,
  valueText: string,
  context: "material" | "labor" | null
): any {
  const normalized = valueText.toLowerCase().trim();

  // Category
  if (fieldName === "category") {
    return CATEGORY_MAPPINGS[normalized] || normalized;
  }

  // Sub-category
  if (fieldName === "subCategory") {
    return SUB_CATEGORY_MAPPINGS[normalized] || normalized;
  }

  // Shape type
  if (fieldName === "shapeType") {
    // Handle common shape type names
    const shapeTypeMap: Record<string, string> = {
      "wide flange": "W",
      "w shape": "W",
      "w": "W",
      "hss": "HSS",
      "tube": "HSS",
      "channel": "C",
      "c shape": "C",
      "c": "C",
      "angle": "L",
      "l shape": "L",
      "l": "L",
      "tee": "T",
      "t shape": "T",
      "t": "T",
    };
    
    const lowerNormalized = normalized.toLowerCase();
    if (shapeTypeMap[lowerNormalized]) {
      return shapeTypeMap[lowerNormalized];
    }
    
    const shape = SHAPE_TYPES.find(s => 
      s.toLowerCase() === lowerNormalized || 
      lowerNormalized.includes(s.toLowerCase())
    );
    return shape || normalized.toUpperCase();
  }

  // Size designation
  if (fieldName === "sizeDesignation") {
    // Remove common words and clean up
    return normalized
      .replace(/\b(size|designation|member)\b/gi, "")
      .trim()
      .toUpperCase();
  }

  // Grade
  if (fieldName === "grade" || fieldName === "plateGrade") {
    return normalized.toUpperCase();
  }

  // Quantity
  if (fieldName === "qty" || fieldName === "plateQty") {
    const match = normalized.match(/(\d+)/);
    return match ? parseInt(match[1]) : undefined;
  }

  // Length in feet
  if (fieldName === "lengthFt") {
    const match = normalized.match(/(\d+)\s*(?:feet|ft|')/);
    return match ? parseInt(match[1]) : undefined;
  }

  // Length in inches
  if (fieldName === "lengthIn") {
    const match = normalized.match(/(\d+)\s*(?:inches|inch|in|")/);
    return match ? parseInt(match[1]) : undefined;
  }

  // Thickness
  if (fieldName === "thickness") {
    const match = normalized.match(/(\d+(?:\/\d+)?)\s*(?:inch|in|")/);
    if (match) {
      const fraction = match[1];
      if (fraction.includes("/")) {
        const [num, den] = fraction.split("/").map(Number);
        return num / den;
      }
      return parseFloat(fraction);
    }
    return undefined;
  }

  // Width or plate length
  if (fieldName === "width" || fieldName === "plateLength") {
    const match = normalized.match(/(\d+)/);
    return match ? parseFloat(match[1]) : undefined;
  }

  // Labor hours (parse "1 hour 15 minutes" or "1.25 hours")
  if (fieldName.startsWith("labor")) {
    return parseLaborHours(normalized);
  }

  // Coating system
  if (fieldName === "coatingSystem") {
    const coating = normalized.toLowerCase();
    if (coating.includes("paint")) return "Paint";
    if (coating.includes("powder")) return "Powder";
    if (coating.includes("galv") || coating.includes("galvanized")) return "Galv";
    return "None";
  }

  // Text fields
  if (fieldName === "itemDescription" || fieldName === "drawingNumber" || fieldName === "detailNumber") {
    return normalized;
  }

  return undefined;
}

/**
 * Parse labor hours from text like "1 hour 15 minutes" or "1.25 hours"
 */
function parseLaborHours(text: string): number {
  let totalHours = 0;

  // Parse hours
  const hoursMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:hours|hour|hrs|hr|h)/);
  if (hoursMatch) {
    totalHours += parseFloat(hoursMatch[1]);
  }

  // Parse minutes
  const minutesMatch = text.match(/(\d+)\s*(?:minutes|minute|mins|min|m)/);
  if (minutesMatch) {
    totalHours += parseFloat(minutesMatch[1]) / 60;
  }

  // If no units, assume hours
  if (totalHours === 0) {
    const numberMatch = text.match(/(\d+(?:\.\d+)?)/);
    if (numberMatch) {
      totalHours = parseFloat(numberMatch[1]);
    }
  }

  return totalHours;
}

/**
 * Parse material value when context is material but no field specified
 */
function parseMaterialValue(text: string): Partial<EstimatingLine> | null {
  const result: Partial<EstimatingLine> = {};

  // Try to parse as rolled member (e.g., "W10X15", "HSS 6x6x1/4")
  const rolledMatch = text.match(/\b([WHCLT])\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\/\d+)?(?:\.[\d]+)?)\b/);
  if (rolledMatch) {
    result.shapeType = rolledMatch[1] as any;
    result.sizeDesignation = `${rolledMatch[1]}${rolledMatch[2]}X${rolledMatch[3]}`.toUpperCase();
    result.materialType = "Material";
    return result;
  }

  // Try HSS format
  const hssMatch = text.match(/\bHSS\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\.\d+)?)\s*[xX]\s*(\d+(?:\/\d+)?)\b/i);
  if (hssMatch) {
    result.shapeType = "HSS";
    result.sizeDesignation = `HSS${hssMatch[1]}X${hssMatch[2]}X${hssMatch[3]}`.toUpperCase();
    result.materialType = "Material";
    return result;
  }

  // Try category
  for (const [spoken, category] of Object.entries(CATEGORY_MAPPINGS)) {
    if (text.includes(spoken)) {
      result.category = category;
      return result;
    }
  }

  return null;
}

/**
 * Parse labor value when context is labor but no field specified
 */
function parseLaborValue(text: string): Partial<EstimatingLine> | null {
  const result: Partial<EstimatingLine> = {};

  // Check for labor field names
  for (const [spokenName, fieldName] of Object.entries(FIELD_MAPPINGS)) {
    if (fieldName.startsWith("labor") && text.includes(spokenName)) {
      // Extract hours after the field name
      const afterField = text.substring(text.indexOf(spokenName) + spokenName.length).trim();
      const hours = parseLaborHours(afterField);
      if (hours > 0) {
        result[fieldName] = hours as any;
        return result;
      }
    }
  }

  return null;
}

/**
 * Create a complete EstimatingLine from accumulated structured data
 */
export function createLineFromStructuredData(
  accumulatedData: Partial<EstimatingLine>,
  lineId: string,
  defaultMaterialRate: number,
  defaultLaborRate: number,
  defaultCoatingRate: number
): EstimatingLine {
  // Start with defaults
  const line: EstimatingLine = {
    lineId,
    drawingNumber: "",
    detailNumber: "",
    itemDescription: accumulatedData.itemDescription || "",
    category: accumulatedData.category || "Misc Metals",
    subCategory: accumulatedData.subCategory || "",
    materialType: accumulatedData.materialType || "Material",
    materialRate: defaultMaterialRate,
    laborRate: defaultLaborRate,
    coatingRate: defaultCoatingRate,
    status: "Active",
  };

  // Apply accumulated data
  Object.assign(line, accumulatedData);

  // Calculate weights if we have size designation
  if (line.sizeDesignation && line.materialType === "Material") {
    line.weightPerFoot = getWeightPerFoot(line.sizeDesignation);
    line.surfaceAreaPerFoot = getSurfaceAreaPerFoot(line.sizeDesignation);
    
    const totalLength = (line.lengthFt || 0) + ((line.lengthIn || 0) / 12);
    const qty = line.qty || 1;
    line.totalWeight = (line.weightPerFoot || 0) * totalLength * qty;
    line.totalSurfaceArea = (line.surfaceAreaPerFoot || 0) * totalLength * qty;
  }

  // Calculate total labor
  const laborFields = [
    line.laborUnload, line.laborCut, line.laborCope, line.laborProcessPlate,
    line.laborDrillPunch, line.laborFit, line.laborWeld, line.laborPrepClean,
    line.laborPaint, line.laborHandleMove, line.laborLoadShip
  ];
  line.totalLabor = laborFields.reduce((sum, val) => sum + (val || 0), 0);

  return line;
}

