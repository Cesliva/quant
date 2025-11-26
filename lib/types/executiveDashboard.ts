/**
 * Executive Dashboard Type Definitions
 * Data models for executive KPI tracking and decision support
 */

export interface PendingDecision {
  id?: string;
  projectId: string;
  projectName: string;
  description: string;
  priority: "high" | "medium" | "low";
  createdBy: string;
  createdAt: any;
  dueDate?: string;
  resolved: boolean;
  resolvedAt?: any;
  resolvedBy?: string;
}

export interface Estimator {
  id: string;
  name: string;
  weeklyCapacityHours: number;
  email?: string;
  active?: boolean;
}

export interface CompanyRedFlag {
  id?: string;
  description: string;
  category: "supply-chain" | "competitor" | "market" | "internal" | "other";
  severity: "high" | "medium" | "low";
  createdAt: any;
  resolved: boolean;
  resolvedAt?: any;
}

export interface SpecReviewSummary {
  projectId: string;
  category: "structural-steel" | "misc-metals" | "div-01" | "div-09" | "aess-noma" | "div-03";
  overallRiskGrade?: "A" | "B" | "C" | "D" | "F";
  riskScore?: number; // 1-3 (High=3, Medium=2, Low=1)
  lastAnalyzed?: any;
}

export interface BacklogGap {
  startDate: Date;
  endDate: Date;
  usedHours: number;
  capacityHours: number;
  utilization: number; // 0-1
}

export interface ExecutiveKPIMetrics {
  weightedPipelineValue: number;
  backlogMonthsSecured: number;
  winRate90Days: number;
  marginTrend: {
    awarded: number;
    lost: number;
    difference: number;
  };
  riskExposureIndex: {
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  backlogGaps?: BacklogGap[]; // Capacity gaps where shop is under-utilized
}

