/**
 * API Route to Seed Mid-Year Sample Data
 * 
 * POST /api/seed-data
 * 
 * Creates realistic sample data for an $8M fab shop mid-year scenario.
 * Requires authentication and admin permissions.
 */

import { NextRequest, NextResponse } from "next/server";
import { createDocument, deleteDocument } from "@/lib/firebase/firestore";
import { Timestamp, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

// Import the seed function logic (we'll inline it here for API route)
// Material rates
const MATERIAL_RATE = 0.85;
const LABOR_RATE = 45.0;
const PAINT_RATE = 2.5;
const GALVANIZE_RATE = 0.55;

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

function daysAgo(days: number): Date {
  const date = new Date();
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
  const coatingSystem = randomChoice(["None", "Paint", "Galv"]);
  let coatingCost = 0;
  if (coatingSystem === "Paint") {
    // Paint: surface area × paint rate (need to calculate surface area from weight)
    // Approximate: 1 lb steel ≈ 0.15 SF surface area
    coatingCost = totalWeight * 0.15 * PAINT_RATE;
  } else if (coatingSystem === "Galv") {
    // Galvanizing: weight × rate ($/lb)
    coatingCost = totalWeight * GALVANIZE_RATE;
  }
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} Column - ${lengthFt}' long`,
    elevation: randomChoice(ELEVATIONS),
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
    sspcPrep: coatingSystem === "Paint" ? randomChoice(["SSPC-SP 6", "SSPC-SP 10"]) : undefined,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate: coatingSystem === "Paint" ? PAINT_RATE : coatingSystem === "Galv" ? GALVANIZE_RATE : 0,
    coatingCost,
    totalCost: materialCost + laborCost + coatingCost,
    status: "Active",
    isMainMember: true,
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
  const coatingSystem = randomChoice(["None", "Paint", "Galv"]);
  let coatingCost = 0;
  if (coatingSystem === "Paint") {
    // Paint: surface area × paint rate (need to calculate surface area from weight)
    // Approximate: 1 lb steel ≈ 0.15 SF surface area
    coatingCost = totalWeight * 0.15 * PAINT_RATE;
  } else if (coatingSystem === "Galv") {
    // Galvanizing: weight × rate ($/lb)
    coatingCost = totalWeight * GALVANIZE_RATE;
  }
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} Beam - ${lengthFt}' long`,
    elevation: randomChoice(ELEVATIONS),
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
    sspcPrep: coatingSystem === "Paint" ? randomChoice(["SSPC-SP 6", "SSPC-SP 10"]) : undefined,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate: coatingSystem === "Paint" ? PAINT_RATE : coatingSystem === "Galv" ? GALVANIZE_RATE : 0,
    coatingCost,
    totalCost: materialCost + laborCost + coatingCost,
    status: "Active",
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
  const coatingSystem = randomChoice(["None", "Paint", "Powder"]);
  let coatingCost = 0;
  if (coatingSystem === "Paint") {
    coatingCost = plateSurfaceArea * PAINT_RATE; // Paint rate is $/SF
  } else if (coatingSystem === "Powder") {
    coatingCost = plateSurfaceArea * 3.5; // Powder rate is $/SF
  }
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${thickness}" x ${width}" x ${plateLength}" ${plateGrade} Plate`,
    elevation: randomChoice(ELEVATIONS),
    category: "Plates",
    subCategory: randomChoice(["Base Plate", "Gusset", "Stiffener", "Clip"]),
    materialType: "Plate",
    thickness,
    width,
    plateLength,
    plateQty,
    plateGrade,
    plateArea,
    plateSurfaceArea,
    plateTotalWeight,
    coatingSystem,
    sspcPrep: coatingSystem === "Paint" ? randomChoice(["SSPC-SP 6", "SSPC-SP 10"]) : undefined,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    coatingRate: coatingSystem === "Paint" ? PAINT_RATE : coatingSystem === "Powder" ? 3.5 : 0,
    coatingCost,
    totalCost: materialCost + laborCost + coatingCost,
    status: "Active",
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
  const coatingSystem = randomChoice(["None", "Paint"]);
  return {
    lineId,
    drawingNumber: `D-${randomInt(100, 999)}`,
    detailNumber: `DTL-${randomInt(1, 50)}`,
    itemDescription: `${size} ${grade} ${type} - ${lengthFt}' long`,
    elevation: randomChoice(ELEVATIONS),
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
    coatingSystem,
    sspcPrep: coatingSystem === "Paint" ? randomChoice(["SSPC-SP 6", "SSPC-SP 10"]) : undefined,
    materialRate: MATERIAL_RATE,
    materialCost,
    laborRate: LABOR_RATE,
    totalLabor: laborHours,
    ...laborBreakdown,
    laborCost,
    totalCost: materialCost + laborCost,
    status: "Active",
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
      line.totalCost = (line.materialCost || 0) + (line.laborCost || 0) + (line.coatingCost || 0);
    }
    lines.push(line);
    currentValue += line.totalCost || 0;
    lineNum++;
  }
  return lines;
}

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json();
    
    if (!companyId) {
      return NextResponse.json(
        { error: "companyId is required" },
        { status: 400 }
      );
    }

    const results = {
      projectsCreated: 0,
      linesCreated: 0,
      bidEventsCreated: 0,
      productionEntriesCreated: 0,
      errors: [] as string[],
    };

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

        results.projectsCreated++;
      } catch (error) {
        const errorMsg = `Error creating project ${projectData.projectNumber}: ${error instanceof Error ? error.message : "Unknown error"}`;
        results.errors.push(errorMsg);
        console.error(errorMsg, error);
      }
    }

    // Add additional standalone bid events for variety (not tied to projects)
    const bidEventsPath = `companies/${companyId}/bidEvents`;
    const additionalBids = [
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
    const today = new Date();
    const futureProductionEntries = [
      {
        projectName: "Stadium Renovation - Seating",
        startDate: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 30 days from now
        endDate: new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 90 days from now
        totalHours: 1800,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "Retail Complex - Anchor Store",
        startDate: new Date(today.getTime() + 15 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 15 days from now
        endDate: new Date(today.getTime() + 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 60 days from now
        totalHours: 980,
        createdAt: today,
        updatedAt: today,
      },
      {
        projectName: "School Addition - Gymnasium",
        startDate: new Date(today.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 45 days from now
        endDate: new Date(today.getTime() + 105 * 24 * 60 * 60 * 1000).toISOString().split("T")[0], // 105 days from now
        totalHours: 1100,
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

