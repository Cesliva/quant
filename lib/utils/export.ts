/**
 * Export Utilities
 * Provides PDF and Excel export functionality
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

/**
 * Export estimating lines to PDF
 */
export function exportToPDF(
  lines: EstimatingLine[],
  projectName: string = "Project",
  companyName: string = "Company"
) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.text(`${companyName} - ${projectName}`, 14, 20);
  doc.setFontSize(12);
  doc.text(`Estimate Report - ${new Date().toLocaleDateString()}`, 14, 28);

  // Prepare table data
  const tableData = lines.map((line) => [
    line.lineId || "-",
    line.itemDescription || "-",
    line.materialType === "Material"
      ? `${line.shapeType || ""} ${line.sizeDesignation || ""}`.trim() || "-"
      : line.thickness && line.width && line.plateLength
      ? `${line.thickness}" × ${line.width}" × ${line.plateLength}"`
      : "-",
    line.materialType === "Material" ? (line.grade || "-") : (line.plateGrade || "-"),
    line.materialType === "Material" ? (line.qty || 0).toString() : (line.plateQty || 0).toString(),
    line.materialType === "Material"
      ? `${line.lengthFt || 0}'${line.lengthIn ? ` ${line.lengthIn}"` : ""}`
      : line.plateLength
      ? `${line.plateLength}"`
      : "-",
    line.materialType === "Material"
      ? (line.totalWeight || 0).toFixed(0)
      : (line.plateTotalWeight || 0).toFixed(0),
    (line.totalLabor || 0).toFixed(2),
    `$${(line.totalCost || 0).toFixed(2)}`,
  ]);

  // Add table
  autoTable(doc, {
    head: [
      [
        "Line ID",
        "Item Description",
        "Spec",
        "Grade",
        "Qty",
        "Length",
        "Weight (lbs)",
        "Labor (hrs)",
        "Cost ($)",
      ],
    ],
    body: tableData,
    startY: 35,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [66, 139, 202] },
  });

  // Totals
  const totals = {
    weight: lines.reduce(
      (sum, line) =>
        sum +
        (line.materialType === "Rolled"
          ? line.totalWeight || 0
          : line.plateTotalWeight || 0),
      0
    ),
    labor: lines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
    cost: lines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
  };

  const finalY = (doc as any).lastAutoTable.finalY || 35;
  doc.setFontSize(10);
  doc.text(`Total Weight: ${totals.weight.toFixed(0)} lbs`, 14, finalY + 10);
  doc.text(`Total Labor: ${totals.labor.toFixed(2)} hrs`, 14, finalY + 16);
  doc.text(`Total Cost: $${totals.cost.toFixed(2)}`, 14, finalY + 22);

  // Save PDF
  doc.save(`${projectName}_Estimate_${new Date().toISOString().split("T")[0]}.pdf`);
}

/**
 * Export estimating lines to Excel
 */
export function exportToExcel(
  lines: EstimatingLine[],
  projectName: string = "Project",
  companyName: string = "Company"
) {
  // Prepare worksheet data
  const worksheetData = [
    // Header row
    [
      "Line ID",
      "Item Description",
      "Type",
      "Spec",
      "Grade",
      "Qty",
      "Length",
      "Weight (lbs)",
      "Labor (hrs)",
      "Material Cost ($)",
      "Labor Cost ($)",
      "Coating Cost ($)",
      "Total Cost ($)",
    ],
    // Data rows
    ...lines.map((line) => [
      line.lineId || "",
      line.itemDescription || "",
      line.materialType === "Material" ? "Material" : "Plate",
      line.materialType === "Material"
        ? `${line.shapeType || ""} ${line.sizeDesignation || ""}`.trim() || ""
        : line.thickness && line.width && line.plateLength
        ? `${line.thickness}" × ${line.width}" × ${line.plateLength}"`
        : "",
      line.materialType === "Material" ? line.grade || "" : line.plateGrade || "",
      line.materialType === "Material" ? line.qty || 0 : line.plateQty || 0,
      line.materialType === "Material"
        ? `${line.lengthFt || 0}'${line.lengthIn ? ` ${line.lengthIn}"` : ""}`
        : line.plateLength
        ? `${line.plateLength}"`
        : "",
      line.materialType === "Material"
        ? line.totalWeight || 0
        : line.plateTotalWeight || 0,
      line.totalLabor || 0,
      line.materialCost || 0,
      line.laborCost || 0,
      line.coatingCost || 0,
      line.totalCost || 0,
    ]),
    // Totals row
    [
      "TOTALS",
      "",
      "",
      "",
      "",
      "",
      "",
      lines.reduce(
        (sum, line) =>
          sum +
          (line.materialType === "Rolled"
            ? line.totalWeight || 0
            : line.plateTotalWeight || 0),
        0
      ),
      lines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
      lines.reduce((sum, line) => sum + (line.materialCost || 0), 0),
      lines.reduce((sum, line) => sum + (line.laborCost || 0), 0),
      lines.reduce((sum, line) => sum + (line.coatingCost || 0), 0),
      lines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
    ],
  ];

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 10 }, // Line ID
    { wch: 30 }, // Item Description
    { wch: 12 }, // Type
    { wch: 20 }, // Spec
    { wch: 12 }, // Grade
    { wch: 8 }, // Qty
    { wch: 15 }, // Length
    { wch: 12 }, // Weight
    { wch: 12 }, // Labor
    { wch: 15 }, // Material Cost
    { wch: 15 }, // Labor Cost
    { wch: 15 }, // Coating Cost
    { wch: 15 }, // Total Cost
  ];

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, "Estimate");

  // Generate Excel file
  XLSX.writeFile(
    workbook,
    `${projectName}_Estimate_${new Date().toISOString().split("T")[0]}.xlsx`
  );
}

