"use client";

import { useState, useEffect } from "react";
import KpiCard from "@/components/dashboard/KpiCard";
import KpiExpandedPanel, { ExpandedSection } from "@/components/dashboard/KpiExpandedPanel";
import { 
  TrendingUp, 
  Calendar, 
  Target, 
  DollarSign, 
  AlertTriangle,
  TrendingDown,
  TrendingUp as TrendingUpIcon,
  Info
} from "lucide-react";
import { subscribeToCollection, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { loadCompanySettings, type CompanySettings } from "@/lib/utils/settingsLoader";
import type { ExecutiveKPIMetrics } from "@/lib/types/executiveDashboard";
import { cn } from "@/lib/utils/cn";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  generalContractor?: string;
  gcId?: string; // Reference to contact ID for exact matching
  projectType?: string; // For project-type win rate calculation
  estimatedValue?: string | number;
  winProbability?: number;
  status?: "bidding" | "awarded" | "in_progress" | "completed" | string; // Allow legacy string values
  archived?: boolean;
  // Hours-based backlog fields
  estimatedShopHoursTotal?: number; // Total fab hours originally estimated
  actualShopHours?: number; // For later accuracy analysis
  remainingShopHours?: number; // Optional; if missing, assume = estimatedShopHoursTotal
  projectedStartDate?: string;
  priority?: number; // Lower = scheduled first when no dates
}

interface WinLossRecord {
  id?: string;
  projectName: string;
  projectId?: string; // Reference to project
  gcId?: string; // Reference to GC contact ID for exact matching
  projectType?: string; // For project-type win rate calculation
  bidDate: string;
  decisionDate: string;
  bidAmount: number;
  projectValue?: number;
  margin?: number;
  estimatedMargin?: number;
  status: "won" | "lost";
  createdAt?: any;
}

interface ExecutiveKPIsProps {
  companyId: string;
  activeProjects: Project[];
  hideHeader?: boolean;
  extraCards?: React.ReactNode;
  rightColumn?: React.ReactNode;
}

export default function ExecutiveKPIs({
  companyId,
  activeProjects,
  hideHeader = false,
  extraCards,
  rightColumn,
}: ExecutiveKPIsProps) {
  const [metrics, setMetrics] = useState<ExecutiveKPIMetrics>({
    weightedPipelineValue: 0,
    backlogMonthsSecured: 0,
    winRate90Days: 0,
    marginTrend: { awarded: 0, lost: 0, difference: 0 },
    riskExposureIndex: { high: 0, medium: 0, low: 0, total: 0 },
    backlogGaps: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [winLossRecords, setWinLossRecords] = useState<WinLossRecord[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [specReviews, setSpecReviews] = useState<Record<string, any>>({});
  const [expandedKpiId, setExpandedKpiId] = useState<string | null>(null);

  // Load company settings
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    
    loadCompanySettings(companyId).then(setCompanySettings);
  }, [companyId]);

  // Load win/loss records
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection(
      recordsPath,
      (records: WinLossRecord[]) => {
        setWinLossRecords(records);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Load spec reviews for risk calculation
  useEffect(() => {
    if (!isFirebaseConfigured() || activeProjects.length === 0) return;

    const loadSpecReviews = async () => {
      const reviews: Record<string, any> = {};
      const reviewTypes = ["structural-steel", "misc-metals", "div-01", "div-09", "aess-noma", "div-03"];

      for (const project of activeProjects) {
        if (!project.id) continue;
        
        for (const type of reviewTypes) {
          try {
            const reviewPath = `companies/${companyId}/projects/${project.id}/specReviews/${type}`;
            const review = await getDocument(reviewPath);
            if (review?.result) {
              if (!reviews[project.id]) reviews[project.id] = {};
              reviews[project.id][type] = review.result;
            }
          } catch (error) {
            // Review doesn't exist, skip
          }
        }
      }

      setSpecReviews(reviews);
    };

    loadSpecReviews();
  }, [companyId, activeProjects]);

  // Calculate metrics
  useEffect(() => {
    if (!companySettings) return;

    // 1. Weighted Pipeline Value
    const calculateDefaultWinProbability = (project: Project): number => {
      // Priority 1: Manual override (most accurate)
      if (project.winProbability !== undefined && project.winProbability > 0) {
        return project.winProbability;
      }

      // Priority 2: Calculate by GC (exact match via gcId)
      let gcWinRate: number | null = null;
      if (project.gcId && winLossRecords.length > 0) {
        const gcRecords = winLossRecords.filter((r) => r.gcId === project.gcId);
        if (gcRecords.length > 0) {
          const gcWins = gcRecords.filter((r) => r.status === "won").length;
          gcWinRate = gcWins / gcRecords.length;
        }
      }

      // Priority 3: Calculate by Project Type
      let projectTypeWinRate: number | null = null;
      if (project.projectType && winLossRecords.length > 0) {
        const typeRecords = winLossRecords.filter(
          (r) => r.projectType === project.projectType
        );
        if (typeRecords.length > 0) {
          const typeWins = typeRecords.filter((r) => r.status === "won").length;
          projectTypeWinRate = typeWins / typeRecords.length;
        }
      }

      // Blend GC and Project Type probabilities if both exist
      // Weight GC more heavily (70%) since it's more specific
      if (gcWinRate !== null && projectTypeWinRate !== null) {
        return gcWinRate * 0.7 + projectTypeWinRate * 0.3;
      }

      // Use GC rate if available
      if (gcWinRate !== null) {
        return gcWinRate;
      }

      // Use project type rate if available
      if (projectTypeWinRate !== null) {
        return projectTypeWinRate;
      }

      // Default 50% (no historical data)
      return 0.5;
    };

    const weightedPipeline = activeProjects
      .filter((p) => p.status === "active" && !p.archived)
      .reduce((sum, project) => {
        const value =
          typeof project.estimatedValue === "string"
            ? parseFloat(project.estimatedValue) || 0
            : project.estimatedValue || 0;
        const winProb = calculateDefaultWinProbability(project);
        return sum + value * winProb;
      }, 0);

    const backlogProjects = activeProjects.filter((project) => {
      if (project.archived) return false;
      const status = project.status?.toLowerCase();
      return status === "awarded" || status === "in_progress";
    });
    const weeklyCapacity = companySettings.shopCapacityHoursPerWeek ?? 0;
    const monthlyCapacity = weeklyCapacity * 4.345;
    const totalRemainingHours = backlogProjects.reduce((sum, project) => {
      const remaining =
        project.remainingShopHours ?? project.estimatedShopHoursTotal ?? 0;
      return sum + remaining;
    }, 0);
    const backlogMonths =
      monthlyCapacity > 0 ? totalRemainingHours / monthlyCapacity : 0;

    // 3. Win Rate (Last 90 Days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const recentRecords = winLossRecords.filter((r) => {
      const decisionDate = r.decisionDate ? new Date(r.decisionDate) : null;
      return decisionDate && decisionDate >= ninetyDaysAgo;
    });
    const recentWins = recentRecords.filter((r) => r.status === "won").length;
    const winRate90Days = recentRecords.length > 0 
      ? (recentWins / recentRecords.length) * 100 
      : 0;

    // 4. Margin Trend (Awarded vs Lost)
    const awardedProjects = winLossRecords.filter((r) => r.status === "won");
    const awardedMargins = awardedProjects
      .map((r) => r.margin || r.estimatedMargin || 0)
      .filter((m) => m > 0);
    const lostProjects = winLossRecords.filter((r) => r.status === "lost");
    const lostMargins = lostProjects
      .map((r) => r.estimatedMargin || 0)
      .filter((m) => m > 0);

    const avgAwardedMargin = awardedMargins.length > 0
      ? awardedMargins.reduce((sum, m) => sum + m, 0) / awardedMargins.length
      : 0;
    const avgLostMargin = lostMargins.length > 0
      ? lostMargins.reduce((sum, m) => sum + m, 0) / lostMargins.length
      : 0;
    const marginDifference = avgAwardedMargin - avgLostMargin;

    // 5. Risk Exposure Index
    const riskScores: number[] = [];
    activeProjects
      .filter((p) => p.status === "active" && !p.archived)
      .forEach((project) => {
        const projectReviews = specReviews[project.id];
        if (!projectReviews) {
          // No reviews = 0 risk
          return;
        }

        // Get worst risk grade across all review types
        let worstGrade: "A" | "B" | "C" | "D" | "F" | null = null;
        Object.values(projectReviews).forEach((review: any) => {
          const grade = review?.summary?.overallRiskGrade;
          if (grade) {
            if (!worstGrade) worstGrade = grade;
            else {
              const gradeOrder = { A: 1, B: 2, C: 3, D: 4, F: 5 };
              if (gradeOrder[grade] > gradeOrder[worstGrade]) {
                worstGrade = grade;
              }
            }
          }
        });

        // Convert grade to score: F/D = 3 (High), C = 2 (Medium), A/B = 1 (Low)
        if (worstGrade === "F" || worstGrade === "D") {
          riskScores.push(3);
        } else if (worstGrade === "C") {
          riskScores.push(2);
        } else if (worstGrade === "A" || worstGrade === "B") {
          riskScores.push(1);
        }
      });

    const riskIndex = {
      high: riskScores.filter((s) => s === 3).length,
      medium: riskScores.filter((s) => s === 2).length,
      low: riskScores.filter((s) => s === 1).length,
      total: riskScores.length,
    };

    setMetrics({
      weightedPipelineValue: weightedPipeline,
      backlogMonthsSecured: backlogMonths,
      winRate90Days: winRate90Days,
      marginTrend: {
        awarded: avgAwardedMargin,
        lost: avgLostMargin,
        difference: marginDifference,
      },
      riskExposureIndex: riskIndex,
      backlogGaps: [],
    });

    setIsLoading(false);
  }, [activeProjects, winLossRecords, companySettings, specReviews]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const handleKpiToggle = (id: string) => {
    setExpandedKpiId(expandedKpiId === id ? null : id);
  };

  if (isLoading) {
    return (
      <div className="mb-12">
        <div className="mb-8">
          <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {[...Array(5)].map((_, i) => (
            <Card key={i} className="animate-pulse border-0 shadow-xl bg-gradient-to-br from-white to-gray-50">
              <CardContent className="p-8">
                <div className="h-3 bg-gray-200 rounded w-3/4 mb-6"></div>
                <div className="h-12 bg-gray-200 rounded w-2/3 mb-4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const hasActiveBids = activeProjects.filter((p) => p.status === "active" && !p.archived).length > 0;
  const hasBacklog = metrics.backlogMonthsSecured > 0;
  const hasWinLossData = winLossRecords.length > 0;
  const hasRiskData = metrics.riskExposureIndex.total > 0;

  return (
    <>
      <div className={hideHeader ? "" : "mb-16"}>
      {!hideHeader && (
        <div className="mb-10">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-3 tracking-tight">Executive KPIs</h2>
          <p className="text-base text-gray-600 font-medium leading-relaxed">Weekly Estimating Dashboard</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 2xl:gap-8 items-stretch">
        <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 2xl:gap-8">
        {/* A. Weighted Pipeline Value */}
        <div className={cn(
          "transition-all duration-300",
          expandedKpiId && expandedKpiId !== "weighted-pipeline" && "opacity-60 scale-[0.98] pointer-events-none"
        )}>
          <KpiCard
            id="weighted-pipeline"
            title="Weighted Pipeline"
            icon={<TrendingUp className="h-5 w-5" />}
            gradientFrom="blue-50"
            gradientVia="white"
            gradientTo="blue-100/50"
            accentColor="blue-500"
            iconBgColor="bg-blue-500/10"
            iconColor="text-blue-600"
            isExpanded={expandedKpiId === "weighted-pipeline"}
            onToggle={handleKpiToggle}
            tooltip={
              <div className="group/tooltip relative">
                <Info className="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help transition-colors" />
                <div className="absolute right-0 top-6 w-72 p-4 bg-gray-900 text-white text-sm rounded-xl shadow-2xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 z-20">
                  <p className="font-semibold mb-2 text-base">Weighted Pipeline Value</p>
                  <p className="text-gray-300 leading-relaxed text-xs">
                    Realistic expected revenue based on probability of award. Calculated as: 
                    <span className="font-mono text-blue-300"> (Project Value × Win Probability)</span> for each active bid.
                  </p>
                  <p className="text-gray-300 mt-2 leading-relaxed text-xs">
                    Win probability is determined by: manual override, GC historical win rate, or project type win rate.
                  </p>
                </div>
              </div>
            }
          >
            {!hasActiveBids ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">No Active Bids</h3>
                <p className="text-sm text-gray-600 font-medium">Create projects to track your pipeline</p>
              </div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight break-words">
                  {formatCurrency(metrics.weightedPipelineValue)}
                </div>
                <p className="text-sm text-gray-700 font-semibold leading-relaxed">
                  {activeProjects.filter((p) => p.status === "active" && !p.archived).length} active bid{activeProjects.filter((p) => p.status === "active" && !p.archived).length !== 1 ? 's' : ''}
                </p>
              </>
            )}
            expandedContent={hasActiveBids ? (
              <KpiExpandedPanel>
                <ExpandedSection>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    This represents your realistic expected revenue based on the probability of winning each active bid. 
                    It's calculated by multiplying each project's estimated value by its win probability, then summing all active bids.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Total Active Bids</span>
                      <span className="text-sm font-bold text-gray-900">
                        {activeProjects.filter((p) => p.status === "active" && !p.archived).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Weighted Value</span>
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(metrics.weightedPipelineValue)}
                      </span>
                    </div>
                  </div>
                </ExpandedSection>
              </KpiExpandedPanel>
            ) : undefined}
          </KpiCard>
        </div>

        {/* B. Backlog Months Secured */}
        <div className={cn(
          "transition-all duration-300",
          expandedKpiId && expandedKpiId !== "backlog-months" && "opacity-60 scale-[0.98] pointer-events-none"
        )}>
          <KpiCard
            id="backlog-months"
            title="Backlog Months"
            icon={<Calendar className="h-5 w-5" />}
            gradientFrom="green-50"
            gradientVia="white"
            gradientTo="emerald-100/50"
            accentColor="green-500"
            iconBgColor="bg-green-500/10"
            iconColor="text-green-600"
            isExpanded={expandedKpiId === "backlog-months"}
            onToggle={handleKpiToggle}
          >
            {!hasBacklog && !companySettings?.shopCapacityHoursPerWeek ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">No Backlog Data</h3>
                <p className="text-sm text-gray-600 font-medium">Set shop capacity in settings</p>
              </div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight break-words">
                  {metrics.backlogMonthsSecured.toFixed(1)}
                </div>
                <p className="text-sm text-gray-700 font-semibold leading-relaxed">
                  {companySettings?.shopCapacityHoursPerWeek
                    ? `Based on ${companySettings.shopCapacityHoursPerWeek} hrs/week capacity`
                    : "Set shop capacity in settings"}
                </p>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed font-medium">
                  Use Bid-Production Schedule to visualize capacity
                </p>
              </>
            )}
            expandedContent={hasBacklog && companySettings?.shopCapacityHoursPerWeek ? (
              <KpiExpandedPanel>
                <ExpandedSection>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    This shows how many months of work you have secured based on your shop's weekly capacity. 
                    It's calculated by dividing total remaining shop hours by your monthly capacity.
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Shop Capacity</span>
                      <span className="text-sm font-bold text-gray-900">
                        {companySettings.shopCapacityHoursPerWeek} hrs/week
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Monthly Capacity</span>
                      <span className="text-sm font-bold text-gray-900">
                        {(companySettings.shopCapacityHoursPerWeek * 4.345).toFixed(0)} hrs/month
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Backlog Secured</span>
                      <span className="text-sm font-bold text-gray-900">
                        {metrics.backlogMonthsSecured.toFixed(1)} months
                      </span>
                    </div>
                  </div>
                </ExpandedSection>
              </KpiExpandedPanel>
            ) : undefined}
          </KpiCard>
        </div>

        {/* C. Win Rate (Last 90 Days) */}
        <div className={cn(
          "transition-all duration-300",
          expandedKpiId && expandedKpiId !== "win-rate" && "opacity-60 scale-[0.98] pointer-events-none"
        )}>
          <KpiCard
            id="win-rate"
            title="Win Rate (90d)"
            icon={<Target className="h-5 w-5" />}
            gradientFrom="purple-50"
            gradientVia="white"
            gradientTo="violet-100/50"
            accentColor="purple-500"
            iconBgColor="bg-purple-500/10"
            iconColor="text-purple-600"
            isExpanded={expandedKpiId === "win-rate"}
            onToggle={handleKpiToggle}
          >
            {!hasWinLossData ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center shadow-lg">
                  <Target className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">No Win/Loss Data</h3>
                <p className="text-sm text-gray-600 font-medium">Log wins and losses to track performance</p>
              </div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight break-words">
                  {formatPercent(metrics.winRate90Days)}
                </div>
                <p className="text-sm text-gray-700 font-semibold leading-relaxed">
                  Last 90 days
                </p>
              </>
            )}
            expandedContent={hasWinLossData ? (() => {
              const ninetyDaysAgo = new Date();
              ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
              const recentRecords = winLossRecords.filter((r) => {
                const decisionDate = r.decisionDate ? new Date(r.decisionDate) : null;
                return decisionDate && decisionDate >= ninetyDaysAgo;
              });
              const recentWins = recentRecords.filter((r) => r.status === "won").length;
              const recentLosses = recentRecords.filter((r) => r.status === "lost").length;
              
              return (
                <KpiExpandedPanel>
                  <ExpandedSection>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      Your win rate over the last 90 days shows the percentage of bids you've won out of all bids decided in that period. 
                      This metric helps track recent performance trends.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Total Decisions</span>
                        <span className="text-sm font-bold text-gray-900">
                          {recentRecords.length}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Wins</span>
                        <span className="text-sm font-bold text-green-600">
                          {recentWins}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Losses</span>
                        <span className="text-sm font-bold text-red-600">
                          {recentLosses}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Win Rate</span>
                        <span className="text-sm font-bold text-gray-900">
                          {formatPercent(metrics.winRate90Days)}
                        </span>
                      </div>
                    </div>
                  </ExpandedSection>
                </KpiExpandedPanel>
              );
            })() : undefined}
          </KpiCard>
        </div>

        {/* D. Margin Trend */}
        <div className={cn(
          "transition-all duration-300",
          expandedKpiId && expandedKpiId !== "margin-trend" && "opacity-60 scale-[0.98] pointer-events-none"
        )}>
          <KpiCard
            id="margin-trend"
            title="Margin Trend"
            icon={<DollarSign className="h-5 w-5" />}
            gradientFrom="amber-50"
            gradientVia="white"
            gradientTo="yellow-100/50"
            accentColor="amber-500"
            iconBgColor="bg-amber-500/10"
            iconColor="text-amber-600"
            isExpanded={expandedKpiId === "margin-trend"}
            onToggle={handleKpiToggle}
          >
            {!hasWinLossData ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center shadow-lg">
                  <DollarSign className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">No Margin Data</h3>
                <p className="text-sm text-gray-600 font-medium">Track margins in win/loss records</p>
              </div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight leading-tight break-words">
                  {formatPercent(metrics.marginTrend.awarded)}
                </div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  {metrics.marginTrend.difference > 0 ? (
                    <>
                      <TrendingUpIcon className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span className="text-sm font-bold text-green-600">
                        +{formatPercent(metrics.marginTrend.difference)} vs lost
                      </span>
                    </>
                  ) : metrics.marginTrend.difference < 0 ? (
                    <>
                      <TrendingDown className="h-4 w-4 text-red-600 flex-shrink-0" />
                      <span className="text-sm font-bold text-red-600">
                        {formatPercent(metrics.marginTrend.difference)} vs lost
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-gray-600 font-semibold">No difference</span>
                  )}
                </div>
              </>
            )}
            expandedContent={hasWinLossData ? (() => {
              const awardedProjects = winLossRecords.filter((r) => r.status === "won");
              const lostProjects = winLossRecords.filter((r) => r.status === "lost");
              
              return (
                <KpiExpandedPanel>
                  <ExpandedSection>
                    <p className="text-sm text-gray-600 leading-relaxed mb-3">
                      This compares the average margin on projects you've won versus those you've lost. 
                      A positive difference suggests you're winning work at better margins than you're losing.
                    </p>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Avg. Awarded Margin</span>
                        <span className="text-sm font-bold text-green-600">
                          {formatPercent(metrics.marginTrend.awarded)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Avg. Lost Margin</span>
                        <span className="text-sm font-bold text-red-600">
                          {formatPercent(metrics.marginTrend.lost)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Difference</span>
                        <span className={cn(
                          "text-sm font-bold",
                          metrics.marginTrend.difference > 0 ? "text-green-600" : 
                          metrics.marginTrend.difference < 0 ? "text-red-600" : "text-gray-600"
                        )}>
                          {metrics.marginTrend.difference > 0 ? "+" : ""}{formatPercent(metrics.marginTrend.difference)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-2">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Awarded Projects</span>
                        <span className="text-sm font-bold text-gray-900">
                          {awardedProjects.length}
                        </span>
                      </div>
                    </div>
                  </ExpandedSection>
                </KpiExpandedPanel>
              );
            })() : undefined}
          </KpiCard>
        </div>

        {/* E. Risk Exposure Index */}
        <div className={cn(
          "transition-all duration-300",
          expandedKpiId && expandedKpiId !== "risk-exposure" && "opacity-60 scale-[0.98] pointer-events-none"
        )}>
          <KpiCard
            id="risk-exposure"
            title="Risk Exposure"
            icon={<AlertTriangle className="h-5 w-5" />}
            gradientFrom="red-50"
            gradientVia="white"
            gradientTo="rose-100/50"
            accentColor="red-500"
            iconBgColor="bg-red-500/10"
            iconColor="text-red-600"
            isExpanded={expandedKpiId === "risk-exposure"}
            onToggle={handleKpiToggle}
          >
            {!hasRiskData ? (
              <div className="text-center py-10">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-lg">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-base font-bold text-gray-900 mb-2">No Risk Data</h3>
                <p className="text-sm text-gray-600 font-medium">Run spec reviews to assess risk</p>
              </div>
            ) : (
              <>
                <div className="text-4xl font-extrabold text-gray-900 mb-5 tracking-tight leading-tight break-words">
                  {metrics.riskExposureIndex.total}
                </div>
                <div className="space-y-2.5">
                  {metrics.riskExposureIndex.high > 0 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-red-500 shadow-md flex-shrink-0"></div>
                      <span className="text-sm text-gray-800 font-bold">
                        <span className="text-red-600">{metrics.riskExposureIndex.high}</span> High Risk
                      </span>
                    </div>
                  )}
                  {metrics.riskExposureIndex.medium > 0 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-yellow-500 shadow-md flex-shrink-0"></div>
                      <span className="text-sm text-gray-800 font-bold">
                        <span className="text-yellow-600">{metrics.riskExposureIndex.medium}</span> Medium Risk
                      </span>
                    </div>
                  )}
                  {metrics.riskExposureIndex.low > 0 && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-md flex-shrink-0"></div>
                      <span className="text-sm text-gray-800 font-bold">
                        <span className="text-green-600">{metrics.riskExposureIndex.low}</span> Low Risk
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
            expandedContent={hasRiskData ? (
              <KpiExpandedPanel>
                <ExpandedSection>
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    This shows the number of active bids with spec reviews, categorized by their highest risk grade. 
                    Risk is assessed based on spec review grades (A/B = Low, C = Medium, D/F = High).
                  </p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Total Projects Reviewed</span>
                      <span className="text-sm font-bold text-gray-900">
                        {metrics.riskExposureIndex.total}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">High Risk</span>
                      <span className="text-sm font-bold text-red-600">
                        {metrics.riskExposureIndex.high}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200/50">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Medium Risk</span>
                      <span className="text-sm font-bold text-yellow-600">
                        {metrics.riskExposureIndex.medium}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Low Risk</span>
                      <span className="text-sm font-bold text-green-600">
                        {metrics.riskExposureIndex.low}
                      </span>
                    </div>
                  </div>
                </ExpandedSection>
              </KpiExpandedPanel>
            ) : undefined}
          </KpiCard>
        </div>
        {extraCards}
        </div>
        {rightColumn && (
          <div className="lg:col-span-4">
            {rightColumn}
          </div>
        )}
      </div>
      </div>
    </>
  );
}

