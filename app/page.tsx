"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Plus, Calendar, TrendingUp, FileText, Search, Upload } from "lucide-react";
import BidCalendarWidget from "@/components/dashboard/BidCalendarWidget";
import WinLossWidget from "@/components/dashboard/WinLossWidget";
import PerformanceMetrics from "@/components/dashboard/PerformanceMetrics";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import CompanyAddressBook from "@/components/settings/CompanyAddressBook";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useState, useEffect } from "react";
import { Target, Percent } from "lucide-react";

export default function Home() {
  const companyId = "default"; // TODO: Get from auth context
  const [winRate, setWinRate] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  
  // Load win/loss data for win rate calculation
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection(
      recordsPath,
      (records: any[]) => {
        if (records.length > 0) {
          const wins = records.filter((r: any) => r.status === "won").length;
          const rate = (wins / records.length) * 100;
          setWinRate(Math.round(rate * 10) / 10); // Round to 1 decimal
          setTotalBids(records.length);
        } else {
          setWinRate(0);
          setTotalBids(0);
        }
      }
    );

    return () => unsubscribe();
  }, [companyId]);
  
  // Mock data - replace with real data from Firestore
  const activeProjects = [
    { id: "1", name: "Downtown Office Building", gc: "ABC Construction", bidDate: "2024-12-15", status: "draft" },
    { id: "2", name: "Industrial Warehouse", gc: "XYZ Builders", bidDate: "2024-12-20", status: "active" },
    { id: "3", name: "Bridge Restoration", gc: "Infrastructure Co", bidDate: "2024-12-10", status: "active" },
  ];

  const upcomingBids = activeProjects
    .filter(p => p.status === "active")
    .sort((a, b) => new Date(a.bidDate).getTime() - new Date(b.bidDate).getTime())
    .slice(0, 3);

  const getDaysUntilBid = (bidDate: string) => {
    const today = new Date();
    const bid = new Date(bidDate);
    const diff = Math.ceil((bid.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-blue-100 text-blue-800";
      case "draft": return "bg-gray-100 text-gray-800";
      case "submitted": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header Section - Refined */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-gray-200/60">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Dashboard</h1>
            <p className="text-sm text-gray-500">
              Welcome back • {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/settings">
              <Button variant="outline" size="lg" className="gap-2">
                <FileText className="w-5 h-5" />
                Company Settings
              </Button>
            </Link>
            <Link href="/projects/new">
              <Button variant="primary" size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
                <Plus className="w-5 h-5" />
                New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Quick Stats - Enhanced */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Projects</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{activeProjects.length}</p>
                  <p className="text-xs text-gray-500">All time</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Active Bids</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {activeProjects.filter(p => p.status === "active").length}
                  </p>
                  <p className="text-xs text-green-600 font-medium">In progress</p>
                </div>
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Upcoming Bids</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {upcomingBids.length}
                  </p>
                  <p className="text-xs text-orange-600 font-medium">Next 7 days</p>
                </div>
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Win Rate</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">
                    {winRate}%
                  </p>
                  <p className="text-xs text-purple-600 font-medium">
                    {totalBids > 0 ? `${totalBids} total bids` : "No data yet"}
                  </p>
                </div>
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Target className="w-5 h-5 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Company Address Book */}
        <div>
          <CompanyAddressBook companyId={companyId} compact={true} />
        </div>

        {/* Main Control Center Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Active Projects & Calendar */}
          <div className="lg:col-span-2 space-y-5">
            {/* Bid Calendar Widget */}
            <BidCalendarWidget companyId={companyId} />
            
            {/* Active Projects - Enhanced */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Active Projects</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Your current work in progress</p>
                </div>
                <Link href="/projects">
                  <Button variant="outline" size="sm" className="text-xs">View All →</Button>
                </Link>
              </div>

              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {activeProjects.map((project, index) => {
                      const daysUntil = getDaysUntilBid(project.bidDate);
                      const isUrgent = daysUntil <= 7 && daysUntil >= 0;
                      
                      return (
                        <Link
                          key={project.id}
                          href={`/projects/${project.id}`}
                          className="block p-4 hover:bg-gray-50/80 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1.5">
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                  {project.name}
                                </h3>
                                <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getStatusColor(project.status)}`}>
                                  {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{project.gc}</p>
                              <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1.5 text-gray-500">
                                  <Calendar className="w-3.5 h-3.5" />
                                  {new Date(project.bidDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </span>
                                {isUrgent && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                                    {daysUntil === 0 ? "Due Today!" : `${daysUntil} days left`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" className="ml-4 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              Open →
                            </Button>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Win/Loss Widget - Compact */}
            <WinLossWidget companyId={companyId} />
          </div>

          {/* Right Column - Performance & Activity */}
          <div className="space-y-5">
            {/* Performance Metrics Widget */}
            <PerformanceMetrics companyId={companyId} />

            {/* Activity Feed */}
            <ActivityFeed companyId={companyId} />
          </div>
        </div>
      </div>
    </div>
  );
}

