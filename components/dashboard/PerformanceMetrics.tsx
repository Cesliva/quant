"use client";

import { useState, useEffect, useMemo } from "react";
import { TrendingUp, DollarSign, FileText, Target, Percent, Calendar } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { cn } from "@/lib/utils/cn";

interface PerformanceMetricsProps {
  companyId: string;
  className?: string;
}

interface ProjectDocument {
  id: string;
  projectName?: string;
  status?: string;
  estimatedValue?: number | string;
  archived?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface WinLossRecord {
  id?: string;
  status: "won" | "lost";
}

export default function PerformanceMetrics({ companyId, className }: PerformanceMetricsProps) {
  const [projects, setProjects] = useState<ProjectDocument[]>([]);
  const [winLossRecords, setWinLossRecords] = useState<WinLossRecord[]>([]);

  // Load projects
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setProjects([]);
      return () => {};
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<ProjectDocument>(projectsPath, (docs) => {
      setProjects(docs || []);
    });

    return () => unsubscribe();
  }, [companyId]);

  // Load win/loss records for conversion rate
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection<WinLossRecord>(
      recordsPath,
      (data) => {
        setWinLossRecords(data || []);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const metrics = useMemo(() => {
    // Filter out archived projects
    const activeProjects = projects.filter(p => p.archived !== true);

    // Total Bid Pipeline Value - sum of estimated values for active/submitted bids
    const pipelineProjects = activeProjects.filter(
      p => p.status === "active" || p.status === "submitted" || p.status === "draft"
    );
    const totalPipelineValue = pipelineProjects.reduce((sum, project) => {
      const value = typeof project.estimatedValue === 'string' 
        ? parseFloat(project.estimatedValue) 
        : (project.estimatedValue || 0);
      return sum + value;
    }, 0);

    // Estimates in Progress - count of projects being estimated (draft/active)
    const estimatesInProgress = activeProjects.filter(
      p => p.status === "draft" || p.status === "active"
    ).length;

    // Average Estimate Value - average of all projects with estimated values
    const projectsWithValues = activeProjects.filter(p => {
      const value = typeof p.estimatedValue === 'string' 
        ? parseFloat(p.estimatedValue) 
        : (p.estimatedValue || 0);
      return value > 0;
    });
    const averageEstimateValue = projectsWithValues.length > 0
      ? projectsWithValues.reduce((sum, project) => {
          const value = typeof project.estimatedValue === 'string' 
            ? parseFloat(project.estimatedValue) 
            : (project.estimatedValue || 0);
          return sum + value;
        }, 0) / projectsWithValues.length
      : 0;

    // Estimates This Month - count of projects created this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const getDateFromField = (value: any): Date | null => {
      if (!value) return null;
      if (typeof value.toDate === "function") {
        return value.toDate();
      }
      if (value instanceof Date) {
        return value;
      }
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    };

    const estimatesThisMonth = activeProjects.filter(project => {
      const createdAt = getDateFromField(project.createdAt);
      return createdAt && createdAt >= monthStart;
    }).length;

    // Bid Conversion Rate - won / total bids (from win/loss records)
    const totalBids = winLossRecords.length;
    const wonBids = winLossRecords.filter(r => r.status === "won").length;
    const conversionRate = totalBids > 0 ? (wonBids / totalBids) * 100 : 0;

    // Pipeline trend - last 6 months of estimates created
    const monthStarts: Date[] = [];
    for (let i = 5; i >= 0; i--) {
      monthStarts.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }

    const estimatesPerMonth: number[] = [];
    const monthLabels: string[] = [];

    monthStarts.forEach((startDate) => {
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);
      const label = startDate.toLocaleDateString("en-US", { month: "short" });
      monthLabels.push(label);

      const monthCount = activeProjects.filter(project => {
        const createdAt = getDateFromField(project.createdAt);
        return createdAt && createdAt >= startDate && createdAt < endDate;
      }).length;

      estimatesPerMonth.push(monthCount);
    });

    const currentMonthEstimates = estimatesPerMonth[estimatesPerMonth.length - 1] || 0;
    const previousMonthEstimates = estimatesPerMonth[estimatesPerMonth.length - 2] || 0;
    const estimatesChange = previousMonthEstimates > 0
      ? ((currentMonthEstimates - previousMonthEstimates) / previousMonthEstimates) * 100
      : 0;

    const maxEstimates = Math.max(...estimatesPerMonth, 1);

    return {
      totalPipelineValue,
      estimatesInProgress,
      averageEstimateValue,
      estimatesThisMonth,
      conversionRate,
      estimatesPerMonth,
      monthLabels,
      currentMonthEstimates,
      estimatesChange,
      maxEstimates,
    };
  }, [projects, winLossRecords]);

  return (
    <Card className={cn("border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white h-full", className)}>
      <CardHeader className="pb-5">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Target className="w-5 h-5 text-blue-600" />
          Bid Pipeline & Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Estimates Created Trend Chart */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-800">Estimates Created (6 Months)</h4>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-semibold ${metrics.estimatesChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {metrics.estimatesChange >= 0 ? '+' : ''}{metrics.estimatesChange.toFixed(1)}%
              </span>
              <TrendingUp className={`w-4 h-4 ${metrics.estimatesChange >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
            </div>
          </div>
          <div className="relative h-36 bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-5 border-2 border-blue-100">
            <div className="flex items-end justify-between h-full gap-2">
              {metrics.estimatesPerMonth.map((value, index) => {
                const height = metrics.maxEstimates > 0 ? (value / metrics.maxEstimates) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-2 h-full">
                    <div className="w-full flex items-end justify-center">
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t-lg transition-all duration-200 hover:from-blue-600 hover:to-purple-600 hover:shadow-md"
                        style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                        title={`${metrics.monthLabels[index]}: ${value} estimates`}
                      />
                    </div>
                    <div className="text-xs text-gray-600 font-medium mt-1">{metrics.monthLabels[index]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-green-600" />
              <span className="text-sm font-semibold text-gray-700">Pipeline Value</span>
            </div>
            <div className="text-2xl font-bold text-green-700 mb-1 tracking-tight">
              ${metrics.totalPipelineValue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs text-gray-600 font-medium">
              Active bids
            </div>
          </div>
          <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-blue-200 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-semibold text-gray-700">In Progress</span>
            </div>
            <div className="text-2xl font-bold text-blue-700 mb-1 tracking-tight">
              {metrics.estimatesInProgress}
            </div>
            <div className="text-xs text-gray-600 font-medium">
              Being estimated
            </div>
          </div>
        </div>

        {/* Secondary Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-center hover:shadow-md transition-shadow">
            <div className="text-xs font-semibold text-gray-600 mb-2">Avg Estimate</div>
            <div className="text-base font-bold text-gray-900 tracking-tight">
              ${metrics.averageEstimateValue > 0 
                ? metrics.averageEstimateValue.toLocaleString("en-US", { maximumFractionDigits: 0 })
                : "-"}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-center hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-600">This Month</span>
            </div>
            <div className="text-base font-bold text-gray-900 tracking-tight">
              {metrics.estimatesThisMonth}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 text-center hover:shadow-md transition-shadow">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Percent className="w-4 h-4 text-gray-500" />
              <span className="text-xs font-semibold text-gray-600">Win Rate</span>
            </div>
            <div className="text-base font-bold text-gray-900 tracking-tight">
              {metrics.conversionRate > 0 ? `${metrics.conversionRate.toFixed(1)}%` : "-"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
