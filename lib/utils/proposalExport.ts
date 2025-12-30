/**
 * Professional Proposal Export Utilities
 * Handles DOCX and PDF export with preserved formatting
 */

import jsPDF from "jspdf";
import { StructuredProposal, ProposalSection } from "@/lib/types/proposal";
import { getCompanyLogoBase64 } from "./logoLoader";

/**
 * Export structured proposal to DOCX (via API route)
 */
export async function exportProposalToDOCX(
  proposal: StructuredProposal,
  companyId?: string
): Promise<void> {
  try {
    const response = await fetch("/api/proposal/export-docx", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ proposal }),
    });

    if (!response.ok) {
      throw new Error("Failed to export DOCX");
    }

    const blob = await response.blob();
    const fileName = `${proposal.header.projectName || "Proposal"}_${new Date().toISOString().split("T")[0]}.docx`;
    
    // Use File System Access API if available
    if ("showSaveFilePicker" in window) {
      try {
        const fileHandle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
          types: [
            {
              description: "Word Document",
              accept: { "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"] },
            },
          ],
        });
        const writable = await fileHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        return;
      } catch (error: any) {
        if (error.name !== "AbortError") {
          console.warn("File System Access API failed, falling back to download:", error);
        } else {
          throw new Error("Save cancelled");
        }
      }
    }

    // Fallback: Standard download
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error: any) {
    console.error("DOCX export error:", error);
    throw error;
  }
}

/**
 * Export structured proposal to PDF
 */
export async function exportProposalToPDFStructured(
  proposal: StructuredProposal,
  companyId?: string
): Promise<void> {
  const doc = new jsPDF();
  
  // Add company logo if available
  if (companyId) {
    try {
      const logoBase64 = await getCompanyLogoBase64(companyId);
      if (logoBase64) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = logoBase64;
        });
        const aspectRatio = img.width / img.height;
        const logoHeight = 15;
        const logoWidth = logoHeight * aspectRatio;
        const xPos = 210 - logoWidth - 14;
        doc.addImage(logoBase64, "PNG", xPos, 5, logoWidth, logoHeight);
      }
    } catch (error) {
      console.warn("Failed to add logo to PDF:", error);
    }
  }

  let yPos = 20;
  const pageHeight = 297; // A4 height in mm
  const marginBottom = 20;
  const maxY = pageHeight - marginBottom;
  const marginX = 19; // 0.75 inch
  const maxWidth = 172; // 8.5 inch - 2 * margin

  // Helper to check page break
  const checkPageBreak = (requiredHeight: number) => {
    if (yPos + requiredHeight > maxY) {
      doc.addPage();
      yPos = 20;
      return true;
    }
    return false;
  };

  // Header
  doc.setFontSize(16);
  doc.setFont(undefined, "bold");
  doc.text(proposal.header.companyName, marginX, yPos);
  yPos += 8;

  doc.setFontSize(14);
  doc.text(proposal.header.projectName, marginX, yPos);
  yPos += 6;

  if (proposal.header.projectNumber) {
    doc.setFontSize(11);
    doc.setFont(undefined, "normal");
    doc.text(`Project Number: ${proposal.header.projectNumber}`, marginX, yPos);
    yPos += 6;
  }

  doc.setFontSize(11);
  doc.text(`Proposal Date: ${proposal.header.proposalDate}`, marginX, yPos);
  yPos += 10;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(marginX, yPos, marginX + maxWidth, yPos);
  yPos += 8;

  // Helper to render section
  const renderSection = (title: string, section: ProposalSection | undefined) => {
    if (!section) return;

    checkPageBreak(30);

    // Section title
    doc.setFontSize(12);
    doc.setFont(undefined, "bold");
    doc.text(title.toUpperCase(), marginX, yPos);
    yPos += 6;

    // Divider line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(marginX, yPos, marginX + maxWidth, yPos);
    yPos += 6;

    // Section content
    doc.setFontSize(11);
    doc.setFont(undefined, "normal");

    if (section.type === "paragraph") {
      const content = typeof section.content === "string" ? section.content : "";
      const lines = doc.splitTextToSize(content, maxWidth);
      lines.forEach((line: string) => {
        checkPageBreak(6);
        doc.text(line, marginX, yPos);
        yPos += 6;
      });
      yPos += 4;
    } else if (section.type === "bullets" || section.type === "numbered") {
      const items = Array.isArray(section.content) ? section.content : [section.content];
      items.forEach((item) => {
        const itemText = typeof item === "string" ? item : "";
        const prefix = section.type === "bullets" ? "• " : `${items.indexOf(item) + 1}. `;
        const fullText = prefix + itemText;
        const lines = doc.splitTextToSize(fullText, maxWidth - 5);
        lines.forEach((line: string) => {
          checkPageBreak(6);
          doc.text(line, marginX + (lines.indexOf(line) === 0 ? 0 : 5), yPos);
          yPos += 6;
        });
        yPos += 2;
      });
      yPos += 4;
    }
  };

  // Render all sections
  renderSection("Project Overview", proposal.sections.projectOverview);
  renderSection("Scope of Work", proposal.sections.scopeOfWork);
  renderSection("Project-Specific Inclusions", proposal.sections.projectSpecificInclusions);
  renderSection("Project-Specific Exclusions", proposal.sections.projectSpecificExclusions);
  renderSection("Clarifications & Assumptions", proposal.sections.clarificationsAssumptions);
  renderSection("Commercial Terms", proposal.sections.commercialTerms);
  renderSection("Acceptance & Signature", proposal.sections.acceptanceSignature);

  // Footer
  checkPageBreak(15);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(marginX, yPos, marginX + maxWidth, yPos);
  yPos += 8;

  doc.setFontSize(9);
  doc.setFont(undefined, "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(proposal.header.companyName, marginX + maxWidth / 2, yPos, {
    align: "center",
  });
  yPos += 5;
  doc.text("Page 1", marginX + maxWidth / 2, yPos, {
    align: "center",
  });

  // Save PDF
  const fileName = `${proposal.header.projectName || "Proposal"}_${new Date().toISOString().split("T")[0]}.pdf`;
  const pdfBlob = doc.output("blob");
  
  // Use File System Access API if available
  if ("showSaveFilePicker" in window) {
    try {
      const fileHandle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: "PDF File",
            accept: { "application/pdf": [".pdf"] },
          },
        ],
      });
      const writable = await fileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      return;
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.warn("File System Access API failed, falling back to download:", error);
      } else {
        throw new Error("Save cancelled");
      }
    }
  }

  // Fallback: Standard download
  const url = URL.createObjectURL(pdfBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

