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
export async function exportToPDF(
  lines: EstimatingLine[],
  projectName: string = "Project",
  companyName: string = "Company"
): Promise<void> {
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
        (line.materialType === "Material"
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

  // Save PDF using save dialog
  const fileName = `${projectName}_Estimate_${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBlob = doc.output('blob');
  
  await saveFileWithDialog(pdfBlob, fileName, "application/pdf", "pdf");
}

/**
 * Helper function to save file with save dialog
 */
async function saveFileWithDialog(
  content: string | Blob,
  fileName: string,
  mimeType: string,
  fileExtension: string
): Promise<void> {
  // Try to use File System Access API (Chrome/Edge) for save dialog
  if ('showSaveFilePicker' in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: `${fileExtension.toUpperCase()} File`,
          accept: {
            [mimeType]: [`.${fileExtension}`],
          },
        }],
      });

      const writable = await fileHandle.createWritable();
      if (content instanceof Blob) {
        const buffer = await content.arrayBuffer();
        await writable.write(buffer);
      } else {
        await writable.write(content);
      }
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
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export estimating lines to Excel
 */
export async function exportToExcel(
  lines: EstimatingLine[],
  projectName: string = "Project",
  companyName: string = "Company"
): Promise<void> {
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
          (line.materialType === "Material"
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

  // Generate Excel file and save with dialog
  const fileName = `${projectName}_Estimate_${new Date().toISOString().split("T")[0]}.xlsx`;
  const excelBlob = new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  
  await saveFileWithDialog(excelBlob, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "xlsx");
}

/**
 * Export estimate summary/reports to PDF
 */
export async function exportReportsToPDF(
  financials: {
    materialCost: number;
    laborCost: number;
    coatingCost: number;
    hardwareCost: number;
    buyouts: number;
    subtotal: number;
    overheadPercentage: number;
    overheadAmount: number;
    profitPercentage: number;
    profitAmount: number;
    totalCost: number;
    materialWasteFactor: number;
    laborWasteFactor: number;
  },
  metrics: {
    totalWeight: number;
    totalLaborHours: number;
    totalSurfaceArea: number;
    costPerLb?: number;
    costPerPound?: number;
    costPerTon: number;
    manHoursPerLb?: number;
    manHoursPerTon: number;
    materialLaborRatio?: number;
    materialToLaborRatio?: number;
    profitMargin?: number;
    margin?: number;
    lineItemCount?: number;
  },
  projectName: string = "Project",
  projectNumber: string = "",
  companyName: string = "Company",
  buyouts?: Array<{ name: string; amount: number }>,
  project?: {
    projectType?: string;
    projectTypeSubCategory?: string;
    probabilityOfWin?: number;
  }
) {
  const doc = new jsPDF();
  
  // Header with background
  doc.setFillColor(59, 130, 246); // Blue background
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text("Estimating Summary", 14, 20);
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  if (projectNumber) {
    doc.text(`${projectNumber} - ${projectName}`, 14, 28);
  } else {
    doc.text(projectName, 14, 28);
  }
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 160, 28);
  
  let yPos = 40;
  const pageHeight = 297; // A4 height in mm
  const marginBottom = 20; // Bottom margin
  const maxY = pageHeight - marginBottom;

  // Helper function to check and add new page if needed
  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > maxY) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Executive Summary Section - Card Style
  checkPageBreak(80);
  doc.setFillColor(239, 246, 255); // Light blue background
  doc.rect(14, yPos, 182, 35, 'F');
  doc.setDrawColor(191, 219, 254);
  doc.setLineWidth(0.5);
  doc.rect(14, yPos, 182, 35);
  
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175); // Blue text
  doc.text("Executive Summary", 20, yPos + 8);
  
  // Project type badges (if available)
  if (project && (project.projectType || project.projectTypeSubCategory)) {
    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    let badgeX = 160;
    if (project.projectType) {
      doc.setFillColor(59, 130, 246);
      doc.roundedRect(badgeX, yPos + 2, 30, 6, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(project.projectType, badgeX + 2, yPos + 5.5);
      badgeX += 35;
    }
    if (project.projectTypeSubCategory) {
      doc.setFillColor(99, 102, 241);
      doc.roundedRect(badgeX, yPos + 2, 30, 6, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(project.projectTypeSubCategory, badgeX + 2, yPos + 5.5);
    }
  }
  
  doc.setTextColor(0, 0, 0);
  yPos += 20;
  
  // Four metric cards in a 2x2 grid
  const cardWidth = 85;
  const cardHeight = 28;
  const cardSpacing = 12;
  const startX = 18;
  let cardX = startX;
  let cardY = yPos;
  
  // Card 1: Total Project Cost
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.rect(cardX, cardY, cardWidth, cardHeight, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("Total Project Cost", cardX + 4, cardY + 5);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`$${(financials.totalCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, cardX + 4, cardY + 12);
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Including overhead & profit", cardX + 4, cardY + 18);
  
  // Card 2: Profit Margin
  cardX += cardWidth + cardSpacing;
  doc.setFillColor(255, 255, 255);
  doc.rect(cardX, cardY, cardWidth, cardHeight, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("Profit Margin", cardX + 4, cardY + 5);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(34, 197, 94); // Green
  doc.text(`${(metrics.profitMargin || metrics.margin || 0).toFixed(1)}%`, cardX + 4, cardY + 12);
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(`$${(financials.profitAmount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} profit`, cardX + 4, cardY + 18);
  
  // Card 3: Win Probability (if available)
  cardX = startX;
  cardY += cardHeight + cardSpacing;
  doc.setFillColor(255, 255, 255);
  doc.rect(cardX, cardY, cardWidth, cardHeight, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("Win Probability", cardX + 4, cardY + 5);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(59, 130, 246); // Blue
  const winProb = project?.probabilityOfWin || 0;
  doc.text(`${winProb}%`, cardX + 4, cardY + 12);
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Based on project settings", cardX + 4, cardY + 18);
  
  // Card 4: Line Items
  cardX += cardWidth + cardSpacing;
  doc.setFillColor(255, 255, 255);
  doc.rect(cardX, cardY, cardWidth, cardHeight, 'FD');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text("Line Items", cardX + 4, cardY + 5);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${metrics.lineItemCount || 0}`, cardX + 4, cardY + 12);
  doc.setFontSize(6);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Active estimate lines", cardX + 4, cardY + 18);
  
  yPos = cardY + cardHeight + 15;

  // Cost Breakdown Section - Card Style
  checkPageBreak(100);
  doc.setFillColor(249, 250, 251); // Light gray background
  doc.rect(14, yPos, 182, 5, 'F');
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Cost Breakdown", 20, yPos + 4);
  yPos += 12;
  
  // Two-column layout for charts
  const leftColX = 18;
  const rightColX = 110;
  const chartBoxHeight = 80;
  
  // Left column: Cost Distribution
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.rect(leftColX, yPos, 85, chartBoxHeight, 'FD');
  
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text("Cost Distribution", leftColX + 4, yPos + 6);
  
  // Total Subtotal display
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(`Total Subtotal: $${(financials.subtotal || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, leftColX + 4, yPos + 12);
  
  // Stacked bar chart
  const distChartX = leftColX + 4;
  const distChartY = yPos + 18;
  const distChartWidth = 77;
  const distChartHeight = 12;
  
  const total = financials.subtotal || 1;
  const materialPct = ((financials.materialCost || 0) / total) * 100;
  const laborPct = ((financials.laborCost || 0) / total) * 100;
  const coatingPct = ((financials.coatingCost || 0) / total) * 100;
  const hardwarePct = ((financials.hardwareCost || 0) / total) * 100;
  const buyoutsPct = ((financials.buyouts || 0) / total) * 100;
  
  let currentX = distChartX;
  
  if (materialPct > 0) {
    const width = (materialPct / 100) * distChartWidth;
    doc.setFillColor(66, 139, 202);
    doc.rect(currentX, distChartY, width, distChartHeight, 'F');
    currentX += width;
  }
  if (laborPct > 0) {
    const width = (laborPct / 100) * distChartWidth;
    doc.setFillColor(34, 197, 94);
    doc.rect(currentX, distChartY, width, distChartHeight, 'F');
    currentX += width;
  }
  if (coatingPct > 0) {
    const width = (coatingPct / 100) * distChartWidth;
    doc.setFillColor(249, 115, 22);
    doc.rect(currentX, distChartY, width, distChartHeight, 'F');
    currentX += width;
  }
  if (hardwarePct > 0) {
    const width = (hardwarePct / 100) * distChartWidth;
    doc.setFillColor(168, 85, 247);
    doc.rect(currentX, distChartY, width, distChartHeight, 'F');
    currentX += width;
  }
  if (buyoutsPct > 0) {
    const width = (buyoutsPct / 100) * distChartWidth;
    doc.setFillColor(156, 163, 175);
    doc.rect(currentX, distChartY, width, distChartHeight, 'F');
  }
  
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.rect(distChartX, distChartY, distChartWidth, distChartHeight);
  
  // Legend
  let legendY = distChartY + distChartHeight + 6;
  doc.setFontSize(7);
  let legendX = distChartX;
  
  // Material
  doc.setFillColor(66, 139, 202);
  doc.rect(legendX, legendY, 3, 3, 'F');
  doc.setTextColor(0, 0, 0);
  doc.text(`Material ${materialPct.toFixed(1)}%`, legendX + 5, legendY + 2.5);
  legendX += 40;
  
  // Labor
  doc.setFillColor(34, 197, 94);
  doc.rect(legendX, legendY, 3, 3, 'F');
  doc.text(`Labor ${laborPct.toFixed(1)}%`, legendX + 5, legendY + 2.5);
  
  legendY += 6;
  legendX = distChartX;
  
  // Coating
  doc.setFillColor(249, 115, 22);
  doc.rect(legendX, legendY, 3, 3, 'F');
  doc.text(`Coating ${coatingPct.toFixed(1)}%`, legendX + 5, legendY + 2.5);
  legendX += 40;
  
  // Hardware (if > 0)
  if (hardwarePct > 0.5) {
    doc.setFillColor(168, 85, 247);
    doc.rect(legendX, legendY, 3, 3, 'F');
    doc.text(`Hardware ${hardwarePct.toFixed(1)}%`, legendX + 5, legendY + 2.5);
  }
  
  // Right column: Cost Comparison
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.rect(rightColX, yPos, 85, chartBoxHeight, 'FD');
  
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.text("Cost Comparison", rightColX + 4, yPos + 6);
  
  const maxCost = Math.max(
    financials.materialCost || 0,
    financials.laborCost || 0,
    financials.coatingCost || 0,
    financials.hardwareCost || 0,
    financials.buyouts || 0,
    1
  );
  const compChartX = rightColX + 4;
  let compChartY = yPos + 12;
  const compChartWidth = 60;
  const compBarHeight = 5;
  const compBarSpacing = 8;
  
  // Material bar
  if (financials.materialCost > 0) {
    const barWidth = maxCost > 0 ? ((financials.materialCost / maxCost) * compChartWidth) : 0;
    doc.setFillColor(66, 139, 202);
    doc.rect(compChartX, compChartY, barWidth, compBarHeight, 'F');
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.text("Material", compChartX + compChartWidth + 3, compChartY + 3.5);
    doc.text(`$${(financials.materialCost || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, compChartX + compChartWidth + 25, compChartY + 3.5);
    compChartY += compBarSpacing;
  }
  
  // Labor bar
  if (financials.laborCost > 0) {
    const barWidth = maxCost > 0 ? ((financials.laborCost / maxCost) * compChartWidth) : 0;
    doc.setFillColor(34, 197, 94);
    doc.rect(compChartX, compChartY, barWidth, compBarHeight, 'F');
    doc.setFontSize(7);
    doc.text("Labor", compChartX + compChartWidth + 3, compChartY + 3.5);
    doc.text(`$${(financials.laborCost || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, compChartX + compChartWidth + 25, compChartY + 3.5);
    compChartY += compBarSpacing;
  }
  
  // Coating bar
  if (financials.coatingCost > 0) {
    const barWidth = maxCost > 0 ? ((financials.coatingCost / maxCost) * compChartWidth) : 0;
    doc.setFillColor(249, 115, 22);
    doc.rect(compChartX, compChartY, barWidth, compBarHeight, 'F');
    doc.setFontSize(7);
    doc.text("Coating", compChartX + compChartWidth + 3, compChartY + 3.5);
    doc.text(`$${(financials.coatingCost || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, compChartX + compChartWidth + 25, compChartY + 3.5);
    compChartY += compBarSpacing;
  }
  
  // Hardware bar
  if (financials.hardwareCost > 0) {
    const barWidth = maxCost > 0 ? ((financials.hardwareCost / maxCost) * compChartWidth) : 0;
    doc.setFillColor(168, 85, 247);
    doc.rect(compChartX, compChartY, barWidth, compBarHeight, 'F');
    doc.setFontSize(7);
    doc.text("Hardware", compChartX + compChartWidth + 3, compChartY + 3.5);
    doc.text(`$${(financials.hardwareCost || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, compChartX + compChartWidth + 25, compChartY + 3.5);
    compChartY += compBarSpacing;
  }
  
  // Buyouts bar
  if (financials.buyouts > 0) {
    const barWidth = maxCost > 0 ? ((financials.buyouts / maxCost) * compChartWidth) : 0;
    doc.setFillColor(156, 163, 175);
    doc.rect(compChartX, compChartY, barWidth, compBarHeight, 'F');
    doc.setFontSize(7);
    doc.text("Buyouts", compChartX + compChartWidth + 3, compChartY + 3.5);
    doc.text(`$${(financials.buyouts || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, compChartX + compChartWidth + 25, compChartY + 3.5);
  }
  
  yPos += chartBoxHeight + 10;

  // Key Metrics Section - Card Style
  checkPageBreak(100);
  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos, 182, 5, 'F');
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Key Metrics", 20, yPos + 4);
  yPos += 12;
  
  // Metrics in a grid layout
  const metricsData = [
    { label: "Total Weight", value: `${(metrics.totalWeight || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} lbs (${((metrics.totalWeight || 0) / 2000).toFixed(2)} tons)` },
    { label: "Total Labor Hours", value: `${(metrics.totalLaborHours || 0).toFixed(2)} hrs` },
    { label: "Total Surface Area", value: `${(metrics.totalSurfaceArea || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} sq ft` },
    { label: "Cost per Pound", value: `$${(metrics.costPerLb || metrics.costPerPound || 0).toFixed(4)}` },
    { label: "Cost per Ton", value: `$${(metrics.costPerTon || 0).toFixed(2)}` },
    { label: "Man Hours per Ton", value: `${(metrics.manHoursPerTon || 0).toFixed(2)}` },
    { label: "Material:Labor Ratio", value: `${(metrics.materialLaborRatio || metrics.materialToLaborRatio || 0).toFixed(2)}:1` },
  ];
  
  const metricCardWidth = 88;
  const metricCardHeight = 18;
  const metricCardSpacing = 8;
  let metricX = 18;
  let metricY = yPos;
  
  metricsData.forEach((metric, index) => {
    if (index > 0 && index % 2 === 0) {
      metricX = 18;
      metricY += metricCardHeight + metricCardSpacing;
    }
    
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.rect(metricX, metricY, metricCardWidth, metricCardHeight, 'FD');
    
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(metric.label, metricX + 4, metricY + 5);
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(metric.value, metricX + 4, metricY + 12);
    
    metricX += metricCardWidth + metricCardSpacing;
  });
  
  yPos = metricY + metricCardHeight + 15;

  // Direct Costs Section
  checkPageBreak(150);
  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos, 182, 5, 'F');
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Direct Costs", 20, yPos + 4);
  yPos += 12;

  const directCostsData = [
    { label: "Material Cost", value: financials.materialCost || 0, withWaste: (financials.materialCost || 0) * (1 + (financials.materialWasteFactor || 0) / 100) },
    { label: "Labor Cost", value: financials.laborCost || 0, withWaste: (financials.laborCost || 0) * (1 + (financials.laborWasteFactor || 0) / 100) },
    { label: "Coating Cost", value: financials.coatingCost || 0 },
    { label: "Hardware Cost", value: financials.hardwareCost || 0 },
    { label: "Buyouts (Subcontractors)", value: financials.buyouts || 0 },
  ];

  directCostsData.forEach((cost, index) => {
    checkPageBreak(25);

    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(229, 231, 235);
    doc.rect(18, yPos, 178, 20, 'FD');
    
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(cost.label, 22, yPos + 7);
    
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`$${(cost.value || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 22, yPos + 15);
    
    if (cost.withWaste && (cost.label === "Material Cost" || cost.label === "Labor Cost")) {
      const wasteFactor = cost.label === "Material Cost" ? financials.materialWasteFactor : financials.laborWasteFactor;
      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(`$${(cost.withWaste || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })} with ${wasteFactor || 0}% waste`, 140, yPos + 15);
    }
    
    yPos += 24;
  });

  // Subtotal lines
  checkPageBreak(50);

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(18, yPos, 178, 18, 'FD');
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Subtotal (Before Waste)", 22, yPos + 7);
  doc.setFontSize(11);
  doc.text(`$${(financials.subtotal || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 140, yPos + 7);
  
  yPos += 22;

  const subtotalWithWaste = (financials.materialCost || 0) * (1 + (financials.materialWasteFactor || 0) / 100) +
                            (financials.laborCost || 0) * (1 + (financials.laborWasteFactor || 0) / 100) +
                            (financials.coatingCost || 0) +
                            (financials.hardwareCost || 0) +
                            (financials.buyouts || 0);

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.rect(18, yPos, 178, 18, 'FD');
  doc.setFontSize(9);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Subtotal (After Waste)", 22, yPos + 7);
  doc.setFontSize(11);
  doc.text(`$${subtotalWithWaste.toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 140, yPos + 7);
  
  yPos += 25;

  // Markup & Profit Section
  checkPageBreak(100);
  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos, 182, 5, 'F');
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Markup & Profit", 20, yPos + 4);
  yPos += 12;

  // Overhead
  doc.setFillColor(255, 251, 235);
  doc.setDrawColor(253, 224, 71);
  doc.rect(18, yPos, 178, 25, 'FD');
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Overhead", 22, yPos + 8);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${financials.overheadPercentage || 0}%`, 22, yPos + 18);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`$${(financials.overheadAmount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 140, yPos + 18);
  yPos += 30;

  // Profit
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(34, 197, 94);
  doc.rect(18, yPos, 178, 25, 'FD');
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Profit", 22, yPos + 8);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${financials.profitPercentage || 0}%`, 22, yPos + 18);
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`$${(financials.profitAmount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 140, yPos + 18);
  yPos += 30;

  // Total Cost
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(59, 130, 246);
  doc.setLineWidth(1);
  doc.rect(18, yPos, 178, 25, 'FD');
  doc.setFontSize(10);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Total Project Cost", 22, yPos + 8);
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`$${(financials.totalCost || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`, 140, yPos + 18);
  yPos += 30;

  // Waste Factors Section
  checkPageBreak(50);
  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos, 182, 5, 'F');
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Waste Factors", 20, yPos + 4);
  yPos += 12;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.rect(18, yPos, 88, 20, 'FD');
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Material Waste Factor", 22, yPos + 7);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${financials.materialWasteFactor || 0}%`, 22, yPos + 16);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(229, 231, 235);
  doc.rect(110, yPos, 88, 20, 'FD');
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text("Labor Waste Factor", 114, yPos + 7);
  doc.setFontSize(11);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`${financials.laborWasteFactor || 0}%`, 114, yPos + 16);

  yPos += 25;

  // Buyouts Detail (if any)
  if (buyouts && buyouts.length > 0 && buyouts.some(b => b.amount > 0)) {
    checkPageBreak(50);

    doc.setFillColor(249, 250, 251);
    doc.rect(14, yPos, 182, 5, 'F');
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(30, 64, 175);
    doc.text("Buyouts/Subcontractors", 20, yPos + 4);
    yPos += 12;
    
    const buyoutData = buyouts
      .filter(b => b.amount > 0)
      .map(b => [b.name, `$${b.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`]);
    
    autoTable(doc, {
      body: buyoutData,
      head: [["Item", "Amount"]],
      startY: yPos,
      theme: "striped",
      styles: { fontSize: 10 },
      headStyles: { fillColor: [66, 139, 202] },
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Key Assumptions Section
  checkPageBreak(50);

  doc.setFillColor(249, 250, 251);
  doc.rect(14, yPos, 182, 5, 'F');
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.setTextColor(30, 64, 175);
  doc.text("Key Assumptions", 20, yPos + 4);
  yPos += 12;

  const assumptions = [
    `Material waste factor: ${financials.materialWasteFactor || 0}%`,
    `Labor waste factor: ${financials.laborWasteFactor || 0}%`,
    `Overhead: ${financials.overheadPercentage || 0}%`,
    `Profit: ${financials.profitPercentage || 0}%`,
    `Total weight: ${(metrics.totalWeight || 0).toLocaleString("en-US", { maximumFractionDigits: 0 })} lbs`,
    `Total labor hours: ${(metrics.totalLaborHours || 0).toFixed(2)} hrs`,
  ];

  assumptions.forEach((assumption) => {
    checkPageBreak(10);
    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(0, 0, 0);
    doc.text(`• ${assumption}`, 22, yPos);
    yPos += 6;
  });

  yPos += 5;

  // Ensure we have enough space for footer
  if (yPos > 280) {
    doc.addPage();
    yPos = 20;
  }

  // Footer on last page
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 290);

  // Save PDF using save dialog
  const fileName = projectNumber 
    ? `${projectNumber}_Summary_${new Date().toISOString().split("T")[0]}.pdf`
    : `${projectName}_Summary_${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBlob = doc.output('blob');
  
  await saveFileWithDialog(pdfBlob, fileName, "application/pdf", "pdf");
}

/**
 * Export proposal text to PDF
 */
export async function exportProposalToPDF(
  proposalText: string,
  projectName: string = "Project",
  projectNumber: string = "",
  companyName: string = "Company"
) {
  const doc = new jsPDF();
  
  // Header with background
  doc.setFillColor(59, 130, 246); // Blue background
  doc.rect(0, 0, 210, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont(undefined, 'bold');
  doc.text("Proposal", 14, 20);
  doc.setFontSize(12);
  doc.setFont(undefined, 'normal');
  if (projectNumber) {
    doc.text(`${projectNumber} - ${projectName}`, 14, 28);
  } else {
    doc.text(projectName, 14, 28);
  }
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 160, 28);
  
  let yPos = 40;
  const pageHeight = 297;
  const marginBottom = 20;
  const maxY = pageHeight - marginBottom;
  const lineHeight = 7;
  const marginX = 14;
  const maxWidth = 182;

  // Split proposal text into lines that fit the page width
  const lines = doc.splitTextToSize(proposalText, maxWidth);
  
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  
  lines.forEach((line: string) => {
    if (yPos + lineHeight > maxY) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.text(line, marginX, yPos);
    yPos += lineHeight;
  });

  // Footer on last page
  if (yPos > 280) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(8);
  doc.setFont(undefined, 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 290);

  // Save PDF using save dialog
  const fileName = projectNumber 
    ? `${projectNumber}_Proposal_${new Date().toISOString().split("T")[0]}.pdf`
    : `${projectName}_Proposal_${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBlob = doc.output('blob');
  
  await saveFileWithDialog(pdfBlob, fileName, "application/pdf", "pdf");
}

