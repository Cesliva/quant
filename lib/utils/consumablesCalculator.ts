/**
 * Consumables Calculator
 * 
 * Design Principles:
 * - Labor = cost of time (from labor rates)
 * - Consumables = cost of doing work (calculated here)
 * - Equipment = cost driver, not markup
 * 
 * Consumables are calculated AFTER labor and equipment time are known.
 * They appear as a separate line item in estimate totals (NOT part of labor rate).
 */

import { ConsumablesSettings } from './settingsLoader';

export interface LaborHours {
  weldHours: number;       // Direct welding hours
  shopLaborHours: number;  // General shop labor hours (non-welding fab work)
}

export interface EquipmentHours {
  plasmaHours: number;     // Plasma cutting machine hours
  sawHours: number;        // Saw cutting machine hours
  drillMachineHours: number; // Drill/punch/machining hours
}

export type JobType = 'structural' | 'miscMetals' | 'heavyWeld' | 'standard';

export interface ConsumablesResult {
  laborConsumables: number;
  equipmentConsumables: number;
  subtotal: number;
  jobTypeMultiplier: number;
  totalConsumables: number;
  breakdown: {
    weldingConsumables: number;
    generalFabConsumables: number;
    plasmaConsumables: number;
    sawConsumables: number;
    drillConsumables: number;
  };
}

const DEFAULT_SETTINGS: ConsumablesSettings = {
  laborDriven: {
    weldingConsumablesPerHour: 8.50,
    generalFabConsumablesPerHour: 3.25,
  },
  equipmentDriven: {
    plasmaCuttingPerHour: 25.00,
    sawCuttingPerHour: 12.00,
    drillMachiningPerHour: 15.00,
  },
  jobTypeMultipliers: {
    structuralSteel: 1.00,
    miscMetalsStairsRails: 1.15,
    heavyWeldJobs: 1.25,
  },
};

/**
 * Calculate consumables cost based on labor hours, equipment hours, and settings
 * 
 * @param laborHours - Object containing weld and shop labor hours
 * @param equipmentHours - Object containing equipment machine hours
 * @param settings - Company consumables settings (uses defaults if not provided)
 * @param jobType - Type of job for multiplier selection
 * @returns ConsumablesResult with detailed breakdown
 */
export function calculateConsumables(
  laborHours: LaborHours,
  equipmentHours: EquipmentHours,
  settings?: ConsumablesSettings | null,
  jobType: JobType = 'standard'
): ConsumablesResult {
  // Use provided settings or defaults
  const s = settings ?? DEFAULT_SETTINGS;
  
  // Labor-driven consumables
  const weldingConsumables = 
    (laborHours.weldHours || 0) * (s.laborDriven?.weldingConsumablesPerHour ?? 0);
  const generalFabConsumables = 
    (laborHours.shopLaborHours || 0) * (s.laborDriven?.generalFabConsumablesPerHour ?? 0);
  const laborConsumables = weldingConsumables + generalFabConsumables;

  // Equipment-driven consumables
  const plasmaConsumables = 
    (equipmentHours.plasmaHours || 0) * (s.equipmentDriven?.plasmaCuttingPerHour ?? 0);
  const sawConsumables = 
    (equipmentHours.sawHours || 0) * (s.equipmentDriven?.sawCuttingPerHour ?? 0);
  const drillConsumables = 
    (equipmentHours.drillMachineHours || 0) * (s.equipmentDriven?.drillMachiningPerHour ?? 0);
  const equipmentConsumables = plasmaConsumables + sawConsumables + drillConsumables;

  // Subtotal before multiplier
  const subtotal = laborConsumables + equipmentConsumables;

  // Job type multiplier
  let jobTypeMultiplier = 1.0;
  if (s.jobTypeMultipliers) {
    switch (jobType) {
      case 'structural':
        jobTypeMultiplier = s.jobTypeMultipliers.structuralSteel ?? 1.0;
        break;
      case 'miscMetals':
        jobTypeMultiplier = s.jobTypeMultipliers.miscMetalsStairsRails ?? 1.15;
        break;
      case 'heavyWeld':
        jobTypeMultiplier = s.jobTypeMultipliers.heavyWeldJobs ?? 1.25;
        break;
      default:
        jobTypeMultiplier = 1.0;
    }
  }

  const totalConsumables = subtotal * jobTypeMultiplier;

  return {
    laborConsumables,
    equipmentConsumables,
    subtotal,
    jobTypeMultiplier,
    totalConsumables,
    breakdown: {
      weldingConsumables,
      generalFabConsumables,
      plasmaConsumables,
      sawConsumables,
      drillConsumables,
    },
  };
}

/**
 * Estimate equipment hours from line items (simple heuristic)
 * This is a placeholder - ideally equipment hours come from actual estimate data
 * 
 * @param totalWeight - Total weight in pounds
 * @param cutCount - Number of cuts (if tracked)
 * @param holeCount - Number of holes (if tracked)
 * @returns Estimated equipment hours
 */
export function estimateEquipmentHours(
  totalWeight: number,
  cutCount?: number,
  holeCount?: number
): EquipmentHours {
  // Simple heuristics - can be refined based on actual shop data
  // These are rough estimates assuming:
  // - Plasma: ~500 lbs/hour throughput for misc metals
  // - Saw: ~300 lbs/hour for structural
  // - Drill: ~100 holes/hour

  const plasmaHours = totalWeight > 0 ? totalWeight / 800 : 0;
  const sawHours = cutCount ? cutCount / 30 : (totalWeight / 500); // ~30 cuts/hour or weight-based
  const drillMachineHours = holeCount ? holeCount / 100 : (totalWeight / 1000);

  return {
    plasmaHours: Math.max(0, plasmaHours),
    sawHours: Math.max(0, sawHours),
    drillMachineHours: Math.max(0, drillMachineHours),
  };
}

/**
 * Determine job type from project data
 * 
 * @param projectType - Project type string from project settings
 * @param weldHoursRatio - Ratio of weld hours to total labor hours
 * @returns JobType for multiplier selection
 */
export function determineJobType(
  projectType?: string,
  weldHoursRatio?: number
): JobType {
  // Check project type first
  if (projectType) {
    const lowerType = projectType.toLowerCase();
    if (lowerType.includes('misc') || lowerType.includes('stair') || lowerType.includes('rail') || lowerType.includes('handrail')) {
      return 'miscMetals';
    }
    if (lowerType.includes('structural') || lowerType.includes('beam') || lowerType.includes('column')) {
      return 'structural';
    }
  }

  // Fall back to weld ratio heuristic
  if (weldHoursRatio !== undefined) {
    if (weldHoursRatio > 0.5) {
      return 'heavyWeld';
    }
  }

  return 'standard';
}

/**
 * Extract labor hours by category from estimating lines
 * Maps labor categories to weld vs general shop hours
 * 
 * @param lineItems - Array of estimating line items with labor breakdown
 * @returns LaborHours object
 */
export function extractLaborHours(
  lineItems: Array<{
    weld?: number;
    fit?: number;
    cut?: number;
    processPlate?: number;
    cope?: number;
    drillPunch?: number;
    handleMove?: number;
    loadShip?: number;
    prepClean?: number;
    paint?: number;
    unload?: number;
    allowance?: number;
    totalLabor?: number;
  }>
): LaborHours {
  let weldHours = 0;
  let shopLaborHours = 0;

  for (const line of lineItems) {
    // Weld hours
    weldHours += line.weld || 0;
    
    // Non-weld shop labor (all other fabrication tasks)
    shopLaborHours += (line.fit || 0);
    shopLaborHours += (line.cut || 0);
    shopLaborHours += (line.processPlate || 0);
    shopLaborHours += (line.cope || 0);
    shopLaborHours += (line.drillPunch || 0);
    shopLaborHours += (line.handleMove || 0);
    shopLaborHours += (line.loadShip || 0);
    shopLaborHours += (line.prepClean || 0);
    shopLaborHours += (line.paint || 0);
    shopLaborHours += (line.unload || 0);
    shopLaborHours += (line.allowance || 0);
  }

  return {
    weldHours,
    shopLaborHours,
  };
}
