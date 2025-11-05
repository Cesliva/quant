/**
 * TEMPORARY SAMPLE DATA FOR TESTING
 * 
 * TODO: REMOVE THIS FILE ONCE FIREBASE IS FULLY INTEGRATED
 * 
 * This file provides mock project data for testing the Reports page
 * and other features without requiring Firebase setup.
 * 
 * To disable sample data:
 * 1. Set USE_SAMPLE_DATA = false in reports/page.tsx
 * 2. Delete this file
 * 3. Remove imports of getSampleProjectData
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export interface SampleAIUsageLog {
  id: string;
  type: string;
  timestamp: any;
  cost: number;
  tokens?: number;
  duration?: number;
}

export interface SampleProjectData {
  lines: EstimatingLine[];
  aiUsage: SampleAIUsageLog[];
}

// Sample estimating lines for different project types
const sampleLines: Record<string, EstimatingLine[]> = {
  "1": [
    // Downtown Office Building - Structural Steel
    {
      id: "line-1",
      item: "Main Column W12x65",
      shape: "W-Beam",
      size: "W12x65",
      length: "20'-0\"",
      qty: 8,
      weight: 1040,
      surfaceArea: 520,
      laborHours: 12.5,
      cost: 15600,
    },
    {
      id: "line-2",
      item: "Floor Beam W16x40",
      shape: "W-Beam",
      size: "W16x40",
      length: "30'-0\"",
      qty: 24,
      weight: 2880,
      surfaceArea: 1440,
      laborHours: 36,
      cost: 43200,
    },
    {
      id: "line-3",
      item: "Girder W18x55",
      shape: "W-Beam",
      size: "W18x55",
      length: "40'-0\"",
      qty: 6,
      weight: 1320,
      surfaceArea: 660,
      laborHours: 15,
      cost: 19800,
    },
    {
      id: "line-4",
      item: "Angle Bracing L4x4x1/4",
      shape: "Angle",
      size: "L4x4x1/4",
      length: "12'-0\"",
      qty: 32,
      weight: 512,
      surfaceArea: 256,
      laborHours: 8,
      cost: 7680,
    },
    {
      id: "line-5",
      item: "Plate Gusset 1/2\"",
      shape: "Plate",
      size: "1/2\" x 12\" x 18\"",
      length: "",
      qty: 16,
      weight: 240,
      surfaceArea: 120,
      laborHours: 4,
      cost: 3600,
    },
    {
      id: "line-6",
      item: "Base Plate 1-1/4\"",
      shape: "Plate",
      size: "1-1/4\" x 18\" x 18\"",
      length: "",
      qty: 8,
      weight: 320,
      surfaceArea: 160,
      laborHours: 6,
      cost: 4800,
    },
  ],
  "2": [
    // Industrial Warehouse - Heavy Structural
    {
      id: "line-1",
      item: "Main Frame Column W14x90",
      shape: "W-Beam",
      size: "W14x90",
      length: "30'-0\"",
      qty: 12,
      weight: 3240,
      surfaceArea: 1620,
      laborHours: 45,
      cost: 48600,
    },
    {
      id: "line-2",
      item: "Rafter W18x76",
      shape: "W-Beam",
      size: "W18x76",
      length: "50'-0\"",
      qty: 18,
      weight: 6840,
      surfaceArea: 3420,
      laborHours: 90,
      cost: 102600,
    },
    {
      id: "line-3",
      item: "Purlin C8x13.75",
      shape: "Channel",
      size: "C8x13.75",
      length: "20'-0\"",
      qty: 60,
      weight: 1650,
      surfaceArea: 825,
      laborHours: 30,
      cost: 24750,
    },
    {
      id: "line-4",
      item: "Girt C6x10.5",
      shape: "Channel",
      size: "C6x10.5",
      length: "25'-0\"",
      qty: 48,
      weight: 1260,
      surfaceArea: 630,
      laborHours: 24,
      cost: 18900,
    },
    {
      id: "line-5",
      item: "Knee Brace L6x6x1/2",
      shape: "Angle",
      size: "L6x6x1/2",
      length: "8'-0\"",
      qty: 24,
      weight: 768,
      surfaceArea: 384,
      laborHours: 12,
      cost: 11520,
    },
    {
      id: "line-6",
      item: "Joist WT7x26.5",
      shape: "Tee",
      size: "WT7x26.5",
      length: "30'-0\"",
      qty: 20,
      weight: 1590,
      surfaceArea: 795,
      laborHours: 35,
      cost: 23850,
    },
  ],
  "3": [
    // Bridge Restoration - Heavy Plates and Beams
    {
      id: "line-1",
      item: "Main Girder W36x150",
      shape: "W-Beam",
      size: "W36x150",
      length: "60'-0\"",
      qty: 4,
      weight: 3600,
      surfaceArea: 1800,
      laborHours: 80,
      cost: 54000,
    },
    {
      id: "line-2",
      item: "Cross Beam W24x84",
      shape: "W-Beam",
      size: "W24x84",
      length: "20'-0\"",
      qty: 12,
      weight: 2016,
      surfaceArea: 1008,
      laborHours: 48,
      cost: 30240,
    },
    {
      id: "line-3",
      item: "Deck Plate 3/4\"",
      shape: "Plate",
      size: "3/4\" x 48\" x 120\"",
      length: "",
      qty: 8,
      weight: 1440,
      surfaceArea: 720,
      laborHours: 32,
      cost: 21600,
    },
    {
      id: "line-4",
      item: "Stiffener Plate 1/2\"",
      shape: "Plate",
      size: "1/2\" x 6\" x 24\"",
      length: "",
      qty: 40,
      weight: 400,
      surfaceArea: 200,
      laborHours: 10,
      cost: 6000,
    },
    {
      id: "line-5",
      item: "Bearing Plate 1-1/2\"",
      shape: "Plate",
      size: "1-1/2\" x 24\" x 24\"",
      length: "",
      qty: 8,
      weight: 480,
      surfaceArea: 240,
      laborHours: 12,
      cost: 7200,
    },
    {
      id: "line-6",
      item: "Diagonal Brace L5x5x3/8",
      shape: "Angle",
      size: "L5x5x3/8",
      length: "15'-0\"",
      qty: 16,
      weight: 600,
      surfaceArea: 300,
      laborHours: 8,
      cost: 9000,
    },
  ],
};

// Sample AI usage logs
const sampleAIUsage: Record<string, SampleAIUsageLog[]> = {
  "1": [
    {
      id: "ai-1",
      type: "whisper",
      timestamp: { toDate: () => new Date(Date.now() - 86400000) }, // 1 day ago
      cost: 0.024,
      duration: 4,
    },
    {
      id: "ai-2",
      type: "spec-review",
      timestamp: { toDate: () => new Date(Date.now() - 172800000) }, // 2 days ago
      cost: 0.15,
      tokens: 1250,
    },
    {
      id: "ai-3",
      type: "proposal",
      timestamp: { toDate: () => new Date(Date.now() - 259200000) }, // 3 days ago
      cost: 0.08,
      tokens: 800,
    },
  ],
  "2": [
    {
      id: "ai-1",
      type: "whisper",
      timestamp: { toDate: () => new Date(Date.now() - 43200000) }, // 12 hours ago
      cost: 0.036,
      duration: 6,
    },
    {
      id: "ai-2",
      type: "spec-review",
      timestamp: { toDate: () => new Date(Date.now() - 86400000) }, // 1 day ago
      cost: 0.18,
      tokens: 1500,
    },
    {
      id: "ai-3",
      type: "proposal",
      timestamp: { toDate: () => new Date(Date.now() - 172800000) }, // 2 days ago
      cost: 0.12,
      tokens: 1200,
    },
    {
      id: "ai-4",
      type: "spec-review",
      timestamp: { toDate: () => new Date(Date.now() - 345600000) }, // 4 days ago
      cost: 0.22,
      tokens: 1800,
    },
  ],
  "3": [
    {
      id: "ai-1",
      type: "whisper",
      timestamp: { toDate: () => new Date(Date.now() - 21600000) }, // 6 hours ago
      cost: 0.048,
      duration: 8,
    },
    {
      id: "ai-2",
      type: "spec-review",
      timestamp: { toDate: () => new Date(Date.now() - 43200000) }, // 12 hours ago
      cost: 0.25,
      tokens: 2100,
    },
    {
      id: "ai-3",
      type: "proposal",
      timestamp: { toDate: () => new Date(Date.now() - 86400000) }, // 1 day ago
      cost: 0.15,
      tokens: 1500,
    },
  ],
};

/**
 * Get sample project data for a given project ID
 * Returns default data if project ID not found
 */
export function getSampleProjectData(projectId: string): SampleProjectData {
  return {
    lines: sampleLines[projectId] || sampleLines["1"] || [],
    aiUsage: sampleAIUsage[projectId] || sampleAIUsage["1"] || [],
  };
}
