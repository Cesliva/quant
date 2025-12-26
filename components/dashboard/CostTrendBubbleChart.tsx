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
import { BarChart3 } from "lucide-react";
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
  const svgRef = useRef<SVGSVGElement>(null);
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
      const buyouts = 0; // TODO: Get from project settings
      
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
  
  // Render D3 circle packing
  useEffect(() => {
    if (!svgRef.current || bubbleData.length === 0) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove(); // Clear previous render
    
    const width = 600;
    const height = 600;
    const padding = 20;
    
    // Create hierarchy for D3 pack layout
    // D3 pack expects a root node with children
    const rootData = {
      name: "root",
      children: bubbleData.map(d => ({
        name: d.category,
        value: d.mhPerTon,
        label: d.label,
        color: d.color,
        percentage: d.percentage,
      }))
    };
    
    const root = d3.hierarchy(rootData)
      .sum((d: any) => d.value || 0)
      .sort((a: any, b: any) => (b.value || 0) - (a.value || 0));
    
    // Create pack layout
    const pack = d3.pack()
      .size([width - padding * 2, height - padding * 2])
      .padding(3);
    
    const packed = pack(root);
    
    // Store bubble positions for overlay
    const bubblePositions = new Map<string, { x: number; y: number; r: number; avgValue: number }>();
    packed.descendants().filter((d: any) => !d.children).forEach((d: any) => {
      bubblePositions.set(d.data.name, {
        x: d.x,
        y: d.y,
        r: d.r,
        avgValue: d.data.value
      });
    });
    
    // Create container group
    const g = svg.append("g")
      .attr("transform", `translate(${padding},${padding})`);
    
    // Draw circles
    const nodes = g.selectAll("g.node")
      .data(packed.descendants().filter((d: any) => !d.children))
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x},${d.y})`)
      .style("cursor", "pointer");
    
    // Add circles with transition
    const circles = nodes.append("circle")
      .attr("r", 0)
      .attr("fill", (d: any) => d.data.color || "#94a3b8")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("opacity", 0.85)
      .style("filter", "drop-shadow(0 2px 4px rgba(0,0,0,0.1))");
    
    circles.transition()
      .duration(800)
      .ease(d3.easeCubicOut)
      .attr("r", (d: any) => d.r);
    
    // Add text labels
    const labels = nodes.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .attr("font-weight", "600")
      .style("font-size", (d: any) => {
        // Scale font size based on circle radius
        const fontSize = Math.max(10, Math.min(16, d.r * 0.25));
        return `${fontSize}px`;
      })
      .style("pointer-events", "none")
      .text((d: any) => d.data.label);
    
    // Add value text below label
    const values = nodes.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "white")
      .attr("font-weight", "500")
      .attr("dy", (d: any) => d.r * 0.3)
      .style("font-size", (d: any) => {
        const fontSize = Math.max(8, Math.min(12, d.r * 0.2));
        return `${fontSize}px`;
      })
      .style("pointer-events", "none")
              .text((d: any) => {
        if (selectedMetric === "laborHoursPerTon") {
          return `${d.data.value.toFixed(1)} MH/T`;
        } else {
          // Format cost per ton
          const value = d.data.value;
          if (value >= 1000) {
            return `$${(value / 1000).toFixed(1)}K`;
          }
          return `$${value.toFixed(0)}`;
        }
      });
    
    // Add hover effects and tooltips
    nodes
      .on("mouseenter", function(event, d: any) {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("opacity", 1)
          .attr("stroke-width", 3);
        
        // Show tooltip
        if (tooltipRef.current) {
          const tooltip = tooltipRef.current;
          const data = d.data;
          tooltip.style.display = "block";
          const value = data.value;
          const valueDisplay = selectedMetric === "laborHoursPerTon" 
            ? `${value.toFixed(2)} MH/T`
            : value >= 1000 
              ? `$${(value / 1000).toFixed(2)}K/T`
              : `$${value.toFixed(2)}/T`;
          
          tooltip.innerHTML = `
            <div class="font-semibold text-sm mb-1">${data.label}</div>
            <div class="text-xs text-gray-200">
              ${valueDisplay}
            </div>
            <div class="text-xs text-gray-300 mt-1">
              ${data.percentage.toFixed(1)}% of total
            </div>
          `;
          
          // Position tooltip relative to mouse
          const rect = svg.node()?.getBoundingClientRect();
          if (rect) {
            const [x, y] = d3.pointer(event, svg.node() as any);
            tooltip.style.left = `${rect.left + x + 20}px`;
            tooltip.style.top = `${rect.top + y - 10}px`;
          }
        }
      })
      .on("mousemove", function(event) {
        if (tooltipRef.current) {
          const rect = svg.node()?.getBoundingClientRect();
          if (rect) {
            const [x, y] = d3.pointer(event, svg.node() as any);
            tooltipRef.current.style.left = `${rect.left + x + 20}px`;
            tooltipRef.current.style.top = `${rect.top + y - 10}px`;
          }
        }
      })
      .on("mouseleave", function() {
        d3.select(this).select("circle")
          .transition()
          .duration(200)
          .attr("opacity", 0.85)
          .attr("stroke-width", 2);
        
        if (tooltipRef.current) {
          tooltipRef.current.style.display = "none";
        }
      });
    
    // Draw overlay bubbles for selected project
    if (selectedProjectData && bubblePositions.size > 0) {
      const overlayGroup = g.append("g").attr("class", "overlay-bubbles");
      
      // Find max value for scaling
      const maxAvgValue = Math.max(...Array.from(bubblePositions.values()).map(b => b.avgValue), 1);
      const maxProjectValue = Math.max(...selectedProjectData.map(d => d.mhPerTon), 1);
      const maxValue = Math.max(maxAvgValue, maxProjectValue);
      
      selectedProjectData.forEach((projectItem) => {
        const position = bubblePositions.get(projectItem.category);
        if (!position) return;
        
        // Calculate radius based on project value, scaled to match average bubble size
        const projectValue = projectItem.mhPerTon;
        const avgValue = position.avgValue;
        const radiusRatio = projectValue / maxValue;
        const avgRadiusRatio = avgValue / maxValue;
        const baseRadius = position.r;
        const projectRadius = baseRadius * (radiusRatio / Math.max(avgRadiusRatio, 0.1));
        
        // Clamp radius to reasonable bounds
        const minRadius = baseRadius * 0.3;
        const maxRadius = baseRadius * 2;
        const clampedRadius = Math.max(minRadius, Math.min(maxRadius, projectRadius));
        
        // Calculate percentage deviation
        const percentDiff = avgValue > 0 ? ((projectValue - avgValue) / avgValue) * 100 : 0;
        const isAbove = projectValue > avgValue;
        
        // Determine stroke color based on deviation (red for concerning, amber for moderate)
        let strokeColor = "#ef4444"; // Bright red
        if (Math.abs(percentDiff) < 15) {
          strokeColor = "#f59e0b"; // Amber for moderate deviation
        }
        if (Math.abs(percentDiff) < 5) {
          strokeColor = "#10b981"; // Green for close to average
        }
        
        // Draw red overlay circle
        const overlayCircle = overlayGroup.append("circle")
          .attr("cx", position.x)
          .attr("cy", position.y)
          .attr("r", 0)
          .attr("fill", "none")
          .attr("stroke", strokeColor)
          .attr("stroke-width", 3)
          .attr("opacity", 0.9)
          .style("filter", `drop-shadow(0 0 4px ${strokeColor}80)`)
          .attr("data-category", projectItem.category)
          .attr("data-project-value", projectValue)
          .attr("data-avg-value", avgValue)
          .attr("data-percent-diff", percentDiff);
        
        overlayCircle.transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .attr("r", clampedRadius);
        
        // Add percentage deviation label if significant
        if (Math.abs(percentDiff) > 5) {
          const labelY = position.y + (isAbove ? -baseRadius - 20 : baseRadius + 20);
          const labelText = `${isAbove ? '+' : ''}${percentDiff.toFixed(0)}%`;
          
          // Add background circle for label readability
          overlayGroup.append("circle")
            .attr("cx", position.x)
            .attr("cy", labelY)
            .attr("r", 12)
            .attr("fill", "white")
            .attr("opacity", 0)
            .style("pointer-events", "none")
            .transition()
            .duration(600)
            .delay(300)
            .attr("opacity", 0.9)
            .lower(); // Place behind text
          
          // Add text label
          overlayGroup.append("text")
            .attr("x", position.x)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", strokeColor)
            .attr("font-weight", "700")
            .attr("font-size", "11px")
            .style("pointer-events", "none")
            .attr("opacity", 0)
            .text(labelText)
            .transition()
            .duration(600)
            .delay(300)
            .attr("opacity", 1);
        }
        
        // Add hover tooltip for overlay bubbles
        overlayCircle
          .on("mouseenter", function(event) {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("stroke-width", 4)
              .attr("opacity", 1);
            
            if (tooltipRef.current) {
              const tooltip = tooltipRef.current;
              const valueDisplay = selectedMetric === "laborHoursPerTon" 
                ? `${projectValue.toFixed(2)} MH/T`
                : projectValue >= 1000 
                  ? `$${(projectValue / 1000).toFixed(2)}K/T`
                  : `$${projectValue.toFixed(2)}/T`;
              
              const avgDisplay = selectedMetric === "laborHoursPerTon" 
                ? `${avgValue.toFixed(2)} MH/T`
                : avgValue >= 1000 
                  ? `$${(avgValue / 1000).toFixed(2)}K/T`
                  : `$${avgValue.toFixed(2)}/T`;
              
              tooltip.style.display = "block";
              tooltip.innerHTML = `
                <div class="font-semibold text-sm mb-1">${projectItem.label}</div>
                <div class="text-xs text-gray-200 mb-1">
                  <div>Project: ${valueDisplay}</div>
                  <div>Average: ${avgDisplay}</div>
                </div>
                <div class="text-xs ${percentDiff > 0 ? 'text-red-300' : 'text-green-300'} mt-1 font-semibold">
                  ${isAbove ? '+' : ''}${percentDiff.toFixed(1)}% ${isAbove ? 'above' : 'below'} average
                </div>
              `;
              
              const rect = svg.node()?.getBoundingClientRect();
              if (rect) {
                const [x, y] = d3.pointer(event, svg.node() as any);
                tooltip.style.left = `${rect.left + x + 20}px`;
                tooltip.style.top = `${rect.top + y - 10}px`;
              }
            }
          })
          .on("mousemove", function(event) {
            if (tooltipRef.current) {
              const rect = svg.node()?.getBoundingClientRect();
              if (rect) {
                const [x, y] = d3.pointer(event, svg.node() as any);
                tooltipRef.current.style.left = `${rect.left + x + 20}px`;
                tooltipRef.current.style.top = `${rect.top + y - 10}px`;
              }
            }
          })
          .on("mouseleave", function() {
            d3.select(this)
              .transition()
              .duration(200)
              .attr("stroke-width", 3)
              .attr("opacity", 0.9);
            
            if (tooltipRef.current) {
              tooltipRef.current.style.display = "none";
            }
          });
      });
    }
    
    // Cleanup function
    return () => {
      svg.selectAll("*").remove();
    };
  }, [bubbleData, selectedMetric, selectedProjectData, selectedProjectId]);
  
  const getMetricLabel = (metric: "laborHoursPerTon" | "costPerTon"): string => {
    return metric === "laborHoursPerTon" ? "Man Hours per Ton" : "Cost per Ton";
  };
  
  if (lines.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
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
    <Card className="p-4 md:p-6 rounded-2xl border border-slate-200/60 bg-white shadow-sm hover:shadow-md transition-shadow">
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-xl font-semibold text-gray-900">
              Cost Trend Analysis
            </CardTitle>
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
          {selectedProjectId && (
            <div className="flex items-center gap-3 text-xs text-gray-600 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-red-500 rounded-full bg-transparent"></div>
                <span>Red = &gt;15% deviation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-amber-500 rounded-full bg-transparent"></div>
                <span>Amber = 5-15% deviation</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 border-2 border-green-500 rounded-full bg-transparent"></div>
                <span>Green = &lt;5% deviation</span>
              </div>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6 relative">
        {/* Tooltip */}
        <div
          ref={tooltipRef}
          className="fixed bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm z-50 pointer-events-none hidden"
          style={{ fontSize: "12px" }}
        />
        
        {/* Bubble Chart Visualization */}
        <div className="w-full flex justify-center" style={{ minHeight: "600px" }}>
          <svg
            ref={svgRef}
            width={600}
            height={600}
            className="max-w-full h-auto"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
          />
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
      </CardContent>
    </Card>
  );
}
