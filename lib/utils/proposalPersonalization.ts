/**
 * Proposal Personalization Utilities
 * 
 * Functions to generate personalized, professional proposals that feel
 * human-written while leveraging auto-populated data.
 */

import type { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import type { ProposalSeed } from "@/lib/types/proposalSeeds";
import type { CompanySettings } from "./settingsLoader";

export interface ProjectIntelligence {
  projectType: string | undefined;
  totalTons: number;
  totalHours: number;
  costPerTon: number;
  complexityIndicators: string[];
  hasComplexWelding: boolean;
  hasLargeMembers: boolean;
  hasSpecialCoatings: boolean;
}

export interface GCRelationship {
  gcName: string;
  gcId?: string;
  projectsCompleted: number;
  totalValue: number;
  lastProjectDate?: Date;
  notes?: string;
}

/**
 * Generate project-specific intelligence from estimating data
 */
export function generateProjectIntelligence(
  estimatingLines: EstimatingLine[],
  projectType?: string,
  totalCost: number = 0,
  totalWeight: number = 0
): ProjectIntelligence {
  const totalTons = totalWeight / 2000;
  const totalHours = estimatingLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
  const costPerTon = totalTons > 0 ? totalCost / totalTons : 0;

  const complexityIndicators: string[] = [];
  let hasComplexWelding = false;
  let hasLargeMembers = false;
  let hasSpecialCoatings = false;

  // Analyze lines for complexity
  for (const line of estimatingLines) {
    // Check for complex welding
    if (line.laborWeld && line.laborWeld > 50) {
      hasComplexWelding = true;
    }

    // Check for large members
    if (line.totalWeight && line.totalWeight > 5000) {
      hasLargeMembers = true;
    }

    // Check for special coatings
    const coating = line.coatingSystem?.toLowerCase() || "";
    if (coating.includes("galvan") || coating.includes("powder") || coating.includes("specialty")) {
      hasSpecialCoatings = true;
    }
  }

  // Generate insights based on project characteristics
  if (projectType) {
    switch (projectType.toLowerCase()) {
      case "healthcare":
        complexityIndicators.push("Healthcare projects require strict quality control and coordination with MEP trades");
        break;
      case "education":
        complexityIndicators.push("School projects often have tight schedules aligned with academic calendars");
        break;
      case "industrial":
        complexityIndicators.push("Industrial facilities typically require heavy-duty members and specialized connections");
        break;
      case "commercial building":
        complexityIndicators.push("Commercial projects require careful coordination with multiple trades and tight schedules");
        break;
    }
  }

  // Size-based insights
  if (totalTons > 200) {
    complexityIndicators.push("Large-scale project requiring dedicated shop capacity and project management");
  } else if (totalTons < 50) {
    complexityIndicators.push("Smaller project allowing for quick turnaround and flexible scheduling");
  }

  // Complexity insights
  if (hasComplexWelding) {
    complexityIndicators.push("Complex connection details requiring certified welders with specialized experience");
  }

  if (hasLargeMembers) {
    complexityIndicators.push("Heavy members requiring specialized handling and equipment");
  }

  if (hasSpecialCoatings) {
    complexityIndicators.push("Special coating requirements necessitating careful coordination and quality control");
  }

  return {
    projectType,
    totalTons,
    totalHours,
    costPerTon,
    complexityIndicators,
    hasComplexWelding,
    hasLargeMembers,
    hasSpecialCoatings,
  };
}

/**
 * Get GC relationship context from project history
 * This would ideally query Firestore for past projects with the same GC
 */
export async function getGCRelationshipContext(
  gcName: string,
  gcId?: string,
  companyId?: string
): Promise<string> {
  // TODO: Query Firestore for past projects with this GC
  // For now, return a generic context
  // In production, this would:
  // 1. Query projects where generalContractor === gcName or gcId === gcId
  // 2. Filter for status === "won"
  // 3. Calculate projectsCompleted, totalValue, lastProjectDate
  // 4. Return personalized context

  return `We're excited about the opportunity to work with ${gcName} on this project.`;
}

/**
 * Generate personalized introduction based on project and company voice
 */
export function generatePersonalizedIntroduction(
  projectName: string,
  projectLocation: string,
  projectType: string | undefined,
  gcName: string,
  companyVoice: CompanySettings["proposalSettings"] | undefined,
  intelligence: ProjectIntelligence,
  relationshipContext: string
): string {
  const tone = companyVoice?.companyVoice?.tone || "professional";
  const keyMessages = companyVoice?.companyVoice?.keyMessages || [];
  const differentiators = companyVoice?.companyVoice?.differentiators || [];

  let intro = "";

  // Start with relationship context
  intro += relationshipContext;

  // Add project-specific reference
  intro += ` Having reviewed the ${projectName} project${projectLocation ? ` in ${projectLocation}` : ""}`;

  // Add project type insight
  if (projectType) {
    intro += `, we understand the unique requirements of ${projectType.toLowerCase()} projects`;
  }

  // Add intelligence insights
  if (intelligence.complexityIndicators.length > 0) {
    intro += `. ${intelligence.complexityIndicators[0]}`;
  }

  // Add company differentiators
  if (differentiators.length > 0) {
    intro += `. As ${differentiators[0]}`;
    if (differentiators.length > 1) {
      intro += ` with ${differentiators.slice(1).join(", ")}`;
    }
  }

  // Add key messages
  if (keyMessages.length > 0) {
    intro += `, we're committed to ${keyMessages[0].toLowerCase()}`;
    if (keyMessages.length > 1) {
      intro += ` and ${keyMessages.slice(1).map(m => m.toLowerCase()).join(", ")}`;
    }
  }

  intro += ".";

  return intro;
}

/**
 * Generate personalized closing based on company voice
 */
export function generatePersonalizedClosing(
  companyVoice: CompanySettings["proposalSettings"] | undefined,
  projectName: string
): string {
  const closingStyle = companyVoice?.companyVoice?.closingStyle || "professional";
  const customClosing = companyVoice?.proposalTemplates?.closing;

  if (customClosing) {
    return customClosing.replace(/{PROJECT_NAME}/g, projectName);
  }

  switch (closingStyle) {
    case "warm":
      return `We're excited about the opportunity to partner with you on ${projectName}. Our team is ready to deliver exceptional results and we look forward to discussing how we can bring this project to life.`;
    
    case "direct":
      return `We're ready to move forward on ${projectName}. Please let us know if you have any questions or need additional information.`;
    
    case "professional":
    default:
      return `Thank you for considering our proposal for ${projectName}. We look forward to the opportunity to work with you and are available to discuss any questions or clarifications you may have.`;
  }
}

/**
 * Extract key insights from proposal seeds for personalization
 */
export function extractSeedInsights(proposalSeeds: ProposalSeed[]): {
  criticalAssumptions: string[];
  importantClarifications: string[];
  keyExclusions: string[];
  notableInclusions: string[];
} {
  return {
    criticalAssumptions: proposalSeeds
      .filter(s => s.type === "assumption" && s.status === "active")
      .map(s => s.text),
    importantClarifications: proposalSeeds
      .filter(s => s.type === "clarification" && s.status === "active")
      .map(s => s.text),
    keyExclusions: proposalSeeds
      .filter(s => s.type === "exclusion" && s.status === "active")
      .slice(0, 5) // Top 5 exclusions
      .map(s => s.text),
    notableInclusions: proposalSeeds
      .filter(s => s.type === "inclusion" && s.status === "active")
      .slice(0, 5) // Top 5 inclusions
      .map(s => s.text),
  };
}

