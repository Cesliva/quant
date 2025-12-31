/**
 * Bid Forecast Calculation Service
 * 
 * Handles probability calculations and forecast totals for bids.
 * All forecast logic is centralized here.
 */

import { Bid, BidType, BidStage, ForecastContext } from "./types";

/**
 * Default probability map for private bid stages
 */
const DEFAULT_PRIVATE_STAGE_PROBABILITIES: Record<BidStage, number> = {
  BUDGET: 0.20,
  PROPOSAL_SUBMITTED: 0.35,
  SHORTLISTED: 0.55,
  NEGOTIATION: 0.75,
  VERBAL: 0.90,
  AWARDED: 1.00,
  LOST: 0.00,
};

/**
 * Default forecast context
 */
const DEFAULT_CONTEXT: ForecastContext = {
  publicBaselineWinRate: 0.10,
  privateStageProbabilities: DEFAULT_PRIVATE_STAGE_PROBABILITIES,
};

/**
 * Compute probability for a bid based on type, stage, and context
 * 
 * Rules:
 * - If status != "ACTIVE": return 0 (unless AWARDED which returns 1)
 * - PUBLIC bids: use publicBaselineWinRate, capped between 0.02 and 0.25
 * - PRIVATE bids: use stage-based probability map
 * - Allow override via bid.probability or bid.probabilityOverride
 */
export function computeBidProbability(
  bid: Bid,
  context: ForecastContext = DEFAULT_CONTEXT
): number {
  // If not active, return 0 (unless awarded)
  if (bid.status !== "ACTIVE") {
    if (bid.status === "AWARDED") {
      return 1.0;
    }
    return 0.0;
  }

  // Check for manual override
  if (bid.probabilityOverride !== undefined) {
    return Math.max(0, Math.min(1, bid.probabilityOverride));
  }

  // If probability is explicitly set, use it (but still apply caps for PUBLIC)
  if (bid.probability !== undefined) {
    if (bid.bidType === "PUBLIC") {
      return Math.max(0.02, Math.min(0.25, bid.probability));
    }
    return Math.max(0, Math.min(1, bid.probability));
  }

  // Calculate based on bid type
  if (bid.bidType === "PUBLIC") {
    const baseline = context.publicBaselineWinRate ?? DEFAULT_CONTEXT.publicBaselineWinRate!;
    // Cap public probability between 0.02 and 0.25
    return Math.max(0.02, Math.min(0.25, baseline));
  }

  // PRIVATE bid - use stage-based probability
  if (bid.bidType === "PRIVATE") {
    if (!bid.stage) {
      // Default to BUDGET if no stage specified
      const probabilities = context.privateStageProbabilities ?? DEFAULT_PRIVATE_STAGE_PROBABILITIES;
      return probabilities.BUDGET;
    }

    const probabilities = context.privateStageProbabilities ?? DEFAULT_PRIVATE_STAGE_PROBABILITIES;
    return probabilities[bid.stage] ?? probabilities.BUDGET;
  }

  // Fallback
  return 0.0;
}

/**
 * Calculate expected award value for a bid
 */
export function computeExpectedAward(
  bid: Bid,
  context?: ForecastContext
): number {
  const probability = computeBidProbability(bid, context);
  return bid.bidAmount * probability;
}

/**
 * Calculate total bid forecast from array of bids
 */
export interface BidForecastTotals {
  total: number;
  publicTotal: number;
  privateTotal: number;
  byStage: Record<BidStage, number>;
  counts: {
    total: number;
    public: number;
    private: number;
    byStatus: Record<BidStatus, number>;
  };
}

export function calculateBidForecast(
  bids: Bid[],
  context: ForecastContext = DEFAULT_CONTEXT,
  options?: {
    activeOnly?: boolean;
    dateHorizonDays?: number; // Filter bids within date horizon
  }
): BidForecastTotals {
  const activeOnly = options?.activeOnly ?? true;
  const dateHorizonDays = options?.dateHorizonDays;

  // Filter bids
  let filteredBids = bids;

  if (activeOnly) {
    filteredBids = filteredBids.filter(b => b.status === "ACTIVE");
  }

  if (dateHorizonDays !== undefined) {
    const horizonDate = new Date();
    horizonDate.setDate(horizonDate.getDate() + dateHorizonDays);
    filteredBids = filteredBids.filter(b => {
      const dueDate = new Date(b.bidDueDate);
      return dueDate <= horizonDate;
    });
  }

  // Calculate totals
  let total = 0;
  let publicTotal = 0;
  let privateTotal = 0;
  const byStage: Record<BidStage, number> = {
    BUDGET: 0,
    PROPOSAL_SUBMITTED: 0,
    SHORTLISTED: 0,
    NEGOTIATION: 0,
    VERBAL: 0,
    AWARDED: 0,
    LOST: 0,
  };

  const counts = {
    total: filteredBids.length,
    public: 0,
    private: 0,
    byStatus: {
      ACTIVE: 0,
      AWARDED: 0,
      LOST: 0,
      ARCHIVED: 0,
    } as Record<BidStatus, number>,
  };

  filteredBids.forEach(bid => {
    const expectedAward = computeExpectedAward(bid, context);
    total += expectedAward;

    if (bid.bidType === "PUBLIC") {
      publicTotal += expectedAward;
      counts.public++;
    } else {
      privateTotal += expectedAward;
      counts.private++;
      if (bid.stage) {
        byStage[bid.stage] += expectedAward;
      }
    }

    counts.byStatus[bid.status]++;
  });

  return {
    total,
    publicTotal,
    privateTotal,
    byStage,
    counts,
  };
}

