"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { TrendingUp, TrendingDown, AlertTriangle, Lightbulb, Target, Zap, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";
import { Slider } from "@/components/ui/Slider";

interface BidStrategyPanelProps {
  lines: EstimatingLine[];
  project: {
    projectType?: string;
    estimatedValue?: string;
    bidDueDate?: string;
  } | null;
  estimatingStats: {
    totalCost: number;
    totalLabor: number;
    totalWeight: number;
  };
  companyId: string;
  projectId: string;
  onAdjustment?: (adjustments: StrategyAdjustments) => void;
}

interface StrategyAdjustments {
  laborEfficiency: number; // 0.8 to 1.2 (20% faster to 20% slower)
  materialRate: number; // 0.9 to 1.1 (10% discount to 10% premium)
  overhead: number; // percentage
  profit: number; // percentage
}

interface Recommendation {
  id: string;
  type: "opportunity" | "risk" | "optimization";
  category: string;
  title: string;
  description: string;
  impact: {
    costSavings?: number;
    winProbabilityChange?: number;
    hoursReduction?: number;
  };
  action: string;
  priority: "high" | "medium" | "low";
}

export default function BidStrategyPanel({
  lines,
  project,
  estimatingStats,
  companyId,
  projectId,
  onAdjustment,
}: BidStrategyPanelProps) {
  const [adjustments, setAdjustments] = useState<StrategyAdjustments>({
    laborEfficiency: 1.0,
    materialRate: 1.0,
    overhead: 10.0,
    profit: 10.0,
  });
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Calculate current metrics
  const currentMetrics = useMemo(() => {
    const tons = estimatingStats.totalWeight / 2000;
    const costPerTon = tons > 0 ? estimatingStats.totalCost / tons : 0;
    const hoursPerTon = tons > 0 ? estimatingStats.totalLabor / tons : 0;
    
    return {
      costPerTon,
      hoursPerTon,
      totalCost: estimatingStats.totalCost,
      totalHours: estimatingStats.totalLabor,
      tons,
    };
  }, [estimatingStats]);

  // Calculate adjusted metrics
  const adjustedMetrics = useMemo(() => {
    const adjustedCost = currentMetrics.totalCost * adjustments.materialRate * adjustments.laborEfficiency;
    const adjustedHours = currentMetrics.totalHours * adjustments.laborEfficiency;
    const adjustedTons = currentMetrics.tons;
    
    const directCost = adjustedCost;
    const overheadAmt = directCost * (adjustments.overhead / 100);
    const costBeforeProfit = directCost + overheadAmt;
    const profitAmt = costBeforeProfit * (adjustments.profit / 100);
    const totalWithMarkup = costBeforeProfit + profitAmt;
    
    const adjustedCostPerTon = adjustedTons > 0 ? totalWithMarkup / adjustedTons : 0;
    const adjustedHoursPerTon = adjustedTons > 0 ? adjustedHours / adjustedTons : 0;
    
    return {
      totalCost: totalWithMarkup,
      costPerTon: adjustedCostPerTon,
      hoursPerTon: adjustedHoursPerTon,
      costChange: totalWithMarkup - (currentMetrics.totalCost * 1.2), // vs baseline with 10% overhead + 10% profit
      hoursChange: adjustedHours - currentMetrics.totalHours,
    };
  }, [currentMetrics, adjustments]);

  // Generate AI recommendations
  const recommendations = useMemo((): Recommendation[] => {
    const recs: Recommendation[] = [];
    
    // Analyze labor efficiency opportunities
    const weldHours = lines.reduce((sum, line) => sum + (line.laborWeld || 0), 0);
    const totalLabor = lines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
    const weldPercentage = totalLabor > 0 ? (weldHours / totalLabor) * 100 : 0;
    
    if (weldPercentage > 25) {
      recs.push({
        id: "weld-optimization",
        type: "opportunity",
        category: "Labor Efficiency",
        title: "High Weld Concentration",
        description: `Welding represents ${weldPercentage.toFixed(1)}% of total labor. Consider prefab or design changes to reduce field welding.`,
        impact: {
          costSavings: currentMetrics.totalCost * 0.05,
          hoursReduction: weldHours * 0.15,
        },
        action: "Review design for prefab opportunities",
        priority: "high",
      });
    }

    // Material rate opportunities
    if (adjustments.materialRate > 1.0) {
      recs.push({
        id: "material-rate",
        type: "optimization",
        category: "Material Costs",
        title: "Material Rate Premium",
        description: "Current material rate is above baseline. Negotiate with suppliers or explore alternatives.",
        impact: {
          costSavings: currentMetrics.totalCost * 0.03,
        },
        action: "Review material sourcing options",
        priority: "medium",
      });
    }

    // Overhead/Profit optimization
    if (adjustments.overhead > 12 || adjustments.profit > 12) {
      recs.push({
        id: "markup-optimization",
        type: "optimization",
        category: "Markup",
        title: "Competitive Markup Adjustment",
        description: `Current markup (${adjustments.overhead + adjustments.profit}%) may be above market. Consider reducing to improve competitiveness.`,
        impact: {
          costSavings: currentMetrics.totalCost * 0.02,
          winProbabilityChange: 5,
        },
        action: "Adjust markup for competitive positioning",
        priority: "high",
      });
    }

    // Hours per ton analysis
    if (currentMetrics.hoursPerTon > 12) {
      recs.push({
        id: "labor-intensity",
        type: "risk",
        category: "Labor Intensity",
        title: "High Labor Intensity",
        description: `Hours per ton (${currentMetrics.hoursPerTon.toFixed(1)}) is above typical range. Review for inefficiencies.`,
        impact: {
          hoursReduction: currentMetrics.totalHours * 0.1,
        },
        action: "Review labor breakdown for optimization",
        priority: "high",
      });
    }

    return recs.slice(0, 4); // Top 4 recommendations
  }, [lines, currentMetrics, adjustments]);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleAdjustmentChange = (key: keyof StrategyAdjustments, value: number) => {
    const newAdjustments = { ...adjustments, [key]: value };
    setAdjustments(newAdjustments);
    if (onAdjustment) {
      onAdjustment(newAdjustments);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Bid Strategy Control Panel
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Real-time adjustments with live impact analysis
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Hide" : "Show"} Advanced
          </Button>
        </div>

        {/* Quick Adjustments */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">Labor Efficiency</label>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {((adjustments.laborEfficiency - 1) * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[adjustments.laborEfficiency]}
              onValueChange={([v]) => handleAdjustmentChange("laborEfficiency", v)}
              min={0.8}
              max={1.2}
              step={0.01}
            />
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>20% faster</span>
              <span>Baseline</span>
              <span>20% slower</span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Impact: {adjustedMetrics.hoursChange >= 0 ? "+" : ""}
              {adjustedMetrics.hoursChange.toFixed(0)} hours
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-slate-700">Material Rate</label>
              <span className="text-sm font-semibold text-slate-900 tabular-nums">
                {((adjustments.materialRate - 1) * 100).toFixed(0)}%
              </span>
            </div>
            <Slider
              value={[adjustments.materialRate]}
              onValueChange={([v]) => handleAdjustmentChange("materialRate", v)}
              min={0.9}
              max={1.1}
              step={0.01}
            />
            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
              <span>10% discount</span>
              <span>Baseline</span>
              <span>10% premium</span>
            </div>
            <div className="mt-2 text-xs text-slate-600">
              Impact: {adjustedMetrics.costChange >= 0 ? "+" : ""}
              {formatMoney(Math.abs(adjustedMetrics.costChange))}
            </div>
          </div>

          {showAdvanced && (
            <>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Overhead</label>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {adjustments.overhead.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[adjustments.overhead]}
                  onValueChange={([v]) => handleAdjustmentChange("overhead", v)}
                  min={5}
                  max={20}
                  step={0.1}
                />
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <label className="text-sm font-medium text-slate-700">Profit</label>
                  <span className="text-sm font-semibold text-slate-900 tabular-nums">
                    {adjustments.profit.toFixed(1)}%
                  </span>
                </div>
                <Slider
                  value={[adjustments.profit]}
                  onValueChange={([v]) => handleAdjustmentChange("profit", v)}
                  min={5}
                  max={20}
                  step={0.1}
                />
              </div>
            </>
          )}
        </div>

        {/* Impact Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200 mb-6">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-slate-600 mb-1">Adjusted Total</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatMoney(adjustedMetrics.totalCost)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Cost / Ton</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {formatMoney(adjustedMetrics.costPerTon)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Hours / Ton</div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {adjustedMetrics.hoursPerTon.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="w-5 h-5 text-amber-500" />
              <h4 className="text-sm font-semibold text-slate-900">Strategic Recommendations</h4>
            </div>
            <div className="space-y-3">
              {recommendations.map((rec) => (
                <div
                  key={rec.id}
                  className={`rounded-lg p-4 border-2 ${
                    rec.type === "opportunity"
                      ? "bg-emerald-50 border-emerald-200"
                      : rec.type === "risk"
                      ? "bg-rose-50 border-rose-200"
                      : "bg-amber-50 border-amber-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {rec.type === "opportunity" ? (
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        ) : rec.type === "risk" ? (
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                        ) : (
                          <Zap className="w-4 h-4 text-amber-600" />
                        )}
                        <span className="text-sm font-semibold text-slate-900">{rec.title}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          rec.priority === "high"
                            ? "bg-red-100 text-red-700"
                            : rec.priority === "medium"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {rec.priority}
                        </span>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{rec.description}</p>
                      <div className="flex items-center gap-4 text-xs">
                        {rec.impact.costSavings && (
                          <span className="text-emerald-700 font-medium">
                            Save: {formatMoney(rec.impact.costSavings)}
                          </span>
                        )}
                        {rec.impact.hoursReduction && (
                          <span className="text-blue-700 font-medium">
                            Reduce: {rec.impact.hoursReduction.toFixed(0)} hours
                          </span>
                        )}
                        {rec.impact.winProbabilityChange && (
                          <span className="text-purple-700 font-medium">
                            Win prob: +{rec.impact.winProbabilityChange}%
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="gap-2 flex-shrink-0">
                      {rec.action}
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

