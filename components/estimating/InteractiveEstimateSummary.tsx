"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { Card } from "@/components/ui/Card";
import { EstimatingLine } from "./EstimatingGrid";
import { Slider } from "@/components/ui/Slider";
import { Info, TrendingUp, TrendingDown, RotateCcw, Save, History, ExternalLink } from "lucide-react";
import Button from "@/components/ui/Button";
import Link from "next/link";
import { useAuth } from "@/lib/hooks/useAuth";
import { logActivity } from "@/lib/utils/activityLogger";
import { createDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  loadCompanySettings,
  calculateTotalCostWithMarkup,
  type CompanySettings,
} from "@/lib/utils/settingsLoader";
import {
  calculateConsumables,
  extractLaborHours,
  estimateEquipmentHours,
  determineJobType,
} from "@/lib/utils/consumablesCalculator";

interface InteractiveEstimateSummaryProps {
  lines: EstimatingLine[];
  companyId: string;
  projectId: string;
  projectName?: string;
  onTotalsChange?: (totals: CalculatedTotals) => void;
}

interface AdjustableParameters {
  // Labor efficiency multipliers (1.0 = baseline, >1.0 = slower, <1.0 = faster)
  laborEfficiency: {
    weld: number;
    fit: number;
    cut: number;
    drillPunch: number;
    cope: number;
    paint: number;
    handleMove: number;
    prepClean: number;
    unload: number;
    loadShip: number;
    processPlate: number;
  };
  // Rate adjustments (1.0 = baseline, >1.0 = higher rate, <1.0 = lower rate)
  laborRateMultiplier: number;
  materialRateMultiplier: number;
  coatingRateMultiplier: number;
  // Markup adjustments
  overheadPercentage: number;
  profitPercentage: number;
  materialWastePercentage: number;
  laborWastePercentage: number;
}

interface CalculatedTotals {
  weight: number;
  surfaceArea: number;
  laborHours: number;
  materialCost: number;
  laborCost: number;
  coatingCost: number;
  hardwareCost: number;
  consumables: number;  // Consumables cost (labor + equipment driven)
  directCost: number;
  materialWaste: number;
  laborWaste: number;
  overhead: number;
  profit: number;
  totalWithMarkup: number;
  costPerTon: number;
  hoursPerTon: number;
  costPerPound: number;
  hoursPerPound: number;
}

interface AdjustmentLog {
  id: string;
  timestamp: Date;
  userId: string;
  userName: string;
  parameter: string;
  oldValue: number;
  newValue: number;
  reason?: string;
  impact: {
    costChange: number;
    hoursChange: number;
    costPerTonChange: number;
  };
}

const DEFAULT_PARAMETERS: AdjustableParameters = {
  laborEfficiency: {
    weld: 1.0,
    fit: 1.0,
    cut: 1.0,
    drillPunch: 1.0,
    cope: 1.0,
    paint: 1.0,
    handleMove: 1.0,
    prepClean: 1.0,
    unload: 1.0,
    loadShip: 1.0,
    processPlate: 1.0,
  },
  laborRateMultiplier: 1.0,
  materialRateMultiplier: 1.0,
  coatingRateMultiplier: 1.0,
  overheadPercentage: 10.0,
  profitPercentage: 10.0,
  materialWastePercentage: 5.0,
  laborWastePercentage: 5.0,
};

export default function InteractiveEstimateSummary({
  lines,
  companyId,
  projectId,
  projectName,
  onTotalsChange,
}: InteractiveEstimateSummaryProps) {
  const { user } = useAuth();
  const [parameters, setParameters] = useState<AdjustableParameters>(DEFAULT_PARAMETERS);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [adjustmentHistory, setAdjustmentHistory] = useState<AdjustmentLog[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Load company settings for baseline rates
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) return;
    loadCompanySettings(companyId).then(setCompanySettings);
  }, [companyId]);

  // Calculate totals with current parameters
  const totals = useMemo((): CalculatedTotals => {
    const activeLines = lines.filter((line) => line.status !== "Void");
    
    let weight = 0;
    let surfaceArea = 0;
    let laborHours = 0;
    let materialCost = 0;
    let laborCost = 0;
    let coatingCost = 0;
    let hardwareCost = 0;

    activeLines.forEach((line) => {
      // Weight
      const lineWeight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);
      weight += lineWeight;

      // Surface Area
      const lineSurfaceArea = line.materialType === "Material"
        ? (line.totalSurfaceArea || 0)
        : (line.plateSurfaceArea || 0);
      surfaceArea += lineSurfaceArea;

      // Material Cost (with multiplier)
      const baseMaterialCost = line.materialCost || 0;
      materialCost += baseMaterialCost * parameters.materialRateMultiplier;

      // Coating Cost (with multiplier)
      const baseCoatingCost = line.coatingCost || 0;
      coatingCost += baseCoatingCost * parameters.coatingRateMultiplier;

      // Hardware Cost
      hardwareCost += line.hardwareCost || 0;

      // Labor Hours (with efficiency multipliers)
      const baseLaborHours = line.totalLabor || 0;
      
      // Apply efficiency multipliers to labor breakdown if available
      let adjustedLaborHours = 0;
      let hasBreakdown = false;
      const laborFields = [
        { field: 'laborUnload', multiplier: parameters.laborEfficiency.unload },
        { field: 'laborCut', multiplier: parameters.laborEfficiency.cut },
        { field: 'laborCope', multiplier: parameters.laborEfficiency.cope },
        { field: 'laborProcessPlate', multiplier: parameters.laborEfficiency.processPlate },
        { field: 'laborDrillPunch', multiplier: parameters.laborEfficiency.drillPunch },
        { field: 'laborFit', multiplier: parameters.laborEfficiency.fit },
        { field: 'laborWeld', multiplier: parameters.laborEfficiency.weld },
        { field: 'laborPrepClean', multiplier: parameters.laborEfficiency.prepClean },
        { field: 'laborPaint', multiplier: parameters.laborEfficiency.paint },
        { field: 'laborHandleMove', multiplier: parameters.laborEfficiency.handleMove },
        { field: 'laborLoadShip', multiplier: parameters.laborEfficiency.loadShip },
      ];
      
      laborFields.forEach(({ field, multiplier }) => {
        const hours = (line as any)[field] || 0;
        if (hours > 0) hasBreakdown = true;
        adjustedLaborHours += hours * multiplier;
      });

      // If no breakdown available, use totalLabor with average efficiency
      if (!hasBreakdown && baseLaborHours > 0) {
        const avgEfficiency = Object.values(parameters.laborEfficiency).reduce((a, b) => a + b, 0) / Object.values(parameters.laborEfficiency).length;
        adjustedLaborHours = baseLaborHours * avgEfficiency;
      }

      laborHours += Math.max(0, adjustedLaborHours); // Prevent negative hours

      // Labor Cost (with rate multiplier)
      // Calculate cost based on adjusted hours and rate multiplier
      const laborRate = line.laborRate || 0;
      laborCost += adjustedLaborHours * laborRate * parameters.laborRateMultiplier;
    });

    // Calculate consumables (separate from labor cost)
    const laborHoursForConsumables = extractLaborHours(
      activeLines.map(line => ({
        weld: line.laborWeld || 0,
        fit: line.laborFit || 0,
        cut: line.laborCut || 0,
        processPlate: line.laborProcessPlate || 0,
        cope: line.laborCope || 0,
        drillPunch: line.laborDrillPunch || 0,
        handleMove: line.laborHandleMove || 0,
        loadShip: line.laborLoadShip || 0,
        prepClean: line.laborPrepClean || 0,
        paint: line.laborPaint || 0,
        unload: line.laborUnload || 0,
        allowance: 0,
        totalLabor: line.totalLabor || 0,
      }))
    );
    const equipmentHoursEstimate = estimateEquipmentHours(weight);
    const consumablesResult = calculateConsumables(
      laborHoursForConsumables,
      equipmentHoursEstimate,
      companySettings?.consumablesSettings,
      'standard'
    );
    const consumables = consumablesResult.totalConsumables;

    // Direct cost (now includes consumables)
    const directCost = materialCost + laborCost + coatingCost + hardwareCost + consumables;

    // Waste
    const materialWaste = directCost * (parameters.materialWastePercentage / 100);
    const laborWaste = laborCost * (parameters.laborWastePercentage / 100);

    // Overhead and Profit
    const costBeforeOverhead = directCost + materialWaste + laborWaste;
    const overhead = costBeforeOverhead * (parameters.overheadPercentage / 100);
    const costBeforeProfit = costBeforeOverhead + overhead;
    const profit = costBeforeProfit * (parameters.profitPercentage / 100);

    // Total with markup
    const totalWithMarkup = costBeforeProfit + profit;

    // Per-unit metrics
    const tons = weight / 2000;
    const costPerTon = tons > 0 ? totalWithMarkup / tons : 0;
    const hoursPerTon = tons > 0 ? laborHours / tons : 0;
    const costPerPound = weight > 0 ? totalWithMarkup / weight : 0;
    const hoursPerPound = weight > 0 ? laborHours / weight : 0;

    return {
      weight,
      surfaceArea,
      laborHours,
      materialCost,
      laborCost,
      coatingCost,
      hardwareCost,
      consumables,
      directCost,
      materialWaste,
      laborWaste,
      overhead,
      profit,
      totalWithMarkup,
      costPerTon,
      hoursPerTon,
      costPerPound,
      hoursPerPound,
    };
  }, [lines, parameters, companySettings]);

  // Notify parent of totals change
  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange(totals);
    }
  }, [totals, onTotalsChange]);

  // Log adjustment
  const logAdjustment = useCallback(async (
    parameter: string,
    oldValue: number,
    newValue: number,
    reason?: string
  ) => {
    if (!user || !isFirebaseConfigured()) return;

    const impact = {
      costChange: totals.totalWithMarkup - (totals.totalWithMarkup / (newValue / oldValue)),
      hoursChange: totals.laborHours - (totals.laborHours / (newValue / oldValue)),
      costPerTonChange: totals.costPerTon - (totals.costPerTon / (newValue / oldValue)),
    };

    const logEntry: AdjustmentLog = {
      id: `adj-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      userId: user.uid,
      userName: user.displayName || user.email || "Unknown",
      parameter,
      oldValue,
      newValue,
      reason,
      impact,
    };

    setAdjustmentHistory((prev) => [logEntry, ...prev.slice(0, 49)]); // Keep last 50

    // Save to Firestore
    try {
      const logPath = getProjectPath(companyId, projectId, "estimateAdjustments");
      await createDocument(logPath, {
        ...logEntry,
        timestamp: logEntry.timestamp.toISOString(),
      });
    } catch (error) {
      console.error("Failed to log adjustment:", error);
    }
  }, [user, companyId, projectId, totals]);

  // Update parameter with logging
  const updateParameter = useCallback((
    path: string,
    value: number,
    reason?: string
  ) => {
    setParameters((prev) => {
      const keys = path.split(".");
      const oldValue = keys.reduce((obj: any, key) => obj?.[key], prev) as number;
      
      const newParams = { ...prev };
      let current: any = newParams;
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;

      // Log the adjustment
      logAdjustment(path, oldValue, value, reason);

      return newParams;
    });
  }, [logAdjustment]);

  // Reset all parameters
  const resetParameters = useCallback(() => {
    if (confirm("Reset all adjustments to defaults? This cannot be undone.")) {
      setParameters(DEFAULT_PARAMETERS);
      logAdjustment("all", 0, 0, "Reset all parameters to defaults");
    }
  }, [logAdjustment]);

  // Save current state
  const saveState = useCallback(async () => {
    if (!isFirebaseConfigured() || !companyId || !projectId) return;
    
    setIsSaving(true);
    try {
      const statePath = getProjectPath(companyId, projectId);
      await createDocument(`${statePath}/estimateState`, {
        parameters,
        savedAt: new Date().toISOString(),
        savedBy: user?.uid || "unknown",
      });
      alert("Estimate state saved successfully!");
    } catch (error) {
      console.error("Failed to save state:", error);
      alert("Failed to save estimate state");
    } finally {
      setIsSaving(false);
    }
  }, [parameters, companyId, projectId, user]);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 1) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Check for allowance lines
  const allowanceLines = useMemo(() => {
    return lines.filter(
      (line) => 
        line.status !== "Void" && 
        (line.category === "Allowances" || line.subCategory === "Bid Coach" || line.itemDescription?.includes("Bid Coach"))
    );
  }, [lines]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-gray-900 tracking-normal">Interactive Estimate Summary</h2>
          <p className="text-sm text-slate-500 mt-1">
            Adjust parameters in real-time to see impact on totals and metrics
            {allowanceLines.length > 0 && (
              <span className="ml-2 text-blue-600 font-medium">
                • {allowanceLines.length} allowance{allowanceLines.length !== 1 ? "s" : ""} applied
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="w-4 h-4" />
            History ({adjustmentHistory.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={resetParameters}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={saveState}
            disabled={isSaving}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save State"}
          </Button>
        </div>
      </div>

      {/* KPI Cards - Real-time totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1">
              Total Project Cost
            </div>
            <div className="text-3xl font-bold text-blue-900 tabular-nums">
              {formatMoney(totals.totalWithMarkup)}
            </div>
            <div className="text-sm text-blue-700 mt-2">
              Including overhead & profit
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600 mb-1">
              Cost per Ton
            </div>
            <div className="text-3xl font-bold text-emerald-900 tabular-nums">
              {formatMoney(totals.costPerTon)}
            </div>
            <div className="text-sm text-emerald-700 mt-2">
              {formatNumber(totals.weight / 2000, 1)} tons total
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">
              Hours per Ton
            </div>
            <div className="text-3xl font-bold text-amber-900 tabular-nums">
              {formatNumber(totals.hoursPerTon, 1)}
            </div>
            <div className="text-sm text-amber-700 mt-2">
              {formatNumber(totals.laborHours, 0)} total hours
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-purple-600 mb-1">
              Profit Margin
            </div>
            <div className="text-3xl font-bold text-purple-900 tabular-nums">
              {totals.totalWithMarkup > 0 
                ? formatNumber((totals.profit / totals.totalWithMarkup) * 100, 1)
                : "0.0"}%
            </div>
            <div className="text-sm text-purple-700 mt-2">
              {formatMoney(totals.profit)} profit
            </div>
          </div>
        </Card>
      </div>

      {/* Adjustable Parameters */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Labor Efficiency Multipliers */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900 tracking-normal">Labor Efficiency</h3>
              <div className="group relative">
                <Info className="w-4 h-4 text-slate-400 cursor-help" />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block w-64 bg-slate-900 text-white text-xs rounded-lg p-2 z-10 pointer-events-none">
                  Adjust efficiency multipliers for each operation. &lt;1.0 = faster, &gt;1.0 = slower.
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1">
                    <div className="w-2 h-2 bg-slate-900 rotate-45" />
                  </div>
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Adjust shop efficiency by operation type (e.g., lower weld efficiency for full-pen welds)
            </p>
            <div className="space-y-4">
              {Object.entries(parameters.laborEfficiency).map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </label>
                    <span className="text-sm font-semibold text-slate-900 tabular-nums">
                      {formatNumber(value, 2)}x
                    </span>
                  </div>
                  <Slider
                    value={[value]}
                    onValueChange={([newValue]) => updateParameter(`laborEfficiency.${key}`, newValue, `Adjusted ${key} efficiency`)}
                    min={0.5}
                    max={2.0}
                    step={0.05}
                    className="w-full"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>50% (faster)</span>
                    <span>100% (baseline)</span>
                    <span>200% (slower)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Rate Multipliers & Markup */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-lg font-bold text-gray-900 tracking-normal">Rates & Markup</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">
              Adjust labor/material rates and markup percentages
            </p>
            <div className="space-y-6">
              {/* Rate Multipliers */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-gray-900 tracking-normal">Rate Multipliers</h4>
                {[
                  { key: "laborRateMultiplier", label: "Labor Rate", min: 0.5, max: 2.0 },
                  { key: "materialRateMultiplier", label: "Material Rate", min: 0.5, max: 2.0 },
                  { key: "coatingRateMultiplier", label: "Coating Rate", min: 0.5, max: 2.0 },
                ].map(({ key, label, min, max }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">{label}</label>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatNumber((parameters as any)[key] * 100, 0)}%
                      </span>
                    </div>
                    <Slider
                      value={[(parameters as any)[key]]}
                      onValueChange={([newValue]) => updateParameter(key, newValue, `Adjusted ${label.toLowerCase()}`)}
                      min={min}
                      max={max}
                      step={0.01}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>

              {/* Markup Percentages */}
              <div className="space-y-4 border-t border-slate-200 pt-4">
                <h4 className="text-sm font-bold text-gray-900 tracking-normal">Markup Percentages</h4>
                {[
                  { key: "overheadPercentage", label: "Overhead", min: 0, max: 30 },
                  { key: "profitPercentage", label: "Profit", min: 0, max: 30 },
                  { key: "materialWastePercentage", label: "Material Waste", min: 0, max: 20 },
                  { key: "laborWastePercentage", label: "Labor Waste", min: 0, max: 20 },
                ].map(({ key, label, min, max }) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700">{label}</label>
                      <span className="text-sm font-semibold text-slate-900 tabular-nums">
                        {formatNumber((parameters as any)[key], 1)}%
                      </span>
                    </div>
                    <Slider
                      value={[(parameters as any)[key]]}
                      onValueChange={([newValue]) => updateParameter(key, newValue, `Adjusted ${label.toLowerCase()}`)}
                      min={min}
                      max={max}
                      step={0.1}
                      className="w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Allowances & Adjustments */}
      {(() => {
        // Always show the section, even if empty, so users know where allowances appear
        if (allowanceLines.length === 0) {
          return (
            <Card className="border-slate-200 bg-slate-50/30">
              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-bold text-gray-900 tracking-normal">Allowances & Adjustments</h3>
                  <span className="text-xs text-slate-500">No allowances yet</span>
                </div>
                <p className="text-sm text-slate-500">
                  Allowance lines (including Bid Coach adjustments) will appear here when added.
                </p>
              </div>
            </Card>
          );
        }

        return (
          <Card className="border-blue-200 bg-blue-50/30">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 tracking-normal">Allowances & Adjustments</h3>
                <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-1 rounded">
                  {allowanceLines.length} {allowanceLines.length === 1 ? "line" : "lines"}
                </span>
              </div>
              <div className="space-y-3">
                {allowanceLines.map((line) => {
                  const isBidCoach = line.subCategory === "Bid Coach";
                  const lineLabor = line.totalLabor || 0;
                  const lineCost = line.totalCost || 0;
                  const laborRate = line.laborRate || 0;
                  
                  return (
                    <div
                      key={line.lineId || line.id}
                      className={`bg-white rounded-lg border p-4 ${
                        isBidCoach ? "border-blue-300 shadow-sm" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="text-sm font-bold text-gray-900 tracking-normal">
                              {line.itemDescription || "Allowance"}
                            </h4>
                            {isBidCoach && (
                              <span className="text-[10px] font-medium text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">
                                Bid Coach
                              </span>
                            )}
                          </div>
                          {line.notes && (
                            <p className="text-xs text-slate-600 mt-1 line-clamp-2">{line.notes}</p>
                          )}
                          <Link
                            href={`/projects/${projectId}/estimating`}
                            className="mt-2 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View in Estimating Grid
                          </Link>
                          {isBidCoach && (
                            <div className="mt-2 text-[11px] text-slate-500 bg-purple-50 border border-purple-200 rounded px-2 py-1">
                              <span className="font-medium text-purple-700">Note:</span> This allowance appears as a single "Allowance" category on all charts. If unused when the project is awarded, it becomes unrealized profit.
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-sm font-semibold text-slate-900 tabular-nums">
                            {formatMoney(lineCost)}
                          </div>
                          <div className="text-xs text-slate-600 mt-0.5">
                            {formatNumber(lineLabor, 1)} hrs
                          </div>
                          {laborRate > 0 && (
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              @ {formatMoney(laborRate)}/hr
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Total Allowances:</span>
                  <div className="text-right">
                    <div className="font-semibold text-slate-900 tabular-nums">
                      {formatMoney(
                        allowanceLines.reduce((sum, line) => sum + (line.totalCost || 0), 0)
                      )}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      {formatNumber(
                        allowanceLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
                        1
                      )}{" "}
                      hrs
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Cost Breakdown */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-bold text-gray-900 tracking-normal mb-4">Cost Breakdown</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Direct Cost</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.directCost)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Material Waste</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.materialWaste)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Labor Waste</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.laborWaste)}
              </div>
            </div>
            {totals.consumables > 0 && (
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                <div className="text-xs text-orange-700 mb-1">Consumables</div>
                <div className="text-xl font-semibold text-orange-900 tabular-nums">
                  {formatMoney(totals.consumables)}
                </div>
              </div>
            )}
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Overhead</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.overhead)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Profit</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.profit)}
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-1">Total w/ Markup</div>
              <div className="text-xl font-semibold text-slate-900 tabular-nums">
                {formatMoney(totals.totalWithMarkup)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Adjustment History */}
      {showHistory && adjustmentHistory.length > 0 && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-bold text-gray-900 tracking-normal mb-4">Adjustment History</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {adjustmentHistory.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">
                      {log.userName} adjusted {log.parameter}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {log.timestamp.toLocaleString()}
                      {log.reason && ` • ${log.reason}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-slate-900">
                      {formatNumber(log.oldValue, 2)} → {formatNumber(log.newValue, 2)}
                    </div>
                    <div className="text-xs text-slate-500">
                      {log.impact.costChange >= 0 ? "+" : ""}
                      {formatMoney(log.impact.costChange)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

