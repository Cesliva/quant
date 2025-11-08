/**
 * Line ID Management Utilities
 * 
 * Handles sequential line IDs (L1, L2, L3, etc.) and copy format (L1-L10)
 */

export interface EstimatingLine {
  lineId: string;
  [key: string]: any;
}

/**
 * Extract the numeric part from a line ID
 * L1 → 1, L10 → 10, L1-L10 → 10 (for sorting)
 */
export function extractLineNumber(lineId: string): number {
  // Handle copy format: L1-L10 → extract 10 (the location)
  if (lineId.includes('-')) {
    const parts = lineId.split('-');
    const lastPart = parts[parts.length - 1];
    const match = lastPart.match(/L?(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }
  
  // Handle regular format: L1 → 1
  const match = lineId.match(/L?(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Extract the prefix from a copy line ID
 * L1-L10 → L1, L5-L20 → L5
 */
export function extractLinePrefix(lineId: string): string | null {
  if (lineId.includes('-')) {
    const parts = lineId.split('-');
    return parts[0] || null;
  }
  return null;
}

/**
 * Check if a line ID is a copy (has prefix format)
 */
export function isCopyLine(lineId: string): boolean {
  return lineId.includes('-') && lineId.split('-').length === 2;
}

/**
 * Get the next sequential line ID
 * Finds the highest number in existing lines and returns next
 */
export function getNextLineId(existingLines: EstimatingLine[]): string {
  if (existingLines.length === 0) {
    return 'L1';
  }
  
  // Extract all line numbers (from both regular and copy lines)
  const lineNumbers = existingLines
    .map(line => extractLineNumber(line.lineId))
    .filter(num => num > 0);
  
  if (lineNumbers.length === 0) {
    return 'L1';
  }
  
  const maxNumber = Math.max(...lineNumbers);
  return `L${maxNumber + 1}`;
}

/**
 * Create a copy line ID in the format: originalLineId-newLocationId
 * Example: copyLineId('L1', 'L10') → 'L1-L10'
 */
export function createCopyLineId(originalLineId: string, newLocationId: string): string {
  // Extract just the number from newLocationId
  const locationNum = extractLineNumber(newLocationId);
  const locationId = `L${locationNum}`;
  
  return `${originalLineId}-${locationId}`;
}

/**
 * Sort lines by line ID
 * Regular lines (L1, L2, L3) sort numerically
 * Copy lines (L1-L10) sort by location (the number after the dash)
 * When sorted, copy lines with same prefix will group together
 */
export function sortLinesByLineId(lines: EstimatingLine[]): EstimatingLine[] {
  return [...lines].sort((a, b) => {
    const numA = extractLineNumber(a.lineId);
    const numB = extractLineNumber(b.lineId);
    
    // Primary sort: by number
    if (numA !== numB) {
      return numA - numB;
    }
    
    // Secondary sort: if numbers are equal, sort by full string
    // This ensures L1 comes before L1-L10
    return a.lineId.localeCompare(b.lineId);
  });
}

/**
 * Sort lines by prefix (for grouping copies together)
 * L1, L1-L10, L1-L15, L2, L2-L20 will sort as:
 * L1, L1-L10, L1-L15, L2, L2-L20
 */
export function sortLinesByPrefix(lines: EstimatingLine[]): EstimatingLine[] {
  return [...lines].sort((a, b) => {
    const prefixA = extractLinePrefix(a.lineId) || a.lineId;
    const prefixB = extractLinePrefix(b.lineId) || b.lineId;
    
    // First sort by prefix number
    const prefixNumA = extractLineNumber(prefixA);
    const prefixNumB = extractLineNumber(prefixB);
    
    if (prefixNumA !== prefixNumB) {
      return prefixNumA - prefixNumB;
    }
    
    // If same prefix, sort by location number
    const numA = extractLineNumber(a.lineId);
    const numB = extractLineNumber(b.lineId);
    
    return numA - numB;
  });
}

