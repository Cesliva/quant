"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import {
  loadCompanySettings,
  loadProjectSettings,
  type CompanySettings,
  type ProjectSettings,
} from "@/lib/utils/settingsLoader";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { Info } from "lucide-react";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface EstimatorHealthPanelProps {
  project: {
    bidDueDate?: string;
    status?: string;
    projectFiles?: any[];
    projectType?: string;
  } | null;
  estimatingStats: {
    totalWeight: number;
    totalCost: number;
    totalLabor: number;
    totalLines: number;
  };
  estimatingLines?: EstimatingLine[];
  companyId?: string;
  projectId?: string;
}

type Baseline = {
  label: string;
  costPerTon: { min: number; p25: number; p50: number; p75: number; max: number };
  hoursPerTon: { min: number; p25: number; p50: number; p75: number; max: number };
  mix: { materialPct: number; laborPct: number };
};

type BaselineBin = { minTons: number; maxTons: number; baseline: Baseline };

// TODO: Replace with real company historical distributions from Firestore (by projectType + tonnage bins).
// Notes:
// - Small jobs typically run higher $/ton and higher hours/ton (setup + handling dominates).
// - Large jobs typically run lower $/ton and slightly lower hours/ton (efficiency scale).
const BASELINE_BINS: Record<string, BaselineBin[]> = {
  Healthcare: [
    {
      minTons: 0,
      maxTons: 50,
      baseline: {
        label: "Healthcare • <50t",
        costPerTon: { min: 3600, p25: 3900, p50: 4200, p75: 4550, max: 4900 },
        hoursPerTon: { min: 24, p25: 28, p50: 32, p75: 36, max: 40 },
        mix: { materialPct: 56, laborPct: 20 },
      },
    },
    {
      minTons: 50,
      maxTons: 150,
      baseline: {
        label: "Healthcare • 50–150t",
        costPerTon: { min: 3300, p25: 3600, p50: 3900, p75: 4200, max: 4500 },
        hoursPerTon: { min: 22, p25: 25, p50: 28, p75: 31, max: 35 },
        mix: { materialPct: 58, laborPct: 18 },
      },
    },
    {
      minTons: 150,
      maxTons: Number.POSITIVE_INFINITY,
      baseline: {
        label: "Healthcare • 150t+",
        costPerTon: { min: 3000, p25: 3300, p50: 3600, p75: 3900, max: 4200 },
        hoursPerTon: { min: 20, p25: 23, p50: 26, p75: 29, max: 33 },
        mix: { materialPct: 59, laborPct: 17 },
      },
    },
  ],
  Commercial: [
    {
      minTons: 0,
      maxTons: 50,
      baseline: {
        label: "Commercial • <50t",
        costPerTon: { min: 3200, p25: 3500, p50: 3800, p75: 4100, max: 4450 },
        hoursPerTon: { min: 20, p25: 23, p50: 26, p75: 29, max: 33 },
        mix: { materialPct: 58, laborPct: 18 },
      },
    },
    {
      minTons: 50,
      maxTons: 150,
      baseline: {
        label: "Commercial • 50–150t",
        costPerTon: { min: 2800, p25: 3050, p50: 3300, p75: 3550, max: 3850 },
        hoursPerTon: { min: 18, p25: 20.5, p50: 23, p75: 25.5, max: 29 },
        mix: { materialPct: 60, laborPct: 16 },
      },
    },
    {
      minTons: 150,
      maxTons: Number.POSITIVE_INFINITY,
      baseline: {
        label: "Commercial • 150t+",
        costPerTon: { min: 2500, p25: 2750, p50: 3000, p75: 3300, max: 3600 },
        hoursPerTon: { min: 16, p25: 18.5, p50: 21, p75: 23.5, max: 27 },
        mix: { materialPct: 61, laborPct: 15 },
      },
    },
  ],
  Industrial: [
    {
      minTons: 0,
      maxTons: 50,
      baseline: {
        label: "Industrial • <50t",
        costPerTon: { min: 3350, p25: 3650, p50: 3950, p75: 4250, max: 4600 },
        hoursPerTon: { min: 22, p25: 25, p50: 28, p75: 31, max: 35 },
        mix: { materialPct: 53, laborPct: 22 },
      },
    },
    {
      minTons: 50,
      maxTons: 150,
      baseline: {
        label: "Industrial • 50–150t",
        costPerTon: { min: 3000, p25: 3250, p50: 3500, p75: 3750, max: 4050 },
        hoursPerTon: { min: 20, p25: 22.5, p50: 25, p75: 27.5, max: 31.5 },
        mix: { materialPct: 55, laborPct: 20 },
      },
    },
    {
      minTons: 150,
      maxTons: Number.POSITIVE_INFINITY,
      baseline: {
        label: "Industrial • 150t+",
        costPerTon: { min: 2700, p25: 2950, p50: 3200, p75: 3500, max: 3800 },
        hoursPerTon: { min: 18, p25: 20.5, p50: 23, p75: 26, max: 29.5 },
        mix: { materialPct: 56, laborPct: 19 },
      },
    },
  ],
  Residential: [
    {
      minTons: 0,
      maxTons: 50,
      baseline: {
        label: "Residential • <50t",
        costPerTon: { min: 2950, p25: 3200, p50: 3450, p75: 3700, max: 4050 },
        hoursPerTon: { min: 18, p25: 20.5, p50: 23, p75: 25.5, max: 29 },
        mix: { materialPct: 60, laborPct: 16 },
      },
    },
    {
      minTons: 50,
      maxTons: 150,
      baseline: {
        label: "Residential • 50–150t",
        costPerTon: { min: 2600, p25: 2850, p50: 3100, p75: 3350, max: 3650 },
        hoursPerTon: { min: 16, p25: 18.5, p50: 21, p75: 23.5, max: 27 },
        mix: { materialPct: 62, laborPct: 14 },
      },
    },
    {
      minTons: 150,
      maxTons: Number.POSITIVE_INFINITY,
      baseline: {
        label: "Residential • 150t+",
        costPerTon: { min: 2350, p25: 2550, p50: 2750, p75: 3000, max: 3300 },
        hoursPerTon: { min: 14, p25: 16.5, p50: 19, p75: 21.5, max: 25.5 },
        mix: { materialPct: 63, laborPct: 13 },
      },
    },
  ],
  Default: [
    {
      minTons: 0,
      maxTons: 50,
      baseline: {
        label: "Company • <50t",
        costPerTon: { min: 3200, p25: 3500, p50: 3800, p75: 4100, max: 4450 },
        hoursPerTon: { min: 20, p25: 23, p50: 26, p75: 29, max: 33 },
        mix: { materialPct: 58, laborPct: 18 },
      },
    },
    {
      minTons: 50,
      maxTons: 150,
      baseline: {
        label: "Company • 50–150t",
        costPerTon: { min: 2900, p25: 3200, p50: 3500, p75: 3800, max: 4100 },
        hoursPerTon: { min: 19, p25: 22, p50: 25, p75: 28, max: 31 },
        mix: { materialPct: 58, laborPct: 17 },
      },
    },
    {
      minTons: 150,
      maxTons: Number.POSITIVE_INFINITY,
      baseline: {
        label: "Company • 150t+",
        costPerTon: { min: 2600, p25: 2850, p50: 3100, p75: 3400, max: 3700 },
        hoursPerTon: { min: 17, p25: 19.5, p50: 22, p75: 24.5, max: 28.5 },
        mix: { materialPct: 59, laborPct: 16 },
      },
    },
  ],
};

function getBaseline(projectType: string | undefined, tons: number): Baseline {
  const typeKey = projectType && BASELINE_BINS[projectType] ? projectType : "Default";
  const bins = BASELINE_BINS[typeKey] || BASELINE_BINS.Default;
  const t = Number.isFinite(tons) && tons > 0 ? tons : 100; // neutral bin if unknown
  const found = bins.find((b) => t >= b.minTons && t < b.maxTons);
  return (found?.baseline || bins[0].baseline);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function safePct(n: number, d: number) {
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return 0;
  return (n / d) * 100;
}

function formatMoney(n: number) {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(n / 1000).toFixed(0)}k`;
  if (abs >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number, dp = 1) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(dp);
}

function parseLineSeq(line: EstimatingLine) {
  // lineId is auto sequence but typed as string
  const n = Number.parseInt((line.lineId || "").toString().replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
}

export default function EstimatorHealthPanel({
  project,
  estimatingStats,
  estimatingLines = [],
  companyId: propCompanyId,
  projectId,
}: EstimatorHealthPanelProps) {
  const hookCompanyId = useCompanyId();
  const companyId = propCompanyId || hookCompanyId;

  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [viewMode, setViewMode] = useState<"executive" | "analyst">("executive");
  const [alertFilter, setAlertFilter] = useState<Record<AlertItem["severity"], boolean>>({
    crit: true,
    warn: true,
    info: true,
    ok: false,
  });
  const [coverageOnly, setCoverageOnly] = useState(false);
  const [winLossRecords, setWinLossRecords] = useState<Array<{ projectType?: string; status: "won" | "lost" }>>([]);

  // Persist UI preferences (marketing demos tend to want consistent defaults)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("quant.estimatorIntel.viewMode");
      if (saved === "executive" || saved === "analyst") setViewMode(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem("quant.estimatorIntel.viewMode", viewMode);
    } catch {}
  }, [viewMode]);

  useEffect(() => {
    if (!companyId) return;
    const load = async () => {
      try {
        const c = await loadCompanySettings(companyId);
        setCompanySettings(c);
        if (projectId) {
          const p = await loadProjectSettings(companyId, projectId);
          setProjectSettings(p);
        }
      } catch (e) {
        console.warn("EstimatorHealthPanel: failed to load settings:", e);
      }
    };
    load();
  }, [companyId, projectId]);

  // Load win/loss records for win probability calculation
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      setWinLossRecords([]);
      return;
    }

    const winLossPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection<any>(
      winLossPath,
      (records) => {
        setWinLossRecords(records || []);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const model = useMemo(() => {
    const active = estimatingLines.filter((l) => l.status !== "Void");
    const sorted = [...active].sort((a, b) => parseLineSeq(a) - parseLineSeq(b));

    const tons = estimatingStats.totalWeight > 0 ? estimatingStats.totalWeight / 2000 : 0;
    const totalCost = estimatingStats.totalCost || 0;
    const totalHours = estimatingStats.totalLabor || 0;
    const costPerTon = tons > 0 ? totalCost / tons : 0;
    const hoursPerTon = tons > 0 ? totalHours / tons : 0;

    const baseline = getBaseline(project?.projectType, tons);

    // Schedule + docs (high-signal “Bloomberg” context)
    const now = Date.now();
    const bidDueMs = project?.bidDueDate ? Date.parse(project.bidDueDate) : NaN;
    const daysToBid = Number.isFinite(bidDueMs) ? Math.ceil((bidDueMs - now) / 86_400_000) : null;
    const filesCount = project?.projectFiles?.length ?? 0;

    // Weight helper (must be defined before any use)
    const lineWeightLbs = (l: EstimatingLine) =>
      l.materialType === "Material" ? l.totalWeight || 0 : l.plateTotalWeight || 0;

    // Direct costs from line totals (these are live as user edits lines)
    const materialCost = active.reduce((s, l) => s + (l.materialCost || 0), 0);
    const laborCost = active.reduce((s, l) => s + (l.laborCost || 0), 0);
    const coatingCost = active.reduce((s, l) => s + (l.coatingCost || 0), 0);
    const hardwareCost = active.reduce((s, l) => s + (l.hardwareCost || 0), 0);
    const directCost = materialCost + laborCost + coatingCost + hardwareCost;

    const materialPct = safePct(materialCost, directCost);
    const laborPct = safePct(laborCost, directCost);
    const coatingPct = safePct(coatingCost, directCost);
    const hardwarePct = safePct(hardwareCost, directCost);

    // Geometry signals (coating area, plate vs member share)
    const totalSurfaceArea =
      active.reduce((s, l) => s + (l.materialType === "Material" ? (l.totalSurfaceArea || 0) : (l.plateSurfaceArea || 0)), 0) || 0;
    const coatedSurfaceArea =
      active.reduce((s, l) => {
        const hasCoat = !!l.coatingSystem && l.coatingSystem !== "None";
        if (!hasCoat) return s;
        return s + (l.materialType === "Material" ? (l.totalSurfaceArea || 0) : (l.plateSurfaceArea || 0));
      }, 0) || 0;
    const coatingCostPerSF = coatedSurfaceArea > 0 ? coatingCost / coatedSurfaceArea : 0;

    const totalWeightLbs = active.reduce((s, l) => s + lineWeightLbs(l), 0);
    const plateWeightLbs = active.reduce((s, l) => s + (l.materialType === "Plate" ? (l.plateTotalWeight || 0) : 0), 0);
    const plateWeightPct = safePct(plateWeightLbs, totalWeightLbs);

    // Work mix
    const structuralLines = active.filter((l) => (l.workType || "STRUCTURAL") === "STRUCTURAL").length;
    const miscLines = active.length - structuralLines;
    const miscPct = active.length ? (miscLines / active.length) * 100 : 0;

    // Markup stack (company + per-project overrides)
    const overheadPct =
      projectSettings?.overheadPercentage !== undefined
        ? projectSettings.overheadPercentage
        : companySettings?.markupSettings?.overheadPercentage ?? 0;
    const profitPct =
      projectSettings?.profitPercentage !== undefined
        ? projectSettings.profitPercentage
        : companySettings?.markupSettings?.profitPercentage ?? 0;
    const materialWastePct = companySettings?.markupSettings?.materialWasteFactor ?? 0;
    const laborWastePct = companySettings?.markupSettings?.laborWasteFactor ?? 0;

    const materialWaste = materialCost * (materialWastePct / 100);
    const laborWaste = laborCost * (laborWastePct / 100);
    const subtotalWithWaste = directCost + materialWaste + laborWaste;
    const overheadAmt = subtotalWithWaste * (overheadPct / 100);
    const profitAmt = (subtotalWithWaste + overheadAmt) * (profitPct / 100);
    const totalWithMarkup = subtotalWithWaste + overheadAmt + profitAmt;

    // Weight/labor coverage diagnostics (surface gaps)
    const lineHasWeight = (l: EstimatingLine) => lineWeightLbs(l) > 0;
    const lineHasLabor = (l: EstimatingLine) => (l.totalLabor || 0) > 0;
    const lineHasRate = (l: EstimatingLine) => (l.laborRate || 0) > 0 || (l.materialRate || 0) > 0;

    const missingWeight = active.filter((l) => !lineHasWeight(l)).length;
    const missingLabor = active.filter((l) => !lineHasLabor(l)).length;
    const missingRates = active.filter((l) => !lineHasRate(l)).length;
    const coatingSpecifiedNoCost = active.filter(
      (l) => !!l.coatingSystem && l.coatingSystem !== "None" && (l.coatingCost || 0) === 0
    ).length;

    const coverage = {
      weight: active.length ? (active.length - missingWeight) / active.length : 0,
      labor: active.length ? (active.length - missingLabor) / active.length : 0,
      rates: active.length ? (active.length - missingRates) / active.length : 0,
      coatingPricing: active.length ? (active.length - coatingSpecifiedNoCost) / active.length : 0,
    };

    // Cost drivers (category + subCategory)
    const byCat = new Map<
      string,
      { key: string; cost: number; hours: number; weight: number; lines: number; type: "category" | "subCategory" }
    >();
    for (const l of active) {
      const weight = lineWeightLbs(l);
      const hours = l.totalLabor || 0;
      const cost = l.totalCost || 0;
      const catKey = l.category || "Uncategorized";
      const subKey = `${catKey} / ${l.subCategory || "—"}`;

      const cat = byCat.get(catKey) || { key: catKey, cost: 0, hours: 0, weight: 0, lines: 0, type: "category" as const };
      cat.cost += cost;
      cat.hours += hours;
      cat.weight += weight;
      cat.lines += 1;
      byCat.set(catKey, cat);

      const sub = byCat.get(subKey) || { key: subKey, cost: 0, hours: 0, weight: 0, lines: 0, type: "subCategory" as const };
      sub.cost += cost;
      sub.hours += hours;
      sub.weight += weight;
      sub.lines += 1;
      byCat.set(subKey, sub);
    }

    const drivers = Array.from(byCat.values())
      .filter((d) => d.cost > 0)
      .sort((a, b) => b.cost - a.cost);

    const topCategories = drivers.filter((d) => d.type === "category").slice(0, 8);
    const topSubcats = drivers.filter((d) => d.type === "subCategory").slice(0, 10);

    const concentration = (() => {
      const top3 = topCategories.slice(0, 3).reduce((s, d) => s + d.cost, 0);
      return safePct(top3, totalCost || directCost || 1);
    })();

    // Labor ops (hours)
    const laborOps: Array<{ key: string; label: string; hours: number }> = [
      { key: "laborUnload", label: "Unload", hours: active.reduce((s, l) => s + (l.laborUnload || 0), 0) },
      { key: "laborCut", label: "Cut", hours: active.reduce((s, l) => s + (l.laborCut || 0), 0) },
      { key: "laborCope", label: "Cope", hours: active.reduce((s, l) => s + (l.laborCope || 0), 0) },
      { key: "laborProcessPlate", label: "Process Plate", hours: active.reduce((s, l) => s + (l.laborProcessPlate || 0), 0) },
      { key: "laborDrillPunch", label: "Drill/Punch", hours: active.reduce((s, l) => s + (l.laborDrillPunch || 0), 0) },
      { key: "laborFit", label: "Fit", hours: active.reduce((s, l) => s + (l.laborFit || 0), 0) },
      { key: "laborWeld", label: "Weld", hours: active.reduce((s, l) => s + (l.laborWeld || 0), 0) },
      { key: "laborPrepClean", label: "Prep/Clean", hours: active.reduce((s, l) => s + (l.laborPrepClean || 0), 0) },
      { key: "laborPaint", label: "Paint", hours: active.reduce((s, l) => s + (l.laborPaint || 0), 0) },
      { key: "laborHandleMove", label: "Handle/Move", hours: active.reduce((s, l) => s + (l.laborHandleMove || 0), 0) },
      { key: "laborLoadShip", label: "Load/Ship", hours: active.reduce((s, l) => s + (l.laborLoadShip || 0), 0) },
    ]
      .filter((o) => o.hours > 0)
      .sort((a, b) => b.hours - a.hours);

    const blendedLaborRate = totalHours > 0 ? laborCost / totalHours : 0;
    const materialPerLb = (() => {
      const lbs = active.reduce((s, l) => s + lineWeightLbs(l), 0);
      return lbs > 0 ? materialCost / lbs : 0;
    })();

    // Live “build curve” (by line sequence) for sparklines
    const curve = (() => {
      let runningCost = 0;
      let runningHours = 0;
      let runningWeight = 0;
      const points: Array<{ x: number; costPerTon: number; hoursPerTon: number; cost: number }> = [];
      for (let i = 0; i < sorted.length; i++) {
        const l = sorted[i];
        runningCost += l.totalCost || 0;
        runningHours += l.totalLabor || 0;
        runningWeight += lineWeightLbs(l);
        const runningTons = runningWeight > 0 ? runningWeight / 2000 : 0;
        points.push({
          x: i + 1,
          cost: runningCost,
          costPerTon: runningTons > 0 ? runningCost / runningTons : 0,
          hoursPerTon: runningTons > 0 ? runningHours / runningTons : 0,
        });
      }
      return points;
    })();

    const kpiSparklines = {
      cost: curve.map((p) => p.cost),
      cpt: curve.map((p) => p.costPerTon),
      hpt: curve.map((p) => p.hoursPerTon),
    };

    const position = {
      cost: percentilePosition(costPerTon, baseline.costPerTon),
      hours: percentilePosition(hoursPerTon, baseline.hoursPerTon),
    };

    const score = computeScore({ position, coverage, concentration });

    const alerts = buildAlerts({
      baseline,
      costPerTon,
      hoursPerTon,
      materialPct,
      laborPct,
      position,
      coverage,
      concentration,
      blendedLaborRate,
      materialPerLb,
      tons,
      activeLines: active.length,
      coatingSpecifiedNoCost,
      missingLabor,
      missingRates,
      missingWeight,
      daysToBid,
      filesCount,
      miscPct,
      coatedSurfaceArea,
      coatingCostPerSF,
      plateWeightPct,
    });

    // Calculate win probability by project type
    const currentProjectType = project?.projectType || "Default";
    const typeRecords = winLossRecords.filter((r) => r.projectType === currentProjectType);
    const typeWins = typeRecords.filter((r) => r.status === "won").length;
    const historicalWinRate = typeRecords.length > 0 ? (typeWins / typeRecords.length) * 100 : null;
    
    // Overall win rate for comparison
    const allWins = winLossRecords.filter((r) => r.status === "won").length;
    const overallWinRate = winLossRecords.length > 0 ? (allWins / winLossRecords.length) * 100 : null;

    // Win rates by project type for chart
    const winRatesByType = (() => {
      const typeMap = new Map<string, { wins: number; total: number }>();
      winLossRecords.forEach((r) => {
        const type = r.projectType || "Default";
        const current = typeMap.get(type) || { wins: 0, total: 0 };
        current.total += 1;
        if (r.status === "won") current.wins += 1;
        typeMap.set(type, current);
      });
      return Array.from(typeMap.entries())
        .map(([type, data]) => ({
          type,
          winRate: data.total > 0 ? (data.wins / data.total) * 100 : 0,
          total: data.total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 6); // Top 6 project types
    })();

    return {
      activeCount: active.length,
      tons,
      totalCost,
      totalHours,
      costPerTon,
      hoursPerTon,
      baseline,
      position,
      score,
      kpiSparklines,
      mix: { materialPct, laborPct, coatingPct, hardwarePct },
      context: {
        daysToBid,
        filesCount,
        miscPct,
        coatedSurfaceArea,
        coatingCostPerSF,
        plateWeightPct,
        totalSurfaceArea,
      },
      costs: {
        materialCost,
        laborCost,
        coatingCost,
        hardwareCost,
        directCost,
        materialWaste,
        laborWaste,
        overheadAmt,
        profitAmt,
        totalWithMarkup,
        overheadPct,
        profitPct,
        materialWastePct,
        laborWastePct,
      },
      coverage,
      gaps: { missingWeight, missingLabor, missingRates, coatingSpecifiedNoCost },
      drivers: { topCategories, topSubcats },
      laborOps,
      rates: { blendedLaborRate, materialPerLb },
      alerts,
      winProbability: {
        currentProjectType,
        historicalWinRate,
        overallWinRate,
        winRatesByType,
        sampleSize: typeRecords.length,
      },
    };
  }, [estimatingLines, estimatingStats, project?.projectType, companySettings, projectSettings, winLossRecords]);

  const filteredAlerts = useMemo(() => {
    const rank: Record<AlertItem["severity"], number> = { crit: 0, warn: 1, info: 2, ok: 3 };
    const isCoverageAlert = (a: AlertItem) =>
      a.id === "coverage" ||
      a.id.startsWith("gap-") ||
      a.id === "coat-area" ||
      a.id === "steel" ||
      a.id === "blend" ||
      a.id === "docs";

    const base = model.alerts.items
      .filter((a) => alertFilter[a.severity])
      .filter((a) => (coverageOnly ? isCoverageAlert(a) : true))
      .sort((a, b) => {
        const r = rank[a.severity] - rank[b.severity];
        if (r !== 0) return r;
        // stable-ish: keep deterministic order by id
        return a.id.localeCompare(b.id);
      });

    // Executive mode: show top signals only
    if (viewMode === "executive") {
      return base.slice(0, 8);
    }
    return base;
  }, [model.alerts.items, alertFilter, coverageOnly, viewMode]);

  const coveragePct =
    ((model.coverage.weight + model.coverage.labor + model.coverage.rates + model.coverage.coatingPricing) / 4) * 100;

  const winType = model.winProbability.currentProjectType || "Default";
  const winTypeRate = model.winProbability.historicalWinRate;
  const winOverallRate = model.winProbability.overallWinRate;

  // Top 3 critical/warning alerts for the summary
  const topAlerts = useMemo(() => {
    return model.alerts.items
      .filter((a) => a.severity === "crit" || a.severity === "warn")
      .slice(0, 3);
  }, [model.alerts.items]);

  const totalGaps = model.gaps.missingWeight + model.gaps.missingLabor + model.gaps.missingRates + model.gaps.coatingSpecifiedNoCost;
  const [showDetails, setShowDetails] = useState(false);

  // Health status based on score
  const healthStatus = model.score >= 70 ? "Healthy" : model.score >= 40 ? "Needs Review" : "At Risk";
  const healthColor = model.score >= 70 ? "text-emerald-600" : model.score >= 40 ? "text-amber-600" : "text-rose-600";
  const healthBg = model.score >= 70 ? "bg-emerald-50" : model.score >= 40 ? "bg-amber-50" : "bg-rose-50";
  const healthBorder = model.score >= 70 ? "border-emerald-200" : model.score >= 40 ? "border-amber-200" : "border-rose-200";

  return (
    <Card className="overflow-hidden">
      {/* Clean header */}
      <div className="p-6 pb-0">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 tracking-normal">Estimate Health</h3>
            <p className="text-sm text-slate-500 mt-1">
              {model.baseline.label} • {model.activeCount} lines • {formatNumber(model.tons, 1)} tons
            </p>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full ${healthBg} border ${healthBorder}`}>
            <div className={`w-2 h-2 rounded-full ${model.score >= 70 ? "bg-emerald-500" : model.score >= 40 ? "bg-amber-500" : "bg-rose-500"}`} />
            <span className={`text-sm font-semibold ${healthColor}`}>{healthStatus}</span>
            <span className="text-sm font-bold text-slate-700 tabular-nums ml-1">{model.score.toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Key metrics - 3 clean cards */}
      <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-blue-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Estimate Total</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2 tabular-nums">{formatMoney(model.totalCost).replace("$", "$").split(".")[0]}</p>
          <p className="text-sm opacity-85">{formatNumber(model.totalHours, 0)} labor hours</p>
        </div>

        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-emerald-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Cost per Ton</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2 tabular-nums">{formatMoney(model.costPerTon).replace("$", "$").split(".")[0]}</p>
          <p className="text-sm opacity-85">
            {model.costPerTon > model.baseline.costPerTon.p50 ? (
              <span>↑ {((model.costPerTon / model.baseline.costPerTon.p50 - 1) * 100).toFixed(0)}% above baseline</span>
            ) : model.costPerTon < model.baseline.costPerTon.p50 ? (
              <span>↓ {((1 - model.costPerTon / model.baseline.costPerTon.p50) * 100).toFixed(0)}% below baseline</span>
            ) : (
              <span>At baseline median</span>
            )}
          </p>
        </div>

        <div className="rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 bg-orange-500">
          <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">Hours per Ton</p>
          <p className="text-4xl md:text-5xl font-semibold leading-none mb-2 tabular-nums">{formatNumber(model.hoursPerTon, 1)}</p>
          <p className="text-sm opacity-85">
            {model.hoursPerTon > model.baseline.hoursPerTon.p50 ? (
              <span>↑ {((model.hoursPerTon / model.baseline.hoursPerTon.p50 - 1) * 100).toFixed(0)}% above baseline</span>
            ) : model.hoursPerTon < model.baseline.hoursPerTon.p50 ? (
              <span>↓ {((1 - model.hoursPerTon / model.baseline.hoursPerTon.p50) * 100).toFixed(0)}% below baseline</span>
            ) : (
              <span>At baseline median</span>
            )}
          </p>
        </div>
      </div>

      {/* Insights section - clean, simple */}
      {(topAlerts.length > 0 || totalGaps > 0) && (
        <div className="px-6 pb-6">
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
            {topAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start gap-4 p-4">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                  alert.severity === "crit" ? "bg-rose-500" : "bg-amber-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{alert.title}</div>
                  <div className="text-sm text-slate-500 mt-0.5">{alert.detail}</div>
                </div>
                <div className="text-sm font-medium text-slate-700 tabular-nums">{alert.value}</div>
              </div>
            ))}
            
            {totalGaps > 0 && (
              <div className="flex items-start gap-4 p-4">
                <div className="mt-0.5 w-2 h-2 rounded-full flex-shrink-0 bg-blue-500" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">Data coverage gaps</div>
                  <div className="text-sm text-slate-500 mt-0.5">
                    {totalGaps} item{totalGaps !== 1 ? "s" : ""} missing weight, labor, rates, or coating pricing
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-700 tabular-nums">{coveragePct.toFixed(0)}% complete</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Win probability - simple inline */}
      {(winTypeRate !== null || winOverallRate !== null) && (
        <div className="px-6 pb-6">
          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-900">Win Probability</span>
              {" "}for {winType} projects
            </div>
            <div className="flex items-center gap-6">
              {winTypeRate !== null && (
                <div className="text-right">
                  <div className="text-sm text-slate-500">This type</div>
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{winTypeRate.toFixed(0)}%</div>
                </div>
              )}
              {winOverallRate !== null && (
                <div className="text-right">
                  <div className="text-sm text-slate-500">Company avg</div>
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{winOverallRate.toFixed(0)}%</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Expandable details */}
      <div className="border-t border-slate-100">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full px-6 py-4 flex items-center justify-between text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors"
        >
          <span>{showDetails ? "Hide detailed analysis" : "View detailed analysis"}</span>
          <svg
            className={`w-5 h-5 transition-transform ${showDetails ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDetails && (
          <div className="px-6 pb-6 space-y-6">
            {/* Cost breakdown */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Cost Breakdown</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Direct Cost</div>
                  <div className="text-base font-semibold text-slate-900 tabular-nums">{formatMoney(model.costs.directCost)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Overhead ({model.costs.overheadPct.toFixed(0)}%)</div>
                  <div className="text-base font-semibold text-slate-900 tabular-nums">{formatMoney(model.costs.overheadAmt)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Profit ({model.costs.profitPct.toFixed(0)}%)</div>
                  <div className="text-base font-semibold text-slate-900 tabular-nums">{formatMoney(model.costs.profitAmt)}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                  <div className="text-xs text-slate-500">Total w/ Markup</div>
                  <div className="text-base font-semibold text-slate-900 tabular-nums">{formatMoney(model.costs.totalWithMarkup)}</div>
                </div>
              </div>
            </div>

            {/* Mix comparison */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Cost Mix vs Baseline</h4>
              <div className="space-y-2">
                {[
                  { label: "Material", pct: model.mix.materialPct, baseline: model.baseline.mix.materialPct, color: "bg-blue-500" },
                  { label: "Labor", pct: model.mix.laborPct, baseline: model.baseline.mix.laborPct, color: "bg-emerald-500" },
                  { label: "Coating", pct: model.mix.coatingPct, baseline: null, color: "bg-amber-500" },
                  { label: "Hardware", pct: model.mix.hardwarePct, baseline: null, color: "bg-indigo-500" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className="w-20 text-sm text-slate-600">{item.label}</div>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${item.color} rounded-full`} style={{ width: `${item.pct}%` }} />
                    </div>
                    <div className="w-16 text-sm text-slate-900 tabular-nums text-right">{item.pct.toFixed(1)}%</div>
                    {item.baseline !== null && (
                      <div className="w-20 text-xs text-slate-500 tabular-nums">vs {item.baseline}%</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Top cost drivers */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Top Cost Drivers</h4>
              <div className="bg-slate-50 rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100">
                      <th className="text-left px-4 py-2 font-medium text-slate-600">Category</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">Cost</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">%</th>
                      <th className="text-right px-4 py-2 font-medium text-slate-600">$/Ton</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {model.drivers.topCategories.slice(0, 5).map((d) => {
                      const tons = d.weight > 0 ? d.weight / 2000 : 0;
                      return (
                        <tr key={d.key} className="hover:bg-white transition-colors">
                          <td className="px-4 py-2 text-slate-900">{d.key}</td>
                          <td className="px-4 py-2 text-right text-slate-900 tabular-nums">{formatMoney(d.cost)}</td>
                          <td className="px-4 py-2 text-right text-slate-600 tabular-nums">{safePct(d.cost, model.totalCost || 1).toFixed(0)}%</td>
                          <td className="px-4 py-2 text-right text-slate-600 tabular-nums">{tons > 0 ? formatMoney(d.cost / tons) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Data coverage */}
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Data Coverage</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Weight", value: model.coverage.weight, missing: model.gaps.missingWeight },
                  { label: "Labor", value: model.coverage.labor, missing: model.gaps.missingLabor },
                  { label: "Rates", value: model.coverage.rates, missing: model.gaps.missingRates },
                  { label: "Coating", value: model.coverage.coatingPricing, missing: model.gaps.coatingSpecifiedNoCost },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3 border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-slate-500">{item.label}</div>
                      <div className={`text-xs font-medium ${item.value >= 0.9 ? "text-emerald-600" : item.value >= 0.7 ? "text-amber-600" : "text-rose-600"}`}>
                        {(item.value * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.value >= 0.9 ? "bg-emerald-500" : item.value >= 0.7 ? "bg-amber-500" : "bg-rose-500"}`}
                        style={{ width: `${item.value * 100}%` }}
                      />
                    </div>
                    {item.missing > 0 && (
                      <div className="mt-1 text-xs text-slate-500">{item.missing} missing</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function TogglePill({
  options,
  value,
  onChange,
}: {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function FilterChip({
  label,
  active,
  tone,
  onClick,
}: {
  label: string;
  active: boolean;
  tone: "rose" | "amber" | "slate" | "emerald" | "blue";
  onClick: () => void;
}) {
  const tones: Record<typeof tone, { on: string; off: string }> = {
    rose: { on: "bg-rose-100 text-rose-800 border-rose-200", off: "bg-white text-slate-600 border-slate-200" },
    amber: { on: "bg-amber-100 text-amber-800 border-amber-200", off: "bg-white text-slate-600 border-slate-200" },
    slate: { on: "bg-slate-100 text-slate-800 border-slate-200", off: "bg-white text-slate-600 border-slate-200" },
    emerald: { on: "bg-emerald-100 text-emerald-800 border-emerald-200", off: "bg-white text-slate-600 border-slate-200" },
    blue: { on: "bg-blue-100 text-blue-800 border-blue-200", off: "bg-white text-slate-600 border-slate-200" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
        active ? tones[tone].on : tones[tone].off
      }`}
    >
      {label}
    </button>
  );
}

function pillClass(sev: "crit" | "warn" | "info" | "ok") {
  const base =
    "text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wide font-semibold";
  if (sev === "crit") return `${base} bg-rose-100 text-rose-700`;
  if (sev === "warn") return `${base} bg-amber-100 text-amber-700`;
  if (sev === "ok") return `${base} bg-emerald-100 text-emerald-700`;
  return `${base} bg-slate-100 text-slate-700`;
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 80 ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    score >= 60 ? "bg-blue-100 text-blue-700 border-blue-200" :
    score >= 40 ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-rose-100 text-rose-700 border-rose-200";
  const label =
    score >= 80 ? "Aligned" :
    score >= 60 ? "Competitive" :
    score >= 40 ? "Drifting" : "At risk";
  return (
    <div className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {label}
    </div>
  );
}

function Kpi({
  label,
  value,
  meta,
  series,
  tone,
  compact = false,
  anomaly = null,
}: {
  label: string;
  value: string;
  meta: string;
  series: number[] | null;
  tone: "slate" | "blue" | "emerald" | "amber" | "indigo" | "rose";
  compact?: boolean;
  anomaly?: "high" | "medium" | null;
}) {
  const tones: Record<typeof tone, { ring: string; dot: string; bg: string }> = {
    slate: { ring: "ring-slate-200", dot: "bg-slate-600", bg: "bg-white" },
    blue: { ring: "ring-blue-200", dot: "bg-blue-600", bg: "bg-white" },
    emerald: { ring: "ring-emerald-200", dot: "bg-emerald-600", bg: "bg-white" },
    amber: { ring: "ring-amber-200", dot: "bg-amber-600", bg: "bg-white" },
    indigo: { ring: "ring-indigo-200", dot: "bg-indigo-600", bg: "bg-white" },
    rose: { ring: "ring-rose-200", dot: "bg-rose-600", bg: "bg-white" },
  };
  const anomalyClass = anomaly === "high" ? "ring-2 ring-rose-400" : anomaly === "medium" ? "ring-2 ring-amber-400" : "";
  return (
    <div className={`rounded border border-slate-200 ${tones[tone].bg} ${compact ? "p-1" : "p-1.5"} ring-1 ${tones[tone].ring} ${anomalyClass}`}>
      <div className="flex items-center justify-between">
        <div className={`${compact ? "text-[10px]" : "text-[11px]"} font-semibold uppercase tracking-wide text-slate-500`}>{label}</div>
        <div className="flex items-center gap-1">
          {anomaly && (
            <div className={`h-1.5 w-1.5 rounded-full ${anomaly === "high" ? "bg-rose-500" : "bg-amber-500"}`} title="Anomaly detected" />
          )}
          <div className={`h-2 w-2 rounded-full ${tones[tone].dot}`} />
        </div>
      </div>
      <div className={`mt-0.5 ${compact ? "text-base" : "text-lg"} font-bold text-slate-900 tabular-nums`}>{value}</div>
      <div className={`mt-0.5 flex items-center justify-between gap-2`}>
        <div className={`${compact ? "text-[10px]" : "text-[11px]"} text-slate-500 truncate`}>{meta}</div>
        {series && series.length >= 2 ? <Sparkline series={series} compact={compact} /> : null}
      </div>
    </div>
  );
}

function Sparkline({ series, compact = false }: { series: number[]; compact?: boolean }) {
  const w = compact ? 48 : 64;
  const h = compact ? 14 : 18;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * (w - 2) + 1;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <polyline points={pts} fill="none" stroke="#0f172a" strokeOpacity="0.55" strokeWidth={compact ? "1" : "1.5"} />
    </svg>
  );
}

function percentilePosition(value: number, b: { min: number; p25: number; p50: number; p75: number; max: number }) {
  if (!Number.isFinite(value) || value <= 0) return 50;
  // piecewise linear percentile-ish scale based on distribution anchors
  if (value <= b.min) return 1;
  if (value >= b.max) return 99;
  if (value <= b.p25) return 10 + ((value - b.min) / (b.p25 - b.min)) * 15; // 10-25
  if (value <= b.p50) return 25 + ((value - b.p25) / (b.p50 - b.p25)) * 25; // 25-50
  if (value <= b.p75) return 50 + ((value - b.p50) / (b.p75 - b.p50)) * 25; // 50-75
  return 75 + ((value - b.p75) / (b.max - b.p75)) * 15; // 75-90
}

function computeScore({
  position,
  coverage,
  concentration,
}: {
  position: { cost: number; hours: number };
  coverage: { weight: number; labor: number; rates: number; coatingPricing: number };
  concentration: number;
}) {
  // “Bloomberg” score: rewarding in-band + good coverage, penalizing concentration + missing data.
  const inBand = (p: number) => 1 - Math.min(1, Math.abs(p - 50) / 50); // 1 at median, 0 at extremes
  const price = inBand(position.cost);
  const labor = inBand(position.hours);
  const cov = (coverage.weight + coverage.labor + coverage.rates + coverage.coatingPricing) / 4;
  const concPenalty = clamp((concentration - 55) / 45, 0, 1); // starts penalizing above 55%
  const score = (price * 38 + labor * 32 + cov * 30) * (1 - concPenalty * 0.25);
  return clamp(score, 0, 100);
}

function SparklineWithContext({
  title,
  value,
  unit,
  baseline,
  series,
  compact = false,
}: {
  title: string;
  value: number;
  unit: string;
  baseline: { min: number; p25: number; p50: number; p75: number; max: number };
  series: number[] | null;
  compact?: boolean;
}) {
  // Calculate delta from median baseline
  const delta = baseline.p50 > 0 ? ((value - baseline.p50) / baseline.p50) * 100 : 0;
  const deltaAbs = Math.abs(delta);
  const deltaTone = deltaAbs < 5 ? "emerald" : deltaAbs < 15 ? "amber" : "rose";
  
  // Prepare sparkline data (use series if available, otherwise create a simple trend)
  const sparklineData = series && series.length >= 2 
    ? series 
    : [baseline.p50 * 0.9, baseline.p50 * 0.95, baseline.p50, baseline.p50 * 1.05, value];
  
  // Calculate chart dimensions and scaling
  const chartWidth = compact ? 160 : 200;
  const chartHeight = compact ? 45 : 60;
  const padding = compact ? { top: 6, right: 6, bottom: 16, left: 6 } : { top: 8, right: 8, bottom: 20, left: 8 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  // Scale to fit baseline range with some padding
  const minVal = Math.min(...sparklineData, baseline.min);
  const maxVal = Math.max(...sparklineData, baseline.max);
  const range = maxVal - minVal || 1;
  const scaleY = (v: number) => plotHeight - ((v - minVal) / range) * plotHeight;
  
  // Generate sparkline path
  const points = sparklineData.map((v, i) => {
    const x = padding.left + (i / (sparklineData.length - 1)) * plotWidth;
    const y = padding.top + scaleY(v);
    return `${x},${y}`;
  }).join(" ");
  
  // Baseline median line
  const baselineY = padding.top + scaleY(baseline.p50);
  
  // Current value marker position
  const currentX = padding.left + plotWidth;
  const currentY = padding.top + scaleY(value);

  return (
    <div className={`rounded border border-slate-200 bg-white ${compact ? "p-1" : "p-1.5"}`}>
      <div className={`flex items-center justify-between ${compact ? "mb-0.5" : "mb-1"}`}>
        <div className={`${compact ? "text-[11px]" : "text-xs"} font-semibold text-slate-900`}>{title}</div>
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold text-slate-700 tabular-nums">
            {unit === "$/ton" ? formatMoney(value) : formatNumber(value, 1)}
          </div>
          <div className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
            deltaTone === "emerald" ? "bg-emerald-100 text-emerald-700" :
            deltaTone === "amber" ? "bg-amber-100 text-amber-700" :
            "bg-rose-100 text-rose-700"
          }`}>
            {delta > 0 ? "+" : ""}{delta.toFixed(0)}%
          </div>
        </div>
      </div>
      
      {/* Sparkline chart */}
      <div className="relative">
        <svg width={chartWidth} height={chartHeight} className="overflow-visible">
          {/* Background gradient (subtle) */}
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, "-")}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f1f5f9" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f1f5f9" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Area under curve */}
          <polygon
            points={`${padding.left},${padding.top + plotHeight} ${points} ${padding.left + plotWidth},${padding.top + plotHeight}`}
            fill={`url(#grad-${title.replace(/\s+/g, "-")})`}
          />
          
          {/* Baseline median line (horizontal reference) */}
          <line
            x1={padding.left}
            y1={baselineY}
            x2={padding.left + plotWidth}
            y2={baselineY}
            stroke="#64748b"
            strokeWidth="1.5"
            strokeDasharray="4 2"
            opacity="0.6"
          />
          
          {/* Trend line */}
          <polyline
            points={points}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          
          {/* Current value marker (circle) */}
          <circle
            cx={currentX}
            cy={currentY}
            r="4"
            fill="#1e293b"
            stroke="white"
            strokeWidth="2"
          />
          
          {/* Baseline label */}
          <text
            x={padding.left + plotWidth - 2}
            y={baselineY - 4}
            textAnchor="end"
            className="text-[9px] fill-slate-500 font-medium"
          >
            med {unit === "$/ton" ? formatMoney(baseline.p50) : formatNumber(baseline.p50, 1)}
          </text>
        </svg>
      </div>
      
      {/* Context footer */}
      <div className={`${compact ? "mt-1" : "mt-2"} flex items-center justify-between ${compact ? "text-[10px]" : "text-[11px]"} text-slate-500`}>
        <span className="tabular-nums">
          vs baseline: {unit === "$/ton" ? formatMoney(baseline.p50) : formatNumber(baseline.p50, 1)}
        </span>
        <span className="tabular-nums">
          range: {unit === "$/ton" ? formatMoney(baseline.min) : formatNumber(baseline.min, 1)} - {unit === "$/ton" ? formatMoney(baseline.max) : formatNumber(baseline.max, 1)}
        </span>
      </div>
    </div>
  );
}

function StackRow({
  title,
  rows,
  total,
  compact = false,
}: {
  title: string;
  rows: Array<{ label: string; value: number; color: string }>;
  total: number;
  compact?: boolean;
}) {
  const safeTotal = total > 0 ? total : rows.reduce((s, r) => s + (r.value || 0), 0) || 1;
  return (
    <div className={`rounded-lg border border-slate-200 bg-white ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-center justify-between">
        <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-900`}>{title}</div>
        <div className={`${compact ? "text-[10px]" : "text-xs"} font-semibold text-slate-700 tabular-nums`}>{formatMoney(total)}</div>
      </div>
      <div className={`${compact ? "mt-1" : "mt-2"} ${compact ? "h-2" : "h-3"} rounded-full bg-slate-100 overflow-hidden flex`}>
        {rows.map((r) => {
          const w = clamp((r.value / safeTotal) * 100, 0, 100);
          if (w <= 0) return null;
          return <div key={r.label} className={`${r.color}`} style={{ width: `${w}%` }} title={`${r.label}: ${formatMoney(r.value)}`} />;
        })}
      </div>
      <div className={`${compact ? "mt-2" : "mt-3"} grid grid-cols-2 ${compact ? "gap-x-2 gap-y-1.5" : "gap-x-4 gap-y-2"} ${compact ? "text-[10px]" : "text-xs"}`}>
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full ${r.color}`} />
              <span className="text-slate-600 truncate">{r.label}</span>
            </div>
            <span className="font-semibold text-slate-800 tabular-nums">{formatMoney(r.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MixComparison({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: Array<{ label: string; pct: number; baselinePct: number | null; color: string }>;
  compact?: boolean;
}) {
  return (
    <div className={`rounded border border-slate-200 bg-white ${compact ? "p-1" : "p-1.5"}`}>
      <div className={`${compact ? "text-[11px]" : "text-xs"} font-semibold text-slate-900`}>{title}</div>
      <div className={`${compact ? "mt-1" : "mt-1.5"} ${compact ? "space-y-1" : "space-y-1.5"}`}>
        {items.map((it) => {
          const delta = it.baselinePct !== null ? it.pct - it.baselinePct : null;
          const badge =
            delta === null
              ? null
              : Math.abs(delta) < 4
                ? "bg-emerald-100 text-emerald-700"
                : delta > 0
                  ? "bg-amber-100 text-amber-700"
                  : "bg-blue-100 text-blue-700";
          return (
            <div key={it.label}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`${compact ? "w-2 h-2" : "w-2.5 h-2.5"} rounded-full ${it.color}`} />
                  <span className={`${compact ? "text-xs" : "text-sm"} font-semibold text-slate-800`}>{it.label}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`${compact ? "text-xs" : "text-sm"} font-bold text-slate-900 tabular-nums`}>{it.pct.toFixed(1)}%</span>
                  {delta !== null && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${badge}`}>
                      {delta > 0 ? "+" : ""}
                      {delta.toFixed(0)}%
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-1 relative h-2.5 rounded-full bg-slate-100 overflow-hidden">
                <div className={`h-full ${it.color} opacity-80`} style={{ width: `${clamp(it.pct, 0, 100)}%` }} />
                {it.baselinePct !== null && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-600/50" style={{ left: `${clamp(it.baselinePct, 0, 100)}%` }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DenseTable({
  title,
  subtitle,
  columns,
  rows,
  defaultRows = 8,
  compact = false,
}: {
  title: string;
  subtitle: string;
  columns: Array<{ key: string; label: string; align: "left" | "right" }>;
  rows: Array<Record<string, string>>;
  defaultRows?: number;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? rows : rows.slice(0, defaultRows);

  return (
    <div className={`rounded border border-slate-200 bg-white ${compact ? "p-1.5" : "p-2"}`}>
      <div className={`flex items-start justify-between ${compact ? "gap-1" : "gap-1.5"}`}>
        <div>
          <div className={`${compact ? "text-[11px]" : "text-xs"} font-semibold text-slate-900`}>{title}</div>
          <div className={`${compact ? "text-[9px]" : "text-[10px]"} text-slate-500 mt-0.5`}>{subtitle}</div>
        </div>
        {rows.length > defaultRows && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className={`${compact ? "text-[9px] px-1 py-0.5" : "text-[10px] px-1.5 py-0.5"} font-semibold text-slate-700 hover:text-slate-900 border border-slate-200 bg-white rounded`}
          >
            {expanded ? "Show top" : "Show all"} ({rows.length})
          </button>
        )}
      </div>
      <div className={`${compact ? "mt-1" : "mt-1.5"} overflow-auto`}>
        <table className="w-full">
          <thead>
            <tr className={`${compact ? "text-[9px]" : "text-[10px]"} uppercase tracking-wide text-slate-500 border-b border-slate-100`}>
              {columns.map((c) => (
                <th key={c.key} className={`${compact ? "py-1" : "py-1.5"} ${c.align === "right" ? "text-right" : "text-left"}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {shown.map((r, idx) => (
              <tr key={idx} className={`hover:bg-slate-50/60 ${compact ? "h-7" : "h-8"}`}>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`${compact ? "py-1 text-[11px]" : "py-1.5 text-xs"} ${c.align === "right" ? "text-right tabular-nums text-slate-700 font-semibold" : "text-left text-slate-900 font-medium"}`}
                  >
                    {r[c.key] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td className="py-8 text-center text-slate-500" colSpan={columns.length}>
                  No data yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CoverageRow({ label, value, meta, compact = false }: { label: string; value: number; meta: string; compact?: boolean }) {
  const pct = clamp(value * 100, 0, 100);
  const tone = pct >= 95 ? "bg-emerald-500" : pct >= 80 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div>
      <div className={`flex items-center justify-between ${compact ? "text-[9px]" : "text-[10px]"}`}>
        <span className="font-semibold text-slate-700">{label}</span>
        <span className="text-slate-500">{meta}</span>
      </div>
      <div className={`${compact ? "mt-0.5" : "mt-0.5"} ${compact ? "h-1.5" : "h-2"} rounded-full bg-slate-100 overflow-hidden`}>
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className={`${compact ? "mt-0.5" : "mt-0.5"} ${compact ? "text-[9px]" : "text-[10px]"} text-slate-500 tabular-nums`}>{pct.toFixed(0)}%</div>
    </div>
  );
}

function MiniStat({ label, value, compact = false }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className={`rounded border border-slate-100 bg-white ${compact ? "px-1 py-0.5" : "px-1.5 py-1"}`}>
      <div className={`${compact ? "text-[9px]" : "text-[10px]"} uppercase tracking-wide text-slate-500 font-semibold`}>{label}</div>
      <div className={`${compact ? "text-[11px]" : "text-xs"} font-bold text-slate-900 tabular-nums ${compact ? "mt-0" : "mt-0.5"}`}>{value}</div>
    </div>
  );
}

type AlertItem = {
  id: string;
  severity: "crit" | "warn" | "info" | "ok";
  title: string;
  detail: string;
  value: string;
};

function buildAlerts(args: {
  baseline: Baseline;
  costPerTon: number;
  hoursPerTon: number;
  materialPct: number;
  laborPct: number;
  position: { cost: number; hours: number };
  coverage: { weight: number; labor: number; rates: number; coatingPricing: number };
  concentration: number;
  blendedLaborRate: number;
  materialPerLb: number;
  tons: number;
  activeLines: number;
  coatingSpecifiedNoCost: number;
  missingLabor: number;
  missingRates: number;
  missingWeight: number;
  daysToBid: number | null;
  filesCount: number;
  miscPct: number;
  coatedSurfaceArea: number;
  coatingCostPerSF: number;
  plateWeightPct: number;
}) {
  const items: AlertItem[] = [];

  const { baseline, costPerTon, hoursPerTon, materialPct, laborPct, position } = args;
  const cptDelta = baseline.costPerTon.p50 > 0 ? ((costPerTon - baseline.costPerTon.p50) / baseline.costPerTon.p50) * 100 : 0;
  const hptDelta = baseline.hoursPerTon.p50 > 0 ? ((hoursPerTon - baseline.hoursPerTon.p50) / baseline.hoursPerTon.p50) * 100 : 0;

  items.push({
    id: "pos-cpt",
    severity: position.cost < 20 || position.cost > 80 ? "warn" : "ok",
    title: "Cost/Ton percentile",
    detail: "Where you sit in historical distribution",
    value: `p${position.cost.toFixed(0)}`,
  });
  items.push({
    id: "pos-hpt",
    severity: position.hours < 20 || position.hours > 80 ? "warn" : "ok",
    title: "Hours/Ton percentile",
    detail: "Labor intensity vs similar work",
    value: `p${position.hours.toFixed(0)}`,
  });

  items.push({
    id: "delta-cpt",
    severity: Math.abs(cptDelta) >= 15 ? (cptDelta > 0 ? "warn" : "warn") : "info",
    title: "Cost/Ton vs median",
    detail: "Median baseline comparison (not a target)",
    value: `${cptDelta > 0 ? "+" : ""}${cptDelta.toFixed(0)}%`,
  });
  items.push({
    id: "delta-hpt",
    severity: Math.abs(hptDelta) >= 20 ? "warn" : "info",
    title: "Hours/Ton vs median",
    detail: "Labor intensity deviation",
    value: `${hptDelta > 0 ? "+" : ""}${hptDelta.toFixed(0)}%`,
  });

  const matMixDelta = args.baseline.mix.materialPct ? materialPct - args.baseline.mix.materialPct : 0;
  const laborMixDelta = args.baseline.mix.laborPct ? laborPct - args.baseline.mix.laborPct : 0;
  items.push({
    id: "mix-mat",
    severity: Math.abs(matMixDelta) >= 10 ? "info" : "ok",
    title: "Material mix",
    detail: "Composition vs typical",
    value: `${matMixDelta > 0 ? "+" : ""}${matMixDelta.toFixed(0)}%`,
  });
  items.push({
    id: "mix-labor",
    severity: Math.abs(laborMixDelta) >= 8 ? "info" : "ok",
    title: "Labor mix",
    detail: "Labor share vs typical",
    value: `${laborMixDelta > 0 ? "+" : ""}${laborMixDelta.toFixed(0)}%`,
  });

  items.push({
    id: "conc",
    severity: args.concentration >= 65 ? "warn" : args.concentration >= 55 ? "info" : "ok",
    title: "Category concentration",
    detail: "Top 3 categories share of total",
    value: `${args.concentration.toFixed(0)}%`,
  });

  items.push({
    id: "blend",
    severity: args.blendedLaborRate > 0 ? "info" : "warn",
    title: "Blended labor $/hr",
    detail: "Implied from line labor costs ÷ hours",
    value: args.blendedLaborRate > 0 ? formatMoney(args.blendedLaborRate) : "—",
  });

  items.push({
    id: "steel",
    severity: args.materialPerLb > 0 ? "info" : "warn",
    title: "Material $/lb",
    detail: "Implied steel pricing",
    value: args.materialPerLb > 0 ? `$${args.materialPerLb.toFixed(2)}` : "—",
  });

  const cov = (args.coverage.weight + args.coverage.labor + args.coverage.rates + args.coverage.coatingPricing) / 4;
  items.push({
    id: "coverage",
    severity: cov >= 0.95 ? "ok" : cov >= 0.8 ? "info" : "warn",
    title: "Data coverage",
    detail: "Missing weights/labor/rates/coating pricing increases error",
    value: `${(cov * 100).toFixed(0)}%`,
  });

  if (args.missingWeight > 0) {
    items.push({
      id: "gap-weight",
      severity: args.missingWeight >= 5 ? "warn" : "info",
      title: "Missing weights",
      detail: "Lines without computed weight distort $/ton",
      value: `${args.missingWeight}`,
    });
  }
  if (args.missingLabor > 0) {
    items.push({
      id: "gap-labor",
      severity: args.missingLabor >= 5 ? "warn" : "info",
      title: "Missing labor",
      detail: "Lines without labor hours distort hrs/ton",
      value: `${args.missingLabor}`,
    });
  }
  if (args.missingRates > 0) {
    items.push({
      id: "gap-rates",
      severity: "info",
      title: "Missing rates",
      detail: "Lines without rates may be priced from defaults/zeros",
      value: `${args.missingRates}`,
    });
  }
  if (args.coatingSpecifiedNoCost > 0) {
    items.push({
      id: "gap-coat",
      severity: "warn",
      title: "Unpriced coating",
      detail: "Coating system specified with $0 coating cost",
      value: `${args.coatingSpecifiedNoCost}`,
    });
  }

  // Schedule pressure + docs
  if (args.daysToBid !== null) {
    items.push({
      id: "sched",
      severity: args.daysToBid < 0 ? "crit" : args.daysToBid <= 3 ? "warn" : args.daysToBid <= 7 ? "info" : "ok",
      title: "Schedule pressure",
      detail: args.daysToBid < 0 ? "Bid due date is past due" : "Days remaining until bid due",
      value: `${args.daysToBid}d`,
    });
  } else {
    items.push({
      id: "sched-missing",
      severity: "info",
      title: "No bid due date",
      detail: "Add bid due date to enable schedule guardrails",
      value: "—",
    });
  }

  items.push({
    id: "docs",
    severity: args.filesCount === 0 ? "warn" : args.filesCount < 3 ? "info" : "ok",
    title: "Docs coverage",
    detail: "Files uploaded (drawings/specs/RFIs)",
    value: `${args.filesCount}`,
  });

  // Mix & geometry signals
  items.push({
    id: "misc",
    severity: args.miscPct >= 40 ? "info" : "ok",
    title: "Misc mix",
    detail: "Misc lines share (often drives labor volatility)",
    value: `${args.miscPct.toFixed(0)}%`,
  });

  items.push({
    id: "plate",
    severity: args.plateWeightPct >= 35 ? "info" : "ok",
    title: "Plate weight share",
    detail: "Plates often shift cutting/drilling load",
    value: `${args.plateWeightPct.toFixed(0)}%`,
  });

  items.push({
    id: "coat-area",
    severity: args.coatedSurfaceArea > 0 && args.coatingCostPerSF === 0 ? "warn" : "info",
    title: "Coating intensity",
    detail: "Coating cost per coated SF (implied)",
    value: args.coatingCostPerSF > 0 ? `$${args.coatingCostPerSF.toFixed(2)}/sf` : "—",
  });

  // Cross-metric validation: Cost/Labor divergence
  const costDelta = args.baseline.costPerTon.p50 > 0 ? ((args.costPerTon - args.baseline.costPerTon.p50) / args.baseline.costPerTon.p50) * 100 : 0;
  const hoursDelta = args.baseline.hoursPerTon.p50 > 0 ? ((args.hoursPerTon - args.baseline.hoursPerTon.p50) / args.baseline.hoursPerTon.p50) * 100 : 0;
  const divergence = Math.abs(costDelta - hoursDelta);
  if (divergence > 20) {
    items.push({
      id: "cost-labor-divergence",
      severity: divergence > 30 ? "warn" : "info",
      title: "Cost/Labor divergence",
      detail: "Cost/Ton and Hours/Ton moving in opposite directions",
      value: `${divergence.toFixed(0)}% gap`,
    });
  }

  // "Not enough signal" nudges
  if (args.activeLines < 10) {
    items.push({
      id: "thin",
      severity: "info",
      title: "Thin estimate",
      detail: "Signals stabilize after ~20–30 lines",
      value: `${args.activeLines} lines`,
    });
  }
  if (args.tons < 25) {
    items.push({
      id: "small",
      severity: "info",
      title: "Small tonnage",
      detail: "Small jobs tend to run higher variance",
      value: `${formatNumber(args.tons, 1)}t`,
    });
  }

  const concentrationPct = args.concentration;
  return { items, concentrationPct };
}


