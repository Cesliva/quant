/**
 * Proposal Seed data model
 * Used to capture project-specific inclusions/exclusions during estimation
 */

export type ProposalSeedType = "inclusion" | "exclusion" | "clarification" | "assumption" | "allowance";
export type ProposalSeedStatus = "active" | "archived";

export interface ProposalSeedContext {
  lineItemId?: string;
  drawing?: string;
  detail?: string;
  category?: string;
  specSection?: string;
}

export interface ProposalSeed {
  id: string;
  projectId: string;
  type: ProposalSeedType;
  text: string;
  context: ProposalSeedContext;
  tags?: string[];
  createdAt: any; // Firestore Timestamp
  createdBy: string; // userId
  status: ProposalSeedStatus;
  updatedAt?: any; // Firestore Timestamp
}



