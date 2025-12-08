import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { calculateGPT4Cost } from "@/lib/openai/usageTracker";
import { logAIUsage } from "@/lib/openai/usageTracker";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

// Professional proposal template
const PROPOSAL_TEMPLATE = `PROPOSAL – STRUCTURAL & MISCELLANEOUS STEEL

To: {TO}
Contractor: {CONTRACTOR}
Project Name: {PROJECT_NAME}
Project Location: {PROJECT_LOCATION}
Bid Date: {BID_DATE}
Prepared By: {PREPARED_BY}

1. INTRODUCTION

Thank you for the opportunity to provide pricing for the structural and miscellaneous steel scope on the above-referenced project. This proposal includes the labor, materials, detailing, fabrication, delivery, and services described herein, based on the drawings and specifications made available at the time of bid.

All work will be performed in accordance with industry-standard practices, applicable codes, and Division 5 requirements unless noted otherwise.

2. SCOPE OF WORK – INCLUDED

{SCOPE_SECTION}

3. PRICE

Total Lump Sum: {TOTAL_LUMP_SUM}
(Sales tax, if applicable, will be added.)

{PRICE_BREAKDOWN}

4. SCHEDULE

Shop drawings issued within {SHOP_DRAWINGS_DAYS} days of receiving purchase order and CAD files.

Fabrication lead time is estimated at {FABRICATION_WEEKS} weeks following approved drawings and material availability.

Delivery is coordinated with the general contractor's schedule.

All schedule commitments assume timely approvals and uninterrupted supply chains.

5. EXCLUSIONS

The following items are excluded unless specifically listed as included above:

{EXCLUSIONS_SECTION}

6. QUALIFICATIONS

All work conforms to AISC, AWS, and approved shop drawings.

Pricing is based on current mill and supplier rates; material escalation may apply after 30 days.

General contractor to provide clear access, staging, and safe working conditions.

Installation, if included, is based on normal working hours unless otherwise agreed.

7. ACCEPTANCE

Authorization to proceed:

Authorized By: _____________________________________
Title: ______________________________________________
Date: ______________________________________________`;

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { formData, estimatingData, companyInfo, projectId, companyId } = body;

    // Support both old format (projectSummary) and new format (formData)
    const isNewFormat = !!formData;
    
    if (!isNewFormat) {
      // Legacy format - use old simple generation
      const { projectSummary, template } = body;
      if (!projectSummary) {
        return NextResponse.json(
          { error: "Project summary is required" },
          { status: 400 }
        );
      }

      const prompt = `Generate a professional steel fabrication proposal based on the following project summary.
      ${template ? `Use this template style: ${template}` : ""}
      
      Project Summary:
      ${projectSummary}
      
      Generate a comprehensive proposal in Markdown format including:
      - Executive summary
      - Project scope
      - Materials and specifications
      - Labor and timeline
      - Pricing breakdown
      - Terms and conditions`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional proposal writer for steel fabrication projects. Generate clear, professional proposals in Markdown format.",
          },
          { role: "user", content: prompt },
        ],
      });

      const proposal = completion.choices[0].message.content || "";
      const tokens = completion.usage?.total_tokens || 0;
      const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");

      return NextResponse.json({
        proposal,
        tokens,
        cost,
      });
    }

    // New format - use template structure
    if (!formData) {
      return NextResponse.json(
        { error: "Form data is required" },
        { status: 400 }
      );
    }

    // Build scope section
    const scopeItems: string[] = [];
    if (formData.scope.structuralSteel) {
      scopeItems.push(`Structural Steel
- Furnishing and fabrication of wide-flange beams, columns, bracing, and associated structural members.
- Shear plates, moment connections, clip angles, stiffeners, and connection hardware as shown.
- Base plates, leveling plates, and necessary weld attachments.
- Anchor bolts and templates (supply only unless noted).
- Steel embeds for concrete (supply only).`);
    }
    if (formData.scope.joistsDecking) {
      scopeItems.push(`Joists & Decking
- Open-web steel joists per SJI specifications, including bridging.
- Steel decking as specified (ASC unless otherwise required).
- Standard shop primer on joist accessories.`);
    }
    if (formData.scope.miscellaneousMetals) {
      scopeItems.push(`Miscellaneous Metals
- Rails, ladders, and roof safety railings.
- Steel canopies and support framing, galvanized where indicated.
- Bollards (supply or install as noted).
- Support frames, angle frames, equipment supports, and miscellaneous steel items.
- Fall-protection anchors including engineering for anchors only.`);
    }
    if (formData.scope.detailingEngineering) {
      scopeItems.push(`Detailing & Engineering
- Shop drawings, erection plans, CNC data, and submittals.
- Coordination with the general contractor and affected trades.
- PE-stamped engineering for ladders and fall-protection anchors only.`);
    }
    if (formData.scope.delivery) {
      scopeItems.push(`Delivery
- Delivery F.O.B. jobsite.
- Sequenced deliveries coordinated with site requirements.
- Bundling, tagging, and protective handling.`);
    }

    // Build exclusions section
    const exclusionItems: string[] = [];
    if (formData.exclusions.bonds) {
      exclusionItems.push("- Performance and payment bonds (available upon request at additional cost).");
    }
    if (formData.exclusions.erection) {
      exclusionItems.push("- Erection of structural steel unless explicitly included.");
    }
    if (formData.exclusions.fieldWelding) {
      exclusionItems.push("- Field welding, field cutting, or modifications not identified in contract documents.");
    }
    if (formData.exclusions.fireproofing) {
      exclusionItems.push("- Fireproofing, intumescent coatings, or sprayed fire resistive materials.");
    }
    if (formData.exclusions.galvanizing) {
      exclusionItems.push("- Galvanizing except where specifically identified.");
    }
    if (formData.exclusions.powderCoat) {
      exclusionItems.push("- Powder coat or specialty finishes unless stated.");
    }
    if (formData.exclusions.specialtyMetals) {
      exclusionItems.push("- Stainless steel, aluminum, or other specialty metals.");
    }
    if (formData.exclusions.delegatedDesign) {
      exclusionItems.push("- Delegated connection design unless specifically stated.");
    }
    if (formData.exclusions.BIM) {
      exclusionItems.push("- BIM modeling beyond LOD 300 unless priced separately.");
    }
    
    // Add custom exclusions
    if (formData.customExclusions && Array.isArray(formData.customExclusions)) {
      formData.customExclusions.forEach((customExclusion) => {
        if (customExclusion.trim()) {
          exclusionItems.push(`- ${customExclusion.trim()}`);
        }
      });
    }

    // Build price breakdown if requested
    let priceBreakdown = "";
    if (formData.includeBreakdowns && estimatingData?.totals) {
      const totals = estimatingData.totals;
      priceBreakdown = `
Breakdowns available upon request:
- Structural Steel: $${totals.materialCost?.toLocaleString() || "0"}
- Labor: $${totals.laborCost?.toLocaleString() || "0"}
- Coating: $${totals.coatingCost?.toLocaleString() || "0"}
- Hardware: $${totals.hardwareCost?.toLocaleString() || "0"}`;
    }

    // Build context for AI
    const context = {
      header: {
        to: formData.to || "Client",
        contractor: formData.contractor || companyInfo?.companyName || "Contractor",
        projectName: formData.projectName || "Project",
        projectLocation: formData.projectLocation || "",
        bidDate: formData.bidDate || new Date().toLocaleDateString(),
        preparedBy: formData.preparedBy || "",
      },
      scope: scopeItems.join("\n\n"),
      price: {
        totalLumpSum: formData.totalLumpSum || 0,
        breakdown: priceBreakdown,
      },
      schedule: {
        shopDrawingsDays: formData.shopDrawingsDays || 14,
        fabricationWeeks: formData.fabricationWeeks || 8,
      },
      exclusions: exclusionItems.length > 0 ? exclusionItems.join("\n") : "None specified.",
      projectSummary: formData.projectSummary || "",
      estimatingData: estimatingData || null,
    };

    // Replace placeholders in template with actual values
    let filledTemplate = PROPOSAL_TEMPLATE
      .replace(/{TO}/g, context.header.to)
      .replace(/{CONTRACTOR}/g, context.header.contractor)
      .replace(/{PROJECT_NAME}/g, context.header.projectName)
      .replace(/{PROJECT_LOCATION}/g, context.header.projectLocation)
      .replace(/{BID_DATE}/g, context.header.bidDate)
      .replace(/{PREPARED_BY}/g, context.header.preparedBy)
      .replace(/{SCOPE_SECTION}/g, context.scope)
      .replace(/{TOTAL_LUMP_SUM}/g, `$${context.price.totalLumpSum.toLocaleString()}`)
      .replace(/{PRICE_BREAKDOWN}/g, context.price.breakdown || "")
      .replace(/{SHOP_DRAWINGS_DAYS}/g, context.schedule.shopDrawingsDays.toString())
      .replace(/{FABRICATION_WEEKS}/g, context.schedule.fabricationWeeks.toString())
      .replace(/{EXCLUSIONS_SECTION}/g, context.exclusions);

    const prompt = `Generate a professional steel fabrication proposal using the following template structure. Fill in any remaining placeholders and expand sections with professional, detailed language.

TEMPLATE STRUCTURE:
${filledTemplate}

PROVIDED DATA:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS:
1. Replace all {PLACEHOLDERS} with actual values from the provided data
2. Expand each section with professional, detailed language appropriate for a steel fabrication proposal
3. Use the project summary to add relevant details to the scope section
4. If estimating data is provided, reference actual costs and quantities where appropriate
5. Format the proposal in clean, professional Markdown
6. Ensure all sections are complete and well-written
7. Maintain the professional tone throughout

Generate the complete proposal now:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional proposal writer for steel fabrication projects. Generate clear, professional proposals following the exact template structure provided. Fill in all placeholders and expand sections with detailed, professional language.",
        },
        { role: "user", content: prompt },
      ],
    });

    const proposal = completion.choices[0].message.content || "";
    const tokens = completion.usage?.total_tokens || 0;
    const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");

    // Log usage if companyId and projectId provided
    if (companyId && projectId) {
      try {
        await logAIUsage(companyId, projectId, {
          type: "proposal",
          tokens,
          cost,
          input: JSON.stringify(context),
          output: proposal,
        });
      } catch (error) {
        console.warn("Failed to log AI usage:", error);
      }
    }

    return NextResponse.json({
      proposal,
      tokens,
      cost,
    });
  } catch (error: any) {
    console.error("Proposal generation error:", error);
    return NextResponse.json(
      { error: error.message || "Proposal generation failed" },
      { status: 500 }
    );
  }
}

