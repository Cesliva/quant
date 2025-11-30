"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import WinLossModal from "./WinLossModal";
import { cn } from "@/lib/utils/cn";

interface WinLossRecord {
  id?: string;
  projectId?: string;
  projectName: string;
  bidDate: string;
  decisionDate: string;
  bidAmount: number;
  actualCost?: number;
  projectValue?: number;
  margin?: number;
  status: "won" | "lost";
  reason?: string;
  competitor?: string;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface WinLossWidgetProps {
  companyId: string;
  className?: string;
}

export default function WinLossWidget({ companyId, className }: WinLossWidgetProps) {
  const [records, setRecords] = useState<WinLossRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Load records from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection<WinLossRecord>(
      recordsPath,
      (data) => {
        const sorted = data.sort((a, b) => 
          new Date(b.decisionDate).getTime() - new Date(a.decisionDate).getTime()
        );
        setRecords(sorted);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Filter records from last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const recentRecords = records.filter((r) => {
    const decisionDate = r.decisionDate ? new Date(r.decisionDate) : null;
    return decisionDate && decisionDate >= ninetyDaysAgo;
  });

  // Calculate statistics from last 90 days
  const stats = {
    totalBids: recentRecords.length,
    wins: recentRecords.filter(r => r.status === "won").length,
    losses: recentRecords.filter(r => r.status === "lost").length,
    winRate: recentRecords.length > 0 
      ? (recentRecords.filter(r => r.status === "won").length / recentRecords.length) * 100 
      : 0,
    averageMargin: (() => {
      const wonRecords = recentRecords.filter(r => r.status === "won" && r.margin);
      if (wonRecords.length === 0) return 0;
      const totalMargin = wonRecords.reduce((sum, r) => sum + (r.margin || 0), 0);
      return totalMargin / wonRecords.length;
    })(),
  };

  // Get last 6 months of data for mini chart (using recent records)
  const getLast6MonthsData = () => {
    const months: string[] = [];
    const wonData: number[] = [];
    const lostData: number[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthLabel = date.toLocaleDateString("en-US", { month: "short" });
      
      months.push(monthLabel);
      
      const monthRecords = recentRecords.filter(r => {
        const recordDate = new Date(r.decisionDate);
        return recordDate.getMonth() === date.getMonth() && 
               recordDate.getFullYear() === date.getFullYear();
      });
      
      wonData.push(monthRecords.filter(r => r.status === "won").length);
      lostData.push(monthRecords.filter(r => r.status === "lost").length);
    }
    
    return { months, wonData, lostData };
  };

  const chartData = getLast6MonthsData();
  const maxValue = Math.max(
    ...chartData.wonData,
    ...chartData.lostData,
    ...chartData.wonData.map((w, i) => w + chartData.lostData[i]),
    1
  );

  return (
    <>
      <Card className={cn("border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white h-full", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-5">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Win/Loss
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} className="border-2">
            View Full
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          {records.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-2">No Win/Loss Records</h3>
              <p className="text-sm text-gray-500 mb-6">Start tracking your wins and losses to analyze performance</p>
              <Button variant="outline" size="md" onClick={() => setIsModalOpen(true)} className="w-full border-2">
                <Plus className="w-4 h-4 mr-2" />
                Log First Record
              </Button>
            </div>
          ) : (
            <>
              {/* Key Metrics - Even Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-5 bg-green-50 rounded-xl border-2 border-green-200 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-green-700 mb-1 tracking-tight">{stats.wins}</div>
                  <div className="text-sm text-gray-600 font-medium">Wins</div>
                </div>
                <div className="p-5 bg-red-50 rounded-xl border-2 border-red-200 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-red-700 mb-1 tracking-tight">{stats.losses}</div>
                  <div className="text-sm text-gray-600 font-medium">Losses</div>
                </div>
                <div className="p-5 bg-blue-50 rounded-xl border-2 border-blue-200 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-blue-700 mb-1 tracking-tight">{stats.winRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600 font-medium">Win Rate</div>
                </div>
                <div className="p-5 bg-purple-50 rounded-xl border-2 border-purple-200 text-center hover:shadow-md transition-shadow">
                  <div className="text-3xl font-bold text-purple-700 mb-1 tracking-tight">
                    {stats.averageMargin > 0 ? `${stats.averageMargin.toFixed(1)}%` : "-"}
                  </div>
                  <div className="text-sm text-gray-600 font-medium">Avg Margin</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <WinLossModal companyId={companyId} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}

