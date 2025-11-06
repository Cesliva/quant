"use client";

import { useState, useEffect } from "react";
import { TrendingUp, DollarSign, BarChart3, Zap } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface PerformanceMetricsProps {
  companyId: string;
}

export default function PerformanceMetrics({ companyId }: PerformanceMetricsProps) {
  const [revenueData, setRevenueData] = useState<number[]>([]);
  const [projectCounts, setProjectCounts] = useState<number[]>([]);

  // Mock data for now - replace with real Firestore queries
  useEffect(() => {
    // Simulate data - in production, query from Firestore
    const mockRevenue = [45000, 52000, 48000, 61000, 55000, 67000];
    const mockProjects = [3, 4, 3, 5, 4, 6];
    setRevenueData(mockRevenue);
    setProjectCounts(mockProjects);
  }, []);

  // Calculate metrics
  const currentMonthRevenue = revenueData[revenueData.length - 1] || 0;
  const previousMonthRevenue = revenueData[revenueData.length - 2] || 0;
  const revenueChange = previousMonthRevenue > 0 
    ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100 
    : 0;

  const totalRevenue = revenueData.reduce((sum, val) => sum + val, 0);
  const avgMonthlyRevenue = revenueData.length > 0 ? totalRevenue / revenueData.length : 0;
  const maxRevenue = Math.max(...revenueData, 0);

  // Get last 6 months labels
  const getMonthLabels = () => {
    const labels: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      labels.push(date.toLocaleDateString("en-US", { month: "short" }));
    }
    return labels;
  };

  const monthLabels = getMonthLabels();

  return (
    <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="w-5 h-5 text-blue-600" />
          Performance Metrics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Revenue Trend Chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-semibold text-gray-700">Monthly Revenue</h4>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}%
              </span>
              <TrendingUp className={`w-4 h-4 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600 rotate-180'}`} />
            </div>
          </div>
          <div className="relative h-32 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-3">
            <div className="flex items-end justify-between h-full gap-1">
              {revenueData.map((value, index) => {
                const height = maxRevenue > 0 ? (value / maxRevenue) * 100 : 0;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center gap-1 h-full">
                    <div className="w-full flex items-end justify-center">
                      <div
                        className="w-full bg-gradient-to-t from-blue-500 to-purple-500 rounded-t transition-all hover:from-blue-600 hover:to-purple-600"
                        style={{ height: `${height}%`, minHeight: height > 0 ? '4px' : '0' }}
                        title={`${monthLabels[index]}: $${value.toLocaleString()}`}
                      />
                    </div>
                    <div className="text-[10px] text-gray-600 mt-1">{monthLabels[index]}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-600">This Month</span>
            </div>
            <div className="text-lg font-bold text-green-700">
              ${currentMonthRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-600">Avg Monthly</span>
            </div>
            <div className="text-lg font-bold text-blue-700">
              ${avgMonthlyRevenue.toLocaleString("en-US", { maximumFractionDigits: 0 })}
            </div>
          </div>
        </div>

        {/* Project Count Trend */}
        <div>
          <h4 className="text-xs font-semibold text-gray-700 mb-2">Active Projects</h4>
          <div className="flex items-center gap-2">
            {projectCounts.map((count, index) => (
              <div key={index} className="flex-1 text-center">
                <div className="text-sm font-bold text-gray-900">{count}</div>
                <div className="text-[10px] text-gray-500">{monthLabels[index]}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

