"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { EstimatingLine } from "./EstimatingGrid";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { BarChart3, X, TrendingUp, TrendingDown, Sparkles, Maximize2 } from "lucide-react";
import ChartOverlay from "@/components/ui/ChartOverlay";
import ContextualHelp from "@/components/ui/ContextualHelp";
import { loadCompanySettings, type CompanySettings } from "@/lib/utils/settingsLoader";
import { subscribeToCollection, getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { 
  LABOR_FINGERPRINT_NAME, 
  LABOR_FINGERPRINT_SUBTITLE
} from "@/lib/branding";

interface ProjectBubbleChartProps {
  lines: EstimatingLine[];
  companyId: string;
  projectName?: string;
  currentProjectId?: string; // To exclude current project from average calculation
  selectedMetric?: "laborHoursPerTon" | "costPerTon";
  onMetricChange?: (metric: "laborHoursPerTon" | "costPerTon") => void;
}

// Labor category definitions (same as CostTrendBubbleChart)
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

const LABOR_COLORS: Record<string, string> = {
  "Unload": "#3b82f6",
  "Cut": "#10b981",
  "Cope": "#8b5cf6",
  "Process Plate": "#f59e0b",
  "Drill/Punch": "#ef4444",
  "Fit": "#06b6d4",
  "Weld": "#f97316",
  "Prep/Clean": "#84cc16",
  "Paint": "#ec4899",
  "Handle/Move": "#6366f1",
  "Load/Ship": "#14b8a6",
  "Allowance": "#a855f7", // Purple for allowance (unrealized profit if unused)
};

// Cost category colors
const COST_COLORS: Record<string, string> = {
  "Material": "#3b82f6",
  "Labor": "#10b981",
  "Coating": "#f59e0b",
  "Hardware": "#8b5cf6",
  "Buyouts": "#ef4444",
  "Overhead": "#f97316",
  "Profit": "#84cc16",
  "Shipping": "#06b6d4",
};

interface BubbleData {
  category: string;
  label: string;
  mhPerTon: number;
  color: string;
  percentage: number;
}

interface ProjectData {
  projectId: string;
  projectName: string;
  lines: EstimatingLine[];
}

export default function ProjectBubbleChart({ lines, companyId, projectName, currentProjectId, selectedMetric: externalMetric, onMetricChange }: ProjectBubbleChartProps) {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [internalMetric, setInternalMetric] = useState<"laborHoursPerTon" | "costPerTon">("laborHoursPerTon");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  
  const selectedMetric = externalMetric || internalMetric;
  
  const handleMetricChange = (metric: "laborHoursPerTon" | "costPerTon") => {
    if (onMetricChange) {
      onMetricChange(metric);
    } else {
      setInternalMetric(metric);
    }
  };
  const [allProjects, setAllProjects] = useState<Array<{ id: string; projectName?: string; status?: string; archived?: boolean }>>([]);
  const [allProjectLines, setAllProjectLines] = useState<ProjectData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const overlaySvgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (companyId) {
      loadCompanySettings(companyId).then(setCompanySettings);
    }
  }, [companyId]);

  // Load all projects to calculate averages
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      setAllProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<any>(
      projectsPath,
      (projectData) => {
        // Filter for projects that have been submitted (won, lost, active, submitted, or have approvedBudget)
        const submittedProjects = projectData.filter(
          (p: any) => 
            !p.archived && 
            (p.status === "won" || 
             p.status === "lost" ||
             p.status === "active" || 
             p.status === "submitted" || 
             p.approvedBudget ||
             p.status === "draft")
        );
        setAllProjects(submittedProjects);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Subscribe to lines for all projects
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || allProjects.length === 0) {
      setAllProjectLines([]);
      return;
    }

    const unsubscribes: Array<() => void> = [];

    allProjects.forEach((project) => {
      try {
        const linesPath = getProjectPath(companyId, project.id, "lines");
        const unsubscribe = subscribeToCollection<EstimatingLine>(
          linesPath,
          (projectLines) => {
            setAllProjectLines((prev) => {
              const updated = [...prev];
              const index = updated.findIndex((p) => p.projectId === project.id);
              if (index >= 0) {
                updated[index] = {
                  ...updated[index],
                  lines: projectLines,
                };
              } else {
                updated.push({
                  projectId: project.id,
                  projectName: project.projectName || project.id,
                  lines: projectLines,
                });
              }
              return updated;
            });
          }
        );
        unsubscribes.push(unsubscribe);
      } catch (err) {
        console.error(`Error subscribing to project ${project.id}:`, err);
      }
    });

    return () => {
      unsubscribes.forEach((unsub) => {
        try {
          unsub();
        } catch (err) {
          console.error("Error unsubscribing:", err);
        }
      });
    };
  }, [companyId, allProjects]);

  // Calculate bubble data for current project only
  const bubbleData = useMemo(() => {
    const activeLines = lines.filter((line) => line.status !== "Void");
    
    if (activeLines.length === 0) {
      return [];
    }
    
    const totalWeight = activeLines.reduce((sum, line) => {
      const weight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);
    
    if (selectedMetric === "laborHoursPerTon") {
      const data: Array<{ category: string; label: string; mhPerTon: number }> = [];
      
      LABOR_CATEGORIES.forEach((laborCat) => {
        const totalLaborHours = activeLines.reduce((sum, line) => {
          const value = (line as any)[laborCat.field] || 0;
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        
        const mhPerTon = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
        
        // Always include category, even if 0, so chart shows all categories
        data.push({
          category: laborCat.key,
          label: laborCat.label,
          mhPerTon,
        });
      });
      
      // Add Allowance category (from allowance lines)
      const allowanceHours = activeLines
        .filter(line => line.category === "Allowances" || line.subCategory === "Bid Coach")
        .reduce((sum, line) => sum + (line.totalLabor || 0), 0);
      const allowanceMHPT = totalWeight > 0 ? (allowanceHours / (totalWeight / 2000)) : 0;
      if (allowanceMHPT > 0) {
        data.push({
          category: "Allowance",
          label: "Allowance",
          mhPerTon: allowanceMHPT,
        });
      }
      
      const total = data.reduce((sum, d) => sum + d.mhPerTon, 0);
      
      return data.map((item) => ({
        ...item,
        percentage: total > 0 ? (item.mhPerTon / total) * 100 : 0,
        color: LABOR_COLORS[item.category] || "#94a3b8",
      })).sort((a, b) => b.mhPerTon - a.mhPerTon);
    } else {
      // Cost per ton calculation
      const materialCost = activeLines.reduce((sum, line) => sum + (line.materialCost || 0), 0);
      const laborCost = activeLines.reduce((sum, line) => sum + (line.laborCost || 0), 0);
      const coatingCost = activeLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0);
      const hardwareCost = activeLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0);
      
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
      
      const costData = [
        { category: "Material", label: "Material", mhPerTon: materialWithWaste },
        { category: "Labor", label: "Labor", mhPerTon: laborWithWaste },
        { category: "Coating", label: "Coating", mhPerTon: coatingCost },
        { category: "Hardware", label: "Hardware", mhPerTon: hardwareCost },
        { category: "Overhead", label: "Overhead", mhPerTon: overheadAmount },
        { category: "Profit", label: "Profit", mhPerTon: profitAmount },
      ].filter(item => item.mhPerTon > 0);
      
      const data = costData.map(item => ({
        category: item.category,
        label: item.label,
        mhPerTon: totalWeight > 0 ? (item.mhPerTon / (totalWeight / 2000)) : 0,
      }));
      
      const total = data.reduce((sum, d) => sum + d.mhPerTon, 0);
      
      return data.map((item) => ({
        ...item,
        percentage: total > 0 ? (item.mhPerTon / total) * 100 : 0,
        color: COST_COLORS[item.category] || "#94a3b8",
      })).sort((a, b) => b.mhPerTon - a.mhPerTon);
    }
  }, [lines, selectedMetric, companySettings]);

  // Calculate average data across all projects (excluding current project)
  const averageData = useMemo(() => {
    // Filter out current project from average calculation
    const projectsForAverage = allProjectLines.filter(
      (p) => !currentProjectId || p.projectId !== currentProjectId
    );

    if (projectsForAverage.length === 0) {
      return new Map<string, number>();
    }

    // Collect all active lines from all projects
    const allActiveLines = projectsForAverage.flatMap((p) =>
      p.lines.filter((line) => line.status !== "Void")
    );

    if (allActiveLines.length === 0) {
      return new Map<string, number>();
    }

    // Calculate total weight across all projects
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
      
      // Add Allowance category average
      const allowanceHours = allActiveLines
        .filter(line => line.category === "Allowances" || line.subCategory === "Bid Coach")
        .reduce((sum, line) => sum + (line.totalLabor || 0), 0);
      const avgAllowanceMHPT = totalWeight > 0 ? (allowanceHours / (totalWeight / 2000)) : 0;
      if (avgAllowanceMHPT > 0) {
        averages.set("Allowance", avgAllowanceMHPT);
      }
    } else {
      // Calculate average cost per ton for each category
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
  }, [allProjectLines, selectedMetric, companySettings, currentProjectId]);

  // Calculate won/lost project averages
  const wonLostAverageData = useMemo(() => {
    // Get project statuses (matching CategoryComparisonChart logic)
    const projectStatusMap = new Map<string, string>();
    allProjects.forEach((p: any) => {
      if (p.id && p.status) {
        projectStatusMap.set(p.id, p.status);
      }
    });

    // Separate won and lost projects (excluding current project)
    // Won projects: status === "won" only (matching CategoryComparisonChart)
    const wonProjects = allProjectLines.filter(
      (p) => {
        if (currentProjectId && p.projectId === currentProjectId) {
          return false; // Always exclude current project
        }
        const status = projectStatusMap.get(p.projectId);
        return status === "won";
      }
    );
    
    // Lost projects: status === "lost" only (matching CategoryComparisonChart)
    const lostProjects = allProjectLines.filter(
      (p) => {
        if (currentProjectId && p.projectId === currentProjectId) {
          return false; // Always exclude current project
        }
        const status = projectStatusMap.get(p.projectId);
        return status === "lost";
      }
    );

    const calculateAverages = (projectList: ProjectData[]) => {
      if (projectList.length === 0) {
        return new Map<string, number>();
      }

      const allActiveLines = projectList.flatMap((p) =>
        p.lines.filter((line) => line.status !== "Void")
      );

      if (allActiveLines.length === 0) {
        return new Map<string, number>();
      }

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
        
        // Add Allowance category average
        const allowanceHours = allActiveLines
          .filter(line => line.category === "Allowances" || line.subCategory === "Bid Coach")
          .reduce((sum, line) => sum + (line.totalLabor || 0), 0);
        const avgAllowanceMHPT = totalWeight > 0 ? (allowanceHours / (totalWeight / 2000)) : 0;
        if (avgAllowanceMHPT > 0) {
          averages.set("Allowance", avgAllowanceMHPT);
        }
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

    const wonAverages = calculateAverages(wonProjects);
    const lostAverages = calculateAverages(lostProjects);
    
    // Debug logging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('Won/Lost Average Calculation:', {
        wonProjectsCount: wonProjects.length,
        lostProjectsCount: lostProjects.length,
        currentProjectId,
        wonProjectIds: wonProjects.map(p => p.projectId),
        lostProjectIds: lostProjects.map(p => p.projectId),
        sampleWonAverages: Array.from(wonAverages.entries()).slice(0, 3),
        sampleLostAverages: Array.from(lostAverages.entries()).slice(0, 3),
      });
    }
    
    return {
      won: wonAverages,
      lost: lostAverages,
    };
  }, [allProjectLines, allProjects, selectedMetric, companySettings, currentProjectId]);

  // Render bubble chart using D3 with physics simulation
  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    if (bubbleData.length === 0) {
      return;
    }

    // Use fixed viewBox dimensions for consistent scaling
    // The SVG will scale responsively via viewBox
    const viewBoxWidth = 800;
    const viewBoxHeight = 600;
    const centerX = viewBoxWidth / 2;
    const centerY = viewBoxHeight / 2;

    // Filter out zero values
    const nonZeroData = bubbleData.filter(d => d.mhPerTon > 0);
    
    if (nonZeroData.length === 0) {
      return;
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
      .force("center", d3.forceCenter(centerX, centerY).strength(0.05)) // Reduced gravity
      .force("collision", d3.forceCollide().radius((d: any) => d.radius + 3).strength(0.9))
      .force("charge", d3.forceManyBody().strength(-20)) // Reduced repulsion for more float
      .force("x", d3.forceX(centerX).strength(0.03)) // Lighter horizontal pull
      .force("y", d3.forceY(centerY).strength(0.02)) // Very light vertical pull (anti-gravity effect)
      .force("radial", d3.forceRadial((d: any) => {
        // Create subtle outward/upward force for floating effect
        const distanceFromCenter = Math.sqrt(
          Math.pow(d.x - centerX, 2) + Math.pow(d.y - centerY, 2)
        );
        return Math.min(distanceFromCenter * 0.1, 50); // Subtle outward push
      }, centerX, centerY).strength(0.02))
      .alphaDecay(0.01) // Slower decay for more movement
      .velocityDecay(0.3); // Less friction for floating effect

    // Create container group for zoom
    const g = svg.append("g").attr("class", "zoom-container");
    
    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3]) // Allow zoom from 0.5x to 3x
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

    // Add average halo rings
    bubbles.each(function(d: any) {
      const bubbleGroup = d3.select(this);
      const category = d.category;
      const avgValue = averageData.get(category) || 0;
      const wonAvgValue = wonLostAverageData.won.get(category) || 0;
      const lostAvgValue = wonLostAverageData.lost.get(category) || 0;
      const currentValue = d.mhPerTon;
      
      // Add red dashed halo for overall average
      if (avgValue > 0) {
        const avgRadius = radiusScale(avgValue);
        if (Math.abs(avgValue - currentValue) > 0.01 && avgRadius > 5) {
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
      
      // Add green dotted line for won projects average
      // Only show if won average is different from current value (to avoid confusion)
      if (wonAvgValue > 0 && Math.abs(wonAvgValue - currentValue) > 0.01) {
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
      
      // Add red dotted line for lost projects average
      // Only show if lost average is different from current value (to avoid confusion)
      if (lostAvgValue > 0 && Math.abs(lostAvgValue - currentValue) > 0.01) {
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
      
      if (radius > 20) {
        labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "-0.3em")
          .attr("fill", "#fff")
          .attr("font-weight", "bold")
          .attr("font-size", `${fontSize}px`)
          .attr("opacity", 0)
          .text(d.label)
          .transition()
          .duration(800)
          .delay(500)
          .attr("opacity", 1);

        labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "1em")
          .attr("fill", "#fff")
          .attr("font-size", `${valueFontSize}px`)
          .attr("opacity", 0)
          .text(`${d.mhPerTon.toFixed(1)} ${selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}`)
          .transition()
          .duration(800)
          .delay(600)
          .attr("opacity", 1);
      }
    });

    // Update positions on simulation tick with boundary constraints
    simulation.on("tick", () => {
      bubbles.attr("transform", (d: any) => {
        // Keep bubbles within viewBox bounds (using viewBox coordinates)
        const boundedX = Math.max(d.radius, Math.min(viewBoxWidth - d.radius, d.x));
        const boundedY = Math.max(d.radius, Math.min(viewBoxHeight - d.radius, d.y));
        return `translate(${boundedX},${boundedY})`;
      });
    });

    // Add drag interaction for more interactivity
    const drag = d3.drag<SVGGElement, any>()
      .on("start", function(event, d: any) {
        // Disable zoom when dragging bubbles
        event.sourceEvent.stopPropagation();
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function(event, d: any) {
        // Get the current zoom transform
        const transform = d3.zoomTransform(svg.node() as SVGSVGElement);
        // Adjust drag coordinates for zoom
        d.fx = (event.x - transform.x) / transform.k;
        d.fy = (event.y - transform.y) / transform.k;
      })
      .on("end", function(event, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    bubbles.call(drag as any);
    
    // Add double-click to reset zoom
    svg.on("dblclick.zoom", () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform as any, d3.zoomIdentity);
    });

    // Cleanup on unmount
    return () => {
      simulation.stop();
    };

  }, [bubbleData, selectedMetric, averageData, wonLostAverageData]);

  // Render overlay chart (larger version)
  useEffect(() => {
    if (!overlaySvgRef.current || !isOverlayOpen || bubbleData.length === 0) return;

    const svg = d3.select(overlaySvgRef.current);
    svg.selectAll("*").remove();

    const nonZeroData = bubbleData.filter(d => d.mhPerTon > 0);
    if (nonZeroData.length === 0) return;

    const viewBoxWidth = 1200;
    const viewBoxHeight = 800;
    const centerX = viewBoxWidth / 2;
    const centerY = viewBoxHeight / 2;

    const maxValue = Math.max(...nonZeroData.map(d => d.mhPerTon));
    const minRadius = 25;
    const maxRadius = 120;
    const radiusScale = d3.scaleSqrt()
      .domain([0, maxValue])
      .range([minRadius, maxRadius]);

    const nodes = nonZeroData.map((d, i) => {
      const radius = radiusScale(d.mhPerTon);
      const angle = (i / nonZeroData.length) * 2 * Math.PI;
      const startRadius = 150;
      return {
        ...d,
        radius,
        x: centerX + Math.cos(angle) * startRadius,
        y: centerY + Math.sin(angle) * startRadius,
        vx: 0,
        vy: 0,
      };
    });

    const simulation = d3.forceSimulation(nodes as any)
      .force("center", d3.forceCenter(centerX, centerY).strength(0.05))
      .force("collision", d3.forceCollide().radius((d: any) => d.radius + 5).strength(0.9))
      .force("charge", d3.forceManyBody().strength(-30))
      .force("x", d3.forceX(centerX).strength(0.03))
      .force("y", d3.forceY(centerY).strength(0.02))
      .alphaDecay(0.01)
      .velocityDecay(0.3);

    const g = svg.append("g").attr("class", "zoom-container");
    
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });
    
    svg.call(zoom);

    const bubbles = g.selectAll("g.bubble")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "bubble")
      .style("cursor", "pointer");

    const circles = bubbles.append("circle")
      .attr("r", 0)
      .attr("fill", (d: any) => d.color)
      .attr("opacity", 0.8)
      .attr("stroke", "#fff")
      .attr("stroke-width", 3)
      .style("cursor", "pointer")
      .on("click", function(event, d: any) {
        event.stopPropagation();
        setSelectedCategory(d.category);
      });

    circles.transition()
      .duration(800)
      .ease(d3.easeElasticOut.period(0.5))
      .attr("r", (d: any) => d.radius);

    // Add average halos
    bubbles.each(function(d: any) {
      const bubbleGroup = d3.select(this);
      const category = d.category;
      const avgValue = averageData.get(category) || 0;
      const currentValue = d.mhPerTon;
      
      if (avgValue > 0 && Math.abs(avgValue - currentValue) > 0.01) {
        const avgRadius = radiusScale(avgValue);
        if (avgRadius > 5) {
          bubbleGroup.append("circle")
            .attr("r", 0)
            .attr("fill", "none")
            .attr("stroke", "#ef4444")
            .attr("stroke-width", 3)
            .attr("stroke-dasharray", "8,8")
            .attr("opacity", 0.7)
            .style("pointer-events", "none")
            .transition()
            .duration(1000)
            .delay(400)
            .attr("r", avgRadius);
        }
      }
    });

    // Add labels
    const labels = bubbles.append("g")
      .attr("class", "label-group")
      .style("pointer-events", "none");

    labels.each(function(d: any) {
      const labelGroup = d3.select(this);
      const radius = d.radius;
      const fontSize = Math.min(radius / 2.5, 18);
      const valueFontSize = Math.min(radius / 3.5, 14);
      
      if (radius > 25) {
        labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "-0.3em")
          .attr("fill", "#fff")
          .attr("font-weight", "bold")
          .attr("font-size", `${fontSize}px`)
          .attr("opacity", 0)
          .text(d.label)
          .transition()
          .duration(800)
          .delay(500)
          .attr("opacity", 1);

        labelGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dy", "1.2em")
          .attr("fill", "#fff")
          .attr("font-size", `${valueFontSize}px`)
          .attr("opacity", 0)
          .text(`${d.mhPerTon.toFixed(1)} ${selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}`)
          .transition()
          .duration(800)
          .delay(600)
          .attr("opacity", 1);
      }
    });

    simulation.on("tick", () => {
      bubbles.attr("transform", (d: any) => {
        const boundedX = Math.max(d.radius, Math.min(viewBoxWidth - d.radius, d.x));
        const boundedY = Math.max(d.radius, Math.min(viewBoxHeight - d.radius, d.y));
        return `translate(${boundedX},${boundedY})`;
      });
    });

    const drag = d3.drag<SVGGElement, any>()
      .on("start", function(event, d: any) {
        event.sourceEvent.stopPropagation();
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", function(event, d: any) {
        const transform = d3.zoomTransform(svg.node() as SVGSVGElement);
        d.fx = (event.x - transform.x) / transform.k;
        d.fy = (event.y - transform.y) / transform.k;
      })
      .on("end", function(event, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    bubbles.call(drag as any);
    
    svg.on("dblclick.zoom", () => {
      svg.transition()
        .duration(750)
        .call(zoom.transform as any, d3.zoomIdentity);
    });

    return () => {
      simulation.stop();
    };

  }, [bubbleData, selectedMetric, averageData, isOverlayOpen]);

  const totalMHPT = bubbleData.reduce((sum, d) => sum + d.mhPerTon, 0);
  const maxValue = bubbleData.length > 0 ? Math.max(...bubbleData.map(d => d.mhPerTon)) : 0;
  const nonZeroData = bubbleData.filter(d => d.mhPerTon > 0);

  // Calculate comparison data for selected category
  const categoryComparison = useMemo(() => {
    if (!selectedCategory) return null;

    const currentValue = bubbleData.find(d => d.category === selectedCategory)?.mhPerTon || 0;
    const allAvg = averageData.get(selectedCategory) || 0;
    const wonAvg = wonLostAverageData.won.get(selectedCategory) || 0;
    const lostAvg = wonLostAverageData.lost.get(selectedCategory) || 0;

    // Count projects for each category
    const allProjectsCount = allProjectLines.filter(p => !currentProjectId || p.projectId !== currentProjectId).length;
    const projectStatusMap = new Map<string, string>();
    allProjects.forEach((p: any) => {
      if (p.id && p.status) {
        projectStatusMap.set(p.id, p.status);
      }
    });
    const wonProjects = allProjectLines.filter(p => {
      if (currentProjectId && p.projectId === currentProjectId) return false;
      return projectStatusMap.get(p.projectId) === "won";
    });
    const lostProjects = allProjectLines.filter(p => {
      if (currentProjectId && p.projectId === currentProjectId) return false;
      return projectStatusMap.get(p.projectId) === "lost";
    });

    // Calculate lost percentage (percentage of all projects that are lost)
    const totalProjectsWithStatus = allProjects.filter(p => {
      if (currentProjectId && p.id === currentProjectId) return false;
      const status = projectStatusMap.get(p.id);
      return status === "won" || status === "lost";
    }).length;
    const lostPercentage = totalProjectsWithStatus > 0 
      ? (lostProjects.length / totalProjectsWithStatus) * 100 
      : 0;

    return {
      category: selectedCategory,
      label: LABOR_CATEGORIES.find(c => c.key === selectedCategory)?.label || selectedCategory,
      current: currentValue,
      allAverage: allAvg,
      wonAverage: wonAvg,
      lostAverage: lostAvg,
      allCount: allProjectsCount,
      wonCount: wonProjects.length,
      lostCount: lostProjects.length,
      lostPercentage: lostPercentage,
    };
  }, [selectedCategory, bubbleData, averageData, wonLostAverageData, allProjectLines, allProjects, currentProjectId]);

  return (
    <>
    <Card 
      className="p-4 cursor-pointer hover:shadow-lg transition-all duration-200 group"
      onClick={() => setIsOverlayOpen(true)}
    >
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CardTitle className="text-xl font-extrabold text-gray-900 tracking-normal flex items-center gap-2 min-w-0 flex-wrap">
                <BarChart3 className="w-5 h-5 flex-shrink-0 text-slate-900" />
                <span className="break-words">
                  {selectedMetric === "laborHoursPerTon" ? LABOR_FINGERPRINT_NAME : "Cost Distribution"}
                </span>
                {projectName && (
                  <span className="text-sm font-medium text-slate-600 ml-2 hidden sm:inline">
                    - {projectName}
                  </span>
                )}
                <ContextualHelp content={selectedMetric === "laborHoursPerTon" 
                  ? "Bubble size represents man hours per ton (MH/T) for each category. Larger bubbles indicate higher intensity. Dotted circles show historical averages from won and lost projects. Click any bubble to see detailed comparisons."
                  : "Bubble size represents cost per ton ($/T) for each category. Larger bubbles indicate higher cost intensity. Dotted circles show historical averages. Click any bubble to see detailed comparisons."} 
                />
              </CardTitle>
              <Maximize2 className="w-5 h-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0 ml-2" />
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <Button
                variant={selectedMetric === "laborHoursPerTon" ? "primary" : "outline"}
                size="sm"
                className="text-xs px-2 py-1"
                onClick={() => handleMetricChange("laborHoursPerTon")}
              >
                MH/T
              </Button>
              <Button
                variant={selectedMetric === "costPerTon" ? "primary" : "outline"}
                size="sm"
                className="text-xs px-2 py-1"
                onClick={() => handleMetricChange("costPerTon")}
              >
                $/T
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Subtitle for both metrics */}
          <p className="text-xs text-gray-500 mb-3">
            {selectedMetric === "laborHoursPerTon" 
              ? LABOR_FINGERPRINT_SUBTITLE
              : "Cost per ton distribution across all cost categories. Compare against historical averages to identify cost drivers."
            }
          </p>
          
          {bubbleData.length === 0 || nonZeroData.length === 0 ? (
            <div className="flex items-center justify-center h-96 text-gray-500">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No data yet</p>
                <p className="text-sm mt-2">Add line items to see the estimate distribution</p>
              </div>
            </div>
          ) : (
            <>
              <div ref={containerRef} className="w-full flex justify-center mb-3 relative" style={{ minHeight: "400px" }}>
                <div className="relative w-full">
                  <svg 
                    ref={svgRef} 
                    width="100%" 
                    height="100%"
                    viewBox="0 0 800 600"
                    preserveAspectRatio="xMidYMid meet"
                    className="border border-gray-200 rounded-lg cursor-move"
                    style={{ maxWidth: "100%", height: "auto", aspectRatio: "4/3", maxHeight: "400px" }}
                  />
                  {/* Tooltip */}
                  <div
                    ref={tooltipRef}
                    className="fixed bg-white rounded-lg shadow-lg p-2 border border-gray-200 pointer-events-none z-50"
                    style={{ display: "none" }}
                  />
                  <div className="absolute top-2 right-2 flex flex-col items-end gap-1.5">
                    <div className="text-xs text-gray-400 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-gray-200/50">
                      Scroll to zoom • Drag to pan
                    </div>
                    {bubbleData.length > 0 && (
                      <div className="text-[10px] text-gray-500 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-gray-200/50">
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
              </div>
              <div className="mt-2">
                <h4 className="text-xs font-bold text-gray-900 tracking-normal mb-2">
                  {selectedMetric === "laborHoursPerTon" ? "LABOR CATEGORIES" : "COST CATEGORIES"}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {bubbleData.map((item) => (
                    <div key={item.category} className="flex items-center gap-2 p-2 rounded bg-gray-50">
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {item.label}
                        </div>
                        <div className="text-xs text-gray-600">
                          {item.mhPerTon.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                          {item.percentage > 0 && (
                            <span className="ml-1">({item.percentage.toFixed(1)}%)</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  {/* Won/Lost Average Lines Legend */}
                  {(wonLostAverageData.won.size > 0 || wonLostAverageData.lost.size > 0) && (
                    <div className="mb-4 p-3 bg-gradient-to-r from-slate-50 to-blue-50 rounded-lg border border-slate-200">
                      <div className="flex items-start gap-3 mb-2">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-6 h-0.5 border-t-2 border-dashed border-green-500"></div>
                          <span className="text-xs font-semibold text-gray-900">Won Projects Average</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-6 h-0.5 border-t-2 border-dashed border-red-500"></div>
                          <span className="text-xs font-semibold text-gray-900">Lost Projects Average</span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed">
                        <strong className="text-gray-900">Decision Intelligence:</strong> The dotted reference lines overlay cumulative averages from all won (green) and lost (red) projects in your portfolio. Compare your current estimate's bubble sizes to these benchmarks to identify labor intensity deviations. Bubbles larger than the won average indicate potential over-bidding risk; bubbles smaller than the lost average suggest competitive positioning. Use this visual gap analysis to optimize category-level estimates before submission.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm flex-wrap gap-4 mb-3">
                    <div>
                      <span className="text-gray-600">Total Categories: </span>
                      <span className="font-medium text-gray-900">{nonZeroData.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Max Value: </span>
                      <span className="font-medium text-gray-900">
                        {maxValue.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">
                        Total {selectedMetric === "laborHoursPerTon" ? "Man Hours per Ton" : "Cost per Ton"}: 
                      </span>
                      <span className="font-medium text-gray-900 ml-1">
                        {totalMHPT.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                      </span>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    {averageData.size > 0 && (
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <div className="flex items-center gap-1">
                          <div className="w-3 h-3 border-2 border-red-500 border-dashed rounded-full"></div>
                          <span>Red dashed rings show average across {allProjectLines.filter(p => !currentProjectId || p.projectId !== currentProjectId).length} submitted project{allProjectLines.filter(p => !currentProjectId || p.projectId !== currentProjectId).length !== 1 ? 's' : ''}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Modal Popup (appears on click) - only show when overlay is NOT open */}
          {selectedCategory && categoryComparison && !isOverlayOpen && (
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
                      <p className="text-sm text-slate-600 mt-1">
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
                    {/* Current Project */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-bold text-gray-900 tracking-normal">Current</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2 truncate">{projectName || "Current Estimate"}</p>
                      <p className="text-2xl font-bold text-blue-900 tabular-nums">
                        {categoryComparison.current.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                      </p>
                    </div>

                    {/* Won Average */}
                    {categoryComparison.wonCount > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                          <span className="text-sm font-bold text-gray-900 tracking-normal">Won Average</span>
                          <span className="text-xs text-slate-600">({categoryComparison.wonCount})</span>
                        </div>
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
                      </div>
                    )}

                    {/* Lost Average */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <span className="text-sm font-bold text-gray-900 tracking-normal">Lost Average</span>
                        {categoryComparison.lostCount > 0 ? (
                          <span className="text-xs text-slate-600">({categoryComparison.lostCount})</span>
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
                          <span className="text-sm font-bold text-gray-900 tracking-normal">All Average</span>
                          <span className="text-xs text-slate-600">({categoryComparison.allCount})</span>
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

      {/* Full-screen Overlay */}
      <ChartOverlay
        isOpen={isOverlayOpen}
        onClose={() => setIsOverlayOpen(false)}
        title={selectedMetric === "laborHoursPerTon" ? `${LABOR_FINGERPRINT_NAME} - Detailed View` : "Cost Distribution - Detailed View"}
      >
        <div className="space-y-6">
          {/* Enhanced Chart */}
          <div className="flex justify-center bg-slate-50 rounded-xl p-6">
            <svg
              ref={overlaySvgRef}
              viewBox="0 0 1200 800"
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-auto"
            />
          </div>

          {/* Enhanced Legend and Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <div className="text-sm text-blue-700 font-medium mb-1">Total {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}</div>
              <div className="text-2xl font-bold text-blue-900">{totalMHPT.toFixed(2)}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
              <div className="text-sm text-slate-700 font-medium mb-1">Categories</div>
              <div className="text-2xl font-bold text-slate-900">{nonZeroData.length}</div>
            </div>
          </div>

          {/* Category Details Modal - appears when bubble is clicked in overlay */}
          {selectedCategory && categoryComparison && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4" 
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedCategory(null);
                }
              }}
            >
              <div 
                className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto relative z-[70]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-slate-900">{categoryComparison.label}</h3>
                      <p className="text-sm text-slate-600 mt-1">
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
                    {/* Current Project */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                        <span className="text-sm font-semibold text-slate-900">Current</span>
                      </div>
                      <p className="text-xs text-slate-600 mb-2 truncate">{projectName || "Current Estimate"}</p>
                      <p className="text-2xl font-bold text-blue-900 tabular-nums">
                        {categoryComparison.current.toFixed(2)} {selectedMetric === "laborHoursPerTon" ? "MH/T" : "$/T"}
                      </p>
                    </div>

                    {/* Won Average */}
                    {categoryComparison.wonCount > 0 && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-emerald-600"></div>
                          <span className="text-sm font-bold text-gray-900 tracking-normal">Won Average</span>
                          <span className="text-xs text-slate-600">({categoryComparison.wonCount})</span>
                        </div>
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
                      </div>
                    )}

                    {/* Lost Average */}
                    <div className="bg-red-50 border border-red-200 rounded-lg p-5">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full bg-red-600"></div>
                        <span className="text-sm font-bold text-gray-900 tracking-normal">Lost Average</span>
                        {categoryComparison.lostCount > 0 ? (
                          <span className="text-xs text-slate-600">({categoryComparison.lostCount})</span>
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
                          <span className="text-sm font-bold text-gray-900 tracking-normal">All Average</span>
                          <span className="text-xs text-slate-600">({categoryComparison.allCount})</span>
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
        </div>
      </ChartOverlay>
    </>
  );
}

