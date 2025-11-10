/**
 * Quant Proprietary Export Format
 * Saves estimates in a .quant file format (JSON-based with metadata)
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export interface QuantEstimateFile {
  version: string;
  format: "quant-estimate";
  metadata: {
    projectId: string;
    projectName?: string;
    companyId: string;
    companyName?: string;
    exportedAt: string;
    exportedBy?: string;
    totalLines: number;
    totalWeight: number;
    totalLabor: number;
    totalCost: number;
  };
  lines: EstimatingLine[];
  settings?: {
    materialRates?: Record<string, number>;
    laborRates?: Record<string, number>;
    coatingRates?: Record<string, number>;
  };
}

/**
 * Export estimate to Quant proprietary format (.quant)
 * Uses File System Access API if available (Chrome/Edge) to show save dialog,
 * otherwise falls back to standard download
 */
export async function exportToQuant(
  lines: EstimatingLine[],
  projectId: string,
  companyId: string = "default",
  projectName?: string,
  companyName?: string
): Promise<void> {
  // Calculate totals
  const totals = {
    totalWeight: lines.reduce(
      (sum, line) =>
        sum +
        (line.materialType === "Rolled"
          ? line.totalWeight || 0
          : line.plateTotalWeight || 0),
      0
    ),
    totalLabor: lines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
    totalCost: lines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
  };

  // Create the Quant file structure
  const quantFile: QuantEstimateFile = {
    version: "1.0.0",
    format: "quant-estimate",
    metadata: {
      projectId,
      projectName: projectName || projectId,
      companyId,
      companyName: companyName || "Company",
      exportedAt: new Date().toISOString(),
      totalLines: lines.length,
      totalWeight: totals.totalWeight,
      totalLabor: totals.totalLabor,
      totalCost: totals.totalCost,
    },
    lines: lines.map((line) => {
      // Create a clean copy without Firestore-specific fields
      const { id, ...cleanLine } = line;
      return cleanLine as EstimatingLine;
    }),
  };

  // Convert to JSON string
  const jsonString = JSON.stringify(quantFile, null, 2);
  const fileName = `${projectName || projectId}_Estimate_${new Date().toISOString().split("T")[0]}.quant`;

  // Try to use File System Access API (Chrome/Edge) for save dialog
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'Quant Estimate File',
          accept: {
            'application/json': ['.quant'],
          },
        }],
      });

      const writable = await fileHandle.createWritable();
      await writable.write(jsonString);
      await writable.close();
      
      // Success - file was saved to user's chosen location
      return;
    } catch (error: any) {
      // User cancelled or error occurred, fall back to download
      if (error.name !== 'AbortError') {
        console.warn('File System Access API failed, falling back to download:', error);
      } else {
        // User cancelled - don't proceed with download
        throw new Error('Save cancelled');
      }
    }
  }

  // Fallback: Standard blob download (will save to Downloads folder)
  const blob = new Blob([jsonString], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  
  // Note: In fallback mode, file goes to browser's default download location
  // (usually Downloads folder). We can't control this in all browsers.
}

/**
 * Import estimate from Quant proprietary format (.quant)
 */
export function importFromQuant(file: File): Promise<QuantEstimateFile> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const quantFile: QuantEstimateFile = JSON.parse(text);
        
        // Validate file format
        if (quantFile.format !== "quant-estimate") {
          reject(new Error("Invalid Quant file format"));
          return;
        }
        
        if (!quantFile.version || !quantFile.lines || !Array.isArray(quantFile.lines)) {
          reject(new Error("Invalid Quant file structure"));
          return;
        }
        
        resolve(quantFile);
      } catch (error) {
        reject(new Error(`Failed to parse Quant file: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };
    
    reader.readAsText(file);
  });
}

