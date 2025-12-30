import { NextRequest, NextResponse } from "next/server";
import { StructuredProposal, ProposalSection } from "@/lib/types/proposal";

export async function POST(request: NextRequest) {
  try {
    // Dynamic import for docx to handle missing dependency gracefully
    let docx: any;
    try {
      docx = await import("docx");
    } catch (error) {
      return NextResponse.json(
        { error: "DOCX export is not available. Please install the 'docx' package: npm install docx" },
        { status: 503 }
      );
    }

    const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = docx;
    const body = await request.json();
    const proposal: StructuredProposal = body.proposal;

    const sections: (Paragraph | any)[] = [];

    // Header
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: proposal.header.companyName,
            bold: true,
            size: 32, // 16pt
          }),
        ],
        heading: HeadingLevel.TITLE,
        spacing: { after: 200 },
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: proposal.header.projectName,
            bold: true,
            size: 28, // 14pt
          }),
        ],
        spacing: { after: 100 },
      })
    );

    if (proposal.header.projectNumber) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `Project Number: ${proposal.header.projectNumber}`,
              size: 22, // 11pt
            }),
          ],
          spacing: { after: 100 },
        })
      );
    }

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Proposal Date: ${proposal.header.proposalDate}`,
            size: 22, // 11pt
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // Helper function to render section
    const renderSection = (title: string, section: ProposalSection | undefined) => {
      if (!section) return;

      // Section title
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: title.toUpperCase(),
              bold: true,
              size: 24, // 12pt
              allCaps: true,
            }),
          ],
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 400, after: 200 },
        })
      );

      // Divider line (using border)
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "_________________________________________________",
              size: 1,
            }),
          ],
          spacing: { after: 200 },
        })
      );

      // Section content
      if (section.type === "paragraph") {
        const content = typeof section.content === "string" ? section.content : "";
        sections.push(
          new Paragraph({
            children: [
              new TextRun({
                text: content,
                size: 22, // 11pt
              }),
            ],
            spacing: { after: 200 },
            alignment: AlignmentType.LEFT,
          })
        );
      } else if (section.type === "bullets" || section.type === "numbered") {
        const items = Array.isArray(section.content) ? section.content : [section.content];
        items.forEach((item) => {
          sections.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: typeof item === "string" ? item : "",
                  size: 22, // 11pt
                }),
              ],
              bullet: section.type === "bullets" ? { level: 0 } : undefined,
              numbering: section.type === "numbered" ? { level: 0 } : undefined,
              spacing: { after: 100 },
              indent: { left: 360 }, // 0.25 inch
            })
          );
        });
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
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: proposal.header.companyName,
            size: 18, // 9pt
          }),
        ],
        spacing: { before: 600 },
        alignment: AlignmentType.CENTER,
      })
    );

    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Page 1",
            size: 18, // 9pt
          }),
        ],
        alignment: AlignmentType.CENTER,
      })
    );

    // Create document
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 720, // 0.75 inch
                right: 720,
                bottom: 720,
                left: 720,
              },
            },
          },
          children: sections,
        },
      ],
    });

    // Generate buffer
    const buffer = await Packer.toBuffer(doc);

    // Return as blob
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${proposal.header.projectName || "Proposal"}_${new Date().toISOString().split("T")[0]}.docx"`,
      },
    });
  } catch (error: any) {
    console.error("DOCX export error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to export DOCX" },
      { status: 500 }
    );
  }
}



