/**
 * CSV Import/Export Utilities for Estimating Lines
 * Handles CSV template generation, parsing, and validation
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

/**
 * Export estimating lines to CSV
 */
export function exportLinesToCSV(lines: EstimatingLine[]): void {
  if (lines.length === 0) {
    alert("No lines to export");
    return;
  }

  // Generate header row
  const headers = CSV_COLUMNS.map(col => col.displayName);
  
  // Generate data rows
  const rows = lines.map(line => {
    return CSV_COLUMNS.map(col => {
      const value = line[col.field];
      
      // Handle different data types
      if (value === null || value === undefined) {
        return "";
      }
      
      if (col.type === "boolean") {
        return value ? "true" : "false";
      }
      
      if (col.type === "number") {
        return String(value);
      }
      
      // String values - escape quotes and wrap in quotes if contains comma, quote, or newline
      const stringValue = String(value);
      if (stringValue.includes(",") || stringValue.includes('"') || stringValue.includes("\n")) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      
      return stringValue;
    });
  });
  
  // Combine headers and rows
  const csvRows = [headers, ...rows];
  const csvContent = csvRows.map(row => row.join(",")).join("\n");
  
  // Create and download file
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Quant_Estimate_Export_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * CSV Template Column Definitions
 * Maps field names to display names and indicates required fields
 */
export interface CSVColumn {
  field: keyof EstimatingLine;
  displayName: string;
  required: boolean;
  type: "string" | "number" | "boolean";
  description?: string;
}

/**
 * All CSV columns in the order they should appear in the template
 * Excludes read-only calculated fields (they'll be computed on import)
 */
export const CSV_COLUMNS: CSVColumn[] = [
  // Identification
  { field: "lineId", displayName: "Line ID", required: true, type: "string", description: "e.g., L1, L2, L3" },
  { field: "drawingNumber", displayName: "Drawing Number", required: false, type: "string" },
  { field: "detailNumber", displayName: "Detail Number", required: false, type: "string" },
  { field: "itemDescription", displayName: "Item Description", required: true, type: "string", description: "e.g., Column, Beam, Plate" },
  { field: "category", displayName: "Category", required: false, type: "string", description: "Columns, Beams, Misc Metals, Plates, Connections, Other" },
  { field: "subCategory", displayName: "Sub Category", required: false, type: "string", description: "Base Plate, Gusset, Stiffener, Clip, Brace, Other" },
  
  // Material Type
  { field: "materialType", displayName: "Material Type", required: true, type: "string", description: "Material or Plate" },
  
  // Material Members
  { field: "shapeType", displayName: "Shape Type", required: false, type: "string", description: "W, HSS, C, L, T, etc." },
  { field: "sizeDesignation", displayName: "Size Designation", required: false, type: "string", description: "e.g., W12x65, HSS6x6x1/4" },
  { field: "grade", displayName: "Grade", required: false, type: "string", description: "A992, A572 Gr50, etc." },
  { field: "lengthFt", displayName: "Length (ft)", required: false, type: "number" },
  { field: "lengthIn", displayName: "Length (in)", required: false, type: "number" },
  { field: "qty", displayName: "Quantity", required: false, type: "number" },
  
  // Plates
  { field: "thickness", displayName: "Thickness (in)", required: false, type: "number", description: "For plates only" },
  { field: "width", displayName: "Width (in)", required: false, type: "number", description: "For plates only" },
  { field: "plateLength", displayName: "Plate Length (in)", required: false, type: "number", description: "For plates only" },
  { field: "plateQty", displayName: "Plate Quantity", required: false, type: "number", description: "For plates only" },
  { field: "plateGrade", displayName: "Plate Grade", required: false, type: "string", description: "For plates only, e.g., A36" },
  { field: "oneSideCoat", displayName: "One Side Coat", required: false, type: "boolean", description: "For plates only, true/false" },
  
  // Coating
  { field: "coatingSystem", displayName: "Coating System", required: false, type: "string", description: "None, Standard Shop Primer, Zinc Primer, Paint, Powder Coat, Galvanizing, Specialty Coating" },
  { field: "sspcPrep", displayName: "SSPC Surface Prep", required: false, type: "string", description: "SSPC surface preparation standard, e.g., SSPC-SP 5, SSPC-SP 6, etc." },
  
  // Labor
  { field: "laborUnload", displayName: "Labor Unload (hrs)", required: false, type: "number" },
  { field: "laborCut", displayName: "Labor Cut (hrs)", required: false, type: "number" },
  { field: "laborCope", displayName: "Labor Cope (hrs)", required: false, type: "number" },
  { field: "laborProcessPlate", displayName: "Labor Process Plate (hrs)", required: false, type: "number" },
  { field: "laborDrillPunch", displayName: "Labor Drill/Punch (hrs)", required: false, type: "number" },
  { field: "laborFit", displayName: "Labor Fit (hrs)", required: false, type: "number" },
  { field: "laborWeld", displayName: "Labor Weld (hrs)", required: false, type: "number" },
  { field: "laborPrepClean", displayName: "Labor Prep/Clean (hrs)", required: false, type: "number" },
  { field: "laborPaint", displayName: "Labor Paint (hrs)", required: false, type: "number" },
  { field: "laborHandleMove", displayName: "Labor Handle/Move (hrs)", required: false, type: "number" },
  { field: "laborLoadShip", displayName: "Labor Load/Ship (hrs)", required: false, type: "number" },
  
  // Cost Rates (optional overrides)
  { field: "materialRate", displayName: "Material Rate ($/lb)", required: false, type: "number", description: "Overrides company default" },
  { field: "laborRate", displayName: "Labor Rate ($/hr)", required: false, type: "number", description: "Overrides company default" },
  { field: "coatingRate", displayName: "Coating Rate", required: false, type: "number", description: "$/sf for Paint/Powder, $/lb for Galv" },
  
  // Admin
  { field: "notes", displayName: "Notes", required: false, type: "string" },
  { field: "hashtags", displayName: "Hashtags", required: false, type: "string" },
  { field: "status", displayName: "Status", required: false, type: "string", description: "Active or Void" },
  { field: "useStockRounding", displayName: "Use Stock Rounding", required: false, type: "boolean", description: "true/false" },
];

/**
 * Generate CSV template with headers and example row
 */
export function generateCSVTemplate(): string {
  // Header row
  const headers = CSV_COLUMNS.map(col => col.displayName);
  
  // Example row with sample data
  const exampleRow: (string | number | boolean)[] = [
    "L1",                    // lineId
    "DWG-001",               // drawingNumber
    "DET-01",                // detailNumber
    "Column",                // itemDescription
    "Columns",               // category
    "",                      // subCategory
    "Material",                // materialType
    "W",                     // shapeType
    "W12x65",               // sizeDesignation
    "A992",                  // grade
    20,                      // lengthFt
    0,                       // lengthIn
    4,                       // qty
    "",                      // thickness (plates only)
    "",                      // width (plates only)
    "",                      // plateLength (plates only)
    "",                      // plateQty (plates only)
    "",                      // plateGrade (plates only)
    false,                   // oneSideCoat (plates only)
    "None",                  // coatingSystem
    "None",                  // sspcPrep
    0.5,                     // laborUnload
    0,                       // laborCut
    0,                       // laborCope
    0,                       // laborProcessPlate
    0,                       // laborDrillPunch
    0,                       // laborFit
    2.5,                     // laborWeld
    0,                       // laborPrepClean
    0,                       // laborPaint
    0.25,                    // laborHandleMove
    0.5,                     // laborLoadShip
    "",                      // materialRate (optional)
    "",                      // laborRate (optional)
    "",                      // coatingRate (optional)
    "",                      // notes
    "",                      // hashtags
    "Active",                // status
    true,                    // useStockRounding
  ];
  
  // Convert to CSV format (handle commas, quotes, newlines)
  const escapeCSV = (value: any): string => {
    if (value === null || value === undefined || value === "") {
      return "";
    }
    const str = String(value);
    // If contains comma, quote, or newline, wrap in quotes and escape quotes
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  
  const csvRows = [
    headers.map(escapeCSV).join(","),
    exampleRow.map(escapeCSV).join(","),
  ];
  
  return csvRows.join("\n");
}

/**
 * Download CSV template file
 */
export function downloadCSVTemplate(): void {
  const csvContent = generateCSVTemplate();
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `Quant_Estimate_Template_${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parse CSV string into array of objects
 */
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split("\n").filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }
  
  // Parse header row
  const headers = parseCSVLine(lines[0]);
  
  // Parse data rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue; // Skip empty rows
    
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Parse a single CSV line, handling quoted fields
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  
  // Add last field
  values.push(current.trim());
  
  return values;
}

/**
 * Map CSV display names to field names
 */
function mapDisplayNameToField(displayName: string): keyof EstimatingLine | null {
  const column = CSV_COLUMNS.find(col => col.displayName === displayName);
  return column ? column.field : null;
}

/**
 * Convert string value to appropriate type
 */
function convertValue(value: string, type: "string" | "number" | "boolean"): any {
  if (!value || value.trim() === "") {
    return type === "number" ? undefined : type === "boolean" ? false : "";
  }
  
  switch (type) {
    case "number":
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    case "boolean":
      const lower = value.toLowerCase().trim();
      return lower === "true" || lower === "1" || lower === "yes";
    default:
      return value.trim();
  }
}

/**
 * Validation error for a specific row/field
 */
export interface CSVValidationError {
  row: number; // 1-based row number (header is row 0)
  field: string;
  message: string;
}

/**
 * Parse and validate CSV file
 */
export function parseCSVFile(
  file: File,
  existingLineIds: string[] = []
): Promise<{ lines: Partial<EstimatingLine>[]; errors: CSVValidationError[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const csvRows = parseCSV(csvText);
        
        if (csvRows.length === 0) {
          reject(new Error("CSV file contains no data rows"));
          return;
        }
        
        const lines: Partial<EstimatingLine>[] = [];
        const errors: CSVValidationError[] = [];
        
        // Get header row to map display names to fields
        const firstLine = csvText.split("\n")[0];
        const headers = parseCSVLine(firstLine);
        
        csvRows.forEach((row, index) => {
          const rowNumber = index + 2; // +2 because row 0 is header, row 1 is first data row
          const line: Partial<EstimatingLine> = {};
          
          // Map CSV columns to EstimatingLine fields
          headers.forEach((displayName) => {
            const field = mapDisplayNameToField(displayName);
            if (!field) {
              // Unknown column - skip it
              return;
            }
            
            const column = CSV_COLUMNS.find(col => col.field === field);
            if (!column) return;
            
            const rawValue = row[displayName] || "";
            const value = convertValue(rawValue, column.type);
            
            // Validate required fields
            if (column.required && (value === undefined || value === "" || value === null)) {
              errors.push({
                row: rowNumber,
                field: column.displayName,
                message: `Required field "${column.displayName}" is missing or empty`,
              });
              return;
            }
            
            // Only set value if it's not empty
            if (value !== undefined && value !== "" && value !== null) {
              (line as any)[field] = value;
            }
          });
          
          // Validate lineId format and duplicates
          if (line.lineId) {
            const lineIdStr = String(line.lineId).trim();
            if (!lineIdStr.match(/^L\d+(-L\d+)?$/)) {
              errors.push({
                row: rowNumber,
                field: "Line ID",
                message: `Invalid line ID format: "${lineIdStr}". Expected format: L1, L2, L1-L10, etc.`,
              });
            } else if (existingLineIds.includes(lineIdStr)) {
              errors.push({
                row: rowNumber,
                field: "Line ID",
                message: `Line ID "${lineIdStr}" already exists. Please use a unique line ID.`,
              });
            }
          }
          
          // Validate materialType
          if (line.materialType && line.materialType !== "Material" && line.materialType !== "Plate") {
            errors.push({
              row: rowNumber,
              field: "Material Type",
              message: `Invalid material type: "${line.materialType}". Must be "Material" or "Plate".`,
            });
          }
          
          // Validate status
          if (line.status && line.status !== "Active" && line.status !== "Void") {
            errors.push({
              row: rowNumber,
              field: "Status",
              message: `Invalid status: "${line.status}". Must be "Active" or "Void".`,
            });
          }
          
          // Only add line if it has at least lineId and itemDescription
          if (line.lineId && line.itemDescription) {
            lines.push(line);
          } else if (!line.lineId || !line.itemDescription) {
            errors.push({
              row: rowNumber,
              field: "Line",
              message: "Line is missing required fields (Line ID and Item Description)",
            });
          }
        });
        
        resolve({ lines, errors });
      } catch (error) {
        reject(new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : "Unknown error"}`));
      }
    };
    
    reader.onerror = () => {
      reject(new Error("Failed to read CSV file"));
    };
    
    reader.readAsText(file);
  });
}


