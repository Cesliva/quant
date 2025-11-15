/**
 * Steel Grade Information Cheat Sheet
 * Provides typical uses and descriptions for steel grades to help learning estimators
 */

export interface GradeInfo {
  grade: string;
  description: string;
  typicalUses: string[];
  yieldStrength?: string;
  notes?: string;
}

/**
 * Get information about a Material (structural steel) grade
 */
export function getMaterialGradeInfo(grade: string): GradeInfo | undefined {
  return materialGradeInfo[grade];
}

/**
 * Get information about a Plate grade
 */
export function getPlateGradeInfo(grade: string): GradeInfo | undefined {
  return plateGradeInfo[grade];
}

/**
 * Get all Material grade information
 */
export function getAllMaterialGradeInfo(): Record<string, GradeInfo> {
  return materialGradeInfo;
}

/**
 * Get all Plate grade information
 */
export function getAllPlateGradeInfo(): Record<string, GradeInfo> {
  return plateGradeInfo;
}

/**
 * Material (Structural Steel) Grade Information
 */
const materialGradeInfo: Record<string, GradeInfo> = {
  "A992": {
    grade: "A992",
    description: "High-strength structural steel for wide flange shapes",
    typicalUses: [
      "Beams and columns in buildings",
      "Main structural framing",
      "Most common grade for W-shapes"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Industry standard for structural steel. Most widely used grade."
  },
  "A913 Grade 65": {
    grade: "A913 Grade 65",
    description: "High-strength structural steel with 65 ksi yield strength",
    typicalUses: [
      "High-rise buildings",
      "Long-span structures",
      "Where weight reduction is critical"
    ],
    yieldStrength: "65 ksi minimum",
    notes: "Allows lighter, more efficient designs. Higher cost than A992."
  },
  "A913 Grade 70": {
    grade: "A913 Grade 70",
    description: "Very high-strength structural steel with 70 ksi yield strength",
    typicalUses: [
      "Heavy industrial structures",
      "Bridges and infrastructure",
      "Extreme loading conditions"
    ],
    yieldStrength: "70 ksi minimum",
    notes: "Maximum strength option. Used when A992 or Grade 65 insufficient."
  },
  "A500 Grade B": {
    grade: "A500 Grade B",
    description: "Standard grade for hollow structural sections (HSS)",
    typicalUses: [
      "HSS columns and beams",
      "Architectural exposed steel",
      "Truss members"
    ],
    yieldStrength: "46 ksi minimum",
    notes: "Most common HSS grade. Good balance of strength and cost."
  },
  "A500 Grade C": {
    grade: "A500 Grade C",
    description: "Higher strength grade for hollow structural sections",
    typicalUses: [
      "Heavy-duty HSS applications",
      "Long-span HSS members",
      "Where higher strength needed"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Stronger than Grade B. Use when Grade B insufficient."
  },
  "A1085": {
    grade: "A1085",
    description: "Premium grade for hollow structural sections",
    typicalUses: [
      "High-performance structures",
      "Seismic applications",
      "Premium architectural projects"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Premium HSS grade with enhanced properties. Higher cost."
  },
  "A53 Type E": {
    grade: "A53 Type E",
    description: "Electric-resistance welded pipe",
    typicalUses: [
      "Structural pipe columns",
      "Handrails and guardrails",
      "General structural applications"
    ],
    yieldStrength: "35 ksi minimum",
    notes: "ERW pipe. Most common pipe type for structural use."
  },
  "A53 Type S": {
    grade: "A53 Type S",
    description: "Seamless pipe",
    typicalUses: [
      "High-pressure applications",
      "Critical structural connections",
      "Where seamless required"
    ],
    yieldStrength: "35 ksi minimum",
    notes: "Seamless pipe. Higher cost than Type E but no weld seam."
  },
  "A252 Grade 1": {
    grade: "A252 Grade 1",
    description: "Standard strength pipe pile",
    typicalUses: [
      "Foundation piles",
      "Driven piles",
      "Marine structures"
    ],
    yieldStrength: "35 ksi minimum",
    notes: "Standard pipe pile grade for most foundation applications."
  },
  "A252 Grade 2": {
    grade: "A252 Grade 2",
    description: "Medium strength pipe pile",
    typicalUses: [
      "Heavy foundation loads",
      "Deep pile foundations",
      "Where Grade 1 insufficient"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Higher strength than Grade 1. Use for heavier loads."
  },
  "A252 Grade 3": {
    grade: "A252 Grade 3",
    description: "High strength pipe pile",
    typicalUses: [
      "Extreme foundation loads",
      "Very deep piles",
      "Heavy industrial foundations"
    ],
    yieldStrength: "65 ksi minimum",
    notes: "Maximum strength pipe pile. Use when Grade 2 insufficient."
  },
  "Stainless 304": {
    grade: "Stainless 304",
    description: "Standard austenitic stainless steel",
    typicalUses: [
      "Corrosive environments",
      "Food processing facilities",
      "Architectural exposed steel",
      "Marine applications"
    ],
    yieldStrength: "30 ksi minimum",
    notes: "Most common stainless grade. Good corrosion resistance."
  },
  "Stainless 316": {
    grade: "Stainless 316",
    description: "High-performance austenitic stainless steel",
    typicalUses: [
      "Severe corrosive environments",
      "Chemical processing",
      "Marine and coastal structures",
      "Where 304 insufficient"
    ],
    yieldStrength: "30 ksi minimum",
    notes: "Superior corrosion resistance to 304. Higher cost."
  }
};

/**
 * Plate Grade Information
 */
const plateGradeInfo: Record<string, GradeInfo> = {
  "A36": {
    grade: "A36",
    description: "Standard carbon steel plate",
    typicalUses: [
      "Base plates",
      "Gusset plates",
      "General fabrication",
      "Most common plate grade"
    ],
    yieldStrength: "36 ksi minimum",
    notes: "Industry standard. Most economical option. Use unless higher strength needed."
  },
  "A572 Grade 50": {
    grade: "A572 Grade 50",
    description: "High-strength low-alloy steel plate",
    typicalUses: [
      "Heavy base plates",
      "Thick gusset plates",
      "Where A36 insufficient",
      "Weight-critical applications"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Stronger than A36. Allows thinner plates for same strength."
  },
  "A572 Grade 42": {
    grade: "A572 Grade 42",
    description: "Medium-strength low-alloy steel plate",
    typicalUses: [
      "Intermediate strength needs",
      "Between A36 and Grade 50",
      "Moderate loading conditions"
    ],
    yieldStrength: "42 ksi minimum",
    notes: "Middle ground between A36 and Grade 50."
  },
  "A588 (Weathering)": {
    grade: "A588 (Weathering)",
    description: "Weathering steel plate (forms protective rust patina)",
    typicalUses: [
      "Exposed architectural steel",
      "Bridges and outdoor structures",
      "Where painting not desired",
      "Rust-colored aesthetic"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Forms protective oxide layer. No painting required. Higher cost."
  },
  "A514 (T-1)": {
    grade: "A514 (T-1)",
    description: "Ultra-high-strength quenched and tempered steel plate",
    typicalUses: [
      "Extreme loading conditions",
      "Heavy machinery bases",
      "Crane rails and supports",
      "Where maximum strength critical"
    ],
    yieldStrength: "100 ksi minimum",
    notes: "Maximum strength plate. Very high cost. Use only when absolutely necessary."
  },
  "A516 Grade 70": {
    grade: "A516 Grade 70",
    description: "Pressure vessel quality carbon steel plate",
    typicalUses: [
      "Pressure vessels",
      "Tanks and containers",
      "Where pressure rating required",
      "Quality-critical applications"
    ],
    yieldStrength: "38 ksi minimum",
    notes: "Pressure vessel grade. Higher quality control than A36."
  },
  "A529 Grade 50": {
    grade: "A529 Grade 50",
    description: "High-strength structural steel plate",
    typicalUses: [
      "Structural plate applications",
      "Heavy fabrication",
      "Where A572 Grade 50 not available"
    ],
    yieldStrength: "50 ksi minimum",
    notes: "Alternative to A572 Grade 50. Similar properties."
  }
};

