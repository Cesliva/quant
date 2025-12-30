import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import { getWeightPerFoot, getSurfaceAreaPerFoot, getShapeByDesignation } from "@/lib/utils/aiscShapes";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface ParsedSpec {
  itemType: string; // "pipe_rail", "roof_ladder", "cage_ladder", "track_gate", "sump_pit_frame", "sump_pit_grate", "sump_pit_ladder", etc.
  material: string; // "sch 40", "HSS 4x4x1/4", etc.
  dimensions: {
    length?: number; // feet
    height?: number; // inches
    width?: number; // inches
    postSpacing?: number; // feet (OC)
  };
  quantities: {
    rails?: number; // number of rail lines
    posts?: number; // calculated from length and spacing
    totalLength?: number; // total LF of material
  };
  features: string[]; // ["vent_holes", "galvanizing", etc.]
  grade?: string; // "A53", "A500", etc.
}

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const { description, companyId } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 }
      );
    }

    // Load company settings for rates
    const companySettings = companyId 
      ? await loadCompanySettings(companyId)
      : null;

    // Step 1: Parse the description with AI
    const parsePrompt = `You are an expert steel estimator. Parse the following misc metals description and extract all relevant information.

Description: "${description}"

Extract and return a JSON object with this structure:
{
  "itemType": "pipe_rail" | "roof_ladder" | "cage_ladder" | "track_gate" | "sump_pit_frame" | "sump_pit_grate" | "sump_pit_ladder" | "other",
  "material": "sch 40" | "HSS 4x4x1/4" | "pipe" | etc.,
  "dimensions": {
    "length": number in feet,
    "height": number in inches,
    "width": number in inches,
    "postSpacing": number in feet (OC spacing)
  },
  "quantities": {
    "rails": number of rail lines (for pipe rail),
    "posts": number of posts (calculate from length and spacing),
    "totalLength": total linear feet of material
  },
  "features": ["vent_holes", "galvanizing", "welded", etc.],
  "grade": "A53" | "A500" | "A36" | etc.
}

Rules:
- Convert all measurements to consistent units (feet for length, inches for height/width)
- For pipe rail: calculate number of posts = (length / postSpacing) + 1
- For pipe rail: totalLength = (rails × length) + (posts × height)
- Extract material specs (sch 40 = schedule 40 pipe, etc.)
- Identify if galvanizing is mentioned
- Return ONLY valid JSON, no markdown or explanation`;

    const parseResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a steel estimation expert. Return only valid JSON.",
        },
        { role: "user", content: parsePrompt },
      ],
      response_format: { type: "json_object" },
    });

    const parsed: ParsedSpec = JSON.parse(
      parseResponse.choices[0].message.content || "{}"
    );

    // Step 2: Calculate material quantities and costs
    const items = await calculateMiscMetalsCosts(parsed, companySettings);

    return NextResponse.json({ items });
  } catch (error: any) {
    console.error("Misc metals parse error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse description" },
      { status: 500 }
    );
  }
}

async function calculateMiscMetalsCosts(
  spec: ParsedSpec,
  companySettings: any
): Promise<any[]> {
  const items: any[] = [];
  const materialRate = getMaterialRate(companySettings);
  const laborRate = getLaborRate(companySettings);
  const galvanizingRate = getGalvanizingRate(companySettings);

  if (spec.itemType === "pipe_rail") {
    // Calculate pipe rail components
    const { rails = 3, posts = 0 } = spec.quantities;
    const railLength = spec.dimensions.length || 0;
    const postHeight = (spec.dimensions.height || 42) / 12; // Convert to feet
    const postSpacing = spec.dimensions.postSpacing || 6;
    const numPosts = Math.ceil(railLength / postSpacing) + 1;

    // Rail material (horizontal pipes)
    const railMaterial = spec.material || "sch 40";
    const railSize = parsePipeSize(railMaterial);
    const railWeightPerFoot = getPipeWeightPerFoot(railSize);
    const railTotalWeight = railWeightPerFoot * railLength * rails;
    const railSurfaceArea = getPipeSurfaceArea(railSize) * railLength * rails;

    items.push({
      itemDescription: `${railLength}' ${railMaterial} pipe rail (${rails} lines)`,
      category: "Misc Metals",
      subCategory: "Pipe Rail",
      materialType: "Material",
      sizeDesignation: railSize,
      grade: spec.grade || "A53",
      lengthFt: railLength,
      qty: rails,
      totalWeight: railTotalWeight,
      totalSurfaceArea: railSurfaceArea,
      laborCut: (railLength * rails * 0.1), // 0.1 hrs per LF
      laborFit: (railLength * rails * 0.15),
      laborWeld: (railLength * rails * 0.2),
      laborHandleMove: (railTotalWeight / 100) * 0.1, // Handling based on weight
      totalLabor: (railLength * rails * 0.45) + (railTotalWeight / 100) * 0.1,
      coatingSystem: spec.features.includes("galvanizing") ? "Galv" : "None",
      materialCost: railTotalWeight * materialRate,
      laborCost: ((railLength * rails * 0.45) + (railTotalWeight / 100) * 0.1) * laborRate,
      coatingCost: spec.features.includes("galvanizing") 
        ? railTotalWeight * galvanizingRate 
        : 0,
      handlingCost: (railTotalWeight / 100) * 0.1 * laborRate,
      totalCost: 0, // Will calculate below
    });

    // Posts
    const postMaterial = spec.material || "sch 40";
    const postSize = parsePipeSize(postMaterial);
    const postWeightPerFoot = getPipeWeightPerFoot(postSize);
    const postTotalWeight = postWeightPerFoot * postHeight * numPosts;
    const postSurfaceArea = getPipeSurfaceArea(postSize) * postHeight * numPosts;

    items.push({
      itemDescription: `${postHeight * 12}" ${postMaterial} pipe posts (${numPosts} @ ${postSpacing}' OC)`,
      category: "Misc Metals",
      subCategory: "Pipe Rail Posts",
      materialType: "Material",
      sizeDesignation: postSize,
      grade: spec.grade || "A53",
      lengthFt: postHeight,
      qty: numPosts,
      totalWeight: postTotalWeight,
      totalSurfaceArea: postSurfaceArea,
      laborDrillPunch: spec.features.includes("vent_holes") 
        ? numPosts * 0.25 // 15 min per post for vent holes
        : 0,
      laborCut: numPosts * 0.1,
      laborFit: numPosts * 0.2,
      laborWeld: numPosts * 0.3,
      laborHandleMove: (postTotalWeight / 100) * 0.1,
      totalLabor: (numPosts * 0.6) + (spec.features.includes("vent_holes") ? numPosts * 0.25 : 0) + (postTotalWeight / 100) * 0.1,
      coatingSystem: spec.features.includes("galvanizing") ? "Galv" : "None",
      materialCost: postTotalWeight * materialRate,
      laborCost: ((numPosts * 0.6) + (spec.features.includes("vent_holes") ? numPosts * 0.25 : 0) + (postTotalWeight / 100) * 0.1) * laborRate,
      coatingCost: spec.features.includes("galvanizing") 
        ? postTotalWeight * galvanizingRate 
        : 0,
      handlingCost: (postTotalWeight / 100) * 0.1 * laborRate,
      totalCost: 0,
      notes: spec.features.includes("vent_holes") ? "Includes vent holes for galvanizing" : undefined,
    });

    // Calculate totals
    items.forEach(item => {
      item.totalCost = (item.materialCost || 0) + (item.laborCost || 0) + (item.coatingCost || 0) + (item.handlingCost || 0);
    });
  } else {
    // For other item types, return a basic item structure
    items.push({
      itemDescription: spec.itemType || "Misc Metals Item",
      category: "Misc Metals",
      subCategory: spec.itemType || "Other",
      materialType: "Material",
      notes: `Parsed from: ${JSON.stringify(spec)}. Full calculation support coming soon.`,
      materialCost: 0,
      laborCost: 0,
      coatingCost: 0,
      handlingCost: 0,
      totalCost: 0,
    });
  }

  return items;
}

// Helper functions
function parsePipeSize(material: string): string {
  // Convert "sch 40" to AISC pipe size designation
  // Standard pipe sizes: sch 40 typically uses STD designation
  const normalized = material.toLowerCase().trim();
  
  // Map common pipe descriptions to AISC designations
  if (normalized.includes("sch 40") || normalized.includes("schedule 40")) {
    // Default to 1-1/4" pipe for sch 40 (most common for rail)
    return "Pipe1-1/4STD";
  }
  if (normalized.includes("sch 80") || normalized.includes("schedule 80")) {
    return "Pipe1-1/4XS";
  }
  if (normalized.includes("1-1/4") || normalized.includes("1.25")) {
    return "Pipe1-1/4STD";
  }
  if (normalized.includes("1-1/2") || normalized.includes("1.5")) {
    return "Pipe1-1/2STD";
  }
  if (normalized.includes("2")) {
    return "Pipe2STD";
  }
  if (normalized.includes("1")) {
    return "Pipe1STD";
  }
  
  // Default to 1-1/4" STD
  return "Pipe1-1/4STD";
}

function getPipeWeightPerFoot(size: string): number {
  // Use AISC data
  const shape = getShapeByDesignation(size);
  if (shape) {
    return parseFloat(shape.W) || 0;
  }
  // Fallback weights (lb/ft)
  const fallbackWeights: Record<string, number> = {
    "Pipe1STD": 1.68,
    "Pipe1-1/4STD": 2.27,
    "Pipe1-1/2STD": 2.72,
    "Pipe2STD": 3.66,
  };
  return fallbackWeights[size] || 2.27;
}

function getPipeSurfaceArea(size: string): number {
  // Use AISC data for surface area per foot
  const shape = getShapeByDesignation(size);
  if (shape) {
    return parseFloat(shape.A) || 0;
  }
  // Fallback surface areas (sf/ft)
  const fallbackAreas: Record<string, number> = {
    "Pipe1STD": 0.469,
    "Pipe1-1/4STD": 0.625,
    "Pipe1-1/2STD": 0.749,
    "Pipe2STD": 1.02,
  };
  return fallbackAreas[size] || 0.625;
}

function getMaterialRate(settings: any): number {
  if (!settings?.materialGrades) return 1.0;
  // Default to A53 rate if available, otherwise first grade
  const a53 = settings.materialGrades.find((g: any) => 
    g.grade.toLowerCase().includes("a53")
  );
  return a53?.costPerPound || settings.materialGrades[0]?.costPerPound || 1.0;
}

function getLaborRate(settings: any): number {
  if (!settings?.laborRates) return 50;
  // Default to Fabricator rate
  const fabricator = settings.laborRates.find((r: any) => 
    r.trade.toLowerCase().includes("fabricator")
  );
  return fabricator?.rate || settings.laborRates[0]?.rate || 50;
}

function getGalvanizingRate(settings: any): number {
  if (!settings?.coatingTypes) return 0.15;
  const galv = settings.coatingTypes.find((c: any) => 
    c.type.toLowerCase().includes("galv")
  );
  // Galvanizing is typically per pound, but settings might be per SF
  // For now, use a default of $0.15/lb
  return galv?.costPerSF ? galv.costPerSF * 0.24 : 0.15; // Rough conversion: 1 lb ≈ 0.24 SF for pipe
}






