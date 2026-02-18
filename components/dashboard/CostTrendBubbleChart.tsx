"use client";

/**
 * Cost Trend Analysis - Packed Bubble Chart
 * 
 * D3.js circle packing visualization showing each labor category's man hours per ton
 * Summary of all projects combined
 */

import { useMemo, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { BarChart3, Info, X, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { loadCompanySettings, type CompanySettings } from "@/lib/utils/settingsLoader";

interface ProjectData {
  projectId: string;
  projectName: string;
  lines: EstimatingLine[];
}

interface CostTrendBubbleChartProps {
  lines: EstimatingLine[];
  companyId: string;
  projects?: Array<{ id: string; projectName?: string; projectNumber?: string }>;
  allProjectLines?: ProjectData[];
  selectedMetric?: "laborHoursPerTon" | "costPerTon";
  onMetricChange?: (metric: "laborHoursPerTon" | "costPerTon") => void;
}

// Labor category definitions
const LABOR_CATEGORIES = [
  { key: "Unload", field: "laborUnload", label: "Unload" },
  { key: "Cut", field: "laborCut", label: "Cut" },
  { key: "Cope", field: "laborCope", label: "Cope" },
  { key: "Process Plate", field: "laborProcessPlate", label: "Process Plate" },
  { key: "Drill/Punch", field: "laborDrillPunch", label: "Drill/Punch" },
  { key: "Fit", field: "laborFit", label: "Fit" },
  { key: "Weld", field: "laborWeld", label: "Weld" },
  { key: "Prep/Clean", field: "laborPrepClean", label: "Prep/Clean" },
  { key: "Paint", field: "laborPaint", label: "Paint" },
  { key: "Handle/Move", field: "laborHandleMove", label: "Handle/Move" },
  { key: "Load/Ship", field: "laborLoadShip", label: "Load/Ship" },
];

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

// Cost category colors
const COST_COLORS: Record<string, string> = {
  "Material": "#3b82f6",      // Blue
  "Labor": "#10b981",         // Green
  "Coating": "#f59e0b",       // Amber
  "Hardware": "#8b5cf6",      // Purple
  "Buyouts": "#ef4444",       // Red
  "Overhead": "#f97316",      // Orange
  "Profit": "#84cc16",        // Lime
  "Shipping": "#06b6d4",      // Cyan
};

interface BubbleData {
  category: string;
  label: string;
  mhPerTon: number;
  color: string;
  percentage: number;
}

export default function CostTrendBubbleChart({
  lines,
  companyId,
  projects = [],
  allProjectLines = [],
  selectedMetric: externalMetric,
  onMetricChange,
}: CostTrendBubbleChartProps) {
  const [internalMetric, setInternalMetric] = useState<"laborHoursPerTon" | "costPerTon">("laborHoursPerTon");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [showFirstTimeHelp, setShowFirstTimeHelp] = useState(false);
  const [showInfoTooltip, setShowInfoTooltip] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Load company settings
  useEffect(() => {
    if (companyId) {
      loadCompanySettings(companyId).then(setCompanySettings);
    }
  }, [companyId]);
  
  // Use external metric if provided, otherwise use internal state
  const selectedMetric = externalMetric || internalMetric;
  
  const handleMetricChange = (metric: "laborHoursPerTon" | "costPerTon") => {
    if (onMetricChange) {
      onMetricChange(metric);
    } else {
      setInternalMetric(metric);
    }
  };
  
  // Check if user has dismissed first-time help (moved after bubbleData declaration)
  
  const handleDismissHelp = () => {
    setShowFirstTimeHelp(false);
    localStorage.setItem('quant-cost-trend-help-dismissed', 'true');
  };
  
  // Calculate data for labor categories or cost categories
  const bubbleData = useMemo(() => {
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
    
    if (selectedMetric === "laborHoursPerTon") {
      // Calculate value for each labor category
      const data: Array<{ category: string; label: string; mhPerTon: number }> = [];
      
      LABOR_CATEGORIES.forEach((laborCat) => {
        // Sum labor hours for this category across all lines
        const totalLaborHours = activeLines.reduce((sum, line) => {
          const value = (line as any)[laborCat.field] || 0;
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        
        // Calculate MHPT
        const mhPerTon = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
        
        if (totalLaborHours > 0 || mhPerTon > 0) {
          data.push({
            category: laborCat.key,
            label: laborCat.label,
            mhPerTon,
          });
        }
      });
      
      // Calculate total for percentage calculation
      const total = data.reduce((sum, d) => sum + d.mhPerTon, 0);
      
      // Add percentage and color to each item
      return data.map((item) => ({
        ...item,
        percentage: total > 0 ? (item.mhPerTon / total) * 100 : 0,
        color: LABOR_COLORS[item.category] || "#94a3b8",
      })).sort((a, b) => b.mhPerTon - a.mhPerTon); // Sort by value descending
    } else {
      // Calculate cost categories
      // Aggregate costs from all lines
      const materialCost = activeLines.reduce((sum, line) => sum + (line.materialCost || 0), 0);
      const laborCost = activeLines.reduce((sum, line) => sum + (line.laborCost || 0), 0);
      const coatingCost = activeLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0);
      const hardwareCost = activeLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0);
      
      // Buyouts would need to come from project settings or be tracked separately
      // For now, we'll calculate from line data if available
      const buyouts = 0; // TODO: Get from project settings or separate tracking
      
      // Apply waste factors (if available from settings)
      const materialWasteFactor = companySettings?.markupSettings?.materialWasteFactor || 0;
      const laborWasteFactor = companySettings?.markupSettings?.laborWasteFactor || 0;
      const materialWithWaste = materialCost * (1 + materialWasteFactor / 100);
      const laborWithWaste = laborCost * (1 + laborWasteFactor / 100);
      
      // Subtotal before overhead
      const subtotal = materialWithWaste + laborWithWaste + coatingCost + hardwareCost + buyouts;
      
      // Calculate overhead
      const overheadPercentage = companySettings?.markupSettings?.overheadPercentage || 0;
      const overheadAmount = subtotal * (overheadPercentage / 100);
      
      // Calculate profit (on subtotal + overhead)
      const profitPercentage = companySettings?.markupSettings?.profitPercentage || 0;
      const subtotalWithOverhead = subtotal + overheadAmount;
      const profitAmount = subtotalWithOverhead * (profitPercentage / 100);
      
      // Shipping - would need to be tracked separately, for now set to 0
      const shipping = 0;
      
      // Build cost category data
      const costData: Array<{ category: string; label: string; mhPerTon: number }> = [
        { category: "Material", label: "Material", mhPerTon: materialWithWaste },
        { category: "Labor", label: "Labor", mhPerTon: laborWithWaste },
        { category: "Coating", label: "Coating", mhPerTon: coatingCost },
        { category: "Hardware", label: "Hardware", mhPerTon: hardwareCost },
        { category: "Buyouts", label: "Buyouts", mhPerTon: buyouts },
        { category: "Overhead", label: "Overhead", mhPerTon: overheadAmount },
        { category: "Profit", label: "Profit", mhPerTon: profitAmount },
        { category: "Shipping", label: "Shipping", mhPerTon: shipping },
      ].filter(item => item.mhPerTon > 0); // Only include categories with costs
      
      // Calculate cost per ton for each category
      const data = costData.map(item => ({
        category: item.category,
        label: item.label,
        mhPerTon: totalWeight > 0 ? (item.mhPerTon / (totalWeight / 2000)) : 0,
      }));
      
      // Calculate total for percentage calculation
      const total = data.reduce((sum, d) => sum + d.mhPerTon, 0);
      
      // Add percentage and color to each item
      return data.map((item) => ({
        ...item,
        percentage: total > 0 ? (item.mhPerTon / total) * 100 : 0,
        color: COST_COLORS[item.category] || "#94a3b8",
      })).sort((a, b) => b.mhPerTon - a.mhPerTon); // Sort by value descending
    }
  }, [lines, selectedMetric, companySettings]);
  
  // Check if user has dismissed first-time help
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('quant-cost-trend-help-dismissed');
    if (!hasSeenHelp && bubbleData.length > 0) {
      const timer = setTimeout(() => {
        setShowFirstTimeHelp(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [bubbleData]);
  
  // Calculate selected project's data for overlay
  const selectedProjectData = useMemo(() => {
    if (!selectedProjectId || allProjectLines.length === 0) return null;
    
    const projectData = allProjectLines.find(p => p.projectId === selectedProjectId);
    if (!projectData || projectData.lines.length === 0) return null;
    
    const projectLines = projectData.lines.filter((line) => line.status !== "Void");
    if (projectLines.length === 0) return null;
    
    // Calculate total weight for selected project
    const totalWeight = projectLines.reduce((sum, line) => {
      const weight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);
    
    if (selectedMetric === "laborHoursPerTon") {
      // Calculate labor categories for selected project
      const data: Array<{ category: string; label: string; mhPerTon: number }> = [];
      
      LABOR_CATEGORIES.forEach((laborCat) => {
        const totalLaborHours = projectLines.reduce((sum, line) => {
          const value = (line as any)[laborCat.field] || 0;
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        
        const mhPerTon = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
        
        if (totalLaborHours > 0 || mhPerTon > 0) {
          data.push({
            category: laborCat.key,
            label: laborCat.label,
            mhPerTon,
          });
        }
      });
      
      return data.map((item) => ({
        ...item,
        color: LABOR_COLORS[item.category] || "#94a3b8",
      }));
    } else {
      // Calculate cost categories for selected project
      const materialCost = projectLines.reduce((sum, line) => sum + (line.materialCost || 0), 0);
      const laborCost = projectLines.reduce((sum, line) => sum + (line.laborCost || 0), 0);
      const coatingCost = projectLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0);
      const hardwareCost = projectLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0);
      const buyouts = 0;
      
      const materialWasteFactor = companySettings?.markupSettings?.materialWasteFactor || 0;
      const laborWasteFactor = companySettings?.markupSettings?.laborWasteFactor || 0;
      const materialWithWaste = materialCost * (1 + materialWasteFactor / 100);
      const laborWithWaste = laborCost * (1 + laborWasteFactor / 100);
      
      const subtotal = materialWithWaste + laborWithWaste + coatingCost + hardwareCost + buyouts;
      const overheadPercentage = companySettings?.markupSettings?.overheadPercentage || 0;
      const overheadAmount = subtotal * (overheadPercentage / 100);
      const profitPercentage = companySettings?.markupSettings?.profitPercentage || 0;
      const subtotalWithOverhead = subtotal + overheadAmount;
      const profitAmount = subtotalWithOverhead * (profitPercentage / 100);
      const shipping = 0;
      
      const costData: Array<{ category: string; label: string; mhPerTon: number }> = [
        { category: "Material", label: "Material", mhPerTon: materialWithWaste },
        { category: "Labor", label: "Labor", mhPerTon: laborWithWaste },
        { category: "Coating", label: "Coating", mhPerTon: coatingCost },
        { category: "Hardware", label: "Hardware", mhPerTon: hardwareCost },
        { category: "Buyouts", label: "Buyouts", mhPerTon: buyouts },
        { category: "Overhead", label: "Overhead", mhPerTon: overheadAmount },
        { category: "Profit", label: "Profit", mhPerTon: profitAmount },
        { category: "Shipping", label: "Shipping", mhPerTon: shipping },
      ].filter(item => item.mhPerTon > 0);
      
      const data = costData.map(item => ({
        category: item.category,
        label: item.label,
        mhPerTon: totalWeight > 0 ? (item.mhPerTon / (totalWeight / 2000)) : 0,
      }));
      
      return data.map((item) => ({
        ...item,
        color: COST_COLORS[item.category] || "#94a3b8",
      }));
    }
  }, [selectedProjectId, allProjectLines, selectedMetric, companySettings]);
  
  // Calculate company-wide averages (won/lost/all) for comparison
  const averageData = useMemo(() => {
    if (allProjectLines.length === 0) return new Map<string, number>();
    
    const allActiveLines = allProjectLines.flatMap((p) =>
      p.lines.filter((line) => line.status !== "Void")
    );
    
    if (allActiveLines.length === 0) return new Map<string, number>();
    
    const totalWeight = allActiveLines.reduce((sum, line) => {
      const weight = line.materialType === "Material"
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);
    
    const averages = new Map<string, number>();
    
    if (selectedMetric === "laborHoursPerTon") {
      LABOR_CATEGORIES.forEach((laborCat) => {
        const totalLaborHours = allActiveLines.reduce((sum, line) => {
          const value = (line as any)[laborCat.field] || 0;
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        const avgMHPT = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
        averages.set(laborCat.key, avgMHPT);
      });
    } else {
      const materialCost = allActiveLines.reduce((sum, line) => sum + (line.materialCost || 0), 0);
      const laborCost = allActiveLines.reduce((sum, line) => sum + (line.laborCost || 0), 0);
      const coatingCost = allActiveLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0);
      const hardwareCost = allActiveLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0);
      
      const materialWasteFactor = companySettings?.markupSettings?.materialWasteFactor || 0;
      const laborWasteFactor = companySettings?.markupSettings?.laborWasteFactor || 0;
      const materialWithWaste = materialCost * (1 + materialWasteFactor / 100);
      const laborWithWaste = laborCost * (1 + laborWasteFactor / 100);
      
      const subtotal = materialWithWaste + laborWithWaste + coatingCost + hardwareCost;
      const overheadPercentage = companySettings?.markupSettings?.overheadPercentage || 0;
      const overheadAmount = subtotal * (overheadPercentage / 100);
      const profitPercentage = companySettings?.markupSettings?.profitPercentage || 0;
      const subtotalWithOverhead = subtotal + overheadAmount;
      const profitAmount = subtotalWithOverhead * (profitPercentage / 100);
      
      const costCategories = [
        { key: "Material", value: materialWithWaste },
        { key: "Labor", value: laborWithWaste },
        { key: "Coating", value: coatingCost },
        { key: "Hardware", value: hardwareCost },
        { key: "Overhead", value: overheadAmount },
        { key: "Profit", value: profitAmount },
      ];
      
      costCategories.forEach((cat) => {
        const avgCostPT = totalWeight > 0 ? (cat.value / (totalWeight / 2000)) : 0;
        averages.set(cat.key, avgCostPT);
      });
    }
    
    return averages;
  }, [allProjectLines, selectedMetric, companySettings]);
  
  // Calculate won/lost averages
  const wonLostAverageData = useMemo(() => {
    const projectStatusMap = new Map<string, string>();
    projects.forEach((p: any) => {
      if (p.id && p.status) {
        projectStatusMap.set(p.id, p.status);
      }
    });
    
    const wonProjects = allProjectLines.filter((p) => projectStatusMap.get(p.projectId) === "won");
    const lostProjects = allProjectLines.filter((p) => projectStatusMap.get(p.projectId) === "lost");
    
    const calculateAverages = (projectList: typeof allProjectLines) => {
      if (projectList.length === 0) return new Map<string, number>();
      
      const allActiveLines = projectList.flatMap((p) =>
        p.lines.filter((line) => line.status !== "Void")
      );
      
      if (allActiveLines.length === 0) return new Map<string, number>();
      
      const totalWeight = allActiveLines.reduce((sum, line) => {
        const weight = line.materialType === "Material"
          ? (line.totalWeight || 0)
          : (line.plateTotalWeight || 0);
        return sum + weight;
      }, 0);
      
      const averages = new Map<string, number>();
      
      if (selectedMetric === "laborHoursPerTon") {
        LABOR_CATEGORIES.forEach((laborCat) => {
          const totalLaborHours = allActiveLines.reduce((sum, line) => {
            const value = (line as any)[laborCat.field] || 0;
            return sum + (typeof value === "number" ? value : 0);
          }, 0);
          const avgMHPT = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
          averages.set(laborCat.key, avgMHPT);
        });
      } else {
        const materialCost = allActiveLines.reduce((sum, line) => sum + (line.materialCost || 0), 0);
        const laborCost = allActiveLines.reduce((sum, line) => sum + (line.laborCost || 0), 0);
        const coatingCost = allActiveLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0);
        const hardwareCost = allActiveLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0);
        
        const materialWasteFactor = companySettings?.markupSettings?.materialWasteFactor || 0;
        const laborWasteFactor = companySettings?.markupSettings?.laborWasteFactor || 0;
        const materialWithWaste = materialCost * (1 + materialWasteFactor / 100);
        const laborWithWaste = laborCost * (1 + laborWasteFactor / 100);
        
        const subtotal = materialWithWaste + laborWithWaste + coatingCost + hardwareCost;
        const overheadPercentage = companySettings?.markupSettings?.overheadPercentage || 0;
        const overheadAmount = subtotal * (overheadPercentage / 100);
        const profitPercentage = companySettings?.markupSettings?.profitPercentage || 0;
        const subtotalWithOverhead = subtotal + overheadAmount;
        const profitAmount = subtotalWithOverhead * (profitPercentage / 100);
        
        const costCategories = [
          { key: "Material", value: materialWithWaste },
          { key: "Labor", value: laborWithWaste },
          { key: "Coating", value: coatingCost },
          { key: "Hardware", value: hardwareCost },
          { key: "Overhead", value: overheadAmount },
          { key: "Profit", value: profitAmount },
        ];
        
        costCategories.forEach((cat) => {
          const avgCostPT = totalWeight > 0 ? (cat.value / (totalWeight / 2000)) : 0;
          averages.set(cat.key, avgCostPT);
        });
      }
      
      return averages;
    };
    
    return {
      won: calculateAverages(wonProjects),
      lost: calculateAverages(lostProjects),
      wonCount: wonProjects.length,
      lostCount: lostProjects.length,
    };
  }, [allProjectLines, projects, selectedMetric, companySettings]);
  
  // Get available projects for dropdown
  const availableProjects = useMemo(() => {
    const projectMap = new Map<string, { id: string; name: string }>();
    
    // Add projects from props
    projects.forEach(p => {
      if (p.id && !projectMap.has(p.id)) {
        projectMap.set(p.id, {
          id: p.id,
          name: p.projectName || p.projectNumber || p.id
        });
      }
    });
    
    // Add projects from allProjectLines
    allProjectLines.forEach(p => {
      if (p.projectId && !projectMap.has(p.projectId)) {
        projectMap.set(p.projectId, {
          id: p.projectId,
          name: p.projectName || p.projectId
        });
      }
    });
    
    return Array.from(projectMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, allProjectLines]);
  
  // Calculate comparison data for selected category
  const categoryComparison = useMemo(() => {
    if (!selectedCategory) return null;
    
    // Get current value: use selected project data if available, otherwise use company average (bubbleData)
    let currentValue = 0;
    let currentLabel = "All Projects (Average)";
    if (selectedProjectId && selectedProjectData) {
      // Use selected project's value
      const projectItem = selectedProjectData.find(d => d.category === selectedCategory);
      currentValue = projectItem?.mhPerTon || 0;
      const project = availableProjects.find(p => p.id === selectedProjectId);
      currentLabel = project?.name || "Selected Project";
    } else {
      // Use company average (which is what bubbleData shows)
      currentValue = bubbleData.find(d => d.category === selectedCategory)?.mhPerTon || 0;
      currentLabel = "All Projects (Average)";
    }
    
    // Company average should be from averageData (all projects average) - this should always be different from current when a project is selected
    const allAvg = averageData.get(selectedCategory) || 0;
    const wonAvg = wonLostAverageData.won.get(selectedCategory) || 0;
    const lostAvg = wonLostAverageData.lost.get(selectedCategory) || 0;
    
    const allCount = allProjectLines.length;
    
    // Calculate lost percentage (percentage of all projects that are lost)
    const projectStatusMap = new Map<string, string>();
    projects.forEach((p: any) => {
      if (p.id && p.status) {
        projectStatusMap.set(p.id, p.status);
      }
    });
    const totalProjectsWithStatus = projects.filter(p => {
      const status = projectStatusMap.get(p.id);
      return status === "won" || status === "lost";
    }).length;
    const lostPercentage = totalProjectsWithStatus > 0 
      ? (wonLostAverageData.lostCount / totalProjectsWithStatus) * 100 
      : 0;
    
    const categoryLabel = selectedMetric === "laborHoursPerTon"
      ? LABOR_CATEGORIES.find(c => c.key === selectedCategory)?.label || selectedCategory
      : COST_COLORS[selectedCategory] ? selectedCategory : selectedCategory;
    
    return {
      category: selectedCategory,
      label: categoryLabel,
      current: currentValue,
      currentLabel: currentLabel,
      allAverage: allAvg,
      wonAverage: wonAvg,
      lostAverage: lostAvg,
      allCount,
      wonCount: wonLostAverageData.wonCount,
      lostCount: wonLostAverageData.lostCount,
      lostPercentage: lostPercentage,
    };
  }, [selectedCategory, bubbleData, selectedProjectData, selectedProjectId, averageData, wonLostAverageData, allProjectLines, selectedMetric, availableProjects, projects]);
  
  // Render bubble chart using D3 with physics simulation (matching project-level style)
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (bubbleData.length === 0) {
      return;
    }

    // Use fixed viewBox dimensions for consistent scaling
    const viewBoxWidth = 800;
    const viewBoxHeight = 600;
    const centerX = viewBoxWidth / 2;
    const centerY = viewBoxHeight / 2;

    // Use selected project data if available, otherwise use company average (bubbleData)
    const dataToRender = selectedProjectId && selectedProjectData 
      ? selectedProjectData.map(d => ({
          ...d,
          percentage: 0, // Will be calculated below
        }))
      : bubbleData;
    
    // Filter out zero values
    const nonZeroData = dataToRender.filter(d => d.mhPerTon > 0);
    
    if (nonZeroData.length === 0) {
      return;
    }
    
    // Calculate percentages for selected project data
    if (selectedProjectId && selectedProjectData) {
      const total = nonZeroData.reduce((sum, d) => sum + d.mhPerTon, 0);
      nonZeroData.forEach(d => {
        d.percentage = total > 0 ? (d.mhPerTon / total) * 100 : 0;
      });
    }

    // Calculate radius scale
    const maxValue = Math.max(...nonZeroData.map(d => d.mhPerTon));
    const minRadius = 15;
    const maxRadius = 80;
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxValue])
      .range([minRadius, maxRadius]);

    // Prepare nodes for force simulation
    const nodes = nonZeroData.map((d, i) => {
      const radius = radiusScale(d.mhPerTon);
      // Start bubbles in a circle around center
      const angle = (i / nonZeroData.length) * 2 * Math.PI;
      const startRadius = 100;
      return {
        ...d,
        radius,
        x: centerX + Math.cos(angle) * startRadius,
        y: centerY + Math.sin(angle) * startRadius,
        vx: 0,
        vy: 0,
      };
    });

    // Create force simulation with anti-gravity (floating effect)
    const simulation = d3.forceSimulation(nodes as any)
      .force("center", d3.forceCenter(centerX, centerY).strength(0.05))
      .force("collision", d3.forceCollide().radius((d: any) => d.radius + 3).strength(0.9))
      .force("charge", d3.forceManyBody().strength(-20))
      .force("x", d3.forceX(centerX).strength(0.03))
      .force("y", d3.forceY(centerY).strength(0.02))
      .force("radial", d3.forceRadial((d: any) => {
        const distanceFromCenter = Math.sqrt(
          Math.pow(d.x - centerX, 2) + Math.pow(d.y - centerY, 2)
        );
        return Math.min(distanceFromCenter * 0.1, 50);
      }, centerX, centerY).strength(0.02))
      .alphaDecay(0.01)
      .velocityDecay(0.3);

    // Create container group for zoom
    const g = svg.append("g").attr("class", "zoom-container");
    
    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    // Create bubble groups
    const bubbles = g.selectAll("g.bubble")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "bubble")
      .style("cursor", "pointer");

    // Add circles with initial animation
    const circles = bubbles.append("circle")
      .attr("r", 0)
      .attr("fill", (d: any) => d.color)
      .attr("opacity", 0.8)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .style("cursor", "pointer");

    // Add hover interactions BEFORE transition
    circles.on("mouseover", function(event, d: any) {
        d3.select(this).attr("opacity", 1).attr("stroke-width", 3);
        
        // Show tooltip
        if (tooltipRef.current) {
          const tooltip = tooltipRef.current;
          tooltip.style.display = "block";
          
          // Use clientX/clientY for viewport-relative positioning
          const x = event.clientX;
          const y = event.clientY;
          const tooltipWidth = 200; // Approximate tooltip width
          const tooltipHeight = 100; // Approximate tooltip height
          const padding = 10;
          
          // Calculate position with viewport bounds checking
          let left = x + padding;
          let top = y - padding;
          
          // Keep tooltip within viewport horizontally
          if (left + tooltipWidth > window.innerWidth) {
            left = x - tooltipWidth - padding;
          }
          
          // Keep tooltip within viewport vertically
          if (top + tooltipHeight > window.innerHeight) {
            top = y - tooltipHeight - padding;
          }
          if (top < 0) {
            top = padding;
          }
          
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
          tooltip.innerHTML = `
            <div class="font-semibold">${d.label}</div>
            <div>${d.mhPerTon.toFixed(2)} ${selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}</div>
            <div class="text-xs text-gray-600">${d.percentage.toFixed(1)}% of total</div>
            <div class="text-xs text-blue-400 mt-1">Click for detailed comparison</div>
          `;
        }
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current) {
          const tooltip = tooltipRef.current;
          
          // Use clientX/clientY for viewport-relative positioning
          const x = event.clientX;
          const y = event.clientY;
          const tooltipWidth = 200; // Approximate tooltip width
          const tooltipHeight = 100; // Approximate tooltip height
          const padding = 10;
          
          // Calculate position with viewport bounds checking
          let left = x + padding;
          let top = y - padding;
          
          // Keep tooltip within viewport horizontally
          if (left + tooltipWidth > window.innerWidth) {
            left = x - tooltipWidth - padding;
          }
          
          // Keep tooltip within viewport vertically
          if (top + tooltipHeight > window.innerHeight) {
            top = y - tooltipHeight - padding;
          }
          if (top < 0) {
            top = padding;
          }
          
          tooltip.style.left = `${left}px`;
          tooltip.style.top = `${top}px`;
        }
      })
      .on("mouseout", function() {
        d3.select(this).attr("opacity", 0.8).attr("stroke-width", 2);
        if (tooltipRef.current) {
          tooltipRef.current.style.display = "none";
        }
      })
      .on("click", function(event, d: any) {
        event.stopPropagation();
        setSelectedCategory(d.category);
      });

    // Now apply the transition
    circles.transition()
      .duration(800)
      .ease(d3.easeElasticOut.period(0.5))
      .attr("r", (d: any) => d.radius);

    // Add average halo rings (matching project-level style)
    // Show overlay circles for all categories that have average data
    bubbles.each(function(d: any) {
      const bubbleGroup = d3.select(this);
      const category = d.category;
      const avgValue = averageData.get(category) || 0;
      const wonAvgValue = wonLostAverageData.won.get(category) || 0;
      const lostAvgValue = wonLostAverageData.lost.get(category) || 0;
      
      // Add red dashed halo for overall average (always show if data exists)
      if (avgValue > 0) {
        const avgRadius = radiusScale(avgValue);
        if (avgRadius > 5) {
          bubbleGroup.append("circle")
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "5,5")
            .attr("opacity", 0.7)
            .style("pointer-events", "none")
            .transition()
            .duration(1000)
            .delay(400)
            .attr("r", avgRadius);
        }
      }
      
      // Add green dotted line for won projects average (always show if data exists)
      if (wonAvgValue > 0) {
        const wonRadius = radiusScale(wonAvgValue);
        if (wonRadius > 5) {
          bubbleGroup.append("circle")
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", "#22c55e") // Green
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4")
            .attr("opacity", 0.7)
            .style("pointer-events", "none")
            .transition()
            .duration(1000)
            .delay(700)
            .attr("r", wonRadius);
        }
      }
      
      // Add red dotted line for lost projects average (always show if data exists)
      if (lostAvgValue > 0) {
        const lostRadius = radiusScale(lostAvgValue);
        if (lostRadius > 5) {
          bubbleGroup.append("circle")
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", "#ef4444") // Red
            .attr("stroke-width", 2)
            .attr("stroke-dasharray", "4,4")
            .attr("opacity", 0.7)
            .style("pointer-events", "none")
            .transition()
            .duration(1000)
            .delay(800)
            .attr("r", lostRadius);
        }
      }
    });

    // Add text labels
    const labels = bubbles.append("g")
      .attr("class", "label-group")
      .style("pointer-events", "none");

    labels.each(function(d: any) {
      const labelGroup = d3.select(this);
      const radius = d.radius;
      const fontSize = Math.min(radius / 3, 14);
      const valueFontSize = Math.min(radius / 4, 12);
      
      // Category label
      labelGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("fill", "white")
        .attr("font-weight", "600")
        .attr("font-size", `${fontSize}px`)
        .style("text-shadow", "0 1px 3px rgba(0,0,0,0.7), 0 0 2px rgba(0,0,0,0.5)")
        .style("stroke", "rgba(0,0,0,0.3)")
        .style("stroke-width", "0.5px")
        .text(d.label);
      
      // Value text
      labelGroup.append("text")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("dy", fontSize + 4)
        .attr("fill", "white")
        .attr("font-weight", "500")
        .attr("font-size", `${valueFontSize}px`)
        .style("text-shadow", "0 1px 2px rgba(0,0,0,0.7)")
        .text(`${d.mhPerTon.toFixed(1)} ${selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}`);
    });

    // Update positions on simulation tick
    simulation.on("tick", () => {
      bubbles.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [bubbleData, selectedProjectId, selectedProjectData, selectedMetric, averageData, wonLostAverageData]);
  
  const getMetricLabel = (metric: "laborHoursPerTon" | "costPerTon"): string => {
    return metric === "laborHoursPerTon" ? "Man Hours per Ton" : "Cost per Ton";
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
  
  // Find max value for legend
  const maxValue = Math.max(...bubbleData.map(d => d.mhPerTon), 1);
  const totalValue = bubbleData.reduce((sum, d) => sum + d.mhPerTon, 0);
  
  return (
    <Card className="p-4 md:p-6 rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CardTitle className="text-xl font-bold text-gray-900 tracking-normal">
                Cost Trend Analysis
              </CardTitle>
              {/* Always-visible info button with rich tooltip */}
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setShowInfoTooltip(!showInfoTooltip)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors group"
                  aria-label="Chart information"
                >
                  <Info className="w-4 h-4 text-gray-400 group-hover:text-gray-600 transition-colors" />
                </button>
                {showInfoTooltip && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowInfoTooltip(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-200 p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-900">How to read this chart</h3>
                        <button
                          onClick={() => setShowInfoTooltip(false)}
                          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </div>
                      <div className="space-y-3 text-xs text-gray-600">
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Bubble size</p>
                          <p>Represents {selectedMetric === "laborHoursPerTon" ? "man hours per ton (MH/T)" : "cost per ton ($/T)"} for each category. Larger bubbles indicate higher intensity.</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Bubble size</p>
                          <p>Represents {selectedMetric === "laborHoursPerTon" ? "man hours per ton (MH/T)" : "cost per ton ($/T)"} for each category. Larger bubbles indicate higher intensity.</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Overlay circles</p>
                          <p>Gray dashed circles show company average. Dark gray solid circles show won/lost project averages. Use these as benchmarks to compare current values.</p>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 mb-1">Click to compare</p>
                          <p>Click any bubble to see a detailed comparison with historical data, including won vs. lost averages.</p>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                title="Select a project to compare against company average"
              >
                <option value="">All Projects (Average)</option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
              <Button
                variant={selectedMetric === "laborHoursPerTon" ? "primary" : "outline"}
                size="sm"
                onClick={() => handleMetricChange("laborHoursPerTon")}
                className="text-xs"
              >
                Man Hours / Ton
              </Button>
              <Button
                variant={selectedMetric === "costPerTon" ? "primary" : "outline"}
                size="sm"
                onClick={() => handleMetricChange("costPerTon")}
                className="text-xs"
              >
                Cost / Ton
              </Button>
            </div>
          </div>
          
          {/* Subtitle */}
          <p className="text-xs text-gray-500 -mt-2">
            {selectedMetric === "laborHoursPerTon" 
              ? "Company-wide labor intensity distribution. Compare individual projects to identify efficiency opportunities."
              : "Company-wide cost distribution. Compare individual projects to identify cost drivers and optimization areas."
            }
          </p>
          
          {/* First-time help banner - Apple-style subtle and dismissible */}
          {showFirstTimeHelp && bubbleData.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/50 rounded-xl shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-start gap-2.5">
                <div className="p-1.5 bg-blue-100 rounded-lg flex-shrink-0">
                  <Sparkles className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-blue-900 mb-1.5">Quick tip</p>
                  <p className="text-xs text-blue-800 leading-relaxed mb-2">
                    Bubble size shows {selectedMetric === "laborHoursPerTon" ? "labor intensity" : "cost intensity"} per category. 
                    Overlay circles show company average and won/lost averages for comparison.
                  </p>
                  <button
                    onClick={handleDismissHelp}
                    className="text-[11px] font-medium text-blue-700 hover:text-blue-900 transition-colors"
                  >
                    Got it
                  </button>
                </div>
                <button
                  onClick={handleDismissHelp}
                  className="p-1 hover:bg-blue-100 rounded-lg transition-colors flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-3.5 h-3.5 text-blue-600" />
                </button>
              </div>
            </div>
          )}
          
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 relative">
        {/* Bubble Chart Visualization */}
        <div className="w-full flex justify-center" style={{ minHeight: "600px" }}>
          <div ref={containerRef} className="relative w-full flex justify-center" style={{ minHeight: "600px" }}>
            <svg
              ref={svgRef}
              className="max-w-full h-auto"
              viewBox="0 0 800 600"
              preserveAspectRatio="xMidYMid meet"
            />
            {/* Tooltip */}
            <div
              ref={tooltipRef}
              className="fixed bg-white rounded-lg shadow-lg p-2 border border-gray-200 pointer-events-none z-50"
              style={{ display: "none" }}
            />
            {/* Zoom/Pan instructions */}
            <div className="absolute top-2 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-gray-200/50">
              Scroll to zoom • Drag to pan
            </div>
            {/* Legend */}
            {(averageData.size > 0 || wonLostAverageData.won.size > 0 || wonLostAverageData.lost.size > 0) && (
              <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-gray-200/50">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full border-2 border-red-500 border-dashed" />
                    <span>All avg</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full border-2 border-green-500 border-dashed" />
                    <span>Won avg</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full border-2 border-orange-500 border-dashed" />
                    <span>Lost avg</span>
                  </div>
                </div>
                <div className="text-[9px] text-gray-400 mt-1 text-center">
                  Click bubbles to compare
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-4 items-center pt-2 border-t border-gray-100">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            {selectedMetric === "laborHoursPerTon" ? "Labor Categories" : "Cost Categories"}
          </span>
          {bubbleData.map((bubble) => (
            <div
              key={bubble.category}
              className="flex items-center gap-2 text-sm text-gray-700"
            >
              <span
                className="inline-block w-3 h-3 rounded-full"
                style={{ backgroundColor: bubble.color }}
              />
              <span className="font-medium">{bubble.label}</span>
              <span className="text-xs text-gray-500">
                ({selectedMetric === "laborHoursPerTon" 
                  ? `${bubble.mhPerTon.toFixed(1)} MH/T`
                  : bubble.mhPerTon >= 1000
                    ? `$${(bubble.mhPerTon / 1000).toFixed(1)}K/T`
                    : `$${bubble.mhPerTon.toFixed(0)}/T`})
              </span>
            </div>
          ))}
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Total Categories</div>
            <div className="text-lg font-semibold text-gray-900">{bubbleData.length}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Max Value</div>
            <div className="text-lg font-semibold text-gray-900">
              {selectedMetric === "laborHoursPerTon" 
                ? `${maxValue.toFixed(1)} MH/T`
                : maxValue >= 1000
                  ? `$${(maxValue / 1000).toFixed(1)}K/T`
                  : `$${maxValue.toFixed(0)}/T`}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 mb-1">Total {getMetricLabel(selectedMetric)}</div>
            <div className="text-lg font-semibold text-gray-900">
              {selectedMetric === "laborHoursPerTon" 
                ? `${totalValue.toFixed(1)} MH/T`
                : totalValue >= 1000
                  ? `$${(totalValue / 1000).toFixed(1)}K/T`
                  : `$${totalValue.toFixed(0)}/T`}
            </div>
          </div>
        </div>
        
        {/* Modal Popup (appears on click) */}
        {selectedCategory && categoryComparison && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" 
            onClick={(e) => {
              // Only close if clicking directly on the backdrop, not on child elements
              if (e.target === e.currentTarget) {
                setSelectedCategory(null);
              }
            }}
            onMouseDown={(e) => {
              // Prevent closing on mouse down events
              if (e.target === e.currentTarget) {
                e.preventDefault();
              }
            }}
          >
            <div 
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" 
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 tracking-normal">{categoryComparison.label}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Live comparison across all projects
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-slate-500" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Current */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                      <span className="text-sm font-semibold text-slate-900">Current</span>
                    </div>
                    <p className="text-xs text-slate-600 mb-2 truncate">{categoryComparison.currentLabel}</p>
                    <p className="text-2xl font-bold text-blue-900 tabular-nums">
                      {categoryComparison.current.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                    </p>
                  </div>

                  {/* Won Average */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                      <span className="text-sm font-semibold text-slate-900">Won Average</span>
                      {categoryComparison.wonCount > 0 ? (
                        <span className="text-xs text-slate-500">({categoryComparison.wonCount})</span>
                      ) : (
                        <span className="text-xs text-slate-400">(No data)</span>
                      )}
                    </div>
                    {categoryComparison.wonCount > 0 ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          {categoryComparison.current > categoryComparison.wonAverage ? (
                            <TrendingUp className="w-4 h-4 text-amber-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-emerald-600" />
                          )}
                          <span className="text-xs text-slate-600">
                            {categoryComparison.current > categoryComparison.wonAverage ? (
                              <span className="text-amber-700">
                                {((categoryComparison.current / categoryComparison.wonAverage - 1) * 100).toFixed(1)}% above
                              </span>
                            ) : (
                              <span className="text-emerald-700">
                                {((1 - categoryComparison.current / categoryComparison.wonAverage) * 100).toFixed(1)}% below
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-emerald-900 tabular-nums">
                          {categoryComparison.wonAverage.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No won projects data available</p>
                    )}
                  </div>

                  {/* Lost Average */}
                  <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-3 h-3 rounded-full bg-red-600"></div>
                      <span className="text-sm font-semibold text-slate-900">Lost Average</span>
                      {categoryComparison.lostCount > 0 ? (
                        <span className="text-xs text-slate-500">({categoryComparison.lostCount})</span>
                      ) : (
                        <span className="text-xs text-slate-400">(No data)</span>
                      )}
                    </div>
                    {categoryComparison.lostCount > 0 && categoryComparison.lostAverage > 0 ? (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          {categoryComparison.current > categoryComparison.lostAverage ? (
                            <TrendingUp className="w-4 h-4 text-red-600" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-emerald-600" />
                          )}
                          <span className="text-xs text-slate-600">
                            {categoryComparison.current > categoryComparison.lostAverage ? (
                              <span className="text-red-700 font-medium">
                                {((categoryComparison.current / categoryComparison.lostAverage - 1) * 100).toFixed(1)}% above
                              </span>
                            ) : (
                              <span className="text-emerald-700">
                                {((1 - categoryComparison.current / categoryComparison.lostAverage) * 100).toFixed(1)}% below
                              </span>
                            )}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-red-900 tabular-nums">
                          {categoryComparison.lostAverage.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No lost projects data available</p>
                    )}
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <p className="text-xs text-red-700">
                        <span className="font-semibold">Lost Rate:</span> {categoryComparison.lostPercentage.toFixed(1)}% of projects
                      </p>
                    </div>
                  </div>

                  {/* All Average */}
                  {categoryComparison.allCount > 0 && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-slate-600"></div>
                        <span className="text-sm font-semibold text-slate-900">All Average</span>
                        <span className="text-xs text-slate-500">({categoryComparison.allCount})</span>
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        {categoryComparison.current > categoryComparison.allAverage ? (
                          <TrendingUp className="w-4 h-4 text-amber-600" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-emerald-600" />
                        )}
                        <span className="text-xs text-slate-600">
                          {categoryComparison.current > categoryComparison.allAverage ? (
                            <span className="text-amber-700">
                              {((categoryComparison.current / categoryComparison.allAverage - 1) * 100).toFixed(1)}% above
                            </span>
                          ) : (
                            <span className="text-emerald-700">
                              {((1 - categoryComparison.current / categoryComparison.allAverage) * 100).toFixed(1)}% below
                            </span>
                          )}
                        </span>
                      </div>
                      <p className="text-2xl font-bold text-slate-900 tabular-nums">
                        {categoryComparison.allAverage.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                      </p>
                    </div>
                  )}
                </div>

                {/* Insight */}
                <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-slate-700 mb-2">
                    <strong className="text-slate-900">Live Control Panel:</strong> This comparison updates in real-time as projects are estimated. 
                    Use won/lost averages to identify competitive positioning and adjust estimates accordingly.
                  </p>
                  {categoryComparison.lostCount > 0 && (
                    <p className="text-sm text-slate-700">
                      <strong className="text-slate-900">Lost Rate Warning:</strong> {categoryComparison.lostPercentage.toFixed(1)}% of historical projects were lost. 
                      If your current estimate is approaching or exceeding the lost average, consider adjusting to improve win probability.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
      </CardContent>
    </Card>
  );
}
