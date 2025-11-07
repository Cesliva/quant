"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Plus, Calendar, TrendingUp, FileText, Search, Upload } from "lucide-react";
import BidCalendarWidget from "@/components/dashboard/BidCalendarWidget";
import WinLossWidget from "@/components/dashboard/WinLossWidget";
import PerformanceMetrics from "@/components/dashboard/PerformanceMetrics";
import ActivityFeed from "@/components/dashboard/ActivityFeed";

export default function Home() {
  const companyId = "default"; // TODO: Get from auth context
  
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
          <Link href="/projects/new">
            <Button variant="primary" size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
              <Plus className="w-5 h-5" />
              New Project
            </Button>
          </Link>
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

        </div>

        {/* Quick Actions - Moved to Top */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Quick Actions</h3>
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                <Link href="/projects/new">
                  <Button variant="primary" className="w-full flex items-center justify-center gap-2 h-11 shadow-sm hover:shadow-md transition-shadow">
                    <Plus className="w-4 h-4" />
                    New Estimate
                  </Button>
                </Link>
                <Link href="/spec-review">
                  <Button variant="secondary" className="w-full flex items-center justify-center gap-2 h-11">
                    <FileText className="w-4 h-4" />
                    Spec Review
                  </Button>
                </Link>
                <Link href="/reports?projectId=1">
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2 h-11 hover:bg-gray-50">
                    <TrendingUp className="w-4 h-4" />
                    View Reports
                  </Button>
                </Link>
                <Link href="/import-quotes">
                  <Button variant="outline" className="w-full flex items-center justify-center gap-2 h-11 hover:bg-gray-50">
                    <Upload className="w-4 h-4" />
                    Import Quotes
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
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

