"use client";

/**
 * Cost Trend Insights Panel
 * 
 * Provides local analytics and insights from cost trend data
 * - Top movers (largest variance)
 * - Volatility scores
 * - Anomaly detection
 * - Category drivers
 * 
 * AI hook available for future narrative insights
 */

import { useMemo } from "react";
import { ChartPoint, ChartMetric } from "@/lib/utils/estimateToStreamgraph";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, AlertTriangle, BarChart3, Zap } from "lucide-react";

interface CostTrendInsightsProps {
  points: ChartPoint[];
  metric: ChartMetric;
  onCategoryClick?: (category: string, subCategory?: string) => void;
}

interface TopMover {
  category: string;
  subCategory?: string;
  variance: number;
  currentValue: number;
  previousValue: number;
  changePercent: number;
}

interface VolatilityScore {
  category: string;
  subCategory?: string;
  score: number; // std dev / mean
  stdDev: number;
  mean: number;
}

interface Anomaly {
  category: string;
  subCategory?: string;
  timeline: string;
  value: number;
  expectedValue: number;
  deviation: number;
  severity: "low" | "medium" | "high";
}

interface CategoryDriver {
  category: string;
  subCategory?: string;
  contribution: number; // % of category's total movement
  absoluteChange: number;
}

/**
 * Calculate top movers (largest positive/negative variance)
 */
function calculateTopMovers(points: ChartPoint[]): TopMover[] {
  // Group by category/subcategory
  const categoryMap = new Map<string, ChartPoint[]>();
  points.forEach(p => {
    const key = `${p.category}|${p.subCategory || ""}`;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, []);
    }
    categoryMap.get(key)!.push(p);
  });
  
  const movers: TopMover[] = [];
  
  categoryMap.forEach((categoryPoints, key) => {
    if (categoryPoints.length < 2) return;
    
    // Sort by timeline
    const sorted = [...categoryPoints].sort((a, b) => a.t.localeCompare(b.t));
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    
    const variance = last.value - first.value;
    const changePercent = first.value !== 0 
      ? ((variance / Math.abs(first.value)) * 100)
      : variance !== 0 ? 100 : 0;
    
    const [category, subCategory] = key.split("|");
    
    movers.push({
      category,
      subCategory: subCategory || undefined,
      variance,
      currentValue: last.value,
      previousValue: first.value,
      changePercent,
    });
  });
  
  // Sort by absolute variance
  return movers.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));
}

/**
 * Calculate volatility score (std dev / mean)
 */
function calculateVolatility(points: ChartPoint[]): VolatilityScore[] {
  const categoryMap = new Map<string, ChartPoint[]>();
  points.forEach(p => {
    const key = `${p.category}|${p.subCategory || ""}`;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, []);
    }
    categoryMap.get(key)!.push(p);
  });
  
  const scores: VolatilityScore[] = [];
  
  categoryMap.forEach((categoryPoints, key) => {
    if (categoryPoints.length < 2) return;
    
    const values = categoryPoints.map(p => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    
    if (mean === 0) return;
    
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    const score = stdDev / Math.abs(mean);
    
    const [category, subCategory] = key.split("|");
    
    scores.push({
      category,
      subCategory: subCategory || undefined,
      score,
      stdDev,
      mean,
    });
  });
  
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Detect anomalies (sudden jumps beyond threshold)
 */
function detectAnomalies(points: ChartPoint[], threshold: number = 2.0): Anomaly[] {
  const categoryMap = new Map<string, ChartPoint[]>();
  points.forEach(p => {
    const key = `${p.category}|${p.subCategory || ""}`;
    if (!categoryMap.has(key)) {
      categoryMap.set(key, []);
    }
    categoryMap.get(key)!.push(p);
  });
  
  const anomalies: Anomaly[] = [];
  
  categoryMap.forEach((categoryPoints, key) => {
    if (categoryPoints.length < 2) return;
    
    const sorted = [...categoryPoints].sort((a, b) => a.t.localeCompare(b.t));
    const values = sorted.map(p => p.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
    );
    
    sorted.forEach((point, index) => {
      if (index === 0) return;
      
      const previous = sorted[index - 1];
      const change = point.value - previous.value;
      const expectedChange = stdDev * 0.5; // Expected change based on volatility
      
      const deviation = Math.abs(change - expectedChange);
      const zScore = stdDev > 0 ? deviation / stdDev : 0;
      
      if (zScore > threshold) {
        const [category, subCategory] = key.split("|");
        
        let severity: "low" | "medium" | "high";
        if (zScore > threshold * 2) {
          severity = "high";
        } else if (zScore > threshold * 1.5) {
          severity = "medium";
        } else {
          severity = "low";
        }
        
        anomalies.push({
          category,
          subCategory: subCategory || undefined,
          timeline: point.t,
          value: point.value,
          expectedValue: previous.value + expectedChange,
          deviation,
          severity,
        });
      }
    });
  });
  
  return anomalies.sort((a, b) => b.deviation - a.deviation);
}

/**
 * Identify category drivers (subcategories explaining most movement)
 */
function calculateCategoryDrivers(points: ChartPoint[]): CategoryDriver[] {
  // Group by category first
  const categoryGroups = new Map<string, ChartPoint[]>();
  points.forEach(p => {
    if (!categoryGroups.has(p.category)) {
      categoryGroups.set(p.category, []);
    }
    categoryGroups.get(p.category)!.push(p);
  });
  
  const drivers: CategoryDriver[] = [];
  
  categoryGroups.forEach((categoryPoints, category) => {
    // Group by subcategory within this category
    const subCategoryGroups = new Map<string, ChartPoint[]>();
    categoryPoints.forEach(p => {
      const key = p.subCategory || "Uncategorized";
      if (!subCategoryGroups.has(key)) {
        subCategoryGroups.set(key, []);
      }
      subCategoryGroups.get(key)!.push(p);
    });
    
    // Calculate total category movement
    const categorySorted = [...categoryPoints].sort((a, b) => a.t.localeCompare(b.t));
    const categoryTotalChange = categorySorted.length > 0
      ? categorySorted[categorySorted.length - 1].value - categorySorted[0].value
      : 0;
    
    // Calculate each subcategory's contribution
    subCategoryGroups.forEach((subPoints, subCategory) => {
      const sorted = [...subPoints].sort((a, b) => a.t.localeCompare(b.t));
      const absoluteChange = sorted.length > 0
        ? Math.abs(sorted[sorted.length - 1].value - sorted[0].value)
        : 0;
      
      const contribution = categoryTotalChange !== 0
        ? (absoluteChange / Math.abs(categoryTotalChange)) * 100
        : 0;
      
      drivers.push({
        category,
        subCategory: subCategory !== "Uncategorized" ? subCategory : undefined,
        contribution,
        absoluteChange,
      });
    });
  });
  
  return drivers.sort((a, b) => b.contribution - a.contribution);
}

/**
 * Generate narrative insights (stub for AI integration)
 */
async function generateNarrativeInsights(input: {
  points: ChartPoint[];
  metric: ChartMetric;
  topMovers: TopMover[];
  volatility: VolatilityScore[];
  anomalies: Anomaly[];
}): Promise<string> {
  // Local deterministic summary for now
  // TODO: Hook into Quant's AI service if available
  
  const { topMovers, volatility, anomalies } = input;
  
  let narrative = "## Cost Trend Summary\n\n";
  
  if (topMovers.length > 0) {
    const topGainer = topMovers.find(m => m.variance > 0);
    const topLoser = topMovers.find(m => m.variance < 0);
    
    if (topGainer) {
      narrative += `**Largest Increase:** ${topGainer.category}${topGainer.subCategory ? ` - ${topGainer.subCategory}` : ""} increased by ${topGainer.changePercent.toFixed(1)}%.\n\n`;
    }
    
    if (topLoser) {
      narrative += `**Largest Decrease:** ${topLoser.category}${topLoser.subCategory ? ` - ${topLoser.subCategory}` : ""} decreased by ${Math.abs(topLoser.changePercent).toFixed(1)}%.\n\n`;
    }
  }
  
  if (volatility.length > 0) {
    const mostVolatile = volatility[0];
    narrative += `**Most Volatile:** ${mostVolatile.category}${mostVolatile.subCategory ? ` - ${mostVolatile.subCategory}` : ""} shows high variability (score: ${mostVolatile.score.toFixed(2)}).\n\n`;
  }
  
  if (anomalies.length > 0) {
    const highSeverity = anomalies.filter(a => a.severity === "high");
    if (highSeverity.length > 0) {
      narrative += `**Anomalies Detected:** ${highSeverity.length} high-severity anomalies found. Review recommended.\n\n`;
    }
  }
  
  return narrative;
}

export default function CostTrendInsights({
  points,
  metric,
  onCategoryClick,
}: CostTrendInsightsProps) {
  const topMovers = useMemo(() => calculateTopMovers(points), [points]);
  const volatility = useMemo(() => calculateVolatility(points), [points]);
  const anomalies = useMemo(() => detectAnomalies(points), [points]);
  const drivers = useMemo(() => calculateCategoryDrivers(points), [points]);
  
  // Show empty state only if truly no data
  if (points.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <CardTitle className="flex items-center gap-2 font-bold text-gray-900 tracking-normal">
            <Zap className="w-5 h-5" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-500 text-center py-4">
            No data available for insights. Add estimating lines to see trends.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
        <CardTitle className="flex items-center gap-2 font-bold text-gray-900 tracking-normal">
          <Zap className="w-5 h-5" />
          Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Top Movers */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 tracking-normal mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Top Movers
          </h3>
          {topMovers.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Need at least 2 data points to calculate movers</p>
          ) : (
          <div className="space-y-2">
            {topMovers.slice(0, 5).map((mover, index) => (
              <div
                key={`${mover.category}-${mover.subCategory || ""}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => onCategoryClick?.(mover.category, mover.subCategory)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {mover.category}
                    {mover.subCategory && <span className="text-gray-600"> - {mover.subCategory}</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {mover.previousValue.toFixed(2)} → {mover.currentValue.toFixed(2)}
                  </div>
                </div>
                <div className={`flex items-center gap-1 ${mover.variance >= 0 ? "text-red-600" : "text-green-600"}`}>
                  {mover.variance >= 0 ? (
                    <TrendingUp className="w-4 h-4" />
                  ) : (
                    <TrendingDown className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">
                    {mover.variance >= 0 ? "+" : ""}{mover.changePercent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        
        {/* Volatility Scores */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 tracking-normal mb-2">Volatility</h3>
          {volatility.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Need at least 2 data points to calculate volatility</p>
          ) : (
          <div className="space-y-2">
            {volatility.slice(0, 5).map((vol, index) => (
              <div
                key={`${vol.category}-${vol.subCategory || ""}-${index}`}
                className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    {vol.category}
                    {vol.subCategory && <span className="text-gray-600"> - {vol.subCategory}</span>}
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  Score: {vol.score.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
          )}
        </div>
        
        {/* Anomalies */}
        {anomalies.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 tracking-normal mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Anomalies
            </h3>
            <div className="space-y-2">
              {anomalies.slice(0, 5).map((anomaly, index) => (
                <div
                  key={`${anomaly.category}-${anomaly.subCategory || ""}-${anomaly.timeline}-${index}`}
                  className={`p-2 rounded-lg border ${
                    anomaly.severity === "high" 
                      ? "bg-red-50 border-red-200" 
                      : anomaly.severity === "medium"
                      ? "bg-yellow-50 border-yellow-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="text-sm font-medium text-gray-900">
                    {anomaly.category}
                    {anomaly.subCategory && <span className="text-gray-600"> - {anomaly.subCategory}</span>}
                  </div>
                  <div className="text-xs text-gray-600">
                    {anomaly.timeline}: {anomaly.value.toFixed(2)} (expected: {anomaly.expectedValue.toFixed(2)})
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Category Drivers */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 tracking-normal mb-2">Category Drivers</h3>
          {drivers.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Need at least 2 data points to calculate drivers</p>
          ) : (
            <div className="space-y-2">
              {drivers.slice(0, 5).map((driver, index) => (
                <div
                  key={`${driver.category}-${driver.subCategory || ""}-${index}`}
                  className="flex items-center justify-between p-2 rounded-lg bg-gray-50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {driver.category}
                      {driver.subCategory && <span className="text-gray-600"> - {driver.subCategory}</span>}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {driver.contribution.toFixed(1)}% of movement
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

