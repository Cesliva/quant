import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export interface NestedPiece {
  lineId: string;
  drawingNumber: string;
  detailNumber: string;
  itemDescription: string;
  lengthFt: number;
  lengthIn: number;
  totalLengthInches: number;
  qty: number;
  shapeType?: string;
  sizeDesignation?: string;
  grade?: string;
  coatingSystem?: string;
  weightPerFoot?: number;
  totalWeight?: number;
}

export interface StockLength {
  lengthFt: number;
  pieces: NestedPiece[];
  usedLength: number; // in inches
  wasteLength: number; // in inches
  wastePercentage: number;
}

export interface MaterialGroup {
  shapeType?: string;
  sizeDesignation?: string;
  grade?: string;
  coatingSystem?: string;
  stockLengths: StockLength[];
  totalStockLengths: number;
  totalUsedLength: number;
  totalWasteLength: number;
  totalWastePercentage: number;
  totalWeight: number;
  totalPieces: number;
}

export interface NestingResult {
  groups: MaterialGroup[];
  totalStockLengths: number;
  totalWastePercentage: number;
  totalWeight: number;
  recommendation?: StockRecommendation;
}

export interface StockRecommendation {
  stockLengthFt: number;
  quantity: number;
  wastePercentage: number;
  totalWasteInches: number;
  efficiency: number; // Utilization percentage
  alternativeOptions?: Array<{
    stockLengthFt: number;
    quantity: number;
    wastePercentage: number;
  }>;
}

/**
 * Convert length from feet and inches to total inches
 */
function convertToInches(lengthFt: number = 0, lengthIn: number = 0): number {
  return lengthFt * 12 + lengthIn;
}

/**
 * Convert inches to feet and inches
 */
function convertToFeetAndInches(totalInches: number): { ft: number; in: number } {
  const ft = Math.floor(totalInches / 12);
  const in_ = totalInches % 12;
  return { ft, in: Math.round(in_ * 100) / 100 }; // Round to 2 decimals
}

/**
 * Round length to nearest stock increment (e.g., 0.125")
 */
function roundToStockIncrement(
  lengthInches: number,
  stockRounding: number = 0.125
): number {
  return Math.ceil(lengthInches / stockRounding) * stockRounding;
}

/**
 * Extract pieces from estimating lines that can be nested
 */
export function extractNestablePieces(
  lines: EstimatingLine[],
  stockRounding: number = 0.125
): NestedPiece[] {
  const pieces: NestedPiece[] = [];

  for (const line of lines) {
    // Only process active material lines (not plates, not void)
    if (line.status === "Void" || line.materialType === "Plate") {
      continue;
    }

    // Must have length and quantity
    if (!line.lengthFt && !line.lengthIn) {
      continue;
    }

    const totalLengthInches = convertToInches(line.lengthFt || 0, line.lengthIn || 0);
    if (totalLengthInches <= 0) {
      continue;
    }

    const qty = line.qty || 1;
    const roundedLength = line.useStockRounding
      ? roundToStockIncrement(totalLengthInches, stockRounding)
      : totalLengthInches;

    // Create one piece entry per quantity
    for (let i = 0; i < qty; i++) {
      pieces.push({
        lineId: line.lineId || "",
        drawingNumber: line.drawingNumber || "",
        detailNumber: line.detailNumber || "",
        itemDescription: line.itemDescription || "",
        lengthFt: line.lengthFt || 0,
        lengthIn: line.lengthIn || 0,
        totalLengthInches: roundedLength,
        qty: 1, // Each piece is individual
        shapeType: line.shapeType,
        sizeDesignation: line.sizeDesignation,
        grade: line.grade,
        coatingSystem: line.coatingSystem,
        weightPerFoot: line.weightPerFoot,
        totalWeight: line.weightPerFoot
          ? (roundedLength / 12) * line.weightPerFoot
          : undefined,
      });
    }
  }

  return pieces;
}

/**
 * Group pieces by material characteristics
 */
export function groupPiecesByMaterial(pieces: NestedPiece[]): Map<string, NestedPiece[]> {
  const groups = new Map<string, NestedPiece[]>();

  for (const piece of pieces) {
    // Create a key based on shape, size, grade, and coating
    const key = [
      piece.shapeType || "Unknown",
      piece.sizeDesignation || "Unknown",
      piece.grade || "Unknown",
    ].join("|");

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(piece);
  }

  return groups;
}

/**
 * Nest pieces into stock lengths using best-fit decreasing algorithm
 * This is more efficient than first-fit for minimizing waste
 */
export function nestPiecesIntoStockLengths(
  pieces: NestedPiece[],
  stockLengthFt: number = 20,
  cuttingWaste: number = 0.125 // 1/8" kerf per cut
): StockLength[] {
  // Sort pieces by length descending (best-fit decreasing strategy)
  const sortedPieces = [...pieces].sort(
    (a, b) => b.totalLengthInches - a.totalLengthInches
  );

  const stockLengthInches = stockLengthFt * 12;
  const stockLengths: StockLength[] = [];

  for (const piece of sortedPieces) {
    let bestFit: StockLength | null = null;
    let bestFitWaste = Infinity;

    // Find the stock length with the smallest waste that can fit this piece
    for (const stock of stockLengths) {
      const availableSpace = stockLengthInches - stock.usedLength;
      const requiredSpace = piece.totalLengthInches + cuttingWaste;
      
      if (requiredSpace <= availableSpace) {
        const waste = availableSpace - requiredSpace;
        if (waste < bestFitWaste) {
          bestFit = stock;
          bestFitWaste = waste;
        }
      }
    }

    // Place in best fit, or create new stock length
    if (bestFit) {
      bestFit.pieces.push(piece);
      bestFit.usedLength += piece.totalLengthInches + cuttingWaste;
    } else {
      const newStock: StockLength = {
        lengthFt: stockLengthFt,
        pieces: [piece],
        usedLength: piece.totalLengthInches + cuttingWaste,
        wasteLength: 0,
        wastePercentage: 0,
      };
      stockLengths.push(newStock);
    }
  }

  // Calculate waste for each stock length
  for (const stock of stockLengths) {
    stock.wasteLength = stockLengthInches - stock.usedLength;
    stock.wastePercentage = (stock.wasteLength / stockLengthInches) * 100;
  }

  return stockLengths;
}

/**
 * Optimize nesting by trying multiple stock length options and finding the best
 */
export function optimizeNesting(
  pieces: NestedPiece[],
  stockLengthOptions: number[] = [20, 40, 60],
  cuttingWaste: number = 0.125
): StockRecommendation {
  if (pieces.length === 0) {
    return {
      stockLengthFt: 20,
      quantity: 0,
      wastePercentage: 0,
      totalWasteInches: 0,
      efficiency: 0,
    };
  }

  const results: Array<{
    stockLengthFt: number;
    quantity: number;
    wastePercentage: number;
    totalWasteInches: number;
    efficiency: number;
  }> = [];

  // Try each stock length option
  for (const stockLengthFt of stockLengthOptions) {
    const stockLengths = nestPiecesIntoStockLengths(pieces, stockLengthFt, cuttingWaste);
    const quantity = stockLengths.length;
    const totalStockInches = quantity * stockLengthFt * 12;
    const totalUsedInches = stockLengths.reduce((sum, stock) => sum + stock.usedLength, 0);
    const totalWasteInches = totalStockInches - totalUsedInches;
    const wastePercentage = (totalWasteInches / totalStockInches) * 100;
    const efficiency = (totalUsedInches / totalStockInches) * 100;

    results.push({
      stockLengthFt,
      quantity,
      wastePercentage,
      totalWasteInches,
      efficiency,
    });
  }

  // Sort by waste percentage (ascending), then by quantity (ascending)
  results.sort((a, b) => {
    if (Math.abs(a.wastePercentage - b.wastePercentage) < 0.01) {
      // If waste is very similar, prefer fewer stock lengths
      return a.quantity - b.quantity;
    }
    return a.wastePercentage - b.wastePercentage;
  });

  const best = results[0];
  const alternatives = results.slice(1, 4); // Top 3 alternatives

  return {
    stockLengthFt: best.stockLengthFt,
    quantity: best.quantity,
    wastePercentage: best.wastePercentage,
    totalWasteInches: best.totalWasteInches,
    efficiency: best.efficiency,
    alternativeOptions: alternatives.map((alt) => ({
      stockLengthFt: alt.stockLengthFt,
      quantity: alt.quantity,
      wastePercentage: alt.wastePercentage,
    })),
  };
}

/**
 * Main nesting function - processes estimating lines and returns nested results
 * Now optimizes across all materials and recommends best stock length
 */
export function nestMaterial(
  lines: EstimatingLine[],
  stockLengthFt?: number, // Optional - if not provided, will optimize
  stockRounding: number = 0.125,
  cuttingWaste: number = 0.125,
  optimize: boolean = true // Whether to find optimal stock length
): NestingResult {
  // Extract nestable pieces
  const pieces = extractNestablePieces(lines, stockRounding);

  if (pieces.length === 0) {
    return {
      groups: [],
      totalStockLengths: 0,
      totalWastePercentage: 0,
      totalWeight: 0,
    };
  }

  // Group by material (still useful for display)
  const materialGroups = groupPiecesByMaterial(pieces);

  // Determine optimal stock length if optimization is enabled
  let optimalStockLength = stockLengthFt || 20;
  let recommendation: StockRecommendation | undefined;

  if (optimize) {
    const stockLengthOptions = [20, 40, 60];
    if (stockLengthFt && !stockLengthOptions.includes(stockLengthFt)) {
      stockLengthOptions.push(stockLengthFt);
      stockLengthOptions.sort((a, b) => a - b);
    }

    // Optimize for all pieces together
    recommendation = optimizeNesting(pieces, stockLengthOptions, cuttingWaste);
    optimalStockLength = recommendation.stockLengthFt;
  }

  const groups: MaterialGroup[] = [];

  // Process each material group with optimal stock length
  for (const [key, groupPieces] of materialGroups.entries()) {
    const [shapeType, sizeDesignation, grade] = key.split("|");

    // Nest pieces into stock lengths using optimal length
    const stockLengths = nestPiecesIntoStockLengths(
      groupPieces,
      optimalStockLength,
      cuttingWaste
    );

    // Calculate totals
    const totalStockLengths = stockLengths.length;
    const totalUsedLength = stockLengths.reduce(
      (sum, stock) => sum + stock.usedLength,
      0
    );
    const totalWasteLength = stockLengths.reduce(
      (sum, stock) => sum + stock.wasteLength,
      0
    );
    const totalWastePercentage =
      totalStockLengths > 0
        ? (totalWasteLength / (totalStockLengths * optimalStockLength * 12)) * 100
        : 0;
    const totalWeight = groupPieces.reduce(
      (sum, piece) => sum + (piece.totalWeight || 0),
      0
    );
    const totalPieces = groupPieces.length;

    groups.push({
      shapeType: shapeType !== "Unknown" ? shapeType : undefined,
      sizeDesignation: sizeDesignation !== "Unknown" ? sizeDesignation : undefined,
      grade: grade !== "Unknown" ? grade : undefined,
      coatingSystem: groupPieces[0]?.coatingSystem,
      stockLengths,
      totalStockLengths,
      totalUsedLength,
      totalWasteLength,
      totalWastePercentage,
      totalWeight,
      totalPieces,
    });
  }

  // Calculate overall totals
  const totalStockLengths = groups.reduce(
    (sum, group) => sum + group.totalStockLengths,
    0
  );
  const totalWeight = groups.reduce((sum, group) => sum + group.totalWeight, 0);
  
  // Calculate overall waste based on actual usage
  const totalStockInches = totalStockLengths * optimalStockLength * 12;
  const totalUsedInches = groups.reduce(
    (sum, group) => sum + group.totalUsedLength,
    0
  );
  const totalWasteInches = totalStockInches - totalUsedInches;
  const overallWastePercentage =
    totalStockInches > 0 ? (totalWasteInches / totalStockInches) * 100 : 0;

  return {
    groups,
    totalStockLengths,
    totalWastePercentage: overallWastePercentage,
    totalWeight,
    recommendation,
  };
}

