// OpenAI client is initialized in API routes, not here
// This module only provides client-side fetch wrappers

export interface SpecReviewResult {
  summary?: {
    keyRequirements?: string;
    overallRiskGrade?: "A" | "B" | "C" | "D" | "F";
    riskExposure?: string;
  };
  costImpactTable?: Array<{
    requirement: string;
    specSection?: string;
    impactExplanation: string;
    costImpactLevel: "Low" | "Medium" | "High";
  }>;
  hiddenTraps?: string[];
  missingOrContradictory?: string[];
  recommendedExclusions?: string[];
  recommendedClarifications?: string[];
  recommendedAlternates?: string[];
  // AESS-specific fields
  finishLevelTable?: Array<{
    element: string;
    requiredFinish: string;
    category: string;
    costImpact: "Low" | "Medium" | "High";
  }>;
  weldingGrindingRequirements?: string[];
  coatingRequirements?: string[];
  erectionHandlingRequirements?: string[];
  // Division 01 specific fields
  coordinationResponsibilityShifts?: string[];
  // Division 03 specific fields
  anchorBoltResponsibilityTable?: Array<{
    item: string;
    requirement: string;
    responsibleParty: string;
    costImpact: "Low" | "Medium" | "High";
  }>;
  toleranceConflicts?: string[];
  coordinationRequirements?: string[];
  complianceItems?: Array<{
    item: string;
    specSection?: string;
    status: "pass" | "warning" | "fail";
    message: string;
    category?: string;
  }>;
  rfiSuggestions?: Array<{
    title: string;
    description: string;
    specSection?: string;
    priority?: "High" | "Medium" | "Low";
  }>;
  // Legacy fields for backward compatibility
  items?: Array<{
    item: string;
    status: "pass" | "warning" | "fail";
    message: string;
  }>;
  tokens: number;
  cost: number;
}

export interface ProposalResult {
  proposal: string;
  tokens: number;
  cost: number;
}

export async function reviewSpecifications(
  specText: string,
  projectData: any,
  analysisType: "structural" | "misc" | "finishes" | "aess" | "div01" | "div03" = "structural",
  companyId?: string,
  projectId?: string
): Promise<SpecReviewResult> {
  const response = await fetch("/api/spec-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ specText, projectData, analysisType, companyId, projectId }),
  });

  if (!response.ok) {
    throw new Error("Spec review failed");
  }

  return await response.json();
}

export async function generateProposal(
  projectSummary: string,
  template?: string
): Promise<ProposalResult> {
  const response = await fetch("/api/proposal", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ projectSummary, template }),
  });

  if (!response.ok) {
    throw new Error("Proposal generation failed");
  }

  return await response.json();
}

