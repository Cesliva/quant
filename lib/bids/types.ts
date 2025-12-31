/**
 * Bid Data Model
 * 
 * Represents a bid opportunity in the Quant system.
 * Supports both PUBLIC (open-market) and PRIVATE (negotiated) bids.
 */

export type BidType = "PUBLIC" | "PRIVATE";

export type BidStage = 
  | "BUDGET" 
  | "PROPOSAL_SUBMITTED" 
  | "SHORTLISTED" 
  | "NEGOTIATION" 
  | "VERBAL" 
  | "AWARDED" 
  | "LOST";

export type BidStatus = "ACTIVE" | "AWARDED" | "LOST" | "ARCHIVED";

export interface Bid {
  id: string;
  projectName: string;
  projectId?: string; // Optional link to existing project
  clientName?: string;
  bidType: BidType;
  stage?: BidStage; // Required for PRIVATE bids
  bidAmount: number; // In USD
  bidDueDate: string; // ISO date string
  status: BidStatus;
  probability?: number; // 0..1, computed or overridden
  probabilityOverride?: number; // Manual override (0..1)
  notes?: string;
  createdAt?: string; // ISO date string
  updatedAt?: string; // ISO date string
}

export interface ForecastContext {
  publicBaselineWinRate?: number; // Default 0.10
  privateStageProbabilities?: Record<BidStage, number>;
}

