/**
 * Enhanced Scope Building for Proposals
 * 
 * Analyzes estimating lines to generate detailed, specific scope descriptions
 * based on actual project data rather than generic templates.
 */

import type { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export interface ScopeAnalysis {
  structuralSteel: {
    hasColumns: boolean;
    hasBeams: boolean;
    columnCount: number;
    beamCount: number;
    totalTons: number;
    grades: string[];
    hasBracing: boolean;
  };
  miscMetals: {
    hasStairs: boolean;
    hasRails: boolean;
    hasLadders: boolean;
    stairCount: number;
    railCount: number;
    ladderCount: number;
    otherMiscCount: number;
  };
  coatings: {
    systems: string[];
    totalSF: number;
    hasGalvanizing: boolean;
    hasPowderCoat: boolean;
    hasSpecialty: boolean;
  };
  hasJoists: boolean;
  hasDelivery: boolean;
}

/**
 * Analyze estimating lines to extract scope details
 */
export function analyzeScope(estimatingLines: EstimatingLine[]): ScopeAnalysis {
  const activeLines = estimatingLines.filter(l => l.status !== "Void");
  
  const columns = activeLines.filter(l => l.category === "Columns");
  const beams = activeLines.filter(l => l.category === "Beams");
  const structuralTons = [...columns, ...beams].reduce((sum, l) => 
    sum + (l.totalWeight || 0), 0
  ) / 2000;
  
  const stairs = activeLines.filter(l => 
    l.category === "Stairs" || 
    l.subCategory?.toLowerCase().includes("stair") ||
    l.itemDescription?.toLowerCase().includes("stair")
  );
  
  const rails = activeLines.filter(l => 
    l.category === "Rails" || 
    l.subCategory?.toLowerCase().includes("rail") ||
    l.itemDescription?.toLowerCase().includes("rail")
  );
  
  const ladders = activeLines.filter(l => 
    l.category === "Ladders" || 
    l.subCategory?.toLowerCase().includes("ladder") ||
    l.itemDescription?.toLowerCase().includes("ladder")
  );
  
  const otherMisc = activeLines.filter(l => 
    l.category === "Misc Metals" && 
    !l.subCategory?.toLowerCase().includes("stair") &&
    !l.subCategory?.toLowerCase().includes("rail") &&
    !l.subCategory?.toLowerCase().includes("ladder")
  );
  
  const coatingSystems = new Set(
    activeLines
      .map(l => l.coatingSystem)
      .filter(c => c && c !== "None")
  );
  
  const totalSurfaceArea = activeLines.reduce((sum, l) => 
    sum + (l.totalSurfaceArea || l.plateSurfaceArea || 0), 0
  );
  
  const grades = new Set(
    activeLines
      .map(l => l.grade || l.plateGrade)
      .filter(g => g)
  );
  
  const hasJoists = activeLines.some(l => 
    l.category?.toLowerCase().includes("joist")
  );
  
  return {
    structuralSteel: {
      hasColumns: columns.length > 0,
      hasBeams: beams.length > 0,
      columnCount: columns.length,
      beamCount: beams.length,
      totalTons: structuralTons,
      grades: Array.from(grades) as string[],
      hasBracing: activeLines.some(l => 
        l.category === "Bracing" || 
        l.subCategory?.toLowerCase().includes("brace")
      ),
    },
    miscMetals: {
      hasStairs: stairs.length > 0,
      hasRails: rails.length > 0,
      hasLadders: ladders.length > 0,
      stairCount: stairs.length,
      railCount: rails.length,
      ladderCount: ladders.length,
      otherMiscCount: otherMisc.length,
    },
    coatings: {
      systems: Array.from(coatingSystems) as string[],
      totalSF: totalSurfaceArea,
      hasGalvanizing: Array.from(coatingSystems).some(c => 
        c?.toLowerCase().includes("galvan")
      ),
      hasPowderCoat: Array.from(coatingSystems).some(c => 
        c?.toLowerCase().includes("powder")
      ),
      hasSpecialty: Array.from(coatingSystems).some(c => 
        c?.toLowerCase().includes("specialty")
      ),
    },
    hasJoists,
    hasDelivery: true, // Assume delivery is included if there are lines
  };
}

/**
 * Build detailed scope section from analyzing estimating lines
 */
export function buildDetailedScope(
  estimatingLines: EstimatingLine[],
  formData: { scope: any },
  analysis: ScopeAnalysis
): string[] {
  const scopeItems: string[] = [];
  
  // If no lines but scope is checked, use generic but professional descriptions
  const hasLines = estimatingLines.length > 0;
  
  // Structural Steel - detailed breakdown
  if (formData.scope.structuralSteel || analysis.structuralSteel.hasColumns || analysis.structuralSteel.hasBeams) {
    const { structuralSteel } = analysis;
    let structuralScope = `Structural Steel\n`;
    
    if (hasLines && (structuralSteel.columnCount > 0 || structuralSteel.beamCount > 0)) {
      structuralScope += `- Fabrication of `;
      const parts: string[] = [];
      if (structuralSteel.columnCount > 0) {
        parts.push(`${structuralSteel.columnCount} column${structuralSteel.columnCount !== 1 ? 's' : ''}`);
      }
      if (structuralSteel.beamCount > 0) {
        parts.push(`${structuralSteel.beamCount} beam${structuralSteel.beamCount !== 1 ? 's' : ''}`);
      }
      structuralScope += parts.join(" and ");
      
      if (structuralSteel.totalTons > 0) {
        structuralScope += ` totaling approximately ${structuralSteel.totalTons.toFixed(1)} tons`;
      }
      structuralScope += `\n`;
    }
    
    structuralScope += `- Wide-flange beams, columns, bracing, and associated structural members per structural drawings
- Shear plates, moment connections, clip angles, stiffeners, and connection hardware as shown
- Base plates, leveling plates, and necessary weld attachments`;
    
    if (hasLines && structuralSteel.grades.length > 0) {
      structuralScope += `\n- Material grades: ${structuralSteel.grades.join(", ")}`;
    } else {
      structuralScope += `\n- Material grades per structural drawings (typically A992, A572 Gr50, or as specified)`;
    }
    
    structuralScope += `\n- Connection hardware (bolts, washers, nuts) as specified`;
    
    if (hasLines && structuralSteel.hasBracing) {
      structuralScope += `\n- Bracing members and connections as shown on drawings`;
    }
    
    scopeItems.push(structuralScope);
  }
  
  // Misc Metals - detailed breakdown with stairs, rails, ladders
  if (formData.scope.miscellaneousMetals || 
      analysis.miscMetals.hasStairs || 
      analysis.miscMetals.hasRails || 
      analysis.miscMetals.hasLadders ||
      analysis.miscMetals.otherMiscCount > 0) {
    const { miscMetals } = analysis;
    let miscScope = `Miscellaneous Metals\n`;
    
    if (hasLines && miscMetals.hasStairs) {
      miscScope += `- Steel stairs: ${miscMetals.stairCount} stair${miscMetals.stairCount !== 1 ? 's' : ''} with stringers, treads, and landings as shown on drawings\n`;
    } else if (formData.scope.miscellaneousMetals) {
      miscScope += `- Steel stairs with stringers, treads, and landings as shown on drawings\n`;
    }
    
    if (hasLines && miscMetals.hasRails) {
      miscScope += `- Handrails and guardrails: ${miscMetals.railCount} rail${miscMetals.railCount !== 1 ? 's' : ''} per drawings and code requirements (IBC/OSHA compliant)\n`;
    } else if (formData.scope.miscellaneousMetals) {
      miscScope += `- Handrails and guardrails per drawings and code requirements (IBC/OSHA compliant)\n`;
    }
    
    if (hasLines && miscMetals.hasLadders) {
      miscScope += `- Ladders: ${miscMetals.ladderCount} ladder${miscMetals.ladderCount !== 1 ? 's' : ''} including roof access and mechanical platform ladders with safety cages where required\n`;
    } else if (formData.scope.miscellaneousMetals) {
      miscScope += `- Ladders including roof access and mechanical platform ladders with safety cages where required\n`;
    }
    
    if (hasLines && miscMetals.otherMiscCount > 0) {
      miscScope += `- Additional miscellaneous steel items: ${miscMetals.otherMiscCount} item${miscMetals.otherMiscCount !== 1 ? 's' : ''} including support frames, angle frames, and equipment supports\n`;
    }
    
    miscScope += `- Steel canopies and support framing, galvanized where indicated
- Bollards (supply or install as noted)
- Fall-protection anchors including engineering for anchors only`;
    
    scopeItems.push(miscScope);
  }
  
  // Coating Systems - detailed breakdown
  if (hasLines && analysis.coatings.systems.length > 0) {
    const coatingDetails = analysis.coatings.systems
      .map(c => {
        const linesWithCoating = estimatingLines.filter(l => l.coatingSystem === c);
        const totalSF = linesWithCoating.reduce((sum, l) => 
          sum + (l.totalSurfaceArea || l.plateSurfaceArea || 0), 0
        );
        return `${c}${totalSF > 0 ? ` (approximately ${totalSF.toFixed(0)} SF)` : ""}`;
      })
      .join(", ");
    
    scopeItems.push(`Coating Systems
- ${coatingDetails}
- Surface preparation per SSPC standards as specified
- Quality control and inspection of coating application`);
  } else if (scopeItems.length > 0) {
    // If we have other scope items but no coating data, add a generic coating note
    scopeItems.push(`Coating Systems
- Coating per Division 9 specifications and drawings
- Surface preparation per SSPC standards as specified
- Quality control and inspection of coating application`);
  }
  
  // Joists & Decking
  if (formData.scope.joistsDecking || analysis.hasJoists) {
    scopeItems.push(`Joists & Decking
- Open-web steel joists per SJI specifications, including bridging
- Steel decking as specified (ASC unless otherwise required)
- Standard shop primer on joist accessories`);
  }
  
  // Detailing & Engineering
  if (formData.scope.detailingEngineering) {
    scopeItems.push(`Detailing & Engineering
- Shop drawings, erection plans, CNC data, and submittals
- Coordination with the general contractor and affected trades
- PE-stamped engineering for ladders and fall-protection anchors only`);
  }
  
  // Delivery
  if (formData.scope.delivery || analysis.hasDelivery) {
    scopeItems.push(`Delivery
- Delivery F.O.B. jobsite
- Sequenced deliveries coordinated with site requirements
- Bundling, tagging, and protective handling`);
  }
  
  return scopeItems;
}

