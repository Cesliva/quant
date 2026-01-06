import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { calculateGPT4Cost } from "@/lib/openai/usageTracker";
import { logAIUsage } from "@/lib/openai/usageTracker";
import {
  generateProjectIntelligence,
  getGCRelationshipContext,
  generatePersonalizedIntroduction,
  generatePersonalizedClosing,
  extractSeedInsights,
} from "@/lib/utils/proposalPersonalization";
import {
  analyzeScope,
  buildDetailedScope,
} from "@/lib/utils/proposalScopeBuilder";

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
    const { formData, estimatingData, companyInfo, projectId, companyId, projectData, proposalSeeds, companySettings } = body;

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
      
      Return a JSON object with the following structure:
      {
        "projectOverview": {
          "content": "Professional introduction paragraph describing the project and opportunity",
          "type": "paragraph"
        },
        "scopeOfWork": {
          "content": ["Bullet point 1", "Bullet point 2", "..."],
          "type": "bullets"
        },
        "projectSpecificInclusions": {
          "content": ["Inclusion 1", "Inclusion 2", "..."],
          "type": "bullets"
        },
        "projectSpecificExclusions": {
          "content": ["Exclusion 1", "Exclusion 2", "..."],
          "type": "bullets"
        },
        "clarificationsAssumptions": {
          "content": ["Clarification 1", "Assumption 1", "..."],
          "type": "bullets"
        },
        "commercialTerms": {
          "content": "Professional paragraph describing pricing, payment terms, and commercial conditions",
          "type": "paragraph"
        },
        "acceptanceSignature": {
          "content": "Professional closing paragraph with acceptance instructions",
          "type": "paragraph"
        }
      }
      
      IMPORTANT: Return ONLY valid JSON, no markdown formatting or code blocks.`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a professional proposal writer for steel fabrication projects. Generate structured proposal content in JSON format. Return ONLY valid JSON, no markdown or code blocks.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const proposalContent = completion.choices[0].message.content || "{}";
      let structuredProposal;
      
      try {
        structuredProposal = JSON.parse(proposalContent);
      } catch (e) {
        // Fallback to plain text if JSON parsing fails
        structuredProposal = { projectOverview: { content: proposalContent, type: "paragraph" } };
      }

      const tokens = completion.usage?.total_tokens || 0;
      const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");

      return NextResponse.json({
        proposal: proposalContent, // Keep for backward compatibility
        structuredProposal, // New structured format
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

    // Analyze estimating lines for detailed scope
    const estimatingLines = estimatingData?.lines || [];
    const scopeAnalysis = analyzeScope(estimatingLines);
    
    // Build detailed scope section from actual line items
    const scopeItems = buildDetailedScope(estimatingLines, formData, scopeAnalysis);

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

    // Generate project intelligence and personalization
    const totalCost = formData.totalLumpSum || 0;
    const totalWeight = estimatingData?.totals?.totalWeight || 0;
    const intelligence = generateProjectIntelligence(
      estimatingLines,
      projectData?.projectType,
      totalCost,
      totalWeight
    );

    // Get GC relationship context
    const gcName = formData.contractor || projectData?.generalContractor || "the general contractor";
    const relationshipContext = await getGCRelationshipContext(
      gcName,
      projectData?.gcId,
      companyId
    );

    // Extract seed insights
    const seedInsights = proposalSeeds ? extractSeedInsights(proposalSeeds) : {
      criticalAssumptions: [],
      importantClarifications: [],
      keyExclusions: [],
      notableInclusions: [],
    };

    // Generate personalized introduction and closing
    const personalizedIntro = generatePersonalizedIntroduction(
      formData.projectName || "this project",
      formData.projectLocation || "",
      projectData?.projectType,
      gcName,
      companySettings?.proposalSettings,
      intelligence,
      relationshipContext
    );

    const personalizedClosing = generatePersonalizedClosing(
      companySettings?.proposalSettings,
      formData.projectName || "this project"
    );

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
      // Personalization context
      personalization: {
        introduction: personalizedIntro,
        closing: personalizedClosing,
        projectIntelligence: intelligence,
        seedInsights: seedInsights,
        companyVoice: companySettings?.proposalSettings?.companyVoice,
      },
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

    // Build personalized prompt
    const companyVoice = companySettings?.proposalSettings?.companyVoice;
    const tone = companyVoice?.tone || "professional";
    const keyMessages = companyVoice?.keyMessages || [];
    const differentiators = companyVoice?.differentiators || [];

    const totalLumpSumFormatted = formData.totalLumpSum.toLocaleString();
    const prompt = `You are a senior estimator writing a personalized proposal for ${gcName} on the ${formData.projectName || "project"} project.

PROJECT CONTEXT:
- Project: ${formData.projectName}
- Location: ${formData.projectLocation || "Not specified"}
- Bid Date: ${formData.bidDate}
- Project Type: ${projectData?.projectType || "Commercial"}
- General Contractor: ${gcName}
${relationshipContext ? `- Relationship: ${relationshipContext}` : ""}

ESTIMATING INSIGHTS:
- Total Tons: ${intelligence.totalTons.toFixed(2)} tons
- Total Hours: ${intelligence.totalHours.toFixed(0)} hours
- Cost per Ton: $${intelligence.costPerTon.toLocaleString()}
${intelligence.complexityIndicators.length > 0 ? `- Key Insights:\n${intelligence.complexityIndicators.map(i => `  • ${i}`).join('\n')}` : ""}

PROPOSAL SEEDS (Captured During Estimating):
${seedInsights.criticalAssumptions.length > 0 ? `Critical Assumptions:\n${seedInsights.criticalAssumptions.map(a => `- ${a}`).join('\n')}` : ""}
${seedInsights.importantClarifications.length > 0 ? `Important Clarifications:\n${seedInsights.importantClarifications.map(c => `- ${c}`).join('\n')}` : ""}
${seedInsights.keyExclusions.length > 0 ? `Key Exclusions:\n${seedInsights.keyExclusions.map(e => `- ${e}`).join('\n')}` : ""}
${seedInsights.notableInclusions.length > 0 ? `Notable Inclusions:\n${seedInsights.notableInclusions.map(i => `- ${i}`).join('\n')}` : ""}

COMPANY VOICE & BRANDING:
- Tone: ${tone}
${keyMessages.length > 0 ? `- Key Messages: ${keyMessages.join(", ")}` : ""}
${differentiators.length > 0 ? `- Differentiators: ${differentiators.join(", ")}` : ""}

TEMPLATE STRUCTURE:
${filledTemplate}

PROVIDED DATA:
${JSON.stringify(context, null, 2)}

WRITING REQUIREMENTS:
1. Use the personalized introduction provided in context.personalization.introduction as the foundation for projectOverview
2. Write like a trusted partner, not a vendor - professional but conversational
3. Reference specific project details naturally (e.g., "Given the ${projectData?.projectType || "commercial"} nature of this project...")
4. Show understanding of their needs based on project intelligence
5. Use active voice and confident language
6. Include subtle relationship-building phrases when appropriate
7. Make technical details accessible, not overwhelming
8. Show enthusiasm for the opportunity without being salesy
9. Use the personalized closing from context.personalization.closing for acceptanceSignature
10. If proposal seeds show specific concerns, address them directly in the proposal
11. For scopeOfWork: Use the detailed scope breakdown provided in context.scope. Expand each item with specific details from the estimating data. Include quantities, materials, and specifications where available.
12. For price: Always include the total lump sum amount ($${totalLumpSumFormatted}) prominently. Reference the scope when explaining value. Include payment terms and pricing validity period.
13. For projectSpecificInclusions: Use items from context.personalization.seedInsights.notableInclusions. Make them specific and relevant to the project.
14. For projectSpecificExclusions: Use items from context.personalization.seedInsights.keyExclusions. Be clear and specific about what is excluded.
15. For clarificationsAssumptions: Use items from context.personalization.seedInsights.criticalAssumptions and importantClarifications. These are critical for avoiding disputes.

Return a JSON object with the following structure:
{
  "projectOverview": {
    "content": "Personalized introduction paragraph that feels written specifically for this project and GC. Use the provided personalized introduction as a starting point but expand it naturally.",
    "type": "paragraph"
  },
  "scopeOfWork": {
    "content": ["Detailed bullet point 1 based on actual estimating data", "Detailed bullet point 2", "..."],
    "type": "bullets"
  },
  "price": {
    "content": "Professional paragraph describing the pricing. Include the total lump sum of $${totalLumpSumFormatted} naturally in the text. Mention payment terms, material escalation clauses (if applicable), and any relevant commercial conditions. Reference the detailed scope when appropriate. If breakdowns are included, reference them naturally.",
    "type": "paragraph"
  },
  "projectSpecificInclusions": {
    "content": ["Inclusion 1 from proposal seeds", "Inclusion 2", "..."],
    "type": "bullets"
  },
  "projectSpecificExclusions": {
    "content": ["Exclusion 1 from proposal seeds", "Exclusion 2", "..."],
    "type": "bullets"
  },
  "clarificationsAssumptions": {
    "content": ["Clarification 1 from proposal seeds", "Assumption 1", "..."],
    "type": "bullets"
  },
  "commercialTerms": {
    "content": "Professional paragraph describing payment terms, material escalation clauses (30-day pricing validity), change order procedures, and other commercial conditions",
    "type": "paragraph"
  },
  "acceptanceSignature": {
    "content": "Use the provided personalized closing. Make it feel warm and professional, written specifically for this relationship.",
    "type": "paragraph"
  }
}

CRITICAL: The proposal should feel like it was written specifically for ${gcName} and the ${formData.projectName || "project"}, not a generic template. Reference project-specific details, show understanding of the project type and complexity, and demonstrate that you've thought deeply about their needs.

Return ONLY valid JSON, no markdown formatting or code blocks.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional proposal writer for steel fabrication projects. Generate structured proposal content in JSON format. Return ONLY valid JSON, no markdown or code blocks.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const proposalContent = completion.choices[0].message.content || "{}";
    let structuredProposal;
    
    try {
      structuredProposal = JSON.parse(proposalContent);
      
      // Ensure price section is included
      if (!structuredProposal.price) {
        structuredProposal.price = {
          content: `Total Lump Sum: $${formData.totalLumpSum.toLocaleString()}\n\n${formData.includeBreakdowns && estimatingData?.totals ? `Breakdowns:\n- Structural Steel: $${estimatingData.totals.materialCost?.toLocaleString() || "0"}\n- Labor: $${estimatingData.totals.laborCost?.toLocaleString() || "0"}\n- Coating: $${estimatingData.totals.coatingCost?.toLocaleString() || "0"}\n- Hardware: $${estimatingData.totals.hardwareCost?.toLocaleString() || "0"}` : "Sales tax, if applicable, will be added."}`,
          type: "paragraph"
        };
      }
      
      // Ensure metadata includes price
      if (!structuredProposal.metadata) {
        structuredProposal.metadata = {};
      }
      structuredProposal.metadata.totalLumpSum = formData.totalLumpSum;
      structuredProposal.metadata.shopDrawingsDays = formData.shopDrawingsDays;
      structuredProposal.metadata.fabricationWeeks = formData.fabricationWeeks;
    } catch (e) {
      // Fallback: convert filled template to structured format
      structuredProposal = {
        projectOverview: { content: filledTemplate.split("\n\n")[0] || "", type: "paragraph" },
        scopeOfWork: { content: filledTemplate.split("2. SCOPE OF WORK")[1]?.split("3. PRICE")[0]?.trim() || "", type: "paragraph" },
        price: {
          content: `Total Lump Sum: $${formData.totalLumpSum.toLocaleString()}\n\n${priceBreakdown || "Sales tax, if applicable, will be added."}`,
          type: "paragraph"
        },
        metadata: {
          totalLumpSum: formData.totalLumpSum,
          shopDrawingsDays: formData.shopDrawingsDays,
          fabricationWeeks: formData.fabricationWeeks,
        },
      };
    }

    // Also keep the filled template as plain text for backward compatibility
    const proposal = filledTemplate;

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
      proposal, // Keep for backward compatibility
      structuredProposal, // New structured format
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

