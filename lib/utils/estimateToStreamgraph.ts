/**
 * Estimate to Streamgraph Adapter
 * 
 * Maps Quant's EstimatingLine schema to chart-ready format
 * 
 * Schema Discovery (from Quant codebase):
 * - Firestore Path: companies/{companyId}/projects/{projectId}/lines
 * - Timeline: Uses updatedAt timestamps OR approvedBudget versions
 * - Category: EstimatingLine.category (Columns, Beams, Misc Metals, Plates, etc.)
 * - SubCategory: EstimatingLine.subCategory (Base Plate, Gusset, Stiffener, etc.)
 * - Metrics: totalCost, totalWeight/plateTotalWeight, totalLabor
 * - Baseline: First approved budget OR first data point
 */

import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { Timestamp } from "firebase/firestore";

export type ChartMetric = "totalCost" | "costPerTon" | "laborHoursPerTon" | "pctOfTotal" | "varianceVsBaseline";

export interface ChartPoint {
  t: string;                 // Timeline label: ISO date OR "v{version}" OR month/quarter
  category: string;          // From EstimatingLine.category
  subCategory?: string;      // From EstimatingLine.subCategory (optional)
  value: number;            // Computed per selected ChartMetric
  baselineValue?: number;    // Baseline value for variance calculation
  projectId?: string;       // Track which project this data point belongs to
  projectName?: string;      // For display in tooltips
}

export interface ChartSeries {
  category: string;
  subCategory?: string;
  points: ChartPoint[];
  color?: string;
}

export interface ApprovedBudget {
  approvedAt: string;
  version: number;
  lineItems?: Array<{
    lineId: string;
    itemDescription: string;
    materialCost: number;
    laborCost: number;
    coatingCost: number;
    hardwareCost: number;
    totalCost: number;
    weight: number;
    laborHours: number;
  }>;
}

/**
 * Extract timeline dimension from line data
 * Options:
 * 1. Time-based: Group by month/quarter from updatedAt
 * 2. Version-based: Use approvedBudget versions
 * 3. Project-based: Aggregate across projects
 */
export type TimelineMode = "time" | "version" | "project";

/**
 * Normalize EstimatingLine to ChartPoint
 */
function lineToChartPoint(
  line: EstimatingLine,
  metric: ChartMetric,
  timelineLabel: string,
  totalWeight: number,
  totalCost: number,
  baselineValue?: number
): ChartPoint {
  // Get weight (handles both Material and Plate types)
  const weight = line.materialType === "Material" 
    ? (line.totalWeight || 0)
    : (line.plateTotalWeight || 0);
  
  // Get labor hours
  const laborHours = line.totalLabor || 0;
  
  // Get cost
  const cost = line.totalCost || 0;
  
  // Calculate metric value
  let value = 0;
  switch (metric) {
    case "totalCost":
      value = cost;
      break;
    case "costPerTon":
      value = weight > 0 ? (cost / (weight / 2000)) : 0; // Convert lbs to tons
      break;
    case "laborHoursPerTon":
      value = weight > 0 ? (laborHours / (weight / 2000)) : 0;
      break;
    case "pctOfTotal":
      value = totalCost > 0 ? (cost / totalCost) * 100 : 0;
      break;
    case "varianceVsBaseline":
      value = baselineValue !== undefined ? cost - (baselineValue || 0) : 0;
      break;
  }
  
  return {
    t: timelineLabel,
    category: line.category || "Uncategorized",
    subCategory: line.subCategory || undefined,
    value,
    baselineValue,
  };
}

/**
 * Group lines by timeline dimension
 */
function groupByTimeline(
  lines: EstimatingLine[],
  mode: TimelineMode,
  approvedBudgets?: ApprovedBudget[]
): Map<string, EstimatingLine[]> {
  const groups = new Map<string, EstimatingLine[]>();
  
  if (mode === "version" && approvedBudgets && approvedBudgets.length > 0) {
    // Group by approved budget version
    approvedBudgets.forEach((budget) => {
      const label = `v${budget.version}`;
      if (budget.lineItems) {
        // Map lineItems back to EstimatingLine format
        const budgetLines = budget.lineItems.map((item) => ({
          category: "Unknown", // Will need to match by lineId
          subCategory: "",
          totalCost: item.totalCost,
          totalWeight: item.weight,
          totalLabor: item.laborHours,
          materialType: "Material" as const,
          status: "Active" as const,
          lineId: item.lineId,
          itemDescription: item.itemDescription,
        })) as EstimatingLine[];
        groups.set(label, budgetLines);
      }
    });
  } else if (mode === "time") {
    // Group by month from updatedAt (if available) or createdAt
    lines.forEach((line) => {
      const timestamp = (line as any).updatedAt || (line as any).createdAt;
      let date: Date;
      
      if (timestamp instanceof Timestamp) {
        date = timestamp.toDate();
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else if (typeof timestamp === "string") {
        date = new Date(timestamp);
      } else {
        // Fallback to current date if no timestamp
        date = new Date();
      }
      
      const monthLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      if (!groups.has(monthLabel)) {
        groups.set(monthLabel, []);
      }
      groups.get(monthLabel)!.push(line);
    });
  } else {
    // Project mode: group by project (if projectId/projectName is available in lines)
    // Otherwise, group by category to show different categories as separate timeline points
    const projectGroups = new Map<string, EstimatingLine[]>();
    lines.forEach((line) => {
      // Try to get project info from line metadata
      const projectId = (line as any)._projectId || (line as any).projectId;
      const projectName = (line as any)._projectName || (line as any).projectName;
      const key = projectId || projectName || "All Projects";
      
      if (!projectGroups.has(key)) {
        projectGroups.set(key, []);
      }
      projectGroups.get(key)!.push(line);
    });
    
    // If we have multiple projects, use project names as timeline labels
    if (projectGroups.size > 1) {
      projectGroups.forEach((projectLines, projectKey) => {
        const projectName = projectLines[0]?._projectName || projectKey;
        groups.set(projectName, projectLines);
      });
    } else {
      // If only one project or no project info, group by category instead
      const categoryGroups = new Map<string, EstimatingLine[]>();
      lines.forEach((line) => {
        const category = line.category || "Uncategorized";
        if (!categoryGroups.has(category)) {
          categoryGroups.set(category, []);
        }
        categoryGroups.get(category)!.push(line);
      });
      
      // Use categories as timeline points to show them separately
      categoryGroups.forEach((categoryLines, category) => {
        groups.set(category, categoryLines);
      });
    }
  }
  
  return groups;
}

/**
 * Transform EstimatingLines to ChartPoints
 */
export function transformToChartPoints(
  lines: EstimatingLine[],
  metric: ChartMetric,
  mode: TimelineMode = "time",
  approvedBudgets?: ApprovedBudget[],
  projectId?: string,
  projectName?: string
): ChartPoint[] {
  // Filter active lines only
  const activeLines = lines.filter((line) => line.status !== "Void");
  
  if (activeLines.length === 0) {
    return [];
  }
  
  // Group by timeline
  const timelineGroups = groupByTimeline(activeLines, mode, approvedBudgets);
  
  // Calculate totals for percentage calculations
  const totalCost = activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0);
  const totalWeight = activeLines.reduce((sum, line) => {
    const weight = line.materialType === "Material" 
      ? (line.totalWeight || 0)
      : (line.plateTotalWeight || 0);
    return sum + weight;
  }, 0);
  
  // Determine baseline (first timeline point or first approved budget)
  let baseline: Map<string, number> | undefined;
  if (metric === "varianceVsBaseline") {
    baseline = new Map();
    const sortedTimelines = Array.from(timelineGroups.keys()).sort();
    if (sortedTimelines.length > 0) {
      const firstTimeline = sortedTimelines[0];
      const firstLines = timelineGroups.get(firstTimeline) || [];
      
      // Calculate baseline values per category
      firstLines.forEach((line) => {
        const key = `${line.category}${line.subCategory ? `|${line.subCategory}` : ""}`;
        const current = baseline!.get(key) || 0;
        baseline!.set(key, current + (line.totalCost || 0));
      });
    }
  }
  
  // Transform to chart points
  const chartPoints: ChartPoint[] = [];
  
  timelineGroups.forEach((groupLines, timelineLabel) => {
    // Calculate totals for this timeline point
    const timelineTotalCost = groupLines.reduce((sum, line) => sum + (line.totalCost || 0), 0);
    const timelineTotalWeight = groupLines.reduce((sum, line) => {
      const weight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);
    
    // Group by category/subcategory for this timeline
    const categoryGroups = new Map<string, EstimatingLine[]>();
    groupLines.forEach((line) => {
      // Ensure category is always set - use "Uncategorized" if missing
      const category = line.category || "Uncategorized";
      const subCategory = line.subCategory || "";
      const key = `${category}|${subCategory}`;
      if (!categoryGroups.has(key)) {
        categoryGroups.set(key, []);
      }
      categoryGroups.get(key)!.push(line);
    });
    
    // Create chart points for each category/subcategory
    categoryGroups.forEach((categoryLines, key) => {
      const [category, subCategory] = key.split("|");
      
      // Aggregate values for this category
      const aggregatedCost = categoryLines.reduce((sum, line) => sum + (line.totalCost || 0), 0);
      const aggregatedWeight = categoryLines.reduce((sum, line) => {
        const weight = line.materialType === "Material" 
          ? (line.totalWeight || 0)
          : (line.plateTotalWeight || 0);
        return sum + weight;
      }, 0);
      const aggregatedLabor = categoryLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
      
      // Calculate metric value
      let value = 0;
      let baselineValue: number | undefined;
      
      switch (metric) {
        case "totalCost":
          value = aggregatedCost;
          break;
        case "costPerTon":
          value = aggregatedWeight > 0 ? (aggregatedCost / (aggregatedWeight / 2000)) : 0;
          break;
        case "laborHoursPerTon":
          value = aggregatedWeight > 0 ? (aggregatedLabor / (aggregatedWeight / 2000)) : 0;
          break;
        case "pctOfTotal":
          value = totalCost > 0 ? (aggregatedCost / totalCost) * 100 : 0;
          break;
        case "varianceVsBaseline":
          if (baseline) {
            baselineValue = baseline.get(key) || 0;
            value = aggregatedCost - baselineValue;
          }
          break;
      }
      
      chartPoints.push({
        t: timelineLabel,
        category,
        subCategory: subCategory || undefined,
        value,
        baselineValue,
        projectId,
        projectName,
      });
    });
  });
  
  return chartPoints;
}

/**
 * Aggregate chart points into series for streamgraph
 */
export function aggregateToSeries(
  points: ChartPoint[],
  includeSubCategories: boolean = false
): ChartSeries[] {
  const seriesMap = new Map<string, ChartSeries>();
  
  points.forEach((point) => {
    const key = includeSubCategories && point.subCategory
      ? `${point.category}|${point.subCategory}`
      : point.category;
    
    if (!seriesMap.has(key)) {
      seriesMap.set(key, {
        category: point.category,
        subCategory: includeSubCategories ? point.subCategory : undefined,
        points: [],
      });
    }
    
    seriesMap.get(key)!.points.push(point);
  });
  
  // Sort points by timeline
  seriesMap.forEach((series) => {
    series.points.sort((a, b) => a.t.localeCompare(b.t));
  });
  
  return Array.from(seriesMap.values());
}

