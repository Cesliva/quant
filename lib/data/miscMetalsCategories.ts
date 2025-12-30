/**
 * Misc Metals Categories - Estimator-Friendly Presets
 * 
 * These are presets/filters/sub-types for misc metals estimating.
 * They are meant to:
 * - Trigger the right estimating mindset
 * - Apply the right labor logic
 * - Make scope explicit
 * - Drive proposal clarity later
 * 
 * NOT meant to:
 * - Force geometry
 * - Lock labor
 * - Auto-price anything
 * 
 * Always overrideable - these are guides, not rigid categories.
 */

export interface MiscMetalsCategory {
  id: string;
  label: string;
  description?: string;
  unit: "EA" | "LF" | "SF" | "HYBRID"; // Typical unit for this category
  commonMethod: "DETAILED" | "ASSEMBLY"; // Typical estimating method
}

/**
 * Core Misc Metals Categories organized by type
 */
export const MISC_METALS_CATEGORIES: Record<string, MiscMetalsCategory[]> = {
  // 🪜 Stairs & Access
  stairs: [
    { id: "STAIR_STRAIGHT", label: "Straight Stair (Single Flight)", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "STAIR_MULTI_FLIGHT", label: "Multi-Flight Stair", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "STAIR_SWITCHBACK", label: "Switchback Stair", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "STAIR_SPIRAL", label: "Spiral Stair", unit: "EA", commonMethod: "DETAILED" },
    { id: "STAIR_PAN", label: "Pan Stair", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "STAIR_BAR_GRATING", label: "Bar-Grating Stair", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "STAIR_CONCRETE_PAN_FRAMING", label: "Concrete Pan Stair Framing Only", unit: "EA", commonMethod: "DETAILED" },
    { id: "STAIR_ACCESS_INDUSTRIAL", label: "Access Stair (Industrial)", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "STAIR_ROOF_ACCESS", label: "Roof Access Stair", unit: "EA", commonMethod: "ASSEMBLY" },
  ],

  // 🤚 Handrails / Guardrails
  handrails: [
    { id: "RAIL_GRIP", label: "Grip Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_TWO_LINE", label: "2-Line Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_THREE_LINE", label: "3-Line Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_FOUR_LINE", label: "4-Line Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_FIVE_TO_NINE_LINE", label: "5-9 Line Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_TOP_ONLY", label: "Top Rail Only", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_MID_ONLY", label: "Mid-Rail Only", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_CABLE", label: "Cable Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_HORIZONTAL_PICKETS", label: "Horizontal Picket Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_VERTICAL_PICKETS", label: "Vertical Picket Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_WIRE_MESH_INFILL", label: "Wire Mesh Infill Rail", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "RAIL_GLASS_STRUCTURE", label: "Glass Rail (Structure Only, No Glass)", unit: "LF", commonMethod: "DETAILED" },
  ],

  // Post Styles (for rails)
  railPosts: [
    { id: "POST_WELDED", label: "Welded Post", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "POST_BASE_PLATE", label: "Base-Plate Post", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "POST_FASCIA_MOUNTED", label: "Fascia-Mounted Post", unit: "EA", commonMethod: "ASSEMBLY" },
  ],

  // 🧱 Platforms & Walkways
  platforms: [
    { id: "PLATFORM_EQUIPMENT", label: "Equipment Platform", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "PLATFORM_ACCESS", label: "Access Platform", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "PLATFORM_MEZZANINE_LIGHT", label: "Mezzanine Framing (Light)", unit: "SF", commonMethod: "DETAILED" },
    { id: "PLATFORM_CATWALK", label: "Catwalk", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "PLATFORM_BAR_GRATING", label: "Bar-Grating Walkway", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "PLATFORM_CHECKER_PLATE", label: "Checker Plate Walkway", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "PLATFORM_ROOFTOP_DUNNAGE", label: "Rooftop Dunnage", unit: "SF", commonMethod: "DETAILED" },
    { id: "PLATFORM_PIPE_RACK", label: "Pipe Rack Platform (Light)", unit: "SF", commonMethod: "DETAILED" },
  ],

  // 🪟 Screens, Guards & Panels
  screens: [
    { id: "SCREEN_GUARD", label: "Guard Screen", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "SCREEN_EQUIPMENT", label: "Equipment Screen", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "SCREEN_SAFETY", label: "Safety Screen", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "SCREEN_WIRE_MESH", label: "Wire Mesh Panel", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "SCREEN_EXPANDED_METAL", label: "Expanded Metal Panel", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "SCREEN_PERFORATED", label: "Perforated Metal Panel", unit: "SF", commonMethod: "ASSEMBLY" },
    { id: "SCREEN_ARCHITECTURAL", label: "Architectural Metal Screen", unit: "SF", commonMethod: "DETAILED" },
    { id: "SCREEN_SHAFT_GUARD", label: "Shaft / Opening Guard", unit: "EA", commonMethod: "ASSEMBLY" },
  ],

  // 🚪 Gates, Doors & Barriers
  gates: [
    { id: "GATE_SWING", label: "Swing Gate", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "GATE_SLIDE", label: "Slide Gate", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "GATE_CHAIN", label: "Chain Gate", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "GATE_SAFETY", label: "Safety Gate", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "BARRIER_BOLLARDS", label: "Bollards", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "BARRIER_WHEEL_STOPS", label: "Wheel Stops", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "BARRIER_EQUIPMENT", label: "Equipment Barriers", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "BARRIER_PEDESTRIAN", label: "Pedestrian Barriers", unit: "LF", commonMethod: "ASSEMBLY" },
  ],

  // 🔩 Ladders, Cages & Safety Items
  ladders: [
    { id: "LADDER_FIXED", label: "Ladder (Fixed)", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "LADDER_WITH_CAGE", label: "Ladder with Cage", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "LADDER_SHIP", label: "Ship Ladder", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "LADDER_CAGE", label: "Ladder Cage", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "LADDER_FALL_PROTECTION", label: "Ladder Fall Protection", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "SAFETY_ROOF_HATCH_FRAME", label: "Roof Hatch Frame", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "SAFETY_HATCH_RAIL", label: "Hatch Safety Rail", unit: "EA", commonMethod: "ASSEMBLY" },
    { id: "SAFETY_TOE_BOARDS", label: "Toe Boards", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "SAFETY_KICK_PLATES", label: "Kick Plates", unit: "LF", commonMethod: "ASSEMBLY" },
    { id: "SAFETY_CHAINS", label: "Safety Chains", unit: "LF", commonMethod: "ASSEMBLY" },
  ],

  // 🔧 Embeds, Angles & Light Framing
  embeds: [
    { id: "EMBED_PLATES", label: "Embed Plates", unit: "EA", commonMethod: "DETAILED" },
    { id: "FRAMING_LOOSE_ANGLES", label: "Loose Angles", unit: "LF", commonMethod: "DETAILED" },
    { id: "FRAMING_EDGE_ANGLES", label: "Edge Angles", unit: "LF", commonMethod: "DETAILED" },
    { id: "FRAMING_SUPPORT", label: "Support Frames", unit: "EA", commonMethod: "DETAILED" },
    { id: "FRAMING_EQUIPMENT_SUPPORT", label: "Light Equipment Supports", unit: "EA", commonMethod: "DETAILED" },
    { id: "FRAMING_PIPE_SUPPORT", label: "Pipe Supports", unit: "EA", commonMethod: "DETAILED" },
    { id: "FRAMING_BRACKETS", label: "Brackets", unit: "EA", commonMethod: "DETAILED" },
    { id: "FRAMING_CLIPS", label: "Misc Clips", unit: "EA", commonMethod: "DETAILED" },
  ],

  // 🎨 Finishes & Special Conditions (Adders - not standalone items)
  finishes: [
    { id: "FINISH_SHOP_PRIMER", label: "Shop Primer", unit: "HYBRID", commonMethod: "ASSEMBLY" },
    { id: "FINISH_POWDER_COAT", label: "Powder Coating", unit: "HYBRID", commonMethod: "ASSEMBLY" },
    { id: "FINISH_GALVANIZING", label: "Galvanizing", unit: "HYBRID", commonMethod: "ASSEMBLY" },
    { id: "FINISH_STAINLESS", label: "Stainless Steel", unit: "HYBRID", commonMethod: "DETAILED" },
    { id: "FINISH_ALUMINUM", label: "Aluminum", unit: "HYBRID", commonMethod: "DETAILED" },
    { id: "FINISH_ARCHITECTURAL", label: "Architectural Finish", unit: "HYBRID", commonMethod: "DETAILED" },
    { id: "CONDITION_TIGHT_TOLERANCE", label: "Tight Tolerance Work", unit: "HYBRID", commonMethod: "DETAILED" },
    { id: "CONDITION_FIELD_WELDING", label: "Field Welding Required", unit: "HYBRID", commonMethod: "DETAILED" },
    { id: "CONDITION_NIGHT_WORK", label: "Night Work / Off-Hours", unit: "HYBRID", commonMethod: "ASSEMBLY" },
  ],

  // Other / Custom
  other: [
    { id: "OTHER_CUSTOM", label: "Other / Custom", unit: "HYBRID", commonMethod: "DETAILED" },
  ],
};

/**
 * Flattened list of all misc metals categories
 */
export const ALL_MISC_METALS_CATEGORIES: MiscMetalsCategory[] = Object.values(MISC_METALS_CATEGORIES).flat();

/**
 * Get category by ID
 */
export function getMiscMetalsCategoryById(id: string): MiscMetalsCategory | undefined {
  return ALL_MISC_METALS_CATEGORIES.find(cat => cat.id === id);
}

/**
 * Get categories by group name
 */
export function getMiscMetalsCategoriesByGroup(group: string): MiscMetalsCategory[] {
  return MISC_METALS_CATEGORIES[group] || [];
}

/**
 * Get all group names
 */
export function getMiscMetalsGroupNames(): string[] {
  return Object.keys(MISC_METALS_CATEGORIES);
}

/**
 * Get category label by ID (for display)
 */
export function getMiscMetalsCategoryLabel(id: string): string {
  const category = getMiscMetalsCategoryById(id);
  return category?.label || id;
}

/**
 * Type for miscSubtype - expanded to include all categories
 */
export type MiscMetalsSubtype = 
  // Stairs
  | "STAIR_STRAIGHT" | "STAIR_MULTI_FLIGHT" | "STAIR_SWITCHBACK" | "STAIR_SPIRAL" | "STAIR_PAN" 
  | "STAIR_BAR_GRATING" | "STAIR_CONCRETE_PAN_FRAMING" | "STAIR_ACCESS_INDUSTRIAL" | "STAIR_ROOF_ACCESS"
  // Handrails
  | "RAIL_GRIP" | "RAIL_TWO_LINE" | "RAIL_THREE_LINE" | "RAIL_FOUR_LINE" | "RAIL_FIVE_TO_NINE_LINE"
  | "RAIL_TOP_ONLY" | "RAIL_MID_ONLY" | "RAIL_CABLE" | "RAIL_HORIZONTAL_PICKETS" | "RAIL_VERTICAL_PICKETS"
  | "RAIL_WIRE_MESH_INFILL" | "RAIL_GLASS_STRUCTURE"
  // Posts
  | "POST_WELDED" | "POST_BASE_PLATE" | "POST_FASCIA_MOUNTED"
  // Platforms
  | "PLATFORM_EQUIPMENT" | "PLATFORM_ACCESS" | "PLATFORM_MEZZANINE_LIGHT" | "PLATFORM_CATWALK"
  | "PLATFORM_BAR_GRATING" | "PLATFORM_CHECKER_PLATE" | "PLATFORM_ROOFTOP_DUNNAGE" | "PLATFORM_PIPE_RACK"
  // Screens
  | "SCREEN_GUARD" | "SCREEN_EQUIPMENT" | "SCREEN_SAFETY" | "SCREEN_WIRE_MESH" | "SCREEN_EXPANDED_METAL"
  | "SCREEN_PERFORATED" | "SCREEN_ARCHITECTURAL" | "SCREEN_SHAFT_GUARD"
  // Gates
  | "GATE_SWING" | "GATE_SLIDE" | "GATE_CHAIN" | "GATE_SAFETY" | "BARRIER_BOLLARDS" | "BARRIER_WHEEL_STOPS"
  | "BARRIER_EQUIPMENT" | "BARRIER_PEDESTRIAN"
  // Ladders
  | "LADDER_FIXED" | "LADDER_WITH_CAGE" | "LADDER_SHIP" | "LADDER_CAGE" | "LADDER_FALL_PROTECTION"
  | "SAFETY_ROOF_HATCH_FRAME" | "SAFETY_HATCH_RAIL" | "SAFETY_TOE_BOARDS" | "SAFETY_KICK_PLATES" | "SAFETY_CHAINS"
  // Embeds
  | "EMBED_PLATES" | "FRAMING_LOOSE_ANGLES" | "FRAMING_EDGE_ANGLES" | "FRAMING_SUPPORT" | "FRAMING_EQUIPMENT_SUPPORT"
  | "FRAMING_PIPE_SUPPORT" | "FRAMING_BRACKETS" | "FRAMING_CLIPS"
  // Finishes (usually adders)
  | "FINISH_SHOP_PRIMER" | "FINISH_POWDER_COAT" | "FINISH_GALVANIZING" | "FINISH_STAINLESS" | "FINISH_ALUMINUM"
  | "FINISH_ARCHITECTURAL" | "CONDITION_TIGHT_TOLERANCE" | "CONDITION_FIELD_WELDING" | "CONDITION_NIGHT_WORK"
  // Other
  | "OTHER_CUSTOM"
  // Legacy support (keep for backward compatibility)
  | "STAIR" | "HANDRAIL" | "GUARDRAIL" | "LADDER" | "PLATFORM" | "GATE" | "OTHER";

