/**
 * Misc Metals Assembly Templates
 * 
 * Preformatted assemblies for each misc metals subtype.
 * These can be edited and saved as custom assemblies for repetitive work.
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { MISC_METALS_CATEGORIES } from "./miscMetalsCategories";

export interface AssemblyTemplate {
  id: string;
  name: string;
  miscSubtype: string;
  description?: string;
  isDefault: boolean; // true for built-in templates, false for custom
  isCustom?: boolean; // true for user-created custom assemblies
  companyId?: string; // For custom assemblies, which company owns it
  createdBy?: string; // User ID who created it
  createdAt?: Date;
  updatedAt?: Date;
  
  // Assembly data - partial EstimatingLine with assembly-specific fields
  template: Partial<EstimatingLine>;
}

/**
 * Default assembly templates for each misc metals subtype
 */
export const DEFAULT_ASSEMBLY_TEMPLATES: Record<string, AssemblyTemplate> = {
  // Stairs
  STAIR_STRAIGHT: {
    id: "default_stair_straight",
    name: "Standard Straight Stair",
    miscSubtype: "STAIR_STRAIGHT",
    description: "Single flight straight stair with typical dimensions",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "STAIR_STRAIGHT",
      stairTreads: 12,
      stairLandings: 0,
      stairWidth: 3.5,
      stairRailIncluded: true,
      assemblyCostPerUnit: 450, // Cost per tread
      assemblyLaborHours: 16, // Typical hours for 12-tread stair
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  STAIR_SWITCHBACK: {
    id: "default_stair_switchback",
    name: "Standard Switchback Stair",
    miscSubtype: "STAIR_SWITCHBACK",
    description: "Switchback stair with landing",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "STAIR_SWITCHBACK",
      stairTreads: 12,
      stairLandings: 1,
      stairWidth: 3.5,
      stairRailIncluded: true,
      assemblyCostPerUnit: 500,
      assemblyLaborHours: 20,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  // Handrails
  RAIL_THREE_LINE: {
    id: "default_rail_three_line",
    name: "Standard 3-Line Rail",
    miscSubtype: "RAIL_THREE_LINE",
    description: "Typical 3-line pipe rail system",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "RAIL_THREE_LINE",
      railType: "THREE_LINE",
      railMaterial: "SCH40_1_5",
      railLengthFt: 100,
      railFinish: "Primer",
      assemblyCostPerUnit: 45, // Cost per LF
      assemblyLaborHours: 8, // Typical hours for 100 LF
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  RAIL_TWO_LINE: {
    id: "default_rail_two_line",
    name: "Standard 2-Line Rail",
    miscSubtype: "RAIL_TWO_LINE",
    description: "Typical 2-line pipe rail system",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "RAIL_TWO_LINE",
      railType: "TWO_LINE",
      railMaterial: "SCH40_1_5",
      railLengthFt: 100,
      railFinish: "Primer",
      assemblyCostPerUnit: 35,
      assemblyLaborHours: 6,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  RAIL_FOUR_LINE: {
    id: "default_rail_four_line",
    name: "Standard 4-Line Rail",
    miscSubtype: "RAIL_FOUR_LINE",
    description: "Typical 4-line pipe rail system",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "RAIL_FOUR_LINE",
      railType: "FOUR_LINE",
      railMaterial: "SCH40_1_5",
      railLengthFt: 100,
      railFinish: "Primer",
      assemblyCostPerUnit: 55,
      assemblyLaborHours: 10,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  // Platforms
  PLATFORM_EQUIPMENT: {
    id: "default_platform_equipment",
    name: "Standard Equipment Platform",
    miscSubtype: "PLATFORM_EQUIPMENT",
    description: "Typical equipment access platform",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "PLATFORM_EQUIPMENT",
      assemblyCostPerUnit: 85, // Cost per SF
      assemblyLaborHours: 12,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  PLATFORM_BAR_GRATING: {
    id: "default_platform_bar_grating",
    name: "Bar-Grating Walkway",
    miscSubtype: "PLATFORM_BAR_GRATING",
    description: "Typical bar-grating walkway platform",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "PLATFORM_BAR_GRATING",
      assemblyCostPerUnit: 95,
      assemblyLaborHours: 14,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  // Ladders
  LADDER_FIXED: {
    id: "default_ladder_fixed",
    name: "Standard Fixed Ladder",
    miscSubtype: "LADDER_FIXED",
    description: "Typical fixed ladder",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "LADDER_FIXED",
      assemblyCostPerUnit: 850, // Cost per EA
      assemblyLaborHours: 8,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  LADDER_WITH_CAGE: {
    id: "default_ladder_with_cage",
    name: "Fixed Ladder with Cage",
    miscSubtype: "LADDER_WITH_CAGE",
    description: "Fixed ladder with safety cage",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "LADDER_WITH_CAGE",
      assemblyCostPerUnit: 1200,
      assemblyLaborHours: 12,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  // Gates
  GATE_SWING: {
    id: "default_gate_swing",
    name: "Standard Swing Gate",
    miscSubtype: "GATE_SWING",
    description: "Typical swing gate",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "GATE_SWING",
      assemblyCostPerUnit: 650,
      assemblyLaborHours: 6,
      coatingSystem: "Standard Shop Primer",
    },
  },
  
  // Screens
  SCREEN_GUARD: {
    id: "default_screen_guard",
    name: "Standard Guard Screen",
    miscSubtype: "SCREEN_GUARD",
    description: "Typical guard screen panel",
    isDefault: true,
    template: {
      workType: "MISC",
      miscMethod: "ASSEMBLY",
      miscSubtype: "SCREEN_GUARD",
      assemblyCostPerUnit: 35, // Cost per SF
      assemblyLaborHours: 4,
      coatingSystem: "Standard Shop Primer",
    },
  },
};

/**
 * Get default template for a misc subtype
 */
export function getDefaultTemplate(miscSubtype: string): AssemblyTemplate | undefined {
  return DEFAULT_ASSEMBLY_TEMPLATES[miscSubtype];
}

/**
 * Get all default templates for a subtype
 */
export function getDefaultTemplatesForSubtype(miscSubtype: string): AssemblyTemplate[] {
  return Object.values(DEFAULT_ASSEMBLY_TEMPLATES).filter(
    template => template.miscSubtype === miscSubtype
  );
}

/**
 * Get all available templates (defaults + custom) for a subtype
 */
export async function getTemplatesForSubtype(
  miscSubtype: string,
  companyId?: string
): Promise<AssemblyTemplate[]> {
  const defaults = getDefaultTemplatesForSubtype(miscSubtype);
  
  // Load custom templates from Firebase if companyId provided
  if (companyId) {
    try {
      const { loadCustomTemplatesForSubtype } = await import("@/lib/utils/assemblyTemplates");
      const customTemplates = await loadCustomTemplatesForSubtype(companyId, miscSubtype);
      return [...defaults, ...customTemplates];
    } catch (error) {
      console.error("Error loading custom templates:", error);
      // Return defaults if custom templates fail to load
      return defaults;
    }
  }
  
  return defaults;
}

/**
 * Apply template to an estimating line
 */
export function applyTemplate(
  line: Partial<EstimatingLine>,
  template: AssemblyTemplate
): Partial<EstimatingLine> {
  return {
    ...line,
    ...template.template,
    // Preserve existing values that shouldn't be overwritten
    id: line.id,
    lineId: line.lineId,
    drawingNumber: line.drawingNumber || "",
    detailNumber: line.detailNumber || "",
    itemDescription: line.itemDescription || template.name,
  };
}

