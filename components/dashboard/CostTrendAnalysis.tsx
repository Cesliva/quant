"use client";

/**
 * Cost Trend Analysis Wrapper
 * 
 * Aggregates estimating lines from all active projects for company-wide trend analysis
 * Integrates streamgraph visualization and insights panel
 */

import { useState, useEffect, useMemo, Suspense } from "react";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { subscribeToCollection, getProjectPath, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import CostTrendBubbleChart from "./CostTrendBubbleChart";
import EstimateVsActualCard from "./EstimateVsActualCard";
import BacklogAtAGlance from "./BacklogAtAGlance";
import { ChartPoint } from "@/lib/utils/estimateToStreamgraph";
import { transformToChartPoints } from "@/lib/utils/estimateToStreamgraph";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  status?: string;
  archived?: boolean;
  approvedBudget?: {
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
  };
}

interface CostTrendAnalysisProps {
  companyId: string;
  onCategoryFilter?: (category: string, subCategory?: string) => void;
}

export default function CostTrendAnalysis({
  companyId,
  onCategoryFilter,
}: CostTrendAnalysisProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [allLines, setAllLines] = useState<Array<{ projectId: string; projectName: string; lines: EstimatingLine[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"laborHoursPerTon" | "costPerTon">("laborHoursPerTon");
  
  // Log component mount
  useEffect(() => {
    console.log("[CostTrend] Component mounted with companyId:", companyId);
  }, [companyId]);
  
  // Load all active projects
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || companyId === "default") {
      console.log("[CostTrend] Firebase not configured or invalid companyId:", companyId);
      setProjects([]);
      setLoading(false);
      return;
    }
    
    console.log("[CostTrend] Loading projects for companyId:", companyId);
    const projectsPath = `companies/${companyId}/projects`;
    let unsubscribe: (() => void) | undefined;
    
    try {
      unsubscribe = subscribeToCollection<Project>(
        projectsPath,
        (projectData) => {
          try {
            console.log("[CostTrend] Loaded projects:", projectData.length);
            // Filter for active projects only
            const activeProjects = projectData.filter(
              (p) => !p.archived && (p.status === "active" || p.status === "draft" || !p.status)
            );
            
            console.log("[CostTrend] Active projects:", activeProjects.length);
            setProjects(activeProjects);
            setError(null);
            
            // Initialize lines array (will be populated by subscriptions)
            setAllLines(
              activeProjects.map((project) => ({
                projectId: project.id,
                projectName: project.projectName || project.id,
                lines: [],
              }))
            );
            setLoading(false);
          } catch (err: any) {
            console.error("[CostTrend] Error processing projects:", err);
            setError(err?.message || "Failed to load projects");
            setLoading(false);
          }
        }
      );
    } catch (err: any) {
      console.error("[CostTrend] Error setting up subscription:", err);
      setError(err?.message || "Failed to initialize");
      setLoading(false);
    }
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [companyId]);
  
  // Subscribe to lines updates for all projects
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || companyId === "default" || projects.length === 0) {
      return;
    }
    
    console.log("[CostTrend] Subscribing to lines for", projects.length, "projects");
    const unsubscribes: Array<() => void> = [];
    
    projects.forEach((project) => {
      try {
        const linesPath = getProjectPath(companyId, project.id, "lines");
        const unsubscribe = subscribeToCollection<EstimatingLine>(
          linesPath,
          (lines) => {
            try {
              console.log(`[CostTrend] Loaded ${lines.length} lines for project ${project.id}`);
              setAllLines((prev) => {
                const updated = [...prev];
                const index = updated.findIndex((p) => p.projectId === project.id);
                if (index >= 0) {
                  updated[index] = {
                    ...updated[index],
                    lines,
                  };
                } else {
                  updated.push({
                    projectId: project.id,
                    projectName: project.projectName || project.id,
                    lines,
                  });
                }
                return updated;
              });
            } catch (err: any) {
              console.error(`[CostTrend] Error processing lines for project ${project.id}:`, err);
            }
          }
        );
        unsubscribes.push(unsubscribe);
      } catch (err: any) {
        console.error(`[CostTrend] Error subscribing to project ${project.id}:`, err);
      }
    });
    
    return () => {
      unsubscribes.forEach((unsub) => {
        try {
          unsub();
        } catch (err) {
          console.error("[CostTrend] Error unsubscribing:", err);
        }
      });
    };
  }, [companyId, projects]);
  
  // Flatten all lines with project context
  const flattenedLines = useMemo(() => {
    const flattened = allLines.flatMap((projectData) =>
      projectData.lines.map((line) => ({
        ...line,
        _projectId: projectData.projectId,
        _projectName: projectData.projectName,
      }))
    );
    console.log("[CostTrend] Total flattened lines:", flattened.length);
    return flattened;
  }, [allLines]);
  
  // Get approved budgets from projects
  const approvedBudgets = useMemo(() => {
    const budgets: Array<{
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
    }> = [];
    
    projects.forEach((project) => {
      if (project.approvedBudget) {
        budgets.push(project.approvedBudget);
      }
    });
    
    return budgets.sort((a, b) => a.version - b.version);
  }, [projects]);
  
  // Transform to chart points (aggregate across all projects)
  const chartPoints = useMemo(() => {
    try {
      if (flattenedLines.length === 0) {
        return [];
      }
      
      // Group by project for project-based mode, or aggregate for time-based
      return transformToChartPoints(
        flattenedLines as EstimatingLine[],
        "totalCost", // Default metric
        "project", // Default to project-based aggregation
        approvedBudgets.length > 0 ? approvedBudgets : undefined,
        undefined, // No single project
        "All Projects"
      );
    } catch (err: any) {
      console.error("[CostTrend] Error transforming chart points:", err);
      return [];
    }
  }, [flattenedLines, approvedBudgets]);
  
  const handleCategoryClick = (category: string, subCategory?: string) => {
    if (onCategoryFilter) {
      onCategoryFilter(category, subCategory);
    }
  };
  
  if (error) {
    return (
      <div className="bg-white rounded-3xl border border-red-200 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] p-6 mb-8">
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">Error loading cost trend data</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }
  
  if (loading) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] p-6 mb-8">
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading cost trend data...</p>
        </div>
      </div>
    );
  }
  
  if (flattenedLines.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] p-6 mb-8">
        <div className="text-center py-8">
          <p className="text-slate-600 mb-2">
            No estimate data available.
          </p>
          <p className="text-sm text-slate-500">
            Create projects and add line items to see cost trends over time.
          </p>
          <p className="text-xs text-slate-400 mt-4">
            Projects loaded: {projects.length} | Lines loaded: {allLines.reduce((sum, p) => sum + p.lines.length, 0)}
          </p>
        </div>
      </div>
    );
  }
  
  try {
    return (
      <Suspense fallback={
        <div className="bg-white rounded-3xl border border-slate-100/50 shadow-lg p-6">
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading chart...</p>
          </div>
        </div>
      }>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5 items-stretch mt-4 md:mt-6 mb-4 md:mb-6">
            <div className="lg:col-span-2">
              <CostTrendBubbleChart
                lines={flattenedLines as EstimatingLine[]}
                companyId={companyId}
                projects={projects}
                allProjectLines={allLines}
                selectedMetric={selectedMetric}
                onMetricChange={(metric) => {
                  setSelectedMetric(metric);
                }}
              />
            </div>
            <div className="lg:col-span-1 flex flex-col gap-3 md:gap-4 w-full">
              <div className="flex-1">
                <EstimateVsActualCard companyId={companyId} />
              </div>
              <div className="flex-1">
                <BacklogAtAGlance companyId={companyId} />
              </div>
            </div>
          </div>
        </Suspense>
    );
  } catch (err: any) {
    console.error("[CostTrend] Render error:", err);
    return (
      <div className="bg-white rounded-3xl border border-red-200 shadow-lg p-6 mb-8">
        <div className="text-center py-8">
          <p className="text-red-600 mb-2">Error rendering cost trend</p>
          <p className="text-sm text-slate-500">{err?.message || "Unknown error"}</p>
        </div>
      </div>
    );
  }
}

