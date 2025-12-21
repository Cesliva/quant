/**
 * Seed Data Script for Mid-Year $8M Fabrication Shop Scenario
 * 
 * This script creates realistic sample data representing a mid-year state
 * for an $8 million annual revenue steel fabrication shop.
 * 
 * Usage: 
 *   1. Set your companyId in the script
 *   2. Run: npx ts-node scripts/seedMidYearData.ts
 *   3. Or import and call from a Next.js API route
 */

import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

// Initialize Firebase Admin (you'll need to set up service account)
// For client-side usage, you'd use the regular Firebase SDK instead
let db: FirebaseFirestore.Firestore;

try {
  if (getApps().length === 0) {
    // Initialize with service account or use client SDK
    // This is a placeholder - adjust based on your setup
    console.log("Firebase Admin not initialized. Using client SDK approach.");
  }
} catch (error) {
  console.log("Using client SDK approach for seeding.");
}

// ============================================================================
// CONFIGURATION
// ============================================================================

// Set your company ID here
const COMPANY_ID = "YOUR_COMPANY_ID"; // Replace with actual company ID

// Material rates (typical for mid-2024)
const MATERIAL_RATE = 0.85; // $/lb
const LABOR_RATE = 45.0; // $/hr
const PAINT_RATE = 2.5; // $/sf
const GALVANIZE_RATE = 0.55; // $/lb

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function monthsAgo(months: number): Date {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date;
}

// ============================================================================
// PROJECT DATA
// ============================================================================

interface ProjectData {
  projectNumber: string;
  projectName: string;
  projectType: string;
  status: string;
  generalContractor: string;
  owner: string;
  location: string;
  bidDueDate?: string;
  decisionDate?: string;
  deliveryDate?: string;
  estimatedValue: number;
  winProbability: number;
  competitionLevel: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  fabWindowStart?: string;
  fabWindowEnd?: string;
  fabHours?: number;
  awardValue?: number;
  actualHoursFabrication?: number;
  actualHoursWelding?: number;
  actualHoursPrepPaint?: number;
}

const PROJECTS: ProjectData[] = [
  // WON PROJECTS (Completed or in production) - ~$2.5M
  {
    projectNumber: "2024-015",
    projectName: "Downtown Office Complex - Phase 2",
    projectType: "Commercial Building",
    status: "won",
    generalContractor: "Turner Construction",
    owner: "Metro Development Group",
    location: "Seattle, WA",
    bidDueDate: daysAgo(120).toISOString().split("T")[0],
    decisionDate: daysAgo(110).toISOString().split("T")[0],
    deliveryDate: daysAgo(30).toISOString().split("T")[0],
    estimatedValue: 485000,
    awardValue: 475000,
    winProbability: 100,
    competitionLevel: "high",
    fabWindowStart: daysAgo(90).toISOString().split("T")[0],
    fabWindowEnd: daysAgo(30).toISOString().split("T")[0],
    fabHours: 1200,
    actualHoursFabrication: 1180,
    actualHoursWelding: 450,
    actualHoursPrepPaint: 320,
    createdAt: daysAgo(130),
    updatedAt: daysAgo(25),
    notes: "Delivered on time. Client very satisfied with quality.",
  },
  {
    projectNumber: "2024-028",
    projectName: "Industrial Warehouse - Main Structure",
    projectType: "Industrial",
    status: "won",
    generalContractor: "Mortenson Construction",
    owner: "Logistics Solutions Inc",
    location: "Portland, OR",
    bidDueDate: daysAgo(95).toISOString().split("T")[0],
    decisionDate: daysAgo(85).toISOString().split("T")[0],
    deliveryDate: daysAgo(15).toISOString().split("T")[0],
    estimatedValue: 620000,
    awardValue: 605000,
    winProbability: 100,
    competitionLevel: "medium",
    fabWindowStart: daysAgo(70).toISOString().split("T")[0],
    fabWindowEnd: daysAgo(10).toISOString().split("T")[0],
    fabHours: 1450,
    actualHoursFabrication: 1420,
    actualHoursWelding: 520,
    actualHoursPrepPaint: 380,
    createdAt: daysAgo(100),
    updatedAt: daysAgo(10),
  },
  {
    projectNumber: "2024-042",
    projectName: "Bridge Rehabilitation - Deck Replacement",
    projectType: "Infrastructure",
    status: "won",
    generalContractor: "Kiewit Corporation",
    owner: "State DOT",
    location: "Spokane, WA",
    bidDueDate: daysAgo(75).toISOString().split("T")[0],
    decisionDate: daysAgo(65).toISOString().split("T")[0],
    deliveryDate: daysAgo(5).toISOString().split("T")[0],
    estimatedValue: 890000,
    awardValue: 875000,
    winProbability: 100,
    competitionLevel: "high",
    fabWindowStart: daysAgo(50).toISOString().split("T")[0],
    fabWindowEnd: daysAgo(5).toISOString().split("T")[0],
    fabHours: 2100,
    actualHoursFabrication: 2080,
    actualHoursWelding: 780,
    actualHoursPrepPaint: 550,
    createdAt: daysAgo(80),
    updatedAt: daysAgo(3),
    notes: "Complex project with tight tolerances. All specs met.",
  },

  // ACTIVE BIDS (In estimating or submitted) - ~$3.5M
  {
    projectNumber: "2024-055",
    projectName: "Tech Campus - Building A",
    projectType: "Commercial Building",
    status: "active",
    generalContractor: "Skanska USA",
    owner: "TechCorp Development",
    location: "Bellevue, WA",
    bidDueDate: daysAgo(5).toISOString().split("T")[0],
    estimatedValue: 750000,
    winProbability: 65,
    competitionLevel: "high",
    createdAt: daysAgo(25),
    updatedAt: daysAgo(2),
    notes: "High-value opportunity. Strong relationship with GC.",
  },
  {
    projectNumber: "2024-061",
    projectName: "Manufacturing Facility Expansion",
    projectType: "Industrial",
    status: "active",
    generalContractor: "PCL Construction",
    owner: "Advanced Manufacturing Co",
    location: "Tacoma, WA",
    bidDueDate: daysAgo(12).toISOString().split("T")[0],
    estimatedValue: 520000,
    winProbability: 45,
    competitionLevel: "medium",
    createdAt: daysAgo(30),
    updatedAt: daysAgo(8),
  },
  {
    projectNumber: "2024-067",
    projectName: "Multi-Family Residential - Tower 3",
    projectType: "Residential",
    status: "active",
    generalContractor: "Lendlease",
    owner: "Urban Living Partners",
    location: "Seattle, WA",
    bidDueDate: daysAgo(18).toISOString().split("T")[0],
    estimatedValue: 680000,
    winProbability: 55,
    competitionLevel: "high",
    createdAt: daysAgo(35),
    updatedAt: daysAgo(10),
  },
  {
    projectNumber: "2024-072",
    projectName: "Hospital Addition - Emergency Wing",
    projectType: "Healthcare",
    status: "active",
    generalContractor: "McCarthy Building",
    owner: "Regional Medical Center",
    location: "Everett, WA",
    bidDueDate: daysAgo(25).toISOString().split("T")[0],
    estimatedValue: 950000,
    winProbability: 40,
    competitionLevel: "very-high",
    createdAt: daysAgo(40),
    updatedAt: daysAgo(15),
    notes: "Complex specs. Multiple RFIs pending.",
  },
  {
    projectNumber: "2024-078",
    projectName: "Distribution Center - Phase 1",
    projectType: "Industrial",
    status: "active",
    generalContractor: "Ryan Companies",
    owner: "Global Logistics",
    location: "Kent, WA",
    bidDueDate: daysAgo(8).toISOString().split("T")[0],
    estimatedValue: 580000,
    winProbability: 50,
    competitionLevel: "medium",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
  },

  // WON BUT NOT STARTED - ~$1.2M
  {
    projectNumber: "2024-083",
    projectName: "Retail Complex - Anchor Store",
    projectType: "Commercial Building",
    status: "won",
    generalContractor: "Clark Construction",
    owner: "Retail Properties Group",
    location: "Renton, WA",
    bidDueDate: daysAgo(45).toISOString().split("T")[0],
    decisionDate: daysAgo(35).toISOString().split("T")[0],
    deliveryDate: daysAgo(60).toISOString().split("T")[0], // Future
    estimatedValue: 420000,
    awardValue: 410000,
    winProbability: 100,
    competitionLevel: "medium",
    fabWindowStart: daysAgo(30).toISOString().split("T")[0],
    fabWindowEnd: daysAgo(60).toISOString().split("T")[0],
    fabHours: 980,
    createdAt: daysAgo(50),
    updatedAt: daysAgo(32),
  },
  {
    projectNumber: "2024-089",
    projectName: "School Addition - Gymnasium",
    projectType: "Education",
    status: "won",
    generalContractor: "Hoffman Construction",
    owner: "School District #401",
    location: "Vancouver, WA",
    bidDueDate: daysAgo(60).toISOString().split("T")[0],
    decisionDate: daysAgo(50).toISOString().split("T")[0],
    deliveryDate: daysAgo(75).toISOString().split("T")[0], // Future
    estimatedValue: 380000,
    awardValue: 375000,
    winProbability: 100,
    competitionLevel: "medium",
    fabWindowStart: daysAgo(40).toISOString().split("T")[0],
    fabWindowEnd: daysAgo(70).toISOString().split("T")[0],
    fabHours: 890,
    createdAt: daysAgo(65),
    updatedAt: daysAgo(48),
  },
  {
    projectNumber: "2024-091",
    projectName: "Parking Structure - Level 2-4",
    projectType: "Parking Structure",
    status: "won",
    generalContractor: "Sellen Construction",
    owner: "City of Seattle",
    location: "Seattle, WA",
    bidDueDate: daysAgo(55).toISOString().split("T")[0],
    decisionDate: daysAgo(45).toISOString().split("T")[0],
    deliveryDate: daysAgo(80).toISOString().split("T")[0], // Future
    estimatedValue: 450000,
    awardValue: 445000,
    winProbability: 100,
    competitionLevel: "high",
    fabWindowStart: daysAgo(35).toISOString().split("T")[0],
    fabWindowEnd: daysAgo(75).toISOString().split("T")[0],
    fabHours: 1050,
    createdAt: daysAgo(60),
    updatedAt: daysAgo(43),
  },

  // LOST PROJECTS (for win/loss analysis) - ~$800K
  {
    projectNumber: "2024-034",
    projectName: "Office Tower - Core & Shell",
    projectType: "Commercial Building",
    status: "lost",
    generalContractor: "Webcor Builders",
    owner: "Downtown Development LLC",
    location: "Seattle, WA",
    bidDueDate: daysAgo(80).toISOString().split("T")[0],
    decisionDate: daysAgo(70).toISOString().split("T")[0],
    estimatedValue: 1200000,
    winProbability: 0,
    competitionLevel: "very-high",
    createdAt: daysAgo(90),
    updatedAt: daysAgo(70),
    notes: "Lost to competitor by 3%. Pricing was competitive but competitor had better schedule.",
  },
  {
    projectNumber: "2024-047",
    projectName: "Warehouse - Automated Storage",
    projectType: "Industrial",
    status: "lost",
    generalContractor: "Mortenson Construction",
    owner: "E-Commerce Fulfillment",
    location: "Auburn, WA",
    bidDueDate: daysAgo(65).toISOString().split("T")[0],
    decisionDate: daysAgo(55).toISOString().split("T")[0],
    estimatedValue: 580000,
    winProbability: 0,
    competitionLevel: "high",
    createdAt: daysAgo(75),
    updatedAt: daysAgo(55),
    notes: "Lost on price. Competitor was 8% lower.",
  },
];

// ============================================================================
// ESTIMATING LINE GENERATORS
// ============================================================================

function createColumnLine(lineId: string, projectType: string): EstimatingLine {
  const sizes = ["W12x65", "W14x90", "W16x100", "W18x119", "W21x147"];
  const grades = ["A992", "A572 Gr50", "A36"];
  const size = randomChoice(sizes);
  const grade = randomChoice(grades);
  const lengthFt = randomInt(12, 30);
  const qty = randomInt(4, 24);
  
  // Typical weights per foot (simplified)
  const weightMap: Record<string, number> = {
    "W12x65": 65,
    "W14x90": 90,
    "W16x100": 100,
    "W18x119": 119,
    "W21x147": 147,
  };
  const weightPerFoot = weightMap[size] || 100;
  const totalWeight = (weightPerFoot * lengthFt * qty) / 1000; // tons
  
  const materialCost = totalWeight * 2000 * MATERIAL_RATE;
  const laborHours = totalWeight * randomBetween(8, 12); // hours per ton
  const laborCost = laborHours * LABOR_RATE;
  const coatingSystem = randomChoice(["None", "Paint", "Galv"]);
  let coatingCost = 0;
  if (coatingSystem === "Paint") {
    const surfaceArea = totalWeight * 2000 * 0.15; // rough sf estimate
    coatingCost = surfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Galv") {
    coatingCost = totalWeight * 2000 * GALVANIZE_RATE;
  }
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} Column - ${lengthFt}' long`,
    category: "Columns",
    subCategory: "Main Column",
    materialType: "Material",
    shapeType: "W",
    sizeDesignation: size,
    grade,
    lengthFt,
    qty,
    weightPerFoot,
    totalWeight,
    coatingSystem,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    laborCost,
    coatingRate: coatingSystem === "Paint" ? PAINT_RATE : coatingSystem === "Galv" ? GALVANIZE_RATE : 0,
    coatingCost,
    totalCost: materialCost + laborCost + coatingCost,
    status: "Active",
    isMainMember: true,
  };
}

function createBeamLine(lineId: string, projectType: string): EstimatingLine {
  const sizes = ["W16x40", "W18x50", "W21x62", "W24x76", "W27x94"];
  const grades = ["A992", "A572 Gr50"];
  const size = randomChoice(sizes);
  const grade = randomChoice(grades);
  const lengthFt = randomInt(20, 40);
  const qty = randomInt(6, 30);
  
  const weightMap: Record<string, number> = {
    "W16x40": 40,
    "W18x50": 50,
    "W21x62": 62,
    "W24x76": 76,
    "W27x94": 94,
  };
  const weightPerFoot = weightMap[size] || 60;
  const totalWeight = (weightPerFoot * lengthFt * qty) / 1000;
  
  const materialCost = totalWeight * 2000 * MATERIAL_RATE;
  const laborHours = totalWeight * randomBetween(7, 11);
  const laborCost = laborHours * LABOR_RATE;
  const coatingSystem = randomChoice(["None", "Paint", "Galv"]);
  let coatingCost = 0;
  if (coatingSystem === "Paint") {
    const surfaceArea = totalWeight * 2000 * 0.15;
    coatingCost = surfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Galv") {
    coatingCost = totalWeight * 2000 * GALVANIZE_RATE;
  }
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} Beam - ${lengthFt}' long`,
    category: "Beams",
    subCategory: "Main Beam",
    materialType: "Material",
    shapeType: "W",
    sizeDesignation: size,
    grade,
    lengthFt,
    qty,
    weightPerFoot,
    totalWeight,
    coatingSystem,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    laborCost,
    coatingRate: coatingSystem === "Paint" ? PAINT_RATE : coatingSystem === "Galv" ? GALVANIZE_RATE : 0,
    coatingCost,
    totalCost: materialCost + laborCost + coatingCost,
    status: "Active",
    isMainMember: true,
  };
}

function createPlateLine(lineId: string, projectType: string): EstimatingLine {
  const thickness = randomChoice([0.25, 0.375, 0.5, 0.625, 0.75, 1.0]);
  const width = randomInt(12, 48);
  const plateLength = randomInt(24, 120);
  const plateQty = randomInt(4, 20);
  const plateGrade = randomChoice(["A36", "A572 Gr50", "A992"]);
  
  // Calculate weight: thickness (in) * width (in) * length (in) * 0.2833 / 12^3 * qty
  const plateTotalWeight = (thickness * width * plateLength * 0.2833 * plateQty) / 1728; // tons
  const plateArea = (width * plateLength * plateQty) / 144; // sf
  const plateSurfaceArea = plateArea * 2; // both sides
  const edgePerimeter = ((width + plateLength) * 2 * plateQty) / 12; // ft
  
  const materialCost = plateTotalWeight * 2000 * MATERIAL_RATE;
  const laborHours = plateTotalWeight * randomBetween(10, 15);
  const laborCost = laborHours * LABOR_RATE;
  const coatingSystem = randomChoice(["None", "Paint", "Powder"]);
  let coatingCost = 0;
  if (coatingSystem === "Paint") {
    coatingCost = plateSurfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Powder") {
    coatingCost = plateSurfaceArea * 3.5; // powder coating rate
  }
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${thickness}" x ${width}" x ${plateLength}" ${plateGrade} Plate`,
    category: "Plates",
    subCategory: randomChoice(["Base Plate", "Gusset", "Stiffener", "Clip"]),
    materialType: "Plate",
    thickness,
    width,
    plateLength,
    plateQty,
    plateGrade,
    plateArea,
    edgePerimeter,
    plateSurfaceArea,
    plateTotalWeight,
    coatingSystem,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    laborCost,
    coatingRate: coatingSystem === "Paint" ? PAINT_RATE : coatingSystem === "Powder" ? 3.5 : 0,
    coatingCost,
    totalCost: materialCost + laborCost + coatingCost,
    status: "Active",
  };
}

function createMiscMetalLine(lineId: string, projectType: string): EstimatingLine {
  const types = ["HSS", "C", "L", "T"];
  const type = randomChoice(types);
  const sizes = type === "HSS" ? ["HSS6x6x1/4", "HSS8x8x3/8", "HSS10x10x1/2"] :
                 type === "C" ? ["C12x20.7", "C15x33.9"] :
                 type === "L" ? ["L4x4x1/4", "L6x6x3/8"] : ["WT6x25"];
  const size = randomChoice(sizes);
  const grade = randomChoice(["A500", "A36", "A572 Gr50"]);
  const lengthFt = randomInt(8, 20);
  const qty = randomInt(10, 50);
  
  const weightPerFoot = randomBetween(15, 35);
  const totalWeight = (weightPerFoot * lengthFt * qty) / 1000;
  
  const materialCost = totalWeight * 2000 * MATERIAL_RATE;
  const laborHours = totalWeight * randomBetween(12, 18);
  const laborCost = laborHours * LABOR_RATE;
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} ${type} - ${lengthFt}' long`,
    category: "Misc Metals",
    subCategory: randomChoice(["Brace", "Clip", "Angle", "Connection"]),
    materialType: "Material",
    shapeType: type as any,
    sizeDesignation: size,
    grade,
    lengthFt,
    qty,
    weightPerFoot,
    totalWeight,
    coatingSystem: randomChoice(["None", "Paint"]),
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    laborCost,
    totalCost: materialCost + laborCost,
    status: "Active",
  };
}

function generateEstimatingLines(projectValue: number, projectType: string): EstimatingLine[] {
  const lines: EstimatingLine[] = [];
  let currentValue = 0;
  let lineNum = 1;
  
  // Target: generate lines that sum to approximately projectValue
  while (currentValue < projectValue * 0.95) {
    const remaining = projectValue - currentValue;
    const lineType = randomChoice(["column", "beam", "plate", "misc"]);
    
    let line: EstimatingLine;
    switch (lineType) {
      case "column":
        line = createColumnLine(`L${lineNum}`, projectType);
        break;
      case "beam":
        line = createBeamLine(`L${lineNum}`, projectType);
        break;
      case "plate":
        line = createPlateLine(`L${lineNum}`, projectType);
        break;
      default:
        line = createMiscMetalLine(`L${lineNum}`, projectType);
    }
    
    // Scale line cost to fit remaining budget if needed
    if (currentValue + line.totalCost! > projectValue * 1.1) {
      const scaleFactor = (remaining * 0.9) / line.totalCost!;
      line.materialCost = (line.materialCost || 0) * scaleFactor;
      line.laborCost = (line.laborCost || 0) * scaleFactor;
      line.coatingCost = (line.coatingCost || 0) * scaleFactor;
      line.totalCost = line.materialCost + line.laborCost + line.coatingCost;
    }
    
    lines.push(line);
    currentValue += line.totalCost || 0;
    lineNum++;
    
    // Safety break
    if (lineNum > 200) break;
  }
  
  return lines;
}

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

export async function seedMidYearData(companyId: string, useClientSDK: boolean = true) {
  if (useClientSDK) {
    // Use client-side Firebase SDK
    const { getDocRef, setDocument, createDocument } = await import("@/lib/firebase/firestore");
    const { Timestamp } = await import("firebase/firestore");
    
    console.log(`\n🌱 Seeding mid-year data for company: ${companyId}\n`);
    
    for (const projectData of PROJECTS) {
      try {
        // Create project
        const projectPath = `companies/${companyId}/projects`;
        const projectId = await createDocument(projectPath, {
          ...projectData,
          createdAt: Timestamp.fromDate(projectData.createdAt),
          updatedAt: Timestamp.fromDate(projectData.updatedAt),
        });
        
        console.log(`✅ Created project: ${projectData.projectNumber} - ${projectData.projectName}`);
        
        // Generate estimating lines
        const lines = generateEstimatingLines(projectData.estimatedValue, projectData.projectType);
        
        // Save lines
        const linesPath = `companies/${companyId}/projects/${projectId}/lines`;
        for (const line of lines) {
          await createDocument(linesPath, {
            ...line,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
        }
        
        console.log(`   └─ Created ${lines.length} estimating lines (Total: $${lines.reduce((sum, l) => sum + (l.totalCost || 0), 0).toLocaleString()})`);
        
      } catch (error) {
        console.error(`❌ Error creating project ${projectData.projectNumber}:`, error);
      }
    }
    
    console.log(`\n✨ Seed complete! Created ${PROJECTS.length} projects.\n`);
    
  } else {
    // Use Firebase Admin SDK (if configured)
    console.log("Firebase Admin SDK approach not implemented in this script.");
    console.log("Please use the client SDK approach or configure Firebase Admin.");
  }
}

// ============================================================================
// CLI EXECUTION
// ============================================================================

if (require.main === module) {
  // Run from command line
  const companyId = process.env.COMPANY_ID || COMPANY_ID;
  
  if (companyId === "YOUR_COMPANY_ID") {
    console.error("❌ Please set COMPANY_ID environment variable or update COMPANY_ID in the script.");
    process.exit(1);
  }
  
  seedMidYearData(companyId)
    .then(() => {
      console.log("✅ Seeding completed successfully!");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Seeding failed:", error);
      process.exit(1);
    });
}

