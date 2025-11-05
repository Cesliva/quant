// OpenAI client is initialized in API routes, not here
// This module only provides client-side fetch wrappers

export interface SpecReviewResult {
  items: Array<{
    item: string;
    status: "pass" | "warning" | "fail";
    message: string;
  }>;
  rfiSuggestions: Array<{
    title: string;
    description: string;
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
  projectData: any
): Promise<SpecReviewResult> {
  const response = await fetch("/api/spec-review", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ specText, projectData }),
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

