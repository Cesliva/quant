/**
 * API Route to Seed Mid-Year Sample Data
 * 
 * POST /api/seed-data
 * 
 * Creates realistic sample data for an $8M fab shop mid-year scenario.
 * Requires authentication and admin permissions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createDocument, deleteDocument, setDocument } from "@/lib/firebase/firestore";
import { Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import type { ProposalSeedType, ProposalSeedContext } from "@/lib/types/proposalSeeds";

// Import the seed function logic (we'll inline it here for API route)
// Material rates
const MATERIAL_RATE = 0.85;
const LABOR_RATE = 45.0;
const PAINT_RATE = 2.5;
const GALVANIZE_RATE = 0.55;
const SHOP_PRIMER_RATE = 1.2; // $/SF for shop primer
const ZINC_PRIMER_RATE = 1.5; // $/SF for zinc primer
const POWDER_COAT_RATE = 3.5; // $/SF for powder coat
const SPECIALTY_COATING_RATE = 4.0; // $/SF for specialty coating

// Coating systems (excluding "None" - always select a coating for seed data)
const COATING_SYSTEMS = [
  "Standard Shop Primer",
  "Zinc Primer",
  "Paint",
  "Powder Coat",
  "Galvanizing",
  "Specialty Coating"
];

// SSPC prep options (excluding "None")
const SSPC_PREP_OPTIONS = [
  "SSPC-SP 1 - Solvent Cleaning",
  "SSPC-SP 2 - Hand Tool Cleaning",
  "SSPC-SP 3 - Power Tool Cleaning",
  "SSPC-SP 6 - Commercial Blast Cleaning",
  "SSPC-SP 10 - Near-White Blast Cleaning",
];

// Map coating systems to appropriate SSPC prep options
function getSSPCPrepForCoating(coatingSystem: string): string {
  if (coatingSystem === "Standard Shop Primer" || coatingSystem === "Zinc Primer") {
    return randomChoice(["SSPC-SP 2 - Hand Tool Cleaning", "SSPC-SP 3 - Power Tool Cleaning"]);
  } else if (coatingSystem === "Paint") {
    return randomChoice(["SSPC-SP 6 - Commercial Blast Cleaning", "SSPC-SP 10 - Near-White Blast Cleaning"]);
  } else if (coatingSystem === "Powder Coat" || coatingSystem === "Specialty Coating") {
    return randomChoice(["SSPC-SP 6 - Commercial Blast Cleaning", "SSPC-SP 10 - Near-White Blast Cleaning"]);
  } else if (coatingSystem === "Galvanizing") {
    return "SSPC-SP 1 - Solvent Cleaning"; // Galvanizing typically uses solvent cleaning
  }
  return "SSPC-SP 2 - Hand Tool Cleaning"; // Default
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

// Elevation options for building projects
const ELEVATIONS = [
  "Foundation",
  "Exterior Ground Level",
  "First Floor",
  "Second Floor",
  "Third Floor",
  "Roof",
  "High Roof",
  "Mezzanine",
  "Basement",
];

// Shift the entire demo timeline forward so schedules and dashboards look current/future-dated.
// TODO: Consider making this configurable via POST body for repeatable marketing captures.
const SEED_TIME_SHIFT_DAYS = 45;
const SEED_BASE_DATE = (() => {
  const d = new Date();
  d.setDate(d.getDate() + SEED_TIME_SHIFT_DAYS);
  return d;
})();

function daysAgo(days: number): Date {
  const date = new Date(SEED_BASE_DATE);
  date.setDate(date.getDate() - days);
  return date;
}

// Estimator names for seed data
const ESTIMATOR_NAMES = [
  "Mike Johnson",
  "Sarah Chen",
  "David Rodriguez",
  "Jennifer Martinez",
  "Robert Thompson",
  "Emily Anderson",
];

// Project data (same as in seed script)
const PROJECTS = [
  // WON PROJECTS
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
  // ACTIVE BIDS
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
    assignedEstimator: "Mike Johnson",
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
    assignedEstimator: "Sarah Chen",
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
    assignedEstimator: "David Rodriguez",
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
    assignedEstimator: "Jennifer Martinez",
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
    assignedEstimator: "Robert Thompson",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(5),
  },
  // WON BUT NOT STARTED
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
    deliveryDate: daysAgo(60).toISOString().split("T")[0],
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
    deliveryDate: daysAgo(75).toISOString().split("T")[0],
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
    deliveryDate: daysAgo(80).toISOString().split("T")[0],
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
  // LOST PROJECTS
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

// Helper to generate detailed labor breakdown based on total hours
function generateLaborBreakdown(totalHours: number, category: string): {
  laborUnload: number;
  laborCut: number;
  laborCope: number;
  laborProcessPlate: number;
  laborDrillPunch: number;
  laborFit: number;
  laborWeld: number;
  laborPrepClean: number;
  laborPaint: number;
  laborHandleMove: number;
  laborLoadShip: number;
} {
  // Different categories have different labor distributions
  if (category === "Columns") {
    return {
      laborUnload: totalHours * randomBetween(0.03, 0.05),
      laborCut: totalHours * randomBetween(0.08, 0.12),
      laborCope: totalHours * randomBetween(0.02, 0.04),
      laborProcessPlate: 0,
      laborDrillPunch: totalHours * randomBetween(0.10, 0.15),
      laborFit: totalHours * randomBetween(0.15, 0.20),
      laborWeld: totalHours * randomBetween(0.20, 0.28),
      laborPrepClean: totalHours * randomBetween(0.05, 0.08),
      laborPaint: totalHours * randomBetween(0.08, 0.12),
      laborHandleMove: totalHours * randomBetween(0.06, 0.10),
      laborLoadShip: totalHours * randomBetween(0.04, 0.06),
    };
  } else if (category === "Beams") {
    return {
      laborUnload: totalHours * randomBetween(0.04, 0.06),
      laborCut: totalHours * randomBetween(0.10, 0.14),
      laborCope: totalHours * randomBetween(0.08, 0.12),
      laborProcessPlate: 0,
      laborDrillPunch: totalHours * randomBetween(0.12, 0.16),
      laborFit: totalHours * randomBetween(0.12, 0.18),
      laborWeld: totalHours * randomBetween(0.18, 0.24),
      laborPrepClean: totalHours * randomBetween(0.04, 0.07),
      laborPaint: totalHours * randomBetween(0.06, 0.10),
      laborHandleMove: totalHours * randomBetween(0.05, 0.08),
      laborLoadShip: totalHours * randomBetween(0.03, 0.05),
    };
  } else if (category === "Plates") {
    return {
      laborUnload: totalHours * randomBetween(0.02, 0.04),
      laborCut: totalHours * randomBetween(0.15, 0.22),
      laborCope: 0,
      laborProcessPlate: totalHours * randomBetween(0.12, 0.18),
      laborDrillPunch: totalHours * randomBetween(0.15, 0.22),
      laborFit: totalHours * randomBetween(0.10, 0.15),
      laborWeld: totalHours * randomBetween(0.12, 0.18),
      laborPrepClean: totalHours * randomBetween(0.05, 0.08),
      laborPaint: totalHours * randomBetween(0.06, 0.10),
      laborHandleMove: totalHours * randomBetween(0.04, 0.06),
      laborLoadShip: totalHours * randomBetween(0.02, 0.04),
    };
  } else {
    // Misc Metals
    return {
      laborUnload: totalHours * randomBetween(0.03, 0.05),
      laborCut: totalHours * randomBetween(0.12, 0.18),
      laborCope: totalHours * randomBetween(0.04, 0.08),
      laborProcessPlate: totalHours * randomBetween(0.02, 0.05),
      laborDrillPunch: totalHours * randomBetween(0.10, 0.15),
      laborFit: totalHours * randomBetween(0.14, 0.20),
      laborWeld: totalHours * randomBetween(0.16, 0.22),
      laborPrepClean: totalHours * randomBetween(0.04, 0.07),
      laborPaint: totalHours * randomBetween(0.06, 0.10),
      laborHandleMove: totalHours * randomBetween(0.05, 0.08),
      laborLoadShip: totalHours * randomBetween(0.03, 0.05),
    };
  }
}

// Simplified line generators (same logic as seed script)
function createColumnLine(lineId: string): EstimatingLine {
  const sizes = ["W12x65", "W14x90", "W16x100", "W18x119", "W21x147"];
  const size = randomChoice(sizes);
  const grade = randomChoice(["A992", "A572 Gr50", "A36"]);
  const lengthFt = randomInt(12, 30);
  const qty = randomInt(4, 24);
  const weightMap: Record<string, number> = {
    "W12x65": 65, "W14x90": 90, "W16x100": 100, "W18x119": 119, "W21x147": 147,
  };
  const weightPerFoot = weightMap[size] || 100;
  const totalWeight = weightPerFoot * lengthFt * qty; // Weight in pounds (lbs)
  const materialCost = totalWeight * MATERIAL_RATE; // Material rate is $/lb
  const laborHours = (totalWeight / 2000) * randomBetween(8, 12); // Labor hours based on tons
  const laborBreakdown = generateLaborBreakdown(laborHours, "Columns");
  const laborCost = laborHours * LABOR_RATE;
  
  // Always select a coating system for seed data (no "None")
  const coatingSystem = randomChoice(COATING_SYSTEMS);
  const sspcPrep = getSSPCPrepForCoating(coatingSystem);
  
  // Calculate surface area (approximate: 1 lb steel ≈ 0.15 SF surface area)
  const totalSurfaceArea = totalWeight * 0.15;
  const surfaceAreaPerFoot = weightPerFoot * 0.15;
  
  let coatingCost = 0;
  let coatingRate = 0;
  
  if (coatingSystem === "Paint") {
    coatingRate = PAINT_RATE;
    coatingCost = totalSurfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Galvanizing") {
    coatingRate = GALVANIZE_RATE;
    coatingCost = totalWeight * GALVANIZE_RATE; // Galvanizing is per pound
  } else if (coatingSystem === "Standard Shop Primer") {
    coatingRate = SHOP_PRIMER_RATE;
    coatingCost = totalSurfaceArea * SHOP_PRIMER_RATE;
  } else if (coatingSystem === "Zinc Primer") {
    coatingRate = ZINC_PRIMER_RATE;
    coatingCost = totalSurfaceArea * ZINC_PRIMER_RATE;
  } else if (coatingSystem === "Powder Coat") {
    coatingRate = POWDER_COAT_RATE;
    coatingCost = totalSurfaceArea * POWDER_COAT_RATE;
  } else if (coatingSystem === "Specialty Coating") {
    coatingRate = SPECIALTY_COATING_RATE;
    coatingCost = totalSurfaceArea * SPECIALTY_COATING_RATE;
  }
  
  // Generate hardware data (30% of columns have hardware)
  const hasHardware = Math.random() < 0.3;
  const hardwareBoltDiameter = hasHardware ? randomChoice(["3/4", "7/8", "1", "1-1/4"]) : undefined;
  const hardwareBoltType = hasHardware ? randomChoice(["A325", "A490", "A307"]) : undefined;
  const hardwareQuantity = hasHardware ? randomInt(8, 32) * qty : undefined;
  const hardwareCostPerSet = hasHardware ? randomBetween(2.50, 8.00) : undefined;
  const hardwareCost = hasHardware && hardwareQuantity && hardwareCostPerSet ? hardwareQuantity * hardwareCostPerSet : 0;
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} Column - ${lengthFt}' long`,
    elevation: randomChoice(ELEVATIONS),
    category: "Columns",
    subCategory: "Main Column",
    workType: "STRUCTURAL" as const,
    materialType: "Material" as const,
    shapeType: "W" as const,
    sizeDesignation: size,
    grade,
    lengthFt,
    qty,
    weightPerFoot,
    totalWeight,
    surfaceAreaPerFoot,
    totalSurfaceArea,
    coatingSystem,
    sspcPrep,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate,
    coatingCost,
    hardwareBoltDiameter,
    hardwareBoltType,
    hardwareQuantity,
    hardwareCostPerSet,
    hardwareCost,
    totalCost: materialCost + laborCost + coatingCost + hardwareCost,
    status: "Active" as const,
    isMainMember: true,
    useStockRounding: randomChoice([true, false]),
    notes: Math.random() < 0.2 ? randomChoice([
      "Full penetration welds required at base",
      "Check shop drawing approval before fabrication",
      "Coordinate with foundation contractor",
      "Special handling required due to length",
    ]) : undefined,
  };
}

function createBeamLine(lineId: string): EstimatingLine {
  const sizes = ["W16x40", "W18x50", "W21x62", "W24x76", "W27x94"];
  const size = randomChoice(sizes);
  const grade = randomChoice(["A992", "A572 Gr50"]);
  const lengthFt = randomInt(20, 40);
  const qty = randomInt(6, 30);
  const weightMap: Record<string, number> = {
    "W16x40": 40, "W18x50": 50, "W21x62": 62, "W24x76": 76, "W27x94": 94,
  };
  const weightPerFoot = weightMap[size] || 60;
  const totalWeight = weightPerFoot * lengthFt * qty; // Weight in pounds (lbs)
  const materialCost = totalWeight * MATERIAL_RATE; // Material rate is $/lb
  const laborHours = (totalWeight / 2000) * randomBetween(7, 11); // Labor hours based on tons
  const laborBreakdown = generateLaborBreakdown(laborHours, "Beams");
  const laborCost = laborHours * LABOR_RATE;
  
  // Always select a coating system for seed data (no "None")
  const coatingSystem = randomChoice(COATING_SYSTEMS);
  const sspcPrep = getSSPCPrepForCoating(coatingSystem);
  
  // Calculate surface area (approximate: 1 lb steel ≈ 0.15 SF surface area)
  const totalSurfaceArea = totalWeight * 0.15;
  const surfaceAreaPerFoot = weightPerFoot * 0.15;
  
  let coatingCost = 0;
  let coatingRate = 0;
  
  if (coatingSystem === "Paint") {
    coatingRate = PAINT_RATE;
    coatingCost = totalSurfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Galvanizing") {
    coatingRate = GALVANIZE_RATE;
    coatingCost = totalWeight * GALVANIZE_RATE; // Galvanizing is per pound
  } else if (coatingSystem === "Standard Shop Primer") {
    coatingRate = SHOP_PRIMER_RATE;
    coatingCost = totalSurfaceArea * SHOP_PRIMER_RATE;
  } else if (coatingSystem === "Zinc Primer") {
    coatingRate = ZINC_PRIMER_RATE;
    coatingCost = totalSurfaceArea * ZINC_PRIMER_RATE;
  } else if (coatingSystem === "Powder Coat") {
    coatingRate = POWDER_COAT_RATE;
    coatingCost = totalSurfaceArea * POWDER_COAT_RATE;
  } else if (coatingSystem === "Specialty Coating") {
    coatingRate = SPECIALTY_COATING_RATE;
    coatingCost = totalSurfaceArea * SPECIALTY_COATING_RATE;
  }
  
  // Generate hardware data (40% of beams have hardware)
  const hasHardware = Math.random() < 0.4;
  const hardwareBoltDiameter = hasHardware ? randomChoice(["3/4", "7/8", "1"]) : undefined;
  const hardwareBoltType = hasHardware ? randomChoice(["A325", "A490"]) : undefined;
  const hardwareQuantity = hasHardware ? randomInt(12, 48) * qty : undefined;
  const hardwareCostPerSet = hasHardware ? randomBetween(2.50, 6.00) : undefined;
  const hardwareCost = hasHardware && hardwareQuantity && hardwareCostPerSet ? hardwareQuantity * hardwareCostPerSet : 0;
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} Beam - ${lengthFt}' long`,
    elevation: randomChoice(ELEVATIONS),
    category: "Beams",
    subCategory: "Main Beam",
    workType: "STRUCTURAL" as const,
    materialType: "Material" as const,
    shapeType: "W" as const,
    sizeDesignation: size,
    grade,
    lengthFt,
    qty,
    weightPerFoot,
    totalWeight,
    surfaceAreaPerFoot,
    totalSurfaceArea,
    coatingSystem,
    sspcPrep,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate,
    coatingCost,
    hardwareBoltDiameter,
    hardwareBoltType,
    hardwareQuantity,
    hardwareCostPerSet,
    hardwareCost,
    totalCost: materialCost + laborCost + coatingCost + hardwareCost,
    status: "Active" as const,
    isMainMember: true,
  };
}

function createPlateLine(lineId: string): EstimatingLine {
  const thickness = randomChoice([0.25, 0.375, 0.5, 0.625, 0.75, 1.0]);
  const width = randomInt(12, 48);
  const plateLength = randomInt(24, 120);
  const plateQty = randomInt(4, 20);
  const plateGrade = randomChoice(["A36", "A572 Gr50", "A992"]);
  // Plate weight calculation: thickness (in) × width (in) × length (in) × density (0.2833 lbs/in³) × quantity
  // Result is in pounds (lbs)
  const plateTotalWeight = (thickness * width * plateLength * 0.2833 * plateQty) / 1728; // Already in lbs
  const plateArea = (width * plateLength * plateQty) / 144;
  const plateSurfaceArea = plateArea * 2;
  const materialCost = plateTotalWeight * MATERIAL_RATE; // Material rate is $/lb
  const laborHours = (plateTotalWeight / 2000) * randomBetween(10, 15); // Labor hours based on tons
  const laborBreakdown = generateLaborBreakdown(laborHours, "Plates");
  const laborCost = laborHours * LABOR_RATE;
  
  // Always select a coating system for seed data (no "None")
  // For plates, prefer primer or paint (not galvanizing typically)
  const plateCoatingOptions = ["Standard Shop Primer", "Zinc Primer", "Paint", "Powder Coat"];
  const coatingSystem = randomChoice(plateCoatingOptions);
  const sspcPrep = getSSPCPrepForCoating(coatingSystem);
  
  let coatingCost = 0;
  let coatingRate = 0;
  
  if (coatingSystem === "Paint") {
    coatingRate = PAINT_RATE;
    coatingCost = plateSurfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Standard Shop Primer") {
    coatingRate = SHOP_PRIMER_RATE;
    coatingCost = plateSurfaceArea * SHOP_PRIMER_RATE;
  } else if (coatingSystem === "Zinc Primer") {
    coatingRate = ZINC_PRIMER_RATE;
    coatingCost = plateSurfaceArea * ZINC_PRIMER_RATE;
  } else if (coatingSystem === "Powder Coat") {
    coatingRate = POWDER_COAT_RATE;
    coatingCost = plateSurfaceArea * POWDER_COAT_RATE;
  }
  
  // Generate hardware data (20% of plates have hardware)
  const hasHardware = Math.random() < 0.2;
  const hardwareBoltDiameter = hasHardware ? randomChoice(["5/8", "3/4", "7/8"]) : undefined;
  const hardwareBoltType = hasHardware ? randomChoice(["A325", "A307"]) : undefined;
  const hardwareQuantity = hasHardware ? randomInt(4, 16) * plateQty : undefined;
  const hardwareCostPerSet = hasHardware ? randomBetween(1.50, 4.00) : undefined;
  const hardwareCost = hasHardware && hardwareQuantity && hardwareCostPerSet ? hardwareQuantity * hardwareCostPerSet : 0;
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${thickness}" x ${width}" x ${plateLength}" ${plateGrade} Plate`,
    elevation: randomChoice(ELEVATIONS),
    category: "Plates",
    subCategory: randomChoice(["Base Plate", "Gusset", "Stiffener", "Clip"]),
    workType: "STRUCTURAL" as const,
    materialType: "Plate" as const,
    thickness,
    width,
    plateLength,
    plateQty,
    plateGrade,
    plateArea,
    plateSurfaceArea,
    plateTotalWeight,
    oneSideCoat: Math.random() < 0.1, // 10% are one-side coat only
    coatingSystem,
    sspcPrep,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate,
    coatingCost,
    hardwareBoltDiameter,
    hardwareBoltType,
    hardwareQuantity,
    hardwareCostPerSet,
    hardwareCost,
    totalCost: materialCost + laborCost + coatingCost + hardwareCost,
    status: "Active" as const,
    useStockRounding: false, // Plates typically don't use stock rounding
    notes: Math.random() < 0.15 ? randomChoice([
      "Check thickness tolerance",
      "Verify plate grade per spec",
      "Coordinate with connection details",
    ]) : undefined,
  };
}

function createMiscMetalLine(lineId: string): EstimatingLine {
  const types = ["HSS", "C", "L"];
  const type = randomChoice(types);
  const sizes = type === "HSS" ? ["HSS6x6x1/4", "HSS8x8x3/8", "HSS10x10x1/2"] :
                 type === "C" ? ["C12x20.7", "C15x33.9"] : ["L4x4x1/4", "L6x6x3/8"];
  const size = randomChoice(sizes);
  const grade = randomChoice(["A500", "A36", "A572 Gr50"]);
  const lengthFt = randomInt(8, 20);
  const qty = randomInt(10, 50);
  const weightPerFoot = randomBetween(15, 35);
  const totalWeight = weightPerFoot * lengthFt * qty; // Weight in pounds (lbs)
  const materialCost = totalWeight * MATERIAL_RATE; // Material rate is $/lb
  const laborHours = (totalWeight / 2000) * randomBetween(12, 18); // Labor hours based on tons
  const laborBreakdown = generateLaborBreakdown(laborHours, "Misc Metals");
  const laborCost = laborHours * LABOR_RATE;
  
  // Always select a coating system for seed data (no "None")
  // For misc metals, prefer primer or paint
  const miscCoatingOptions = ["Standard Shop Primer", "Zinc Primer", "Paint"];
  const coatingSystem = randomChoice(miscCoatingOptions);
  const sspcPrep = getSSPCPrepForCoating(coatingSystem);
  
  // Calculate surface area (approximate: 1 lb steel ≈ 0.15 SF surface area)
  const totalSurfaceArea = totalWeight * 0.15;
  const surfaceAreaPerFoot = weightPerFoot * 0.15;
  
  let coatingCost = 0;
  let coatingRate = 0;
  
  if (coatingSystem === "Paint") {
    coatingRate = PAINT_RATE;
    coatingCost = totalSurfaceArea * PAINT_RATE;
  } else if (coatingSystem === "Standard Shop Primer") {
    coatingRate = SHOP_PRIMER_RATE;
    coatingCost = totalSurfaceArea * SHOP_PRIMER_RATE;
  } else if (coatingSystem === "Zinc Primer") {
    coatingRate = ZINC_PRIMER_RATE;
    coatingCost = totalSurfaceArea * ZINC_PRIMER_RATE;
  }
  
  // Generate hardware data (50% of misc metals have hardware)
  const hasHardware = Math.random() < 0.5;
  const hardwareBoltDiameter = hasHardware ? randomChoice(["1/2", "5/8", "3/4"]) : undefined;
  const hardwareBoltType = hasHardware ? randomChoice(["A325", "A307"]) : undefined;
  const hardwareQuantity = hasHardware ? randomInt(2, 12) * qty : undefined;
  const hardwareCostPerSet = hasHardware ? randomBetween(1.00, 3.50) : undefined;
  const hardwareCost = hasHardware && hardwareQuantity && hardwareCostPerSet ? hardwareQuantity * hardwareCostPerSet : 0;
  
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} ${type} - ${lengthFt}' long`,
    elevation: randomChoice(ELEVATIONS),
    category: "Misc Metals",
    subCategory: randomChoice(["Brace", "Clip", "Angle", "Connection"]),
    workType: "MISC" as const,
    miscMethod: "DETAILED" as const,
    materialType: "Material" as const,
    shapeType: type as any,
    sizeDesignation: size,
    grade,
    lengthFt,
    qty,
    weightPerFoot,
    totalWeight,
    surfaceAreaPerFoot,
    totalSurfaceArea,
    coatingSystem,
    sspcPrep,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate,
    coatingCost,
    hardwareBoltDiameter,
    hardwareBoltType,
    hardwareQuantity,
    hardwareCostPerSet,
    hardwareCost,
    totalCost: materialCost + laborCost + coatingCost + hardwareCost,
    status: "Active" as const,
    useStockRounding: randomChoice([true, false]),
    notes: Math.random() < 0.2 ? randomChoice([
      "Verify connection details",
      "Check material availability",
      "Coordinate with structural steel",
    ]) : undefined,
  };
}

function generateEstimatingLines(projectValue: number): EstimatingLine[] {
  const lines: EstimatingLine[] = [];
  let currentValue = 0;
  let lineNum = 1;
  while (currentValue < projectValue * 0.95 && lineNum <= 200) {
    const remaining = projectValue - currentValue;
    const lineType = randomChoice(["column", "beam", "plate", "misc"]);
    let line: EstimatingLine;
    switch (lineType) {
      case "column": line = createColumnLine(`L${lineNum}`); break;
      case "beam": line = createBeamLine(`L${lineNum}`); break;
      case "plate": line = createPlateLine(`L${lineNum}`); break;
      default: line = createMiscMetalLine(`L${lineNum}`);
    }
    if (currentValue + (line.totalCost || 0) > projectValue * 1.1) {
      const scaleFactor = (remaining * 0.9) / (line.totalCost || 1);
      line.materialCost = (line.materialCost || 0) * scaleFactor;
      line.laborCost = (line.laborCost || 0) * scaleFactor;
      line.coatingCost = (line.coatingCost || 0) * scaleFactor;
      line.hardwareCost = (line.hardwareCost || 0) * scaleFactor;
      line.totalCost = (line.materialCost || 0) + (line.laborCost || 0) + (line.coatingCost || 0) + (line.hardwareCost || 0);
    }
    lines.push(line);
    currentValue += line.totalCost || 0;
    lineNum++;
  }
  return lines;
}

// Proposal seed templates for realistic demo data
const PROPOSAL_SEED_TEMPLATES: Record<ProposalSeedType, string[]> = {
  exclusion: [
    "Exclude field touch-up paint",
    "Exclude permits and engineering stamps",
    "Erection by others",
    "Exclude anchor bolts and templates",
    "Exclude shipping and delivery",
    "Exclude field welding",
    "Exclude fireproofing",
    "Exclude galvanizing",
    "Exclude powder coating",
    "Exclude specialty metals (stainless, weathering steel)",
    "Exclude delegated design",
    "Exclude BIM modeling",
    "Exclude shop drawings for miscellaneous metals",
    "Exclude material handling at job site",
    "Exclude crane rental and rigging",
    "Exclude temporary bracing",
    "Exclude field modifications",
    "Exclude warranty beyond standard AISC",
    // Misc metals specific exclusions
    "Exclude stair nosings and tread finishes",
    "Exclude glass railing infill",
    "Exclude cable rail tensioning",
    "Exclude ladder cage fabrication",
    "Exclude roof access hatch coordination",
    "Exclude decorative metal finishes",
    "Exclude stair handrail installation",
  ],
  inclusion: [
    "Include anchor bolts and templates",
    "Include shop primer only",
    "Include material handling to staging area",
    "Include shop drawings",
    "Include structural steel fabrication",
    "Include miscellaneous metals fabrication",
    "Include standard shop primer (SSPC-SP 2)",
    "Include delivery to job site",
    "Include material offloading",
    "Include connection hardware (bolts, washers, nuts)",
    "Include shop drawings for structural steel",
    "Include standard AISC tolerances",
    "Include QA/QC inspection",
    "Include material certifications",
    "Include erection drawings",
    // Misc metals specific inclusions
    "Include steel stairs with stringers, treads, and landings",
    "Include handrails and guardrails per code requirements",
    "Include roof access ladders with safety cages",
    "Include connection hardware for all misc metals",
    "Include shop drawings for stairs, rails, and ladders",
    "Include ladder safety cages and fall protection",
    "Include rail post bases and anchoring",
  ],
  clarification: [
    "Clarify: electrical work by others",
    "Clarify: foundation work by others",
    "Clarify: concrete work by others",
    "Clarify: coating system per Division 9 specifications",
    "Clarify: connection design responsibility",
    "Clarify: material grade per structural drawings",
    "Clarify: shop drawing approval process",
    "Clarify: delivery schedule coordination",
    "Clarify: field welding requirements",
    "Clarify: special inspection requirements",
    "Clarify: material handling at site",
    "Clarify: erection sequence and phasing",
    // Misc metals specific clarifications
    "Clarify: Stair tread finish and nosing requirements",
    "Clarify: Rail post spacing and infill type",
    "Clarify: Ladder access requirements and safety cage specifications",
    "Clarify: Misc metals coating requirements vs structural steel",
    "Clarify: Stair landing connection details",
    "Clarify: Rail mounting method (surface vs embedded)",
  ],
  assumption: [
    "Assume standard shop primer (SSPC-SP 2)",
    "Assume AISC tolerances",
    "Assume standard delivery within 50 miles",
    "Assume normal shop hours (no overtime)",
    "Assume material availability within 4 weeks",
    "Assume standard connection details",
    "Assume A992 material grade unless specified",
    "Assume standard fabrication practices",
    "Assume shop drawings approved within 2 weeks",
    "Assume no escalation beyond 30 days",
    "Assume standard QA/QC procedures",
    "Assume normal working conditions",
    // Misc metals specific assumptions
    "Assume standard stair tread configuration",
    "Assume code-compliant rail heights and spacing",
    "Assume standard ladder rung spacing per OSHA",
    "Assume shop welding for all misc metals connections",
  ],
  allowance: [
    "Allowance for field modifications: $5,000",
    "Allowance for additional material: 5%",
    "Allowance for schedule acceleration: $10,000",
    "Allowance for design changes: $15,000",
    "Allowance for material escalation: 3%",
    "Allowance for field adjustments: $7,500",
    "Allowance for additional connections: $8,000",
    "Allowance for scope additions: 10%",
    // Misc metals specific allowances
    "Allowance for stair modifications: $3,000",
    "Allowance for rail adjustments: $2,500",
  ],
};

/**
 * Generate proposal seeds for a project
 * Creates a realistic mix of inclusions, exclusions, clarifications, assumptions, and allowances
 */
function generateProposalSeeds(
  projectId: string,
  projectType: string | undefined,
  lines: EstimatingLine[],
  createdBy: string = "system"
): Array<{
  projectId: string;
  type: ProposalSeedType;
  text: string;
  context: ProposalSeedContext;
  createdBy: string;
  status: "active";
}> {
  const seeds: Array<{
    projectId: string;
    type: ProposalSeedType;
    text: string;
    context: ProposalSeedContext;
    createdBy: string;
    status: "active";
  }> = [];

  // Generate 2-5 exclusions (most common)
  const exclusionCount = randomInt(2, 5);
  for (let i = 0; i < exclusionCount; i++) {
    const text = randomChoice(PROPOSAL_SEED_TEMPLATES.exclusion);
    const line = randomChoice(lines);
    seeds.push({
      projectId,
      type: "exclusion",
      text,
      context: {
        lineItemId: line?.lineId,
        drawing: line?.drawingNumber,
        detail: line?.detailNumber,
        category: line?.category,
      },
      createdBy,
      status: "active",
    });
  }

  // Generate 2-4 inclusions
  const inclusionCount = randomInt(2, 4);
  for (let i = 0; i < inclusionCount; i++) {
    const text = randomChoice(PROPOSAL_SEED_TEMPLATES.inclusion);
    const line = randomChoice(lines);
    seeds.push({
      projectId,
      type: "inclusion",
      text,
      context: {
        lineItemId: line?.lineId,
        drawing: line?.drawingNumber,
        detail: line?.detailNumber,
        category: line?.category,
      },
      createdBy,
      status: "active",
    });
  }

  // Generate 1-3 clarifications
  const clarificationCount = randomInt(1, 3);
  for (let i = 0; i < clarificationCount; i++) {
    const text = randomChoice(PROPOSAL_SEED_TEMPLATES.clarification);
    seeds.push({
      projectId,
      type: "clarification",
      text,
      context: {},
      createdBy,
      status: "active",
    });
  }

  // Generate 2-4 assumptions
  const assumptionCount = randomInt(2, 4);
  for (let i = 0; i < assumptionCount; i++) {
    const text = randomChoice(PROPOSAL_SEED_TEMPLATES.assumption);
    seeds.push({
      projectId,
      type: "assumption",
      text,
      context: {},
      createdBy,
      status: "active",
    });
  }

  // Generate 0-2 allowances (less common)
  const allowanceCount = randomInt(0, 2);
  for (let i = 0; i < allowanceCount; i++) {
    const text = randomChoice(PROPOSAL_SEED_TEMPLATES.allowance);
    seeds.push({
      projectId,
      type: "allowance",
      text,
      context: {},
      createdBy,
      status: "active",
    });
  }

  return seeds;
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, timeShiftDays } = await request.json();
    
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    // Optional knob for marketing captures: move the entire demo timeline forward/back.
    // Example: { companyId, timeShiftDays: 90 }
    if (typeof timeShiftDays === "number" && Number.isFinite(timeShiftDays)) {
      const d = new Date();
      d.setDate(d.getDate() + timeShiftDays);
      // @ts-expect-error - mutate module-level seed base date for this run
      SEED_BASE_DATE.setTime(d.getTime());
    }

    const results = {
      projectsCreated: 0,
      linesCreated: 0,
      bidEventsCreated: 0,
      productionEntriesCreated: 0,
      winLossRecordsCreated: 0,
      specReviewsCreated: 0,
      proposalSeedsCreated: 0,
      errors: [] as string[],
    };

    // Ensure company settings are demo-ready (powers multiple dashboards/filters)
    try {
      await setDocument(
        `companies/${companyId}`,
        {
          settings: {
            showSampleData: true,
            // Executive dashboard + backlog widgets
            shopCapacityHoursPerWeek: 800,
            shopCapacityHoursPerDay: 160,
            backlogForecastWeeks: 24,
            underUtilizedThreshold: 0.7,
            // Pipeline bucketing (used by dashboards)
            pipelineRanges: {
              small: { min: 0, max: 250000 },
              medium: { min: 250000, max: 750000 },
              large: { min: 750000, max: 1500000 },
              xlarge: { min: 1500000, max: 4000000 },
              xxlarge: { min: 4000000, max: 999999999 },
            },
            // Estimator workload panel
            estimators: ESTIMATOR_NAMES.map((name) => ({
              name,
              weeklyCapacityHours: 40,
              active: true,
            })),
          },
        },
        true
      );
    } catch (e) {
      results.errors.push(`Warning: failed to update company settings for demo mode: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    const createdProjects: Array<{
      id: string;
      projectName: string;
      projectNumber: string;
      status: string;
      bidDate?: string;
      decisionDate?: string;
      estimatedValue?: number;
      awardValue?: number;
      generalContractor?: string;
      gcId?: string;
      projectType?: string;
      createdAt: Date;
      updatedAt: Date;
    }> = [];

    for (const projectData of PROJECTS) {
      try {
        const projectPath = `companies/${companyId}/projects`;
        const projectId = await createDocument(projectPath, {
          ...projectData,
          // Also set bidDate from bidDueDate for consistency
          bidDate: projectData.bidDueDate || projectData.bidDate,
          isSampleData: true, // Mark as sample data for training
          createdAt: Timestamp.fromDate(projectData.createdAt),
          updatedAt: Timestamp.fromDate(projectData.updatedAt),
        });

        const lines = generateEstimatingLines(projectData.estimatedValue);
        const linesPath = `companies/${companyId}/projects/${projectId}/lines`;
        
        for (const line of lines) {
          await createDocument(linesPath, {
            ...line,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });
          results.linesCreated++;
        }

        // Create proposal seeds (inclusions/exclusions/clarifications/assumptions/allowances)
        try {
          const proposalSeeds = generateProposalSeeds(
            projectId,
            projectData.projectType,
            lines,
            "system"
          );
          const seedsPath = `companies/${companyId}/projects/${projectId}/proposalSeeds`;
          
          for (const seed of proposalSeeds) {
            await createDocument(seedsPath, {
              ...seed,
              createdAt: Timestamp.fromDate(projectData.createdAt),
              updatedAt: Timestamp.fromDate(projectData.updatedAt),
            });
            results.proposalSeedsCreated++;
          }
        } catch (e) {
          results.errors.push(`Warning: failed to seed proposal seeds for ${projectData.projectNumber}: ${e instanceof Error ? e.message : "Unknown error"}`);
        }

        // Create bid events for projects with bidDueDate
        if (projectData.bidDueDate) {
          const bidEventsPath = `companies/${companyId}/bidEvents`;
          const bidStatus = projectData.status === "won" ? "won" :
                           projectData.status === "lost" ? "lost" :
                           projectData.status === "active" ? "active" : "submitted";
          
          await createDocument(bidEventsPath, {
            date: projectData.bidDueDate,
            projectName: projectData.projectName,
            projectId: projectId,
            generalContractor: projectData.generalContractor,
            bidTime: `${randomInt(8, 16)}:${randomChoice(["00", "30"])}`,
            status: bidStatus,
            estimatedValue: projectData.estimatedValue || 0,
            notes: bidStatus === "won" ? "Awarded project" : 
                   bidStatus === "lost" ? "Lost to competitor" : 
                   "Bid submitted",
            createdAt: Timestamp.fromDate(projectData.createdAt),
            updatedAt: Timestamp.fromDate(projectData.updatedAt),
          });
          results.bidEventsCreated++;
        }

        // Create production entries for won projects with fab windows
        if (projectData.status === "won" && projectData.fabWindowStart && projectData.fabWindowEnd && projectData.fabHours) {
          const productionEntriesPath = `companies/${companyId}/productionEntries`;
          const startDate = new Date(projectData.fabWindowStart);
          const endDate = new Date(projectData.fabWindowEnd);
          
          // Calculate weeks between start and end
          const weeksDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
          const weeklyHours = projectData.fabHours / Math.max(weeksDiff, 1);
          
          // Create daily overrides for some variation
          const overrides: Record<string, number> = {};
          const workingDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
          let currentDate = new Date(startDate);
          let dayCount = 0;
          
          while (currentDate <= endDate && dayCount < 50) {
            const dayOfWeek = currentDate.toLocaleDateString("en-US", { weekday: "long" });
            if (workingDays.includes(dayOfWeek)) {
              // Add some variation: ±20% on random days
              if (Math.random() > 0.7) {
                const dateKey = currentDate.toISOString().split("T")[0];
                const baseDailyHours = weeklyHours / 5;
                overrides[dateKey] = baseDailyHours * randomBetween(0.8, 1.2);
              }
            }
            currentDate.setDate(currentDate.getDate() + 1);
            dayCount++;
          }
          
          await createDocument(productionEntriesPath, {
            projectName: projectData.projectName,
            projectId: projectId,
            startDate: projectData.fabWindowStart,
            endDate: projectData.fabWindowEnd,
            totalHours: projectData.fabHours,
            overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
            createdAt: Timestamp.fromDate(startDate),
            updatedAt: Timestamp.fromDate(endDate),
          });
          results.productionEntriesCreated++;
        }

        createdProjects.push({
          id: projectId,
          projectName: projectData.projectName,
          projectNumber: projectData.projectNumber,
          status: projectData.status,
          bidDate: projectData.bidDueDate || projectData.bidDate,
          decisionDate: projectData.decisionDate,
          estimatedValue: projectData.estimatedValue,
          awardValue: projectData.awardValue,
          generalContractor: projectData.generalContractor,
          gcId: (projectData as any).gcId,
          projectType: projectData.projectType,
          createdAt: projectData.createdAt,
          updatedAt: projectData.updatedAt,
        });

        results.projectsCreated++;
      } catch (error) {
        const errorMsg = `Error creating project ${projectData.projectNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
        results.errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Seed win/loss records to power Executive KPIs / WinLoss widgets (marketing-ready)
    try {
      const recordsPath = `companies/${companyId}/winLossRecords`;
      for (const p of createdProjects) {
        const status = p.status?.toLowerCase();
        if (status !== "won" && status !== "lost") continue;

        const bidDate = p.bidDate || new Date().toISOString().split("T")[0];
        const decisionDate =
          p.decisionDate || new Date(p.updatedAt).toISOString().split("T")[0];

        await createDocument(recordsPath, {
          projectId: p.id,
          projectName: p.projectName || p.projectNumber,
          bidDate,
          decisionDate,
          bidAmount: p.estimatedValue || 0,
          projectValue: p.awardValue || p.estimatedValue || 0,
          status,
          gcId: p.gcId,
          projectType: p.projectType,
          isSampleData: true,
          createdAt: Timestamp.fromDate(p.createdAt),
          updatedAt: Timestamp.fromDate(p.updatedAt),
        } as any);
        results.winLossRecordsCreated++;
      }
    } catch (e) {
      results.errors.push(`Warning: failed to seed win/loss records: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Seed spec review outputs to power risk dashboards + reports (marketing-ready)
    try {
      const reviewTypes = ["structural-steel", "misc-metals", "div-01", "div-09", "aess-noma", "div-03"];
      const grades = ["A", "B", "C", "D"] as const;

      for (const p of createdProjects) {
        // Focus on active/submitted to show “in-progress” risk signals
        const status = p.status?.toLowerCase();
        if (status !== "active" && status !== "submitted") continue;

        for (const type of reviewTypes) {
          const grade = randomChoice([...grades]);
          const riskPct = grade === "A" ? randomInt(5, 20) : grade === "B" ? randomInt(20, 40) : grade === "C" ? randomInt(40, 65) : randomInt(65, 85);
          const createdAt = Timestamp.fromDate(daysAgo(randomInt(5, 25)));
          const updatedAt = Timestamp.fromDate(daysAgo(randomInt(0, 4)));

          await setDocument(
            `companies/${companyId}/projects/${p.id}/specReviews/${type}`,
            {
              type,
              isSampleData: true,
              createdAt,
              updatedAt,
              // Minimal but rich-enough structure for dashboards + reports
              result: {
                summary: {
                  overallRiskGrade: grade,
                  riskPercentage: riskPct,
                  executiveSummary:
                    "Automated spec scan highlights scope ambiguities, coating requirements, and schedule-driven risks.",
                },
                keyRisks: [
                  { title: "Coating system ambiguity", severity: grade === "A" ? "low" : "medium", note: "Verify primer/finish requirements and warranty language." },
                  { title: "Connection responsibility", severity: grade === "A" ? "low" : "high", note: "Clarify delegated design and RFI flow." },
                  { title: "Schedule pressure", severity: riskPct > 50 ? "high" : "medium", note: "Confirm long-lead material + detailing constraints." },
                ],
                assumptions: [
                  "No escalation beyond standard steel pricing index.",
                  "Normal shop hours; overtime not included unless awarded.",
                  "Standard QA/QC; special inspections excluded unless noted.",
                ],
                recommendations: [
                  "Submit 2–3 RFIs early to lock scope and reduce change exposure.",
                  "Confirm coating spec section for DF/T and surface prep requirements.",
                  "Align fab window with GC milestone schedule before final pricing.",
                ],
              },
            } as any,
            true
          );
          results.specReviewsCreated++;
        }
      }
    } catch (e) {
      results.errors.push(`Warning: failed to seed spec reviews: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    // Add additional standalone bid events for variety (not tied to projects)
    const bidEventsPath = `companies/${companyId}/bidEvents`;
    const today = new Date();
    const additionalBids = [
      // Past bids
      {
        date: daysAgo(3).toISOString().split("T")[0],
        projectName: "Office Park - Building 5",
        generalContractor: "Swinerton Builders",
        bidTime: "14:00",
        status: "submitted" as const,
        estimatedValue: 450000,
        notes: "Waiting for decision",
        createdAt: daysAgo(20),
        updatedAt: daysAgo(3),
      },
      {
        date: daysAgo(7).toISOString().split("T")[0],
        projectName: "Mixed-Use Development - Retail",
        generalContractor: "Webcor Builders",
        bidTime: "10:30",
        status: "submitted" as const,
        estimatedValue: 380000,
        notes: "Submitted on time",
        createdAt: daysAgo(25),
        updatedAt: daysAgo(7),
      },
      {
        date: daysAgo(15).toISOString().split("T")[0],
        projectName: "Data Center Expansion",
        generalContractor: "Hensel Phelps",
        bidTime: "16:00",
        status: "lost" as const,
        estimatedValue: 1200000,
        notes: "Lost to competitor - price too high",
        createdAt: daysAgo(40),
        updatedAt: daysAgo(15),
      },
      {
        date: daysAgo(20).toISOString().split("T")[0],
        projectName: "Parking Structure - Level 3",
        generalContractor: "Sundt Construction",
        bidTime: "11:00",
        status: "lost" as const,
        estimatedValue: 290000,
        notes: "Lost - went with local fabricator",
        createdAt: daysAgo(35),
        updatedAt: daysAgo(20),
      },
      {
        date: daysAgo(30).toISOString().split("T")[0],
        projectName: "Stadium Renovation - Seating",
        generalContractor: "Mortenson Construction",
        bidTime: "13:30",
        status: "won" as const,
        estimatedValue: 850000,
        notes: "Awarded - starting production next month",
        createdAt: daysAgo(45),
        updatedAt: daysAgo(30),
      },
      // Future bids (upcoming)
      {
        date: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 5 days from now
        projectName: "Corporate Headquarters - Expansion",
        generalContractor: "Turner Construction",
        bidTime: "15:00",
        status: "active" as const,
        estimatedValue: 650000,
        notes: "High priority - strong relationship with GC",
        createdAt: daysAgo(10),
        updatedAt: new Date(),
      },
      {
        date: new Date(today.getTime() + 12 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 12 days from now
        projectName: "Apartment Complex - Phase 2",
        generalContractor: "Lendlease",
        bidTime: "11:30",
        status: "active" as const,
        estimatedValue: 720000,
        notes: "Multi-phase project opportunity",
        createdAt: daysAgo(15),
        updatedAt: new Date(),
      },
      {
        date: new Date(today.getTime() + 18 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 18 days from now
        projectName: "Medical Center - Outpatient Wing",
        generalContractor: "McCarthy Building",
        bidTime: "14:00",
        status: "active" as const,
        estimatedValue: 980000,
        notes: "Complex healthcare project - multiple RFIs",
        createdAt: daysAgo(20),
        updatedAt: new Date(),
      },
      {
        date: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 25 days from now
        projectName: "Distribution Hub - Loading Docks",
        generalContractor: "Ryan Companies",
        bidTime: "10:00",
        status: "active" as const,
        estimatedValue: 420000,
        notes: "Industrial project - standard specs",
        createdAt: daysAgo(12),
        updatedAt: new Date(),
      },
      {
        date: new Date(today.getTime() + 32 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 32 days from now
        projectName: "University Science Building",
        generalContractor: "Hoffman Construction",
        bidTime: "13:00",
        status: "active" as const,
        estimatedValue: 1100000,
        notes: "Large education project - competitive",
        createdAt: daysAgo(18),
        updatedAt: new Date(),
      },
      {
        date: new Date(today.getTime() + 40 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 40 days from now
        projectName: "Shopping Mall - Food Court Renovation",
        generalContractor: "Clark Construction",
        bidTime: "16:30",
        status: "active" as const,
        estimatedValue: 380000,
        notes: "Renovation project - tight schedule",
        createdAt: daysAgo(8),
        updatedAt: new Date(),
      },
    ];

    for (const bidData of additionalBids) {
      try {
        await createDocument(bidEventsPath, {
          ...bidData,
          createdAt: Timestamp.fromDate(bidData.createdAt),
          updatedAt: Timestamp.fromDate(bidData.updatedAt),
        });
        results.bidEventsCreated++;
      } catch (error) {
        console.error(`Error creating bid event ${bidData.projectName}:`, error);
      }
    }

    // Add future production entries for upcoming projects
    const productionEntriesPath = `companies/${companyId}/productionEntries`;
    const futureProductionEntries = [
      // Current/Active production
      {
        projectName: "Bridge Rehabilitation - Deck Replacement",
        startDate: daysAgo(10).toISOString().split("T")[0], // Started 10 days ago
        endDate: new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Ends in 20 days
        totalHours: 2100,
        createdAt: daysAgo(10),
        updatedAt: today,
      },
      {
        projectName: "Industrial Warehouse - Main Structure",
        startDate: daysAgo(5).toISOString().split("T")[0], // Started 5 days ago
        endDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // Ends in 25 days
        totalHours: 1450,
        createdAt: daysAgo(5),
        updatedAt: today,
      },
      // Upcoming production
      {
        projectName: "Stadium Renovation - Seating",
        startDate: new Date(today.getTime() + 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 10 days from now
        endDate: new Date(today.getTime() + 70 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 70 days from now
        totalHours: 1800,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Retail Complex - Anchor Store",
        startDate: new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 5 days from now
        endDate: new Date(today.getTime() + 50 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 50 days from now
        totalHours: 980,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "School Addition - Gymnasium",
        startDate: new Date(today.getTime() + 20 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 20 days from now
        endDate: new Date(today.getTime() + 80 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 80 days from now
        totalHours: 1100,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Parking Structure - Level 2-4",
        startDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 15 days from now
        endDate: new Date(today.getTime() + 55 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 55 days from now
        totalHours: 1050,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Office Complex - Phase 3",
        startDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
        endDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 90 days from now
        totalHours: 1650,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Manufacturing Facility - Expansion",
        startDate: new Date(today.getTime() + 25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 25 days from now
        endDate: new Date(today.getTime() + 75 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 75 days from now
        totalHours: 1350,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Hospital Wing - Structural Steel",
        startDate: new Date(today.getTime() + 35 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 35 days from now
        endDate: new Date(today.getTime() + 95 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 95 days from now
        totalHours: 1950,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Tech Campus - Building B",
        startDate: new Date(today.getTime() + 40 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 40 days from now
        endDate: new Date(today.getTime() + 100 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 100 days from now
        totalHours: 1250,
        createdAt: today,
        updatedAt: today,
      },
    ];

    for (const prodData of futureProductionEntries) {
      try {
        await createDocument(productionEntriesPath, {
          ...prodData,
          createdAt: Timestamp.fromDate(prodData.createdAt),
          updatedAt: Timestamp.fromDate(prodData.updatedAt),
        });
        results.productionEntriesCreated++;
      } catch (error) {
        console.error(`Error creating production entry ${prodData.projectName}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Created ${results.projectsCreated} projects with ${results.linesCreated} estimating lines, ${results.bidEventsCreated} bid events, and ${results.productionEntriesCreated} production entries`,
      ...results,
    });
  } catch (error) {
    console.error("Seed data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to seed data" },
      { status: 500 }
    );
  }
}

// DELETE - Remove all sample data
export async function DELETE(request: NextRequest) {
  try {
    const { companyId } = await request.json();
    
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    const results = {
      projectsDeleted: 0,
      linesDeleted: 0,
      bidEventsDeleted: 0,
      productionEntriesDeleted: 0,
      errors: [] as string[],
    };

    // Query for all sample data projects
    const projectsRef = collection(db, `companies/${companyId}/projects`);
    const sampleProjectsQuery = query(projectsRef, where("isSampleData", "==", true));
    const sampleProjects = await getDocs(sampleProjectsQuery);

    for (const projectDoc of sampleProjects.docs) {
      try {
        const projectId = projectDoc.id;
        
        // First delete all lines in this project
        const linesRef = collection(db, `companies/${companyId}/projects/${projectId}/lines`);
        const linesSnapshot = await getDocs(linesRef);
        
        for (const lineDoc of linesSnapshot.docs) {
          // deleteDocument takes (collectionPath, documentId)
          await deleteDocument(`companies/${companyId}/projects/${projectId}/lines`, lineDoc.id);
          results.linesDeleted++;
        }
        
        // Then delete the project
        await deleteDocument(`companies/${companyId}/projects`, projectId);
        results.projectsDeleted++;
      } catch (error) {
        const errorMsg = `Error deleting project ${projectDoc.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
        results.errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Delete all bid events (they're all sample data)
    try {
      const bidEventsRef = collection(db, `companies/${companyId}/bidEvents`);
      const bidEventsSnapshot = await getDocs(bidEventsRef);
      for (const bidDoc of bidEventsSnapshot.docs) {
        await deleteDocument(`companies/${companyId}/bidEvents`, bidDoc.id);
        results.bidEventsDeleted++;
      }
    } catch (error) {
      const errorMsg = `Error deleting bid events: ${error instanceof Error ? error.message : "Unknown error"}`;
      results.errors.push(errorMsg);
      console.error(errorMsg, error);
    }

    // Delete all production entries (they're all sample data)
    try {
      const productionEntriesRef = collection(db, `companies/${companyId}/productionEntries`);
      const productionEntriesSnapshot = await getDocs(productionEntriesRef);
      for (const prodDoc of productionEntriesSnapshot.docs) {
        await deleteDocument(`companies/${companyId}/productionEntries`, prodDoc.id);
        results.productionEntriesDeleted++;
      }
    } catch (error) {
      const errorMsg = `Error deleting production entries: ${error instanceof Error ? error.message : "Unknown error"}`;
      results.errors.push(errorMsg);
      console.error(errorMsg, error);
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${results.projectsDeleted} sample projects with ${results.linesDeleted} estimating lines, ${results.bidEventsDeleted} bid events, and ${results.productionEntriesDeleted} production entries`,
      ...results,
    });
  } catch (error) {
    console.error("Delete sample data error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete sample data" },
      { status: 500 }
    );
  }
}

