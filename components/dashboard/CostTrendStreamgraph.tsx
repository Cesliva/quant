"use client";

/**
 * Cost Trend Analysis Chart
 * 
 * Zero-centered diverging streamgraph showing man hours per ton by department
 * Data flows from zero center in both +y and -y directions like water
 * Shows collective data with optional individual project overlay
 */

import { useState, useMemo } from "react";
import { 
  ChartPoint, 
  ChartSeries, 
  ChartMetric,
  transformToChartPoints,
  aggregateToSeries,
  ApprovedBudget,
} from "@/lib/utils/estimateToStreamgraph";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { BarChart3 } from "lucide-react";

interface CostTrendStreamgraphProps {
  lines: EstimatingLine[];
  approvedBudgets?: ApprovedBudget[];
  projectId?: string;
  projectName?: string;
  companyId: string;
  onCategoryClick?: (category: string, subCategory?: string) => void;
  projects?: Array<{ id: string; name?: string; status?: string; projectNumber?: string }>;
}

// Refined color palette - softer, more professional
const MATERIAL_COLORS: Record<string, string> = {
  "Columns": "#3b82f6",      // Blue
  "Beams": "#10b981",        // Green
  "Misc Metals": "#f59e0b",  // Amber
  "Plates": "#ef4444",       // Red
  "Structural": "#8b5cf6",    // Purple
  "Uncategorized": "#94a3b8", // Gray
};

// Labor category colors
const LABOR_COLORS: Record<string, string> = {
  "Unload": "#3b82f6",        // Blue
  "Cut": "#10b981",           // Green
  "Cope": "#8b5cf6",          // Purple
  "Process Plate": "#f59e0b", // Amber
  "Drill/Punch": "#ef4444",   // Red
  "Fit": "#06b6d4",           // Cyan
  "Weld": "#f97316",          // Orange
  "Prep/Clean": "#84cc16",    // Lime
  "Paint": "#ec4899",         // Pink
  "Handle/Move": "#6366f1",   // Indigo
  "Load/Ship": "#14b8a6",     // Teal
};

// Labor category definitions
const LABOR_CATEGORIES = [
  { key: "Unload", field: "laborUnload" },
  { key: "Cut", field: "laborCut" },
  { key: "Cope", field: "laborCope" },
  { key: "Process Plate", field: "laborProcessPlate" },
  { key: "Drill/Punch", field: "laborDrillPunch" },
  { key: "Fit", field: "laborFit" },
  { key: "Weld", field: "laborWeld" },
  { key: "Prep/Clean", field: "laborPrepClean" },
  { key: "Paint", field: "laborPaint" },
  { key: "Handle/Move", field: "laborHandleMove" },
  { key: "Load/Ship", field: "laborLoadShip" },
];

function getCategoryColor(category: string, index: number, isLabor: boolean = false): string {
  if (isLabor && LABOR_COLORS[category]) {
    return LABOR_COLORS[category];
  }
  if (!isLabor && MATERIAL_COLORS[category]) {
    return MATERIAL_COLORS[category];
  }
  // Generate distinct color using golden angle
  const hue = (index * 137.5) % 360;
  return `hsl(${hue}, 65%, 55%)`;
}

/**
 * Transform lines to chart points grouped by labor categories
 * X-axis = Labor categories (Unload, Cut, Fit, Weld, etc.)
 * Y-axis = Man Hours per Ton for each category
 * Each category flows from zero outward
 */
function transformToLaborChartPoints(
  lines: EstimatingLine[],
  metric: ChartMetric,
  approvedBudgets?: ApprovedBudget[]
): ChartPoint[] {
  const chartPoints: ChartPoint[] = [];
  
  // Filter active lines
  const activeLines = lines.filter((line) => line.status !== "Void");
  
  if (activeLines.length === 0) {
    return [];
  }
  
  // Calculate total weight across all projects
  const totalWeight = activeLines.reduce((sum, line) => {
    const weight = line.materialType === "Material" 
      ? (line.totalWeight || 0)
      : (line.plateTotalWeight || 0);
    return sum + weight;
  }, 0);
  
  // For each labor category, calculate its total MHPT across all projects
  // Each labor category becomes a timeline point (X-axis position)
  LABOR_CATEGORIES.forEach((laborCat) => {
    // Sum labor hours for this category across all lines
    const totalLaborHours = activeLines.reduce((sum, line) => {
      const value = (line as any)[laborCat.field] || 0;
      return sum + (typeof value === "number" ? value : 0);
    }, 0);
    
    // Calculate MHPT for this labor category
    let value = 0;
    if (metric === "laborHoursPerTon") {
      value = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
    } else if (metric === "costPerTon") {
      const totalCost = activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0);
      value = totalWeight > 0 ? (totalCost / (totalWeight / 2000)) : 0;
    }
    
    // Create a chart point for this labor category
    // The timeline label (t) is the labor category name
    // The category field can be used for grouping if needed
    // The value is the MHPT for this labor category
    if (totalLaborHours > 0 || value > 0) {
      chartPoints.push({
        t: laborCat.key, // X-axis position = labor category name
        category: laborCat.key, // Use same for category
        value, // Y-axis value = MHPT for this category
      });
    }
  });
  
  return chartPoints;
}

/**
 * Calculate zero-centered diverging streamgraph layout
 * Each category's total is split 50/50 between positive (above) and negative (below) sides
 * Outer bands on both sides equal the total man hours per department
 */
function calculateStreamgraphLayout(
  series: ChartSeries[],
  timeline: string[],
  isLaborBreakdown: boolean = false
): { 
  paths: Array<{ category: string; subCategory?: string; path: string; color: string }>; 
  outerBandPath: string; // Solid line showing total MHPT per project (top + bottom = total)
  maxValue: number;
  minValue: number;
} {
  if (series.length === 0 || timeline.length === 0) {
    return { paths: [], outerBandPath: "", maxValue: 0, minValue: 0 };
  }
  
  // For labor breakdown: X-axis = labor categories, each flows independently from zero
  if (isLaborBreakdown) {
    // Find max absolute value for scaling
    let maxAbsValue = 0;
    series.forEach((s) => {
      s.points.forEach((p) => {
        maxAbsValue = Math.max(maxAbsValue, Math.abs(p.value));
      });
    });
    
    const maxValue = maxAbsValue || 1;
    const minValue = -maxAbsValue;
    const centerY = 50;
    
    // Build data matrix: timeline (labor categories) x series
    const dataMatrix: number[][] = timeline.map(() => new Array(series.length).fill(0));
    
    series.forEach((s, seriesIndex) => {
      const pointMap = new Map(s.points.map(p => [p.t, p.value]));
      timeline.forEach((t, timeIndex) => {
        dataMatrix[timeIndex][seriesIndex] = pointMap.get(t) || 0;
      });
    });
    
    // Create paths - each series represents a different grouping
    // In labor breakdown, typically one series with all categories
    const paths = series.map((s, seriesIndex) => {
      const topPoints: Array<{x: number, y: number}> = [];
      const bottomPoints: Array<{x: number, y: number}> = [];
      
      timeline.forEach((t, timeIndex) => {
        const x = timeline.length > 1 
          ? (timeIndex / (timeline.length - 1)) * 100 
          : 50;
        
        // Get value for this labor category
        const value = dataMatrix[timeIndex][seriesIndex];
        const halfValue = value / 2; // Split 50/50
        
        // Top point (positive side) - flows from center outward
        const topY = centerY - ((halfValue / maxValue) * 50);
        topPoints.push({ x, y: topY });
        
        // Bottom point (negative side) - flows from center outward
        const bottomY = centerY - ((-halfValue / maxValue) * 50);
        bottomPoints.push({ x, y: bottomY });
      });
      
      // Create path that flows from zero at each category
      // Start at center, flow out, connect categories, return to center
      let path = `M ${topPoints[0].x} ${centerY}`; // Start at center
      path += ` L ${topPoints[0].x} ${topPoints[0].y}`; // Flow out to top
      
      // Top curve connecting all categories
      for (let i = 0; i < topPoints.length - 1; i++) {
        const current = topPoints[i];
        const next = topPoints[i + 1];
        const controlX1 = current.x + (next.x - current.x) * 0.5;
        const controlY1 = current.y;
        const controlX2 = current.x + (next.x - current.x) * 0.5;
        const controlY2 = next.y;
        path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
      }
      
      // Connect back to center at last point
      const lastTop = topPoints[topPoints.length - 1];
      path += ` L ${lastTop.x} ${centerY}`;
      
      // Bottom curve (negative side) - reverse order
      const lastBottom = bottomPoints[bottomPoints.length - 1];
      path += ` L ${lastBottom.x} ${centerY}`;
      path += ` L ${lastBottom.x} ${lastBottom.y}`;
      
      for (let i = bottomPoints.length - 1; i > 0; i--) {
        const current = bottomPoints[i];
        const prev = bottomPoints[i - 1];
        const controlX1 = current.x - (current.x - prev.x) * 0.5;
        const controlY1 = current.y;
        const controlX2 = current.x - (current.x - prev.x) * 0.5;
        const controlY2 = prev.y;
        path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${prev.x} ${prev.y}`;
      }
      
      // Connect to first bottom point and back to center
      const firstBottom = bottomPoints[0];
      path += ` L ${firstBottom.x} ${firstBottom.y}`;
      path += ` L ${firstBottom.x} ${centerY}`;
      path += ' Z'; // Close path
      
      return {
        category: s.category,
        subCategory: s.subCategory,
        path,
        color: getCategoryColor(s.category, seriesIndex, true),
      };
    });
    
    // Create outer band showing total MHPT per labor category
    const topOuterPoints: Array<{x: number, y: number}> = [];
    const bottomOuterPoints: Array<{x: number, y: number}> = [];
    
    timeline.forEach((t, timeIndex) => {
      const x = timeline.length > 1 
        ? (timeIndex / (timeline.length - 1)) * 100 
        : 50;
      
      // Sum all series values for this timeline point (labor category)
      const total = series.reduce((sum, s, sIdx) => {
        return sum + dataMatrix[timeIndex][sIdx];
      }, 0);
      
      const halfTotal = total / 2;
      
      // Top point (positive side)
      const topY = centerY - ((halfTotal / maxValue) * 50);
      topOuterPoints.push({ x, y: topY });
      
      // Bottom point (negative side)
      const bottomY = centerY - ((-halfTotal / maxValue) * 50);
      bottomOuterPoints.push({ x, y: bottomY });
    });
    
    // Create outer band path
    let outerBandPath = `M ${topOuterPoints[0].x} ${centerY}`;
    outerBandPath += ` L ${topOuterPoints[0].x} ${topOuterPoints[0].y}`;
    for (let i = 0; i < topOuterPoints.length - 1; i++) {
      const current = topOuterPoints[i];
      const next = topOuterPoints[i + 1];
      const controlX1 = current.x + (next.x - current.x) * 0.5;
      const controlY1 = current.y;
      const controlX2 = current.x + (next.x - current.x) * 0.5;
      const controlY2 = next.y;
      outerBandPath += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
    }
    const lastTop = topOuterPoints[topOuterPoints.length - 1];
    outerBandPath += ` L ${lastTop.x} ${centerY}`;
    outerBandPath += ` L ${bottomOuterPoints[bottomOuterPoints.length - 1].x} ${bottomOuterPoints[bottomOuterPoints.length - 1].y}`;
    for (let i = bottomOuterPoints.length - 1; i > 0; i--) {
      const current = bottomOuterPoints[i];
      const next = bottomOuterPoints[i - 1];
      const controlX1 = current.x - (current.x - next.x) * 0.5;
      const controlY1 = current.y;
      const controlX2 = current.x - (current.x - next.x) * 0.5;
      const controlY2 = next.y;
      outerBandPath += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
    }
    const firstBottom = bottomOuterPoints[0];
    outerBandPath += ` L ${firstBottom.x} ${firstBottom.y}`;
    outerBandPath += ` L ${firstBottom.x} ${centerY}`;
    outerBandPath += ' Z';
    
    return { paths, outerBandPath, maxValue, minValue };
  }
  
  // Original material categories logic (stacked by project)
  // Build data matrix: timeline x series
  const dataMatrix: number[][] = timeline.map(() => new Array(series.length).fill(0));
  
  series.forEach((s, seriesIndex) => {
    const pointMap = new Map(s.points.map(p => [p.t, p.value]));
    timeline.forEach((t, timeIndex) => {
      dataMatrix[timeIndex][seriesIndex] = pointMap.get(t) || 0;
    });
  });
  
  // Calculate total MHPT per project (sum of all departments)
  const projectTotals: number[] = timeline.map((_, timeIndex) => {
    return series.reduce((sum, _, seriesIndex) => {
      return sum + dataMatrix[timeIndex][seriesIndex];
    }, 0);
  });
  
  // Find max total for scaling - split 50/50 above and below center
  const maxTotal = Math.max(...projectTotals, 1);
  const maxValue = maxTotal / 2; // Half goes positive, half negative
  const minValue = -maxTotal / 2;
  
  // Center line is at 50% (y = 50)
  const centerY = 50;
  
  // Calculate cumulative stacks for positive (above center) and negative (below center)
  // Each category contributes 50% of its value to positive side, 50% to negative side
  const positiveCumulative: number[][] = timeline.map(() => new Array(series.length).fill(0));
  const negativeCumulative: number[][] = timeline.map(() => new Array(series.length).fill(0));
  
  timeline.forEach((_, timeIndex) => {
    let posSum = 0;
    let negSum = 0;
    
    series.forEach((_, seriesIndex) => {
      const value = dataMatrix[timeIndex][seriesIndex];
      const halfValue = value / 2; // Split 50/50
      
      // Positive side (above center)
      positiveCumulative[timeIndex][seriesIndex] = posSum;
      posSum += halfValue;
      
      // Negative side (below center) - stored as negative values
      negativeCumulative[timeIndex][seriesIndex] = -negSum;
      negSum += halfValue;
    });
  });
  
  // Generate SVG paths with wave pattern
  const paths = series.map((s, seriesIndex) => {
    const topPoints: Array<{x: number, y: number}> = [];
    const bottomPoints: Array<{x: number, y: number}> = [];
    
    timeline.forEach((t, timeIndex) => {
      const x = timeline.length > 1 
        ? (timeIndex / (timeline.length - 1)) * 100 
        : 50;
      
      const value = dataMatrix[timeIndex][seriesIndex];
      const halfValue = value / 2;
      
      // Positive side (above center)
      const posBottom = positiveCumulative[timeIndex][seriesIndex];
      const posTop = posBottom + halfValue;
      
      // Negative side (below center)
      const negTop = negativeCumulative[timeIndex][seriesIndex];
      const negBottom = negTop - halfValue;
      
      // Convert to Y coordinates (centered at 50%)
      const topY = centerY - ((posTop / maxValue) * 50);
      const bottomY = centerY - ((negBottom / maxValue) * 50);
      
      topPoints.push({ x, y: topY });
      bottomPoints.push({ x, y: bottomY });
    });
    
    // Create smooth curve for top edge (positive side)
    let path = `M ${topPoints[0].x} ${topPoints[0].y}`;
    for (let i = 0; i < topPoints.length - 1; i++) {
      const current = topPoints[i];
      const next = topPoints[i + 1];
      const controlX1 = current.x + (next.x - current.x) * 0.5;
      const controlY1 = current.y;
      const controlX2 = current.x + (next.x - current.x) * 0.5;
      const controlY2 = next.y;
      path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
    }
    
    // Close path along bottom (negative side, reverse order)
    for (let i = bottomPoints.length - 1; i >= 0; i--) {
      if (i === bottomPoints.length - 1) {
        path += ` L ${bottomPoints[i].x} ${bottomPoints[i].y}`;
      } else {
        const current = bottomPoints[i + 1];
        const next = bottomPoints[i];
        const controlX1 = current.x - (current.x - next.x) * 0.5;
        const controlY1 = current.y;
        const controlX2 = current.x - (current.x - next.x) * 0.5;
        const controlY2 = next.y;
        path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
      }
    }
    
    path += ' Z';
    
    return {
      category: s.category,
      subCategory: s.subCategory,
      path,
      color: getCategoryColor(s.category, seriesIndex),
    };
  });
  
  // Generate outer band paths (top and bottom) - showing total MHPT per project
  const topOuterPoints: Array<{x: number, y: number}> = [];
  const bottomOuterPoints: Array<{x: number, y: number}> = [];
  
  timeline.forEach((t, timeIndex) => {
    const x = timeline.length > 1 
      ? (timeIndex / (timeline.length - 1)) * 100 
      : 50;
    
    const total = projectTotals[timeIndex];
    const halfTotal = total / 2;
    
    // Top outer band (positive side) - 50% of total
    const topY = centerY - ((halfTotal / maxValue) * 50);
    topOuterPoints.push({ x, y: topY });
    
    // Bottom outer band (negative side) - 50% of total
    const bottomY = centerY - ((-halfTotal / maxValue) * 50);
    bottomOuterPoints.push({ x, y: bottomY });
  });
  
  // Create smooth curves for outer bands - combine into single closed path
  let outerBandPath = `M ${topOuterPoints[0].x} ${topOuterPoints[0].y}`;
  
  // Top curve
  for (let i = 0; i < topOuterPoints.length - 1; i++) {
    const current = topOuterPoints[i];
    const next = topOuterPoints[i + 1];
    const controlX1 = current.x + (next.x - current.x) * 0.5;
    const controlY1 = current.y;
    const controlX2 = current.x + (next.x - current.x) * 0.5;
    const controlY2 = next.y;
    outerBandPath += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
  }
  
  // Connect to bottom (at last point)
  outerBandPath += ` L ${bottomOuterPoints[bottomOuterPoints.length - 1].x} ${bottomOuterPoints[bottomOuterPoints.length - 1].y}`;
  
  // Bottom curve (reverse order)
  for (let i = bottomOuterPoints.length - 1; i > 0; i--) {
    const current = bottomOuterPoints[i];
    const next = bottomOuterPoints[i - 1];
    const controlX1 = current.x - (current.x - next.x) * 0.5;
    const controlY1 = current.y;
    const controlX2 = current.x - (current.x - next.x) * 0.5;
    const controlY2 = next.y;
    outerBandPath += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
  }
  
  outerBandPath += ' Z';
  
  return { paths, outerBandPath, maxValue, minValue };
}

/**
 * Calculate overlay path for selected project
 * Returns top and bottom paths showing project's total MHPT
 * Only shows value at the project's timeline position, 0 elsewhere
 */
function calculateProjectOverlay(
  projectLines: EstimatingLine[],
  timeline: string[],
  projectTimelineIndex: number,
  selectedMetric: ChartMetric,
  maxValue: number,
  centerY: number
): { topPath: string; bottomPath: string } | null {
  if (projectLines.length === 0 || timeline.length === 0 || projectTimelineIndex === -1) {
    return null;
  }
  
  // Calculate project totals - aggregate all lines for the project
  const totalWeight = projectLines.reduce((sum, line) => {
    const weight = line.materialType === "Material" 
      ? (line.totalWeight || 0)
      : (line.plateTotalWeight || 0);
    return sum + weight;
  }, 0);
  
  const totalLabor = projectLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
  const totalCost = projectLines.reduce((sum, line) => sum + (line.totalCost || 0), 0);
  
  // Calculate the metric value for this project
  let projectValue = 0;
  if (selectedMetric === "laborHoursPerTon") {
    projectValue = totalWeight > 0 ? (totalLabor / (totalWeight / 2000)) : 0;
  } else if (selectedMetric === "costPerTon") {
    projectValue = totalWeight > 0 ? (totalCost / (totalWeight / 2000)) : 0;
  } else {
    return null;
  }
  
  // Create array with project value only at its timeline position, 0 elsewhere
  const projectTotals: number[] = timeline.map((_, index) => 
    index === projectTimelineIndex ? projectValue : 0
  );
  
  // Create paths for top and bottom (50/50 split)
  const topPoints: Array<{x: number, y: number}> = [];
  const bottomPoints: Array<{x: number, y: number}> = [];
  
  timeline.forEach((t, timeIndex) => {
    const x = timeline.length > 1 
      ? (timeIndex / (timeline.length - 1)) * 100 
      : 50;
    
    const total = projectTotals[timeIndex];
    const halfTotal = total / 2;
    
    // Top point (positive side)
    const topY = centerY - ((halfTotal / maxValue) * 50);
    topPoints.push({ x, y: topY });
    
    // Bottom point (negative side)
    const bottomY = centerY - ((-halfTotal / maxValue) * 50);
    bottomPoints.push({ x, y: bottomY });
  });
  
  // Create smooth curves
  let topPath = `M ${topPoints[0].x} ${topPoints[0].y}`;
  for (let i = 0; i < topPoints.length - 1; i++) {
    const current = topPoints[i];
    const next = topPoints[i + 1];
    const controlX1 = current.x + (next.x - current.x) * 0.5;
    const controlY1 = current.y;
    const controlX2 = current.x + (next.x - current.x) * 0.5;
    const controlY2 = next.y;
    topPath += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
  }
  
  let bottomPath = `M ${bottomPoints[0].x} ${bottomPoints[0].y}`;
  for (let i = 0; i < bottomPoints.length - 1; i++) {
    const current = bottomPoints[i];
    const next = bottomPoints[i + 1];
    const controlX1 = current.x + (next.x - current.x) * 0.5;
    const controlY1 = current.y;
    const controlX2 = current.x + (next.x - current.x) * 0.5;
    const controlY2 = next.y;
    bottomPath += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
  }
  
  return { topPath, bottomPath };
}

export default function CostTrendStreamgraph({
  lines,
  approvedBudgets,
  projectId,
  projectName,
  companyId,
  onCategoryClick,
  projects = [],
  allProjectLines = [],
}: CostTrendStreamgraphProps) {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("laborHoursPerTon");
  const [viewMode, setViewMode] = useState<"material" | "labor">("material");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  
  // Get unique projects for dropdown
  const availableProjects = useMemo(() => {
    const projectMap = new Map<string, { id: string; name: string }>();
    
    // Add projects from props
    projects.forEach(p => {
      if (p.id && !projectMap.has(p.id)) {
        projectMap.set(p.id, {
          id: p.id,
          name: p.name || p.projectNumber || p.id
        });
      }
    });
    
    // Also check lines for project IDs
    lines.forEach(line => {
      // Lines might have project context from CostTrendAnalysis wrapper
      // This will be handled by the parent component
    });
    
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, lines]);
  
  // Filter lines for selected project overlay
  const selectedProjectLines = useMemo(() => {
    if (!selectedProjectId || allProjectLines.length === 0) return [];
    
    // Find the project's lines from allProjectLines
    const projectData = allProjectLines.find(p => p.projectId === selectedProjectId);
    return projectData?.lines || [];
  }, [selectedProjectId, allProjectLines]);
  
  // Transform data to chart points (collective data)
  const chartPoints = useMemo(() => {
    if (viewMode === "labor") {
      // Use labor breakdown transformation
      return transformToLaborChartPoints(lines, selectedMetric, approvedBudgets);
    } else {
      // Use material categories (existing logic)
      const points = transformToChartPoints(
        lines,
        selectedMetric,
        "project",
        approvedBudgets,
        projectId,
        projectName
      );
      
      return points.map(point => {
        if (point.projectId) {
          const project = projects.find(p => p.id === point.projectId);
          if (project) {
            return {
              ...point,
              projectName: project.name || project.projectNumber || point.projectName,
              projectNumber: project.projectNumber,
            };
          }
        }
        return point;
      });
    }
  }, [lines, selectedMetric, approvedBudgets, projectId, projectName, projects, viewMode]);
  
  // Aggregate per project and split by category
  // For labor breakdown, we want each labor category as a timeline point, not a series
  const series = useMemo(() => {
    if (viewMode === "labor") {
      // In labor breakdown, each chart point represents a labor category at a timeline position
      // The timeline IS the labor categories, so we want to show the flow from category to category
      // Create one series per unique grouping (if any), but typically one series showing all categories
      
      // Group points by their category (which should all be the same in labor breakdown)
      // But actually, each point's t (timeline) is the labor category name
      // So we want to aggregate by the original grouping if there are multiple projects
      // For now, create a single series with all points
      const singleSeries: ChartSeries = {
        category: "Total",
        points: chartPoints.sort((a, b) => {
          // Sort by labor category order
          const orderA = LABOR_CATEGORIES.findIndex(lc => lc.key === a.t);
          const orderB = LABOR_CATEGORIES.findIndex(lc => lc.key === b.t);
          if (orderA === -1 && orderB === -1) return a.t.localeCompare(b.t);
          if (orderA === -1) return 1;
          if (orderB === -1) return -1;
          return orderA - orderB;
        }),
      };
      return [singleSeries];
    }
    return aggregateToSeries(chartPoints, false);
  }, [chartPoints, viewMode]);
  
  // Get unique timeline values
  const timeline = useMemo(() => {
    const times = new Set(chartPoints.map(p => p.t));
    return Array.from(times).sort();
  }, [chartPoints]);
  
  // Calculate chart layout (collective data)
  const { paths, outerBandPath, maxValue, minValue } = useMemo(() => {
    return calculateStreamgraphLayout(series, timeline, viewMode === "labor");
  }, [series, timeline, viewMode]);
  
  // Get selected project info
  const selectedProject = useMemo(() => {
    if (!selectedProjectId) return null;
    return projects.find(p => p.id === selectedProjectId);
  }, [selectedProjectId, projects]);
  
  // Calculate project overlay if project is selected
  const projectOverlay = useMemo(() => {
    if (!selectedProjectId || selectedProjectLines.length === 0 || !selectedProject) return null;
    
    // Find which timeline point corresponds to this project
    const projectName = selectedProject.name || selectedProject.projectNumber || selectedProjectId;
    const projectTimelineIndex = timeline.findIndex(t => {
      const tLower = t.toLowerCase();
      const pLower = projectName.toLowerCase();
      return tLower.includes(pLower) || pLower.includes(tLower) || tLower === pLower;
    });
    
    // Debug logging
    console.log('[CostTrend] Project Overlay Debug:', {
      selectedProjectId,
      projectName,
      timeline,
      projectTimelineIndex,
      selectedProjectLinesCount: selectedProjectLines.length,
      selectedMetric
    });
    
    if (projectTimelineIndex === -1) {
      console.warn('[CostTrend] Could not find project in timeline:', { projectName, timeline });
      return null;
    }
    
    // Calculate project metrics for debugging
    const totalWeight = selectedProjectLines.reduce((sum, line) => {
      const weight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);
    const totalLabor = selectedProjectLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
    const projectMHPT = totalWeight > 0 ? (totalLabor / (totalWeight / 2000)) : 0;
    
    console.log('[CostTrend] Project Metrics:', {
      totalWeight,
      totalLabor,
      projectMHPT,
      maxValue
    });
    
    return calculateProjectOverlay(
      selectedProjectLines,
      timeline,
      projectTimelineIndex,
      selectedMetric,
      maxValue,
      50 // centerY
    );
  }, [selectedProjectId, selectedProjectLines, selectedProject, timeline, selectedMetric, maxValue]);
  
  // Format metric label
  const getMetricLabel = (metric: ChartMetric): string => {
    switch (metric) {
      case "totalCost": return "Total Cost";
      case "costPerTon": return "Cost per Ton";
      case "laborHoursPerTon": return "Man Hours per Ton";
      case "pctOfTotal": return "% of Total";
      case "varianceVsBaseline": return "Variance vs Baseline";
      default: return metric;
    }
  };
  
  if (lines.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <CardTitle className="flex items-center gap-2 font-bold text-gray-900 tracking-normal">
            <BarChart3 className="w-5 h-5" />
            Cost Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-8">
            No estimate data available. Add line items to see cost trends.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="p-4 md:p-6 rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold text-gray-900 tracking-normal">
              Cost Trend Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={selectedMetric === "laborHoursPerTon" ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric("laborHoursPerTon")}
                className="text-xs"
              >
                Man Hours / Ton
              </Button>
              <Button
                variant={selectedMetric === "costPerTon" ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric("costPerTon")}
                className="text-xs"
              >
                Cost / Ton
              </Button>
            </div>
          </div>
          
          {/* View Mode Toggle and Project Selector */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">View by:</span>
              <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("material")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    viewMode === "material"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Material Categories
                </button>
                <button
                  onClick={() => setViewMode("labor")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    viewMode === "labor"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  Labor Breakdown
                </button>
              </div>
            </div>
            
            {/* Project Selector */}
            {availableProjects.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Compare Project:</label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Projects (Collective)</option>
                  {availableProjects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Chart Visualization */}
        <div className="w-full relative" style={{ height: "420px" }}>
          {/* Y-axis label */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-medium text-gray-700 whitespace-nowrap" style={{ width: "420px", left: "-200px" }}>
            {getMetricLabel(selectedMetric)}
          </div>
          
          {/* Chart area */}
          <div className="absolute" style={{ top: "20px", left: "60px", right: "20px", bottom: "80px" }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              {/* Subtle grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((v, idx) => {
                const y = 100 - v * 100;
                return (
                  <line
                    key={`grid-${idx}`}
                    x1="0"
                    y1={y}
                    x2="100"
                    y2={y}
                    stroke="#f1f5f9"
                    strokeWidth="0.5"
                  />
                );
              })}
              
              {/* Zero center line (highlighted) */}
              <line x1="0" y1="50" x2="100" y2="50" stroke="#374151" strokeWidth="1" strokeDasharray="2,2" opacity="0.5" />
              
              {/* Stacked area paths - render in reverse for proper layering */}
              {paths.slice().reverse().map((pathData, index) => {
                const color = pathData.color || getCategoryColor(pathData.category, paths.length - 1 - index, viewMode === "labor");
                return (
                  <path
                    key={`${pathData.category}-${pathData.subCategory || "base"}-${index}`}
                    d={pathData.path}
                    fill={color}
                    opacity="0.85"
                    stroke="white"
                    strokeWidth="0.5"
                    className="cursor-pointer hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (onCategoryClick) {
                        onCategoryClick(pathData.category, pathData.subCategory);
                      }
                    }}
                  />
                );
              })}
              
              {/* Outer boundary - total MHPT per project (collective) */}
              {outerBandPath && (
                <path
                  d={outerBandPath}
                  fill="none"
                  stroke="#1e293b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.9"
                  className="pointer-events-none"
                />
              )}
              
              {/* Selected project overlay - dotted red lines */}
              {projectOverlay && (
                <>
                  <path
                    d={projectOverlay.topPath}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    strokeLinecap="round"
                    opacity="0.9"
                    className="pointer-events-none"
                  />
                  <path
                    d={projectOverlay.bottomPath}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="2"
                    strokeDasharray="4,4"
                    strokeLinecap="round"
                    opacity="0.9"
                    className="pointer-events-none"
                  />
                </>
              )}
            </svg>
          </div>
          
          {/* Y-axis labels - centered around zero */}
          <div className="absolute left-0 w-14 flex flex-col justify-between text-right pr-3 text-xs text-gray-600" style={{ top: "20px", bottom: "80px" }}>
            {/* Positive values (top to center) */}
            {[1, 0.5, 0].map((v, idx) => {
              const rawValue = maxValue * v;
              let displayValue: string;
              if (selectedMetric === "costPerTon") {
                if (rawValue >= 1000) {
                  displayValue = `$${(rawValue / 1000).toFixed(1)}K`;
                } else {
                  displayValue = `$${rawValue.toFixed(0)}`;
                }
              } else if (selectedMetric === "totalCost") {
                if (rawValue >= 1000000) {
                  displayValue = `$${(rawValue / 1000000).toFixed(1)}M`;
                } else if (rawValue >= 1000) {
                  displayValue = `$${(rawValue / 1000).toFixed(0)}K`;
                } else {
                  displayValue = `$${rawValue.toFixed(0)}`;
                }
              } else {
                displayValue = rawValue.toFixed(0);
              }
              const yPosition = 100 - (v * 50); // Top half (0% to 50%)
              return (
                <span
                  key={`y-label-pos-${idx}`}
                  className="leading-none"
                  style={{ marginTop: idx === 0 ? '0' : 'auto', marginBottom: idx === 2 ? '0' : 'auto' }}
                >
                  {displayValue}
                </span>
              );
            })}
            {/* Zero line */}
            <span key="y-label-zero" className="leading-none absolute font-semibold" style={{ top: '50%', transform: 'translateY(-50%)' }}>0</span>
            {/* Negative values (center to bottom) */}
            {[0.5, 1].map((v, idx) => {
              const rawValue = -maxValue * v;
              let displayValue: string;
              if (selectedMetric === "costPerTon") {
                if (Math.abs(rawValue) >= 1000) {
                  displayValue = `-$${(Math.abs(rawValue) / 1000).toFixed(1)}K`;
                } else {
                  displayValue = `-$${Math.abs(rawValue).toFixed(0)}`;
                }
              } else if (selectedMetric === "totalCost") {
                if (Math.abs(rawValue) >= 1000000) {
                  displayValue = `-$${(Math.abs(rawValue) / 1000000).toFixed(1)}M`;
                } else if (Math.abs(rawValue) >= 1000) {
                  displayValue = `-$${(Math.abs(rawValue) / 1000).toFixed(0)}K`;
                } else {
                  displayValue = `-$${Math.abs(rawValue).toFixed(0)}`;
                }
              } else {
                displayValue = rawValue.toFixed(0);
              }
              const yPosition = 50 + (v * 50); // Bottom half (50% to 100%)
              return (
                <span
                  key={`y-label-neg-${idx}`}
                  className="leading-none"
                  style={{ marginTop: idx === 0 ? '0' : 'auto', marginBottom: idx === 1 ? '0' : 'auto' }}
                >
                  {displayValue}
                </span>
              );
            })}
          </div>
          
          {/* X-axis labels */}
          <div className="absolute bottom-0 flex justify-between text-xs text-gray-600" style={{ left: "60px", right: "20px", height: "80px" }}>
            {timeline.map((t, index) => {
              const label = t.length > 15 ? `${t.substring(0, 13)}..` : t;
              return (
                <div
                  key={`x-label-${index}`}
                  className="flex flex-col items-center justify-end"
                  style={{ width: `${100 / timeline.length}%` }}
                >
                  <div className="w-px h-2 bg-gray-400 mb-1"></div>
                  <span
                    className="font-medium text-gray-700 text-[10px] text-center leading-tight"
                    style={{
                      transform: "rotate(-45deg)",
                      transformOrigin: "top center",
                      width: "60px",
                      marginTop: "8px",
                    }}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {viewMode === "labor" ? "Labor Categories" : "Departments"}
          </span>
          {series.map((s, index) => {
            const color = getCategoryColor(s.category, index, viewMode === "labor");
            return (
              <div
                key={`${s.category}-${s.subCategory || "base"}`}
                className="flex items-center gap-2 text-sm text-gray-700"
              >
                <span
                  className="inline-block w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                />
                <span className="font-medium">{s.category}</span>
              </div>
            );
          })}
          <div className="flex items-center gap-2 text-sm text-gray-700 ml-auto">
            <svg className="w-6 h-3">
              <path
                d="M 0 1.5 L 6 1.5"
                stroke="#1e293b"
                strokeWidth="2"
                fill="none"
              />
            </svg>
            <span className="text-xs text-gray-600">Total MHPT (Collective)</span>
          </div>
          {projectOverlay && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-6 h-3">
                <path
                  d="M 0 1.5 L 6 1.5"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  fill="none"
                />
              </svg>
              <span className="text-xs text-gray-600">Selected Project</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
