"use client";

/**
 * Cost Trend Streamgraph Component
 * 
 * Displays cost trends by category/subcategory over time using streamgraph visualization
 * 
 * Data Source: Quant EstimatingLine from companies/{companyId}/projects/{projectId}/lines
 * Timeline: Time-based (monthly) OR version-based (approved budgets) OR project-based
 */

import { useState, useMemo, useCallback } from "react";
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
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3 } from "lucide-react";

interface CostTrendStreamgraphProps {
  lines: EstimatingLine[];
  approvedBudgets?: ApprovedBudget[];
  projectId?: string;
  projectName?: string;
  companyId: string;
  onCategoryClick?: (category: string, subCategory?: string) => void;
  projects?: Array<{ id: string; name?: string; status?: string; projectNumber?: string }>;
}

// Color palette for material categories
const MATERIAL_COLORS: Record<string, string> = {
  "Columns": "#3b82f6",
  "Beams": "#10b981",
  "Misc Metals": "#f59e0b",
  "Plates": "#ef4444",
  "Uncategorized": "#6b7280",
};

// Color palette for labor categories
const LABOR_COLORS: Record<string, string> = {
  "Unload": "#0ea5e9",
  "Cut": "#ef4444",
  "Cope": "#f97316",
  "Process": "#eab308",
  "Drill/Punch": "#84cc16",
  "Fit": "#22c55e",
  "Weld": "#14b8a6",
  "Prep/Clean": "#06b6d4",
  "Paint": "#3b82f6",
  "Handle/Move": "#8b5cf6",
  "Load/Ship": "#a855f7",
};

// Combined color palette
const CATEGORY_COLORS: Record<string, string> = {
  ...MATERIAL_COLORS,
  ...LABOR_COLORS,
  "Awarded": "#22c55e",
  "Not Awarded": "#f97316",
};

const DEFAULT_COLOR = "#94a3b8";

function getCategoryColor(category: string, index: number): string {
  return CATEGORY_COLORS[category] || 
    `hsl(${(index * 137.5) % 360}, 70%, 50%)`; // Golden angle for color distribution
}

/**
 * Calculate stacked area chart layout (simplified streamgraph-style)
 * Uses standard stacking with optional baseline centering
 */
function calculateStreamgraphLayout(
  series: ChartSeries[],
  timeline: string[]
): { 
  paths: Array<{ category: string; subCategory?: string; path: string; color: string; dataPoints?: Array<{x: number, y: number}> }>; 
  maxValue: number;
  dataPoints?: Array<Array<{x: number, y: number, category: string, value: number}>>;
} {
  if (series.length === 0 || timeline.length === 0) {
    return { paths: [], maxValue: 0, dataPoints: [] };
  }
  
  // Build data matrix: timeline x series
  const dataMatrix: number[][] = timeline.map(() => new Array(series.length).fill(0));
  
  series.forEach((s, seriesIndex) => {
    const pointMap = new Map(s.points.map(p => [p.t, p.value]));
    timeline.forEach((t, timeIndex) => {
      dataMatrix[timeIndex][seriesIndex] = pointMap.get(t) || 0;
    });
  });
  
  // Calculate cumulative stacks (bottom to top)
  const cumulative: number[][] = timeline.map(() => new Array(series.length).fill(0));
  const totals: number[] = new Array(timeline.length).fill(0);
  
  timeline.forEach((_, timeIndex) => {
    let sum = 0;
    series.forEach((_, seriesIndex) => {
      cumulative[timeIndex][seriesIndex] = sum;
      sum += dataMatrix[timeIndex][seriesIndex];
    });
    totals[timeIndex] = sum;
  });
  
  // Find max value for scaling
  const maxValue = Math.max(...totals, 1); // Avoid division by zero
  
  // Generate SVG paths with smooth curves (stacked from bottom)
  const paths = series.map((s, seriesIndex) => {
    const topPoints: Array<{x: number, y: number}> = [];
    const bottomPoints: Array<{x: number, y: number}> = [];
    
    timeline.forEach((t, timeIndex) => {
      const x = timeline.length > 1 
        ? (timeIndex / (timeline.length - 1)) * 100 
        : 50;
      const bottomY = 100 - ((cumulative[timeIndex][seriesIndex] / maxValue) * 100);
      const topY = 100 - (((cumulative[timeIndex][seriesIndex] + dataMatrix[timeIndex][seriesIndex]) / maxValue) * 100);
      
      topPoints.push({ x, y: topY });
      bottomPoints.push({ x, y: bottomY });
    });
    
    // Create smooth curve for top edge
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
    
    // Close path along bottom (reverse order)
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
    
    path += ' Z'; // Close path
    
    return {
      category: s.category,
      subCategory: s.subCategory,
      path,
      color: getCategoryColor(s.category, seriesIndex),
      dataPoints: topPoints, // Store for markers
    };
  });
  
  return { paths, maxValue, dataPoints: series.map((s, seriesIndex) => {
    return timeline.map((t, timeIndex) => {
      const x = timeline.length > 1 
        ? (timeIndex / (timeline.length - 1)) * 100 
        : 50;
      const topY = 100 - (((cumulative[timeIndex][seriesIndex] + dataMatrix[timeIndex][seriesIndex]) / maxValue) * 100);
      return { x, y: topY, category: s.category, value: dataMatrix[timeIndex][seriesIndex] };
    });
  }) };
}

export default function CostTrendStreamgraph({
  lines,
  approvedBudgets,
  projectId,
  projectName,
  companyId,
  onCategoryClick,
  projects = [],
}: CostTrendStreamgraphProps) {
  const [selectedMetric, setSelectedMetric] = useState<ChartMetric>("totalCost");
  const [awardedFilter, setAwardedFilter] = useState<"all" | "awarded" | "notAwarded">("all");
  const [includeSubCategories, setIncludeSubCategories] = useState(false);
  const [visibleCategories, setVisibleCategories] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<"material" | "labor">("material");
  
  // Transform data to chart points
  const chartPoints = useMemo(() => {
    const points = transformToChartPoints(
      lines,
      selectedMetric,
      "project",
      approvedBudgets,
      projectId,
      projectName
    );
    
    // Enhance points with project info for display
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
  }, [lines, selectedMetric, approvedBudgets, projectId, projectName, projects]);
  
  // Labor categories for breakdown
  const laborCategories = [
    { key: "laborUnload", label: "Unload" },
    { key: "laborCut", label: "Cut" },
    { key: "laborCope", label: "Cope" },
    { key: "laborProcessPlate", label: "Process" },
    { key: "laborDrillPunch", label: "Drill/Punch" },
    { key: "laborFit", label: "Fit" },
    { key: "laborWeld", label: "Weld" },
    { key: "laborPrepClean", label: "Prep/Clean" },
    { key: "laborPaint", label: "Paint" },
    { key: "laborHandleMove", label: "Handle/Move" },
    { key: "laborLoadShip", label: "Load/Ship" },
  ];

  // Aggregate labor hours per ton by project for labor view
  const laborSeries = useMemo(() => {
    if (viewMode !== "labor") return [];
    
    // Group lines by project
    const projectGroups = new Map<string, EstimatingLine[]>();
    lines.forEach(line => {
      const projectKey = (line as any)._projectName || (line as any)._projectId || "Unknown";
      if (!projectGroups.has(projectKey)) {
        projectGroups.set(projectKey, []);
      }
      projectGroups.get(projectKey)!.push(line);
    });
    
    // Create series for each labor category (hours per ton)
    const seriesData: ChartSeries[] = laborCategories.map(({ key, label }) => {
      const points: ChartPoint[] = [];
      
      projectGroups.forEach((projectLines, projectName) => {
        // Calculate total hours for this labor category
        const totalHours = projectLines.reduce((sum, line) => {
          return sum + ((line as any)[key] || 0);
        }, 0);
        
        // Calculate total weight for this project (convert lbs to tons)
        const totalWeightLbs = projectLines.reduce((sum, line) => {
          const weight = line.materialType === "Material" 
            ? (line.totalWeight || 0)
            : (line.plateTotalWeight || 0);
          return sum + weight;
        }, 0);
        
        const totalWeightTons = totalWeightLbs / 2000;
        
        // Calculate hours per ton
        const hoursPerTon = totalWeightTons > 0 ? (totalHours / totalWeightTons) : 0;
        
        points.push({
          t: projectName,
          category: label,
          value: hoursPerTon,
        });
      });
      
      return {
        category: label,
        points: points.sort((a, b) => a.t.localeCompare(b.t)),
      };
    });
    
    // Filter out categories with all zeros
    const filteredSeries = seriesData.filter(s => s.points.some(p => p.value > 0));
    
    // Add total man hours per ton series
    const totalSeriesPoints: ChartPoint[] = [];
    projectGroups.forEach((projectLines, projectName) => {
      // Calculate total labor hours for this project
      const totalHours = projectLines.reduce((sum, line) => {
        return sum + (line.totalLabor || 0);
      }, 0);
      
      // Calculate total weight for this project (convert lbs to tons)
      const totalWeightLbs = projectLines.reduce((sum, line) => {
        const weight = line.materialType === "Material" 
          ? (line.totalWeight || 0)
          : (line.plateTotalWeight || 0);
        return sum + weight;
      }, 0);
      
      const totalWeightTons = totalWeightLbs / 2000;
      
      // Calculate total hours per ton
      const totalHoursPerTon = totalWeightTons > 0 ? (totalHours / totalWeightTons) : 0;
      
      totalSeriesPoints.push({
        t: projectName,
        category: "Total Man Hours / Ton",
        value: totalHoursPerTon,
      });
    });
    
    // Add total series if there's data
    if (totalSeriesPoints.some(p => p.value > 0)) {
      filteredSeries.push({
        category: "Total Man Hours / Ton",
        points: totalSeriesPoints.sort((a, b) => a.t.localeCompare(b.t)),
      });
    }
    
    return filteredSeries;
  }, [lines, viewMode]);

  // Aggregate per project and split by category/subcategory (material view)
  const materialSeries = useMemo(() => {
    if (viewMode !== "material") return [];
    const aggregated = aggregateToSeries(chartPoints, includeSubCategories);
    return aggregated;
  }, [chartPoints, includeSubCategories, viewMode]);

  // Separate total series from labor series for line rendering
  const { laborSeriesWithoutTotal, totalSeries } = useMemo(() => {
    if (viewMode !== "labor") {
      return { laborSeriesWithoutTotal: [], totalSeries: null };
    }
    
    const total = laborSeries.find(s => s.category === "Total Man Hours / Ton");
    const withoutTotal = laborSeries.filter(s => s.category !== "Total Man Hours / Ton");
    
    return {
      laborSeriesWithoutTotal: withoutTotal,
      totalSeries: total || null,
    };
  }, [laborSeries, viewMode]);

  // Use the appropriate series based on view mode (excluding total for stacked areas)
  const series = viewMode === "labor" ? laborSeriesWithoutTotal : materialSeries;

  // Update visible categories when series changes
  useMemo(() => {
    if (visibleCategories.size === 0 && series.length > 0) {
      setVisibleCategories(new Set(series.map(s =>
        includeSubCategories && s.subCategory
          ? `${s.category}|${s.subCategory}`
          : s.category
      )));
    }
  }, [series, includeSubCategories, visibleCategories]);
  
  // Get unique timeline values
  const timeline = useMemo(() => {
    if (viewMode === "labor" && laborSeries.length > 0) {
      // For labor mode, get timeline from laborSeries
      const times = new Set(laborSeries[0]?.points.map(p => p.t) || []);
      return Array.from(times).sort();
    }
    const times = new Set(chartPoints.map(p => p.t));
    return Array.from(times).sort();
  }, [chartPoints, viewMode, laborSeries]);
  
  // Map timeline label -> project info for display (number/name)
  const timelineProjectInfo = useMemo(() => {
    const infoMap = new Map<string, { name?: string; number?: string }>();
    timeline.forEach((t) => {
      const point = chartPoints.find(p => p.t === t);
      if (point?.projectId) {
        const project = projects.find(p => p.id === point.projectId);
        if (project) {
          infoMap.set(t, {
            name: project.name,
            number: project.projectNumber,
          });
        }
      }
    });
    return infoMap;
  }, [timeline, chartPoints, projects]);

  // Calculate streamgraph layout with max value cap for cost per ton
  const { paths, maxValue, dataPoints } = useMemo(() => {
    const layout = calculateStreamgraphLayout(series, timeline);
    
    // For cost per ton, cap max value at 3000 (extremely large project)
    if (selectedMetric === "costPerTon" && layout.maxValue > 3000) {
      // Recalculate with capped max value
      const cappedMax = 3000;
      return {
        ...layout,
        maxValue: cappedMax,
        // Recalculate paths with new max value
        paths: layout.paths.map((pathData, seriesIndex) => {
          // Rebuild path with new max value
          const s = series[seriesIndex];
          const pointMap = new Map(s.points.map(p => [p.t, p.value]));
          
          const topPoints: Array<{x: number, y: number}> = [];
          const bottomPoints: Array<{x: number, y: number}> = [];
          
          // Calculate cumulative stacks with capped max
          const cumulative: number[] = [];
          let sum = 0;
          timeline.forEach((t, timeIndex) => {
            cumulative[timeIndex] = sum;
            sum += (pointMap.get(t) || 0);
          });
          
          timeline.forEach((t, timeIndex) => {
            const x = timeline.length > 1 
              ? (timeIndex / (timeline.length - 1)) * 100 
              : 50;
            const value = pointMap.get(t) || 0;
            const bottomY = 100 - ((cumulative[timeIndex] / cappedMax) * 100);
            const topY = 100 - (((cumulative[timeIndex] + value) / cappedMax) * 100);
            
            topPoints.push({ x, y: topY });
            bottomPoints.push({ x, y: bottomY });
          });
          
          // Rebuild path
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
            ...pathData,
            path,
            dataPoints: topPoints,
          };
        }),
      };
    }
    
    return layout;
  }, [series, timeline, selectedMetric]);
  
  // Calculate total line path if total series exists
  const totalLinePath = useMemo(() => {
    if (!totalSeries || timeline.length === 0) return null;
    
    const pointMap = new Map(totalSeries.points.map(p => [p.t, p.value]));
    const maxValueForTotal = Math.max(...totalSeries.points.map(p => p.value), 1);
    // Use the same max value as the stacked areas for consistency
    const scaleMax = selectedMetric === "costPerTon" && maxValue > 3000 ? 3000 : Math.max(maxValue, maxValueForTotal);
    
    const points: Array<{x: number, y: number}> = [];
    timeline.forEach((t, timeIndex) => {
      const x = timeline.length > 1 
        ? (timeIndex / (timeline.length - 1)) * 100 
        : 50;
      const value = pointMap.get(t) || 0;
      const y = 100 - ((value / scaleMax) * 100);
      points.push({ x, y });
    });
    
    if (points.length === 0) return null;
    
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const current = points[i];
      const next = points[i + 1];
      const controlX1 = current.x + (next.x - current.x) * 0.5;
      const controlY1 = current.y;
      const controlX2 = current.x + (next.x - current.x) * 0.5;
      const controlY2 = next.y;
      path += ` C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${next.x} ${next.y}`;
    }
    
    return { path, points, color: "#ef4444" }; // Red line for total
  }, [totalSeries, timeline, maxValue, selectedMetric]);
  
  // Format metric label
  const getMetricLabel = (metric: ChartMetric): string => {
    switch (metric) {
      case "totalCost": return "Total Cost ($)";
      case "costPerTon": return "Cost per Ton ($/ton)";
      case "laborHoursPerTon": return "Labor Hours per Ton";
      case "pctOfTotal": return "% of Total";
      case "varianceVsBaseline": return "Variance vs Baseline ($)";
      default: return metric;
    }
  };
  
  if (lines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Cost Trend Analysis</CardTitle>
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
    <Card className="p-3 md:p-4 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Cost Trend Analysis
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant={selectedMetric === "laborHoursPerTon" ? "primary" : "outline"}
                size="sm"
                onClick={() => setSelectedMetric("laborHoursPerTon")}
              >
              Labor Hours / Ton
            </Button>
            <Button
              variant={selectedMetric === "costPerTon" ? "primary" : "outline"}
              size="sm"
              onClick={() => setSelectedMetric("costPerTon")}
            >
              Cost / Ton
            </Button>
            </div>
          </div>
          
          {/* View Mode Toggle - Material vs Labor Categories */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-600">View by:</span>
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode("material")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "material"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Material Categories
              </button>
              <button
                onClick={() => setViewMode("labor")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  viewMode === "labor"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Labor Breakdown
              </button>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Streamgraph Visualization */}
        <div className="w-full relative" style={{ height: "420px" }}>
          {/* Y-axis title */}
          <div className="absolute left-0 top-0 text-xs font-semibold text-gray-700 pl-1" style={{ width: "55px" }}>
            {viewMode === "labor" ? "Labor Hours / Ton" : getMetricLabel(selectedMetric)}
          </div>
          
          {/* Chart area wrapper - positioned to match the chart space */}
          <div className="absolute" style={{ top: "20px", left: "55px", right: "16px", bottom: "105px" }}>
            {/* SVG Chart */}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
              {/* Gridlines */}
              {[0, 0.25, 0.5, 0.75, 1].map((v, idx) => {
                const y = 100 - v * 100;
                return (
                  <line key={`grid-${idx}`} x1="0" y1={y} x2="100" y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
                );
              })}
              
              {/* Chart border */}
              <rect x="0" y="0" width="100" height="100" fill="none" stroke="#d1d5db" strokeWidth="0.5" />
              
              {/* Streamgraph paths (stacked areas) */}
              {paths.map((pathData, index) => (
                <path
                  key={`${pathData.category}-${pathData.subCategory || ""}-${index}`}
                  d={pathData.path}
                  fill={pathData.color}
                  opacity={0.75}
                  stroke={pathData.color}
                  strokeWidth="0.3"
                  className="cursor-pointer hover:opacity-100 transition-opacity"
                  onClick={() => {
                    if (onCategoryClick) {
                      onCategoryClick(pathData.category, pathData.subCategory);
                    }
                  }}
                />
              ))}
              
              {/* Total line overlay (for labor breakdown mode) */}
              {totalLinePath && (
                <path
                  d={totalLinePath.path}
                  fill="none"
                  stroke={totalLinePath.color}
                  strokeWidth="2"
                  strokeDasharray="4,2"
                  opacity={0.9}
                  className="pointer-events-none"
                />
              )}
            </svg>
            
            {/* Data point markers - Perfect circles positioned relative to chart area */}
            {dataPoints && dataPoints.flat().map((point, index) => (
              <div
                key={`marker-${index}`}
                className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm pointer-events-none"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
            
            {/* Total line markers */}
            {totalLinePath && totalLinePath.points.map((point, index) => (
              <div
                key={`total-marker-${index}`}
                className="absolute w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow-sm pointer-events-none"
                style={{
                  left: `${point.x}%`,
                  top: `${point.y}%`,
                  transform: "translate(-50%, -50%)",
                }}
              />
            ))}
          </div>
          
          {/* Y-axis labels (positioned outside SVG) */}
          <div className="absolute left-0 w-14 flex flex-col justify-between text-right pr-2 text-xs text-gray-500" style={{ top: "20px", bottom: "105px" }}>
            {[1, 0.75, 0.5, 0.25, 0].map((v, idx) => {
              const rawValue = maxValue * v;
              // Format: use K for thousands, M for millions
              let displayValue: string;
              if (viewMode === "labor") {
                // Labor hours - no dollar sign
                if (rawValue >= 1000) {
                  displayValue = `${(rawValue / 1000).toFixed(1)}K`;
                } else {
                  displayValue = rawValue.toFixed(0);
                }
              } else if (selectedMetric === "costPerTon") {
                // For cost per ton, show values up to 3000
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
                if (rawValue >= 1000) {
                  displayValue = `${(rawValue / 1000).toFixed(1)}K`;
                } else {
                  displayValue = rawValue.toFixed(1);
                }
              }
              return (
                <span key={`y-label-${idx}`} className="leading-none">{displayValue}</span>
              );
            })}
          </div>
          
          {/* X-axis labels (positioned below chart area) - rotated vertically */}
          <div className="absolute bottom-0 flex justify-between text-xs text-gray-600" style={{ left: "55px", right: "16px", height: "100px" }}>
            {timeline.map((t, index) => {
              const projectInfo = timelineProjectInfo.get(t);
              const displayName = projectInfo?.name || projectInfo?.number || t || `Project ${index + 1}`;
              // Show more of the name since it's vertical now
              const label = displayName.length > 20 ? `${displayName.substring(0, 18)}..` : displayName;
              return (
                <div key={`x-label-${index}`} className="flex flex-col items-center" style={{ width: "20px" }}>
                  <div className="w-0.5 h-2 bg-red-500 mb-1 flex-shrink-0"></div>
                  <span 
                    className="font-medium text-gray-700 whitespace-nowrap origin-top-left"
                    style={{ 
                      fontSize: "9px",
                      transform: "rotate(-65deg) translateX(-50%)",
                      transformOrigin: "top center",
                      marginTop: "4px",
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
        <div className="flex flex-wrap gap-3 items-center">
          {series.map((s, index) => {
            const color = getCategoryColor(s.category, index);
            return (
              <div key={`${s.category}-${s.subCategory || "base"}`} className="flex items-center gap-2 text-sm text-gray-700">
                <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: color }} />
                <span className="font-medium">
                  {s.category}
                  {includeSubCategories && s.subCategory ? ` • ${s.subCategory}` : ""}
                </span>
              </div>
            );
          })}
          {totalSeries && (
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <svg className="w-4 h-3" viewBox="0 0 16 3" preserveAspectRatio="none">
                <path
                  d="M 0 1.5 L 16 1.5"
                  stroke="#ef4444"
                  strokeWidth="2"
                  strokeDasharray="4,2"
                  fill="none"
                />
              </svg>
              <span className="font-semibold text-red-600">
                {totalSeries.category}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

