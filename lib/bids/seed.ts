/**
 * Seeded Sample Bid Data
 * 
 * Realistic construction/steel bid data for dev/demo purposes.
 */

import { Bid } from "./types";

export const SEEDED_BIDS: Bid[] = [
  // PUBLIC BIDS (6 bids)
  {
    id: "bid-001",
    projectName: "Downtown Office Tower - Structural Steel",
    clientName: "Metro Construction Group",
    bidType: "PUBLIC",
    bidAmount: 1200000,
    bidDueDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(), // 21 days
    status: "ACTIVE",
    probability: 0.10, // Baseline
    notes: "Large public project, competitive bidding",
  },
  {
    id: "bid-002",
    projectName: "Regional Hospital Expansion",
    clientName: "Healthcare Builders Inc",
    bidType: "PUBLIC",
    bidAmount: 450000,
    bidDueDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days
    status: "ACTIVE",
    probability: 0.08, // Slightly below baseline
    notes: "Medical facility, strict specs",
  },
  {
    id: "bid-003",
    projectName: "Municipal Sports Complex",
    clientName: "City of Springfield",
    bidType: "PUBLIC",
    bidAmount: 2800000,
    bidDueDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
    status: "ACTIVE",
    probability: 0.12, // Above baseline
    notes: "Public works project, good relationship with city",
  },
  {
    id: "bid-004",
    projectName: "Community College Science Building",
    clientName: "State University System",
    bidType: "PUBLIC",
    bidAmount: 875000,
    bidDueDate: new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString(), // 35 days
    status: "ACTIVE",
    probability: 0.10, // Baseline
    notes: "Educational facility, standard public bid",
  },
  {
    id: "bid-005",
    projectName: "Highway Bridge Replacement",
    clientName: "State DOT",
    bidType: "PUBLIC",
    bidAmount: 3200000,
    bidDueDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
    status: "ACTIVE",
    probability: 0.06, // Lower due to complexity
    notes: "Infrastructure project, high competition expected",
  },
  {
    id: "bid-006",
    projectName: "Warehouse Distribution Center",
    clientName: "Logistics Partners LLC",
    bidType: "PUBLIC",
    bidAmount: 650000,
    bidDueDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString(), // 28 days
    status: "ACTIVE",
    probability: 0.10, // Baseline
    notes: "Industrial project, straightforward scope",
  },

  // PRIVATE BIDS (6 bids across stages)
  {
    id: "bid-007",
    projectName: "Corporate Headquarters Renovation",
    clientName: "TechCorp Industries",
    bidType: "PRIVATE",
    stage: "BUDGET",
    bidAmount: 950000,
    bidDueDate: new Date(Date.now() + 40 * 24 * 60 * 60 * 1000).toISOString(), // 40 days
    status: "ACTIVE",
    notes: "Early stage, providing budget estimate",
  },
  {
    id: "bid-008",
    projectName: "Luxury Residential High-Rise",
    clientName: "Premier Developers",
    bidType: "PRIVATE",
    stage: "PROPOSAL_SUBMITTED",
    bidAmount: 2100000,
    bidDueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
    status: "ACTIVE",
    notes: "Proposal submitted, awaiting response",
  },
  {
    id: "bid-009",
    projectName: "Manufacturing Facility Expansion",
    clientName: "Industrial Solutions Group",
    bidType: "PRIVATE",
    stage: "SHORTLISTED",
    bidAmount: 1800000,
    bidDueDate: new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString(), // 50 days
    status: "ACTIVE",
    notes: "Made shortlist, in final consideration",
  },
  {
    id: "bid-010",
    projectName: "Mixed-Use Development - Phase 2",
    clientName: "Urban Development Partners",
    bidType: "PRIVATE",
    stage: "NEGOTIATION",
    bidAmount: 3200000,
    bidDueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(), // 25 days
    status: "ACTIVE",
    notes: "Negotiating final terms and pricing",
  },
  {
    id: "bid-011",
    projectName: "Retail Shopping Center",
    clientName: "Commercial Realty Holdings",
    bidType: "PRIVATE",
    stage: "VERBAL",
    bidAmount: 600000,
    bidDueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days
    status: "ACTIVE",
    notes: "Verbal commitment received, awaiting contract",
  },
  {
    id: "bid-012",
    projectName: "Hospitality Complex - Hotel & Conference",
    clientName: "Hospitality Ventures",
    bidType: "PRIVATE",
    stage: "SHORTLISTED",
    bidAmount: 1450000,
    bidDueDate: new Date(Date.now() + 70 * 24 * 60 * 60 * 1000).toISOString(), // 70 days
    status: "ACTIVE",
    notes: "Shortlisted, preparing final presentation",
  },

  // Non-active examples (should show 0 expected in active-only mode)
  {
    id: "bid-013",
    projectName: "Office Park Building A",
    clientName: "Commercial Developers",
    bidType: "PRIVATE",
    stage: "AWARDED",
    bidAmount: 1250000,
    bidDueDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
    status: "AWARDED",
    notes: "Successfully awarded project",
  },
  {
    id: "bid-014",
    projectName: "Industrial Warehouse Complex",
    clientName: "Distribution Solutions",
    bidType: "PUBLIC",
    bidAmount: 890000,
    bidDueDate: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 days ago
    status: "LOST",
    notes: "Lost to competitor, lower bid",
  },
];

