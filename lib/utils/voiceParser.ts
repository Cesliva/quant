/**
 * Voice Parser Utility
 * Parses transcribed voice text into EstimatingLine objects
 * 
 * Examples of voice commands:
 * - "W12x65 column, 8 pieces, 20 feet each"
 * - "Add 5 W12x26 beams, 20 feet long, A992 grade"
 * - "HSS 8x8x3/8, 3 pieces, 30 feet"
 * - "1/2 inch plate, 48 by 96, 2 pieces"
 * - "L4 W10x15 beam, 5 pieces, 15 feet" (specifies line ID L4)
 * - "line 4 W10x15 beam" (alternative line ID format)
 * - "edit L4, change member size to HSS 6x6x1/4" (edit existing line)
 * - "edit L4, change quantity to 4" (edit quantity)
 * 
 * Line ID Detection:
 * When you say a line ID (e.g., "L4", "line 4", "line id 4"), the parser will:
 * 1. Create a new line with that specific ID
 * 2. If there's text before the line ID, it will be parsed as a separate line first
 * 3. The text after the line ID will be assigned to the new line
 * 
 * Edit Commands:
 * When you say "edit L4" followed by field changes, the parser will:
 * 1. Identify the line to edit
 * 2. Parse the field changes (size, quantity, length, grade, etc.)
 * 3. Return edit instructions instead of new line data
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getShapeByDesignation, SHAPE_TYPES } from "@/lib/utils/aiscShapes";
import { getWeightPerFoot, getSurfaceAreaPerFoot } from "@/lib/utils/aiscShapes";

export interface ParsedLine {
  lineId?: string; // Optional line ID from voice (e.g., "L4", "L10")
  itemDescription: string;
  materialType: "Material" | "Plate";
  shapeType?: string;
  sizeDesignation?: string;
  grade?: string;
  qty?: number;
  lengthFt?: number;
  lengthIn?: number;
  // Plate fields
  thickness?: number;
  width?: number;
  plateLength?: number;
  plateQty?: number;
  plateGrade?: string;
  category?: string;
  subCategory?: string;
}

export interface ParsedEditCommand {
  isEdit: true;
  targetLineId: string; // Line ID to edit (e.g., "L4")
  updates: Partial<EstimatingLine>; // Fields to update
}

/**
 * Extract line ID from text (e.g., "L4", "line 4", "line id 4")
 * Returns the line ID in format "L{number}" or null if not found
 */
function extractLineId(text: string): string | null {
  // Patterns: "L4", "line 4", "line id 4", "line number 4", "L 4"
  const patterns = [
    /\bL\s*(\d+)\b/i,                    // L4, L 4
    /\bline\s+id\s+(\d+)\b/i,             // line id 4
    /\bline\s+number\s+(\d+)\b/i,         // line number 4
    /\bline\s+(\d+)\b/i,                  // line 4
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `L${match[1]}`;
    }
  }

  return null;
}

/**
 * Parse edit command (e.g., "edit L4, change member size to HSS 6x6x1/4")
 * Returns ParsedEditCommand if it's an edit, null otherwise
 */
function parseEditCommand(text: string): ParsedEditCommand | null {
  const normalized = text.toLowerCase().trim();
  
  // Check if it starts with "edit"
  const editMatch = normalized.match(/^edit\s+(?:line\s+id\s+)?(?:L\s*(\d+)|line\s+(\d+)|line\s+id\s+(\d+)|line\s+number\s+(\d+))/i);
  if (!editMatch) {
    return null;
  }

  // Extract line ID
  const lineIdNum = editMatch[1] || editMatch[2] || editMatch[3] || editMatch[4];
  if (!lineIdNum) {
    return null;
  }
  const targetLineId = `L${lineIdNum}`;

  // Get the rest of the text after "edit L4, " or "edit L4 "
  const afterEdit = normalized.substring(editMatch[0].length).trim();
  if (!afterEdit) {
    return null; // No changes specified
  }

  const updates: Partial<EstimatingLine> = {};

  // Parse field changes
  // "change member size to HSS 6x6x1/4"
  // "change size to W12x65"
  const sizeMatch = afterEdit.match(/change\s+(?:member\s+)?size\s+to\s+(.+?)(?:,|$)/i);
  if (sizeMatch) {
    const sizeText = sizeMatch[1].trim();
    // Try to parse as rolled member to extract shape and size
    const parsed = parseRolledMember(sizeText);
    if (parsed && parsed.shapeType && parsed.sizeDesignation) {
      updates.shapeType = parsed.shapeType as any;
      updates.sizeDesignation = parsed.sizeDesignation;
      // Recalculate weight if we have the size
      if (parsed.sizeDesignation) {
        updates.weightPerFoot = getWeightPerFoot(parsed.sizeDesignation);
        updates.surfaceAreaPerFoot = getSurfaceAreaPerFoot(parsed.sizeDesignation);
      }
    }
  }

  // "change quantity to 4"
  // "change qty to 4"
  const qtyMatch = afterEdit.match(/change\s+(?:quantity|qty)\s+to\s+(\d+)/i);
  if (qtyMatch) {
    updates.qty = parseInt(qtyMatch[1]);
  }

  // "change length to 20 feet"
  // "change length to 15 feet 6 inches"
  const lengthMatch = afterEdit.match(/change\s+length\s+to\s+(?:(\d+)\s*(?:feet|ft|')\s*(?:(\d+)\s*(?:inch|in|"))?|(\d+)\s*(?:inch|in|"))/i);
  if (lengthMatch) {
    if (lengthMatch[1]) {
      updates.lengthFt = parseInt(lengthMatch[1]);
      updates.lengthIn = lengthMatch[2] ? parseInt(lengthMatch[2]) : 0;
    } else if (lengthMatch[3]) {
      updates.lengthFt = 0;
      updates.lengthIn = parseInt(lengthMatch[3]);
    }
  }

  // "change grade to A992"
  const gradeMatch = afterEdit.match(/change\s+grade\s+to\s+([A-Za-z0-9\s]+?)(?:,|$)/i);
  if (gradeMatch) {
    updates.grade = gradeMatch[1].trim();
  }

  // "change category to Columns"
  const categoryMatch = afterEdit.match(/change\s+category\s+to\s+([A-Za-z\s]+?)(?:,|$)/i);
  if (categoryMatch) {
    updates.category = categoryMatch[1].trim();
  }

  // If no specific updates found, try to parse the whole thing as a material description
  if (Object.keys(updates).length === 0) {
    // Try parsing as a complete material description
    const parsed = parseSegment(afterEdit);
    if (parsed) {
      if (parsed.materialType === "Material") {
        if (parsed.shapeType) updates.shapeType = parsed.shapeType as any;
        if (parsed.sizeDesignation) {
          updates.sizeDesignation = parsed.sizeDesignation;
          updates.weightPerFoot = getWeightPerFoot(parsed.sizeDesignation);
          updates.surfaceAreaPerFoot = getSurfaceAreaPerFoot(parsed.sizeDesignation);
        }
        if (parsed.grade) updates.grade = parsed.grade;
        if (parsed.qty) updates.qty = parsed.qty;
        if (parsed.lengthFt !== undefined) updates.lengthFt = parsed.lengthFt;
        if (parsed.lengthIn !== undefined) updates.lengthIn = parsed.lengthIn;
      }
    }
  }

  return {
    isEdit: true,
    targetLineId,
    updates,
  };
}

/**
 * Parse voice transcription into estimating line items or edit commands
 * Supports line ID detection (e.g., "L4", "line 4") to trigger new lines
 * Supports edit commands (e.g., "edit L4, change size to...")
 * Supports edit followed by new line (e.g., "edit L4, change size to..., L5 W10x15...")
 * Supports undo/redo commands (e.g., "undo", "redo")
 */
export type VoiceCommandResult = 
  | ParsedLine[] 
  | ParsedEditCommand 
  | { edit: ParsedEditCommand; newLines: ParsedLine[] }
  | { command: "undo" }
  | { command: "redo" };

export function parseVoiceTranscription(text: string): VoiceCommandResult {
  const normalizedText = text.toLowerCase().trim();

  // Check for undo/redo commands first
  if (normalizedText === "undo" || normalizedText === "undo last" || normalizedText === "undo that") {
    return { command: "undo" };
  }
  
  if (normalizedText === "redo" || normalizedText === "redo last" || normalizedText === "redo that") {
    return { command: "redo" };
  }

  // First, check if this is an edit command
  const editCommand = parseEditCommand(normalizedText);
  if (editCommand) {
    // Check if there's a new line ID after the edit command
    // Find where the edit command ends by looking for the target line ID and what comes after
    const editMatch = normalizedText.match(/^edit\s+(?:line\s+id\s+)?(?:L\s*\d+|line\s+(?:id\s+)?\d+|line\s+number\s+\d+)/i);
    if (editMatch) {
      const afterEditStart = editMatch.index! + editMatch[0].length;
      const afterEdit = normalizedText.substring(afterEditStart).trim();
      
      // Look for line ID patterns in the text after the edit command
      // But exclude the target line ID itself
      const lineIdPattern = /\b(?:L\s*\d+|line\s+(?:id\s+)?\d+|line\s+number\s+\d+)\b/gi;
      const lineIdMatches = [...afterEdit.matchAll(lineIdPattern)];
      
      // Filter out the target line ID if it appears again
      const validMatches = lineIdMatches.filter(match => {
        const extracted = extractLineId(match[0]);
        return extracted && extracted !== editCommand.targetLineId;
      });
      
      if (validMatches.length > 0) {
        // There's a new line ID after the edit - parse it
        const newLineId = extractLineId(validMatches[0][0]);
        if (newLineId) {
          // Get text after the new line ID
          const matchIndex = validMatches[0].index!;
          const newLineText = afterEdit.substring(matchIndex + validMatches[0][0].length).trim();
          if (newLineText) {
            const parsed = parseSegment(newLineText);
            if (parsed) {
              parsed.lineId = newLineId;
              return { edit: editCommand, newLines: [parsed] };
            }
          }
        }
      }
    }
    
    return editCommand;
  }

  const lines: ParsedLine[] = [];

  // Check if the text starts with a line ID
  // Split text by line ID patterns to separate different lines
  // Pattern: Look for "L4", "line 4", "line id 4", etc.
  const lineIdPattern = /\b(?:L\s*\d+|line\s+(?:id\s+)?\d+|line\s+number\s+\d+)\b/gi;
  const lineIdMatches = [...normalizedText.matchAll(lineIdPattern)];
  
  if (lineIdMatches.length > 0) {
    // Split text by line IDs
    let lastIndex = 0;
    for (let i = 0; i < lineIdMatches.length; i++) {
      const match = lineIdMatches[i];
      const matchIndex = match.index!;
      
      // Get text before this line ID (if any) - this is the previous line's content
      if (matchIndex > lastIndex) {
        const previousText = normalizedText.substring(lastIndex, matchIndex).trim();
        if (previousText) {
          const parsed = parseSegment(previousText);
          if (parsed) {
            lines.push(parsed);
          }
        }
      }
      
      // Extract the line ID
      const lineId = extractLineId(match[0]);
      
      // Get text after this line ID (up to next line ID or end)
      const nextMatchIndex = i < lineIdMatches.length - 1 
        ? lineIdMatches[i + 1].index! 
        : normalizedText.length;
      const lineText = normalizedText.substring(matchIndex + match[0].length, nextMatchIndex).trim();
      
      if (lineText) {
        const parsed = parseSegment(lineText);
        if (parsed && lineId) {
          parsed.lineId = lineId;
          lines.push(parsed);
        }
      }
      
      lastIndex = nextMatchIndex;
    }
    
    // If there's text after the last line ID, parse it
    if (lastIndex < normalizedText.length) {
      const remainingText = normalizedText.substring(lastIndex).trim();
      if (remainingText) {
        const parsed = parseSegment(remainingText);
        if (parsed) {
          lines.push(parsed);
        }
      }
    }
  } else {
    // No line IDs found, use original logic - split by common separators
    const segments = normalizedText
      .split(/[.,;]| and | also | then /)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const segment of segments) {
      const parsed = parseSegment(segment);
      if (parsed) {
        lines.push(parsed);
      }
    }

    // If no segments found, try parsing the whole text
    if (lines.length === 0) {
      const parsed = parseSegment(normalizedText);
      if (parsed) {
        lines.push(parsed);
      }
    }
  }

  return lines;
}

/**
 * Parse a single segment of text
 */
function parseSegment(text: string): ParsedLine | null {
  // Skip empty or very short segments
  if (text.length < 5) return null;

  // Check if it's a plate
  if (isPlateDescription(text)) {
    return parsePlate(text);
  }

  // Otherwise, try to parse as rolled member
  return parseRolledMember(text);
}

/**
 * Check if text describes a plate
 */
function isPlateDescription(text: string): boolean {
  const plateKeywords = [
    "plate",
    "sheet",
    "thick",
    "inch thick",
    '" thick',
    "by",
    "x" // e.g., "48 x 96"
  ];
  
  const hasPlateKeyword = plateKeywords.some(keyword => text.includes(keyword));
  const hasThickness = /\d+\s*(?:\/\d+)?\s*(?:inch|"|in)/i.test(text);
  const hasDimensions = /\d+\s*(?:x|by)\s*\d+/i.test(text);
  
  return hasPlateKeyword || (hasThickness && hasDimensions);
}

/**
 * Parse plate description
 * Examples:
 * - "1/2 inch plate, 48 by 96, 2 pieces"
 * - "3/8 plate 36x72"
 */
function parsePlate(text: string): ParsedLine | null {
  const result: ParsedLine = {
    itemDescription: "",
    materialType: "Plate",
    category: "Plates",
  };

  // Extract thickness (e.g., "1/2 inch", "3/8", "0.5 inch")
  const thicknessMatch = text.match(/(\d+(?:\/\d+)?)\s*(?:inch|"|in|thick)/i) ||
                         text.match(/(\d+\.\d+)\s*(?:inch|"|in)/i);
  if (thicknessMatch) {
    const thicknessStr = thicknessMatch[1];
    if (thicknessStr.includes("/")) {
      const [num, den] = thicknessStr.split("/").map(Number);
      result.thickness = num / den;
    } else {
      result.thickness = parseFloat(thicknessStr);
    }
  }

  // Extract dimensions (e.g., "48 by 96", "36x72")
  const dimMatch = text.match(/(\d+)\s*(?:x|by)\s*(\d+)/i);
  if (dimMatch) {
    result.width = parseFloat(dimMatch[1]);
    result.plateLength = parseFloat(dimMatch[2]);
  }

  // Extract quantity
  const qtyMatch = text.match(/(\d+)\s*(?:piece|pcs|qty|quantity)/i) ||
                   text.match(/(\d+)\s*(?:each|ea)/i);
  if (qtyMatch) {
    result.plateQty = parseInt(qtyMatch[1]);
  } else {
    // Try to find standalone number that might be quantity
    const numbers = text.match(/\d+/g);
    if (numbers && numbers.length > 2) {
      // If we have thickness and dimensions, the last number might be quantity
      result.plateQty = parseInt(numbers[numbers.length - 1]);
    } else {
      result.plateQty = 1;
    }
  }

  // Extract grade
  const gradeMatch = text.match(/\b(A\d+|A\d+\s*Gr\s*\d+|A\d+\s*Grade\s*\d+)\b/i);
  if (gradeMatch) {
    result.plateGrade = gradeMatch[1].replace(/\s+/g, " ");
  } else {
    result.plateGrade = "A36"; // Default
  }

  // Create description
  if (result.thickness && result.width && result.plateLength) {
    result.itemDescription = `${result.thickness}" Plate ${result.width}" × ${result.plateLength}"`;
  } else {
    result.itemDescription = text; // Fallback to original text
  }

  return result;
}

/**
 * Parse rolled member description
 * Examples:
 * - "W12x65 column, 8 pieces, 20 feet each"
 * - "Add 5 W12x26 beams, 20 feet long, A992 grade"
 * - "HSS 8x8x3/8, 3 pieces, 30 feet"
 */
function parseRolledMember(text: string): ParsedLine | null {
  const result: ParsedLine = {
    itemDescription: "",
    materialType: "Material",
    category: "Structural",
  };

  // Extract shape designation (e.g., "W12x65", "HSS 8x8x3/8", "C15x33.9")
  const shapePatterns = [
    // W-shapes: W12x65, W 12 x 65
    /\b([Ww])\s*(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\b/,
    // HSS: HSS 8x8x3/8, HSS8x8x0.375
    /\b([Hh][Ss]{2})\s*(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+(?:\/\d+)?(?:\.\d+)?)\b/,
    // Channels: C15x33.9, C 15 x 33.9
    /\b([Cc])\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\b/,
    // Angles: L4x4x1/2, L 4 x 4 x 1/2
    /\b([Ll])\s*(\d+)\s*[x×]\s*(\d+)\s*[x×]\s*(\d+(?:\/\d+)?)\b/,
  ];

  let shapeMatch = null;
  let shapeType = "";
  let sizeDesignation = "";

  for (const pattern of shapePatterns) {
    shapeMatch = text.match(pattern);
    if (shapeMatch) {
      if (shapeMatch[1].toUpperCase() === "HSS") {
        shapeType = "HSS";
        // HSS format: HSS8x8x3/8 (match AISC database format)
        const thickness = shapeMatch[4];
        sizeDesignation = `HSS${shapeMatch[2]}x${shapeMatch[3]}x${thickness}`;
      } else if (shapeMatch[1].toUpperCase() === "L") {
        shapeType = "L";
        // Angle format: L4x4x1/2
        sizeDesignation = `${shapeMatch[1].toUpperCase()}${shapeMatch[2]}x${shapeMatch[3]}x${shapeMatch[4]}`;
      } else {
        shapeType = shapeMatch[1].toUpperCase();
        // W or C format: W12x65
        sizeDesignation = `${shapeMatch[1].toUpperCase()}${shapeMatch[2]}x${shapeMatch[3]}`;
      }
      break;
    }
  }

  // If no standard pattern found, try to extract any shape mention
  if (!shapeMatch) {
    const shapeKeywords = SHAPE_TYPES.map(t => t.toLowerCase());
    for (const keyword of shapeKeywords) {
      if (text.includes(keyword)) {
        shapeType = keyword.toUpperCase();
        // Try to extract any size pattern
        const sizeMatch = text.match(/\d+\s*[x×]\s*\d+/);
        if (sizeMatch) {
          sizeDesignation = `${shapeType}${sizeMatch[0]}`;
        }
        break;
      }
    }
  }

  if (!shapeType) {
    // Couldn't identify shape, might not be a valid rolled member
    return null;
  }

  result.shapeType = shapeType;
  result.sizeDesignation = sizeDesignation;

  // Extract quantity
  const qtyPatterns = [
    /(\d+)\s*(?:piece|pcs|qty|quantity|each|ea)/i,
    /(\d+)\s*(?:of|pieces of)/i,
  ];
  for (const pattern of qtyPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.qty = parseInt(match[1]);
      break;
    }
  }
  if (!result.qty) {
    // Try to find number before shape (e.g., "5 W12x26")
    const beforeShape = text.substring(0, text.indexOf(shapeType) || text.length);
    const numMatch = beforeShape.match(/\b(\d+)\b/);
    if (numMatch) {
      result.qty = parseInt(numMatch[1]);
    } else {
      result.qty = 1; // Default
    }
  }

  // Extract length
  const lengthPatterns = [
    /(\d+)\s*(?:feet|ft|')\s*(?:(\d+)\s*(?:inch|in|"))?/i,
    /(\d+)\s*(?:feet|ft|')/i,
    /(\d+)\s*(?:inch|in|")/i,
  ];
  for (const pattern of lengthPatterns) {
    const match = text.match(pattern);
    if (match) {
      result.lengthFt = parseInt(match[1]);
      if (match[2]) {
        result.lengthIn = parseInt(match[2]);
      }
      break;
    }
  }

  // Extract grade
  const gradeMatch = text.match(/\b(A\d+|A\d+\s*Gr\s*\d+|A\d+\s*Grade\s*\d+)\b/i);
  if (gradeMatch) {
    result.grade = gradeMatch[1].replace(/\s+/g, " ");
  } else {
    result.grade = "A992"; // Default for structural
  }

  // Extract category from keywords
  if (text.includes("column") || text.includes("col")) {
    result.category = "Columns";
  } else if (text.includes("beam") || text.includes("girder")) {
    result.category = "Beams";
  } else if (text.includes("brace") || text.includes("bracing")) {
    result.category = "Misc Metals";
    result.subCategory = "Brace";
  }

  // Create description
  if (sizeDesignation) {
    result.itemDescription = `${sizeDesignation} ${result.category || "Member"}`;
    if (result.lengthFt) {
      result.itemDescription += `, ${result.lengthFt}'`;
      if (result.lengthIn) {
        result.itemDescription += ` ${result.lengthIn}"`;
      }
    }
  } else {
    result.itemDescription = text; // Fallback
  }

  return result;
}

/**
 * Convert parsed line to full EstimatingLine with calculated fields
 */
export function createEstimatingLineFromParsed(
  parsed: ParsedLine,
  lineId: string, // Fallback line ID if parsed.lineId is not provided
  defaultMaterialRate: number,
  defaultLaborRate: number,
  defaultCoatingRate: number
): Partial<EstimatingLine> {
  const line: Partial<EstimatingLine> = {
    lineId: parsed.lineId || lineId, // Use voice-provided line ID if available, otherwise use fallback
    itemDescription: parsed.itemDescription,
    materialType: parsed.materialType,
    category: parsed.category || "Structural",
    subCategory: parsed.subCategory || "",
    status: "Active",
    useStockRounding: true,
    materialRate: defaultMaterialRate,
    laborRate: defaultLaborRate,
    coatingRate: defaultCoatingRate,
    coatingSystem: "None",
  };

  if (parsed.materialType === "Material") {
    line.shapeType = parsed.shapeType as any;
    line.sizeDesignation = parsed.sizeDesignation;
    line.grade = parsed.grade || "A992";
    line.qty = parsed.qty || 1;
    line.lengthFt = parsed.lengthFt || 0;
    line.lengthIn = parsed.lengthIn || 0;

    // Calculate read-only fields
    if (line.sizeDesignation) {
      line.weightPerFoot = getWeightPerFoot(line.sizeDesignation);
      line.surfaceAreaPerFoot = getSurfaceAreaPerFoot(line.sizeDesignation);

      const totalLength = (line.lengthFt || 0) + ((line.lengthIn || 0) / 12);
      line.totalWeight = (line.weightPerFoot || 0) * totalLength * (line.qty || 1);
      line.totalSurfaceArea = (line.surfaceAreaPerFoot || 0) * totalLength * (line.qty || 1);
    }
  } else if (parsed.materialType === "Plate") {
    line.thickness = parsed.thickness;
    line.width = parsed.width;
    line.plateLength = parsed.plateLength;
    line.plateQty = parsed.plateQty || 1;
    line.plateGrade = parsed.plateGrade || "A36";
    line.oneSideCoat = false;

    // Plate calculations would be done by the EstimatingGrid component
  }

  return line;
}

