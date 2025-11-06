"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Plus } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import WinLossModal from "./WinLossModal";

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
}

export default function WinLossWidget({ companyId }: WinLossWidgetProps) {
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

  // Calculate statistics
  const stats = {
    totalBids: records.length,
    wins: records.filter(r => r.status === "won").length,
    losses: records.filter(r => r.status === "lost").length,
    winRate: records.length > 0 
      ? (records.filter(r => r.status === "won").length / records.length) * 100 
      : 0,
    averageMargin: (() => {
      const wonRecords = records.filter(r => r.status === "won" && r.margin);
      if (wonRecords.length === 0) return 0;
      const totalMargin = wonRecords.reduce((sum, r) => sum + (r.margin || 0), 0);
      return totalMargin / wonRecords.length;
    })(),
  };

  // Get last 6 months of data for mini chart
  const getLast6MonthsData = () => {
    const months: string[] = [];
    const wonData: number[] = [];
    const lostData: number[] = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthLabel = date.toLocaleDateString("en-US", { month: "short" });
      
      months.push(monthLabel);
      
      const monthRecords = records.filter(r => {
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
      <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Win/Loss
          </CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} className="text-xs">
            View Full
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Key Metrics - Even Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
              <div className="text-2xl font-bold text-green-700">{stats.wins}</div>
              <div className="text-xs text-gray-600 mt-0.5">Wins</div>
            </div>
            <div className="p-3 bg-red-50 rounded-lg border border-red-200 text-center">
              <div className="text-2xl font-bold text-red-700">{stats.losses}</div>
              <div className="text-xs text-gray-600 mt-0.5">Losses</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
              <div className="text-2xl font-bold text-blue-700">{stats.winRate.toFixed(1)}%</div>
              <div className="text-xs text-gray-600 mt-0.5">Win Rate</div>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
              <div className="text-2xl font-bold text-purple-700">
                {stats.averageMargin > 0 ? `${stats.averageMargin.toFixed(1)}%` : "-"}
              </div>
              <div className="text-xs text-gray-600 mt-0.5">Avg Margin</div>
            </div>
          </div>

          {/* Empty State or Quick Action */}
          {records.length === 0 && (
            <div className="text-center py-3">
              <Button variant="outline" size="sm" onClick={() => setIsModalOpen(true)} className="w-full text-xs">
                <Plus className="w-3 h-3 mr-1" />
                Log First Record
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {isModalOpen && (
        <WinLossModal companyId={companyId} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}

