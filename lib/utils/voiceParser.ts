/**
 * Voice Parser Utility
 * Parses transcribed voice text into EstimatingLine objects
 * 
 * Examples of voice commands:
 * - "W12x65 column, 8 pieces, 20 feet each"
 * - "Add 5 W12x26 beams, 20 feet long, A992 grade"
 * - "HSS 8x8x3/8, 3 pieces, 30 feet"
 * - "1/2 inch plate, 48 by 96, 2 pieces"
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getShapeByDesignation, SHAPE_TYPES } from "@/lib/utils/aiscShapes";
import { getWeightPerFoot, getSurfaceAreaPerFoot } from "@/lib/utils/aiscShapes";

interface ParsedLine {
  itemDescription: string;
  materialType: "Rolled" | "Plate";
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

/**
 * Parse voice transcription into estimating line items
 */
export function parseVoiceTranscription(text: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  const normalizedText = text.toLowerCase().trim();

  // Split by common separators (periods, commas, "and", "also")
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
    materialType: "Rolled",
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
  lineId: string,
  defaultMaterialRate: number,
  defaultLaborRate: number,
  defaultCoatingRate: number
): Partial<EstimatingLine> {
  const line: Partial<EstimatingLine> = {
    lineId,
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

  if (parsed.materialType === "Rolled") {
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

