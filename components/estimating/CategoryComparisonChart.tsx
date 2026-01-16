"use client";

import { useMemo, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { EstimatingLine } from "./EstimatingGrid";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { loadCompanySettings, type CompanySettings } from "@/lib/utils/settingsLoader";
import Button from "@/components/ui/Button";
import { subscribeToCollection, getProjectPath, createDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface CategoryComparisonChartProps {
  lines: EstimatingLine[];
  companyId: string;
  currentProjectId?: string;
  selectedMetric: "laborHoursPerTon" | "costPerTon";
}

interface ProjectData {
  projectId: string;
  projectName: string;
  lines: EstimatingLine[];
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
};

const COST_COLORS: Record<string, string> = {
  "Material": "#3b82f6",
  "Labor": "#10b981",
  "Coating": "#f59e0b",
  "Hardware": "#8b5cf6",
  "Overhead": "#f97316",
  "Profit": "#84cc16",
};

interface ComparisonData {
  category: string;
  label: string;
  current: number;
  average: number;
  deviation: number; // percentage deviation
  color: string;
}


const formatMoney = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export default function CategoryComparisonChart({
  lines,
  companyId,
  currentProjectId,
  selectedMetric,
}: CategoryComparisonChartProps) {
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [allProjects, setAllProjects] = useState<Array<{ id: string; projectName?: string; status?: string; archived?: boolean }>>([]);
  const [allProjectLines, setAllProjectLines] = useState<ProjectData[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (companyId) {
      loadCompanySettings(companyId).then(setCompanySettings);
    }
  }, [companyId]);

  // Load all projects
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      setAllProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<any>(
      projectsPath,
      (projectData) => {
        const submittedProjects = projectData.filter(
          (p: any) =>
            !p.archived &&
            (p.status === "won" ||
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

  // Calculate current project data
  const currentData = useMemo(() => {
    const activeLines = lines.filter((line) => line.status !== "Void");
    if (activeLines.length === 0) return new Map<string, number>();

    const totalWeight = activeLines.reduce((sum, line) => {
      const weight = line.materialType === "Material"
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);

    const data = new Map<string, number>();

    if (selectedMetric === "laborHoursPerTon") {
      LABOR_CATEGORIES.forEach((laborCat) => {
        const totalLaborHours = activeLines.reduce((sum, line) => {
          const value = (line as any)[laborCat.field] || 0;
          return sum + (typeof value === "number" ? value : 0);
        }, 0);
        const mhPerTon = totalWeight > 0 ? (totalLaborHours / (totalWeight / 2000)) : 0;
        data.set(laborCat.key, mhPerTon);
      });
      
      // Add Allowance category (from allowance lines)
      const allowanceHours = activeLines
        .filter(line => line.category === "Allowances")
        .reduce((sum, line) => sum + (line.totalLabor || 0), 0);
      const allowanceMHPT = totalWeight > 0 ? (allowanceHours / (totalWeight / 2000)) : 0;
      if (allowanceMHPT > 0) {
        data.set("Allowance", allowanceMHPT);
      }
    } else {
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

      const costCategories = [
        { key: "Material", value: materialWithWaste },
        { key: "Labor", value: laborWithWaste },
        { key: "Coating", value: coatingCost },
        { key: "Hardware", value: hardwareCost },
        { key: "Overhead", value: overheadAmount },
        { key: "Profit", value: profitAmount },
      ];

      costCategories.forEach((cat) => {
        const costPT = totalWeight > 0 ? (cat.value / (totalWeight / 2000)) : 0;
        data.set(cat.key, costPT);
      });
    }

    return data;
  }, [lines, selectedMetric, companySettings]);

  const currentTotalTons = useMemo(() => {
    const activeLines = lines.filter((line) => line.status !== "Void");
    const totalWeight = activeLines.reduce((sum, line) => {
      const weight =
        line.materialType === "Material"
          ? (line.totalWeight || 0)
          : (line.plateTotalWeight || 0);
      return sum + weight;
    }, 0);
    return totalWeight > 0 ? totalWeight / 2000 : 0;
  }, [lines]);

  // Calculate average data
  const averageData = useMemo(() => {
    const projectsForAverage = allProjectLines.filter(
      (p) => !currentProjectId || p.projectId !== currentProjectId
    );

    if (projectsForAverage.length === 0) {
      return new Map<string, number>();
    }

    const allActiveLines = projectsForAverage.flatMap((p) =>
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
        .filter(line => line.category === "Allowances")
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
  }, [allProjectLines, selectedMetric, companySettings, currentProjectId]);

  // Calculate won/lost project averages
  const wonLostAverageData = useMemo(() => {
    // Get project statuses
    const projectStatusMap = new Map<string, string>();
    allProjects.forEach((p) => {
      if (p.id && p.status) {
        projectStatusMap.set(p.id, p.status);
      }
    });

    // Separate won and lost projects (excluding current project)
    const wonProjects = allProjectLines.filter(
      (p) => (!currentProjectId || p.projectId !== currentProjectId) && 
             projectStatusMap.get(p.projectId) === "won"
    );
    const lostProjects = allProjectLines.filter(
      (p) => (!currentProjectId || p.projectId !== currentProjectId) && 
             projectStatusMap.get(p.projectId) === "lost"
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
          .filter(line => line.category === "Allowances")
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

    return {
      won: calculateAverages(wonProjects),
      lost: calculateAverages(lostProjects),
    };
  }, [allProjectLines, allProjects, selectedMetric, companySettings, currentProjectId]);

  const wonLostCounts = useMemo(() => {
    const statusMap = new Map<string, string>();
    allProjects.forEach((p) => {
      if (p.id && p.status) statusMap.set(p.id, p.status);
    });
    const wonCount = allProjectLines.filter(
      (p) => (!currentProjectId || p.projectId !== currentProjectId) && statusMap.get(p.projectId) === "won"
    ).length;
    const lostCount = allProjectLines.filter(
      (p) => (!currentProjectId || p.projectId !== currentProjectId) && statusMap.get(p.projectId) === "lost"
    ).length;
    return { wonCount, lostCount };
  }, [allProjectLines, allProjects, currentProjectId]);

  // Create comparison data
  const comparisonData = useMemo(() => {
    let categories = selectedMetric === "laborHoursPerTon" ? LABOR_CATEGORIES : [
      { key: "Material", label: "Material" },
      { key: "Labor", label: "Labor" },
      { key: "Coating", label: "Coating" },
      { key: "Hardware", label: "Hardware" },
      { key: "Overhead", label: "Overhead" },
      { key: "Profit", label: "Profit" },
    ];

    // Add Allowance category if it exists in current or average data
    if (selectedMetric === "laborHoursPerTon") {
      const hasAllowance = (currentData.get("Allowance") || 0) > 0 || (averageData.get("Allowance") || 0) > 0;
      if (hasAllowance) {
        categories = [...categories, { key: "Allowance", field: "totalLabor", label: "Allowance" }];
      }
    }

    const colors = selectedMetric === "laborHoursPerTon" ? LABOR_COLORS : COST_COLORS;

    return categories
      .map((cat) => {
        const current = currentData.get(cat.key) || 0;
        const average = averageData.get(cat.key) || 0;
        const deviation = average > 0 ? ((current - average) / average) * 100 : 0;

        return {
          category: cat.key,
          label: cat.label,
          current,
          average,
          deviation,
          color: colors[cat.key] || "#94a3b8",
        };
      })
      .filter((d) => d.current > 0 || d.average > 0)
      .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation)); // Sort by absolute deviation
  }, [currentData, averageData, selectedMetric]);

  // Render chart
  useEffect(() => {
    if (!svgRef.current || comparisonData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 15, right: 25, bottom: 45, left: 70 };
    const width = 600 - margin.left - margin.right;
    const height = 350 - margin.top - margin.bottom;

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Scales - ensure all values including won/lost average fit
    const maxValue = Math.max(
      ...comparisonData.map((d) => {
        const wonAvg = wonLostAverageData.won.get(d.category) || 0;
        const lostAvg = wonLostAverageData.lost.get(d.category) || 0;
        const winLossAvg =
          wonAvg > 0 && lostAvg > 0 ? (wonAvg + lostAvg) / 2 : wonAvg > 0 ? wonAvg : lostAvg;
        return Math.max(d.current, d.average, winLossAvg);
      })
    );
    // Add more padding (1.15x) and ensure minimum domain for better visibility
    const domainMax = Math.max(maxValue * 1.15, maxValue + (maxValue * 0.1));
    const xScale = d3.scaleLinear().domain([0, domainMax]).range([0, width]);
    const yScale = d3
      .scaleBand()
      .domain(comparisonData.map((d) => d.label))
      .range([0, height])
      .padding(0.3);

    // Grid lines
    const xTicks = xScale.ticks(5);
    xTicks.forEach((tick) => {
      g.append("line")
        .attr("x1", xScale(tick))
        .attr("x2", xScale(tick))
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#f1f5f9")
        .attr("stroke-width", 1);
    });

    // Bars for average (gray, behind)
    g.selectAll(".bar-average")
      .data(comparisonData)
      .enter()
      .append("rect")
      .attr("class", "bar-average")
      .attr("x", 0)
      .attr("y", (d) => yScale(d.label)!)
      .attr("width", (d) => xScale(d.average))
      .attr("height", yScale.bandwidth() * 0.25)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.3)
      .attr("rx", 4);

    // Bars for won/lost average (black, solid)
    g.selectAll(".bar-wonlost")
      .data(comparisonData)
      .enter()
      .append("rect")
      .attr("class", "bar-wonlost")
      .attr("x", 0)
      .attr("y", (d) => (yScale(d.label)! || 0) + yScale.bandwidth() * 0.3)
      .attr("width", (d) => {
        const wonAvg = wonLostAverageData.won.get(d.category) || 0;
        const lostAvg = wonLostAverageData.lost.get(d.category) || 0;
        const winLossAvg = (wonAvg > 0 && lostAvg > 0) 
          ? (wonAvg + lostAvg) / 2 
          : wonAvg > 0 ? wonAvg : lostAvg;
        return xScale(winLossAvg);
      })
      .attr("height", yScale.bandwidth() * 0.25)
      .attr("fill", "#000000")
      .attr("opacity", 0.8)
      .attr("rx", 4);

    // Bars for current (colored, on top)
    g.selectAll(".bar-current")
      .data(comparisonData)
      .enter()
      .append("rect")
      .attr("class", "bar-current")
      .attr("x", 0)
      .attr("y", (d) => (yScale(d.label)! || 0) + yScale.bandwidth() * 0.6)
      .attr("width", (d) => xScale(d.current))
      .attr("height", yScale.bandwidth() * 0.25)
      .attr("fill", (d) => d.color)
      .attr("opacity", 0.8)
      .attr("rx", 4)
      .on("mouseover", function (event, d) {
        d3.select(this).attr("opacity", 1);
      })
      .on("mouseout", function () {
        d3.select(this).attr("opacity", 0.8);
      });

    // Value labels on bars
    g.selectAll(".label-current")
      .data(comparisonData)
      .enter()
      .append("text")
      .attr("class", "label-current")
      .attr("x", (d) => xScale(d.current) + 5)
      .attr("y", (d) => (yScale(d.label)! || 0) + yScale.bandwidth() * 0.7)
      .attr("fill", "#374151")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .text((d) => d.current.toFixed(2));

    g.selectAll(".label-average")
      .data(comparisonData)
      .enter()
      .append("text")
      .attr("class", "label-average")
      .attr("x", (d) => xScale(d.average) + 5)
      .attr("y", (d) => (yScale(d.label)! || 0) + yScale.bandwidth() * 0.2)
      .attr("fill", "#6b7280")
      .attr("font-size", "10px")
      .text((d) => `Avg: ${d.average.toFixed(2)}`);

    // Y-axis
    g.append("g")
      .attr("class", "y-axis")
      .call(d3.axisLeft(yScale))
      .selectAll("text")
      .attr("font-size", "12px")
      .attr("fill", "#374151");

    // X-axis
    g.append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0,${height})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((d) => Number(d).toFixed(1))
      )
      .selectAll("text")
      .attr("font-size", "11px")
      .attr("fill", "#6b7280");

    // X-axis label
    g.append("text")
      .attr("x", width / 2)
      .attr("y", height + 45)
      .attr("text-anchor", "middle")
      .attr("font-size", "12px")
      .attr("fill", "#6b7280")
      .text(selectedMetric === "laborHoursPerTon" ? "Man Hours per Ton" : "Cost per Ton");
  }, [comparisonData, selectedMetric, wonLostAverageData]);

  const avgDeviation = comparisonData.length > 0
    ? comparisonData.reduce((sum, d) => sum + Math.abs(d.deviation), 0) / comparisonData.length
    : 0;

  return (
    <Card className="p-4">
      <CardHeader className="mb-2">
        <CardTitle className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-slate-900" />
          Category Comparison
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {comparisonData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <p className="text-sm font-medium">No data to compare</p>
              <p className="text-xs mt-1">Add line items to see comparisons</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-center mb-2">
              <svg
                ref={svgRef}
                viewBox="0 0 600 350"
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-auto border border-gray-200 rounded-lg"
              />
            </div>

            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-3 text-xs mb-2 flex-wrap">
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-blue-50 border border-blue-200">
                  <div className="w-4 h-4 rounded bg-blue-500 opacity-80"></div>
                  <span className="text-blue-900 font-medium">Current Project</span>
                </div>
                <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-slate-50 border border-slate-200">
                  <div className="w-4 h-4 rounded bg-slate-400 opacity-60"></div>
                  <span className="text-slate-700 font-medium">Company Average</span>
                </div>
                {(wonLostAverageData.won.size > 0 || wonLostAverageData.lost.size > 0) && (
                  <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-gray-100 border border-gray-300">
                    <div className="w-4 h-4 rounded bg-gray-800 opacity-90"></div>
                    <span className="text-gray-800 font-medium">Won/Lost Average</span>
                  </div>
                )}
              </div>

                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                    {comparisonData.map((item) => {
                      // Convert hex color to RGB for background tint
                      const hexToRgb = (hex: string) => {
                        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                        return result
                          ? {
                              r: parseInt(result[1], 16),
                              g: parseInt(result[2], 16),
                              b: parseInt(result[3], 16),
                            }
                          : { r: 148, g: 163, b: 184 }; // fallback to slate-400
                      };
                      const rgb = hexToRgb(item.color);
                      const bgColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`;
                      const borderColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`;
                      
                      return (
                        <div
                          key={item.category}
                          className="flex items-center justify-between p-2 rounded transition-colors border"
                          style={{
                            backgroundColor: bgColor,
                            borderColor: borderColor,
                          }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div
                              className="w-3 h-3 rounded flex-shrink-0"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm font-medium text-gray-900 truncate">
                              {item.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-600 w-16 text-right">
                              {item.current.toFixed(2)}
                            </span>
                            <span className="text-gray-400">vs</span>
                            <span className="text-gray-500 w-16 text-right">
                              {item.average.toFixed(2)}
                            </span>
                            <div className="flex items-center gap-1 w-20 justify-end">
                              {item.deviation > 5 ? (
                                <TrendingUp className="w-4 h-4 text-red-500" />
                              ) : item.deviation < -5 ? (
                                <TrendingDown className="w-4 h-4 text-green-500" />
                              ) : (
                                <Minus className="w-4 h-4 text-gray-400" />
                              )}
                              <span
                                className={`font-medium ${
                                  item.deviation > 5
                                    ? "text-red-600"
                                    : item.deviation < -5
                                      ? "text-green-600"
                                      : "text-gray-600"
                                }`}
                              >
                                {item.deviation > 0 ? "+" : ""}
                                {item.deviation.toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

              <div className="mt-4 pt-4 border-t border-gray-200 text-xs text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Average Deviation:</span>
                  <span className="font-medium text-gray-900">{avgDeviation.toFixed(1)}%</span>
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  Based on {allProjectLines.filter(p => !currentProjectId || p.projectId !== currentProjectId).length} submitted project{allProjectLines.filter(p => !currentProjectId || p.projectId !== currentProjectId).length !== 1 ? 's' : ''}
                </div>
              </div>

            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

