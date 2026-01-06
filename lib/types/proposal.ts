/**
 * Structured Proposal Data Model
 * Defines the fixed sections and structure for professional proposals
 */

export interface ProposalHeader {
  companyName: string;
  companyLogo?: string;
  projectName: string;
  projectNumber?: string;
  proposalDate: string;
  to?: string;
  contractor?: string;
  projectLocation?: string;
  preparedBy?: string;
}

export interface ProposalSection {
  content: string | string[]; // String for paragraphs, string[] for bullet lists
  type: "paragraph" | "bullets" | "numbered";
}

export interface StructuredProposal {
  header: ProposalHeader;
  sections: {
    projectOverview?: ProposalSection;
    scopeOfWork?: ProposalSection;
    price?: ProposalSection;
    projectSpecificInclusions?: ProposalSection;
    projectSpecificExclusions?: ProposalSection;
    clarificationsAssumptions?: ProposalSection;
    commercialTerms?: ProposalSection;
    acceptanceSignature?: ProposalSection;
  };
  metadata?: {
    totalLumpSum?: number;
    shopDrawingsDays?: number;
    fabricationWeeks?: number;
  };
}

