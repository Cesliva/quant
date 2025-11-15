"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Plus, Calendar, TrendingUp, FileText, Search, Upload, Target, Percent, Archive, Trash2, BarChart3, Brain, Sparkles } from "lucide-react";
import BidCalendarWidget from "@/components/dashboard/BidCalendarWidget";
import WinLossWidget from "@/components/dashboard/WinLossWidget";
import PerformanceMetrics from "@/components/dashboard/PerformanceMetrics";
import ActivityFeed from "@/components/dashboard/ActivityFeed";
import CompanyAddressBook from "@/components/settings/CompanyAddressBook";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useState, useEffect } from "react";
import { clearAllFirestoreData } from "@/lib/utils/clearAllFirestoreData";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  generalContractor?: string;
  bidDueDate?: string;
  status?: string;
  isSampleData?: boolean;
  archived?: boolean;
}

export default function Home() {
  const companyId = "default"; // TODO: Get from auth context
  const [winRate, setWinRate] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
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

  // Load projects from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      // No fallback data - show empty list if Firebase not configured
      setActiveProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (projects) => {
        // Debug: Log all projects and their archived status
        console.log("All projects from Firestore:", projects.map(p => ({ 
          id: p.id, 
          name: p.projectName, 
          archived: p.archived,
          archivedType: typeof p.archived 
        })));
        
        // Filter out archived projects - be explicit about what we're filtering
        const activeOnly = projects.filter((p) => {
          // Explicitly check: archived must be exactly true (boolean)
          const isArchived = p.archived === true;
          if (isArchived) {
            console.log(`Filtering out archived project: ${p.id} (${p.projectName})`);
          }
          return !isArchived;
        });
        
        // Map Firestore projects to the format expected by the UI
        const mappedProjects = activeOnly.map((p) => ({
          id: p.id,
          name: p.projectName || "Untitled Project",
          gc: p.generalContractor || "",
          bidDate: p.bidDueDate || "",
          status: p.status || "draft",
          isSampleData: p.isSampleData || false,
          projectNumber: p.projectNumber || "",
        }));
        
        // Deduplicate by ID to prevent duplicate entries
        const uniqueProjects = mappedProjects.filter((project, index, self) => 
          index === self.findIndex((p) => p.id === project.id)
        );
        
        if (uniqueProjects.length !== mappedProjects.length) {
          console.warn(`Found ${mappedProjects.length - uniqueProjects.length} duplicate project(s) in Firestore. Deduplicating...`);
        }
        
        console.log(`Active projects after filtering and deduplication: ${uniqueProjects.length}`, uniqueProjects.map(p => ({ id: p.id, name: p.name })));
        setActiveProjects(uniqueProjects);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

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
            <Link href="/projects/new/details">
              <Button variant="primary" size="lg" className="gap-2 shadow-md hover:shadow-lg transition-shadow">
                <Plus className="w-5 h-5" />
                New Project
              </Button>
            </Link>
            {/* Admin-only destructive buttons removed for production */}
          </div>
        </div>

        {/* Quick Stats - Enhanced */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-0 shadow-sm hover:shadow-md transition-shadow bg-white/80 backdrop-blur-sm">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Total Projects</p>
                  <p className="text-3xl font-bold text-gray-900 mb-1">{activeProjects.length || 0}</p>
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
                  <p className="text-sm text-gray-500 mt-0.5">
                    Your current work in progress {(() => {
                      // Deduplicate before counting to ensure accurate count
                      const uniqueProjects = activeProjects.filter((project, index, self) => 
                        index === self.findIndex((p) => p.id === project.id)
                      );
                      return uniqueProjects.length > 0 && `(${uniqueProjects.length} project${uniqueProjects.length !== 1 ? 's' : ''})`;
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href="/projects/archived">
                    <Button variant="outline" size="sm" className="text-xs gap-1">
                      <Archive className="w-3 h-3" />
                      Archived
                    </Button>
                  </Link>
                  <Link href="/projects">
                    <Button variant="outline" size="sm" className="text-xs">View All →</Button>
                  </Link>
                </div>
              </div>

              {/* Search/Filter by Project Number */}
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by project number or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {activeProjects
                      .filter((project) => {
                        if (!searchQuery) return true;
                        const query = searchQuery.toLowerCase();
                        return (
                          project.projectNumber?.toLowerCase().includes(query) ||
                          project.name?.toLowerCase().includes(query) ||
                          project.gc?.toLowerCase().includes(query)
                        );
                      })
                      // Deduplicate by ID to prevent React key warnings
                      .filter((project, index, self) => 
                        index === self.findIndex((p) => p.id === project.id)
                      )
                      .map((project, index) => {
                      const daysUntil = getDaysUntilBid(project.bidDate);
                      const isUrgent = daysUntil <= 7 && daysUntil >= 0;
                      
                      return (
                        <Link
                          key={`${project.id}-${index}`}
                          href={`/projects/${project.id}`}
                          className="block p-4 hover:bg-gray-50/80 transition-all group"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2.5 mb-1.5">
                                <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                                  {project.name}
                                </h3>
                                {project.projectNumber && (
                                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium flex-shrink-0 bg-gray-100 text-gray-700 border border-gray-200">
                                    {project.projectNumber}
                                  </span>
                                )}
                                {project.isSampleData && (
                                  <span className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 bg-orange-100 text-orange-700 border border-orange-200">
                                    Sample
                                  </span>
                                )}
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

            {/* Reports Widget */}
            <Link href="/reports">
              <Card className="border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer group border-2 hover:border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-amber-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                      <BarChart3 className="w-8 h-8 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        Reports & Analytics
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Comprehensive company-wide reports and analytics
                      </p>
                      <p className="text-xs text-amber-700 font-medium">
                        Coming soon →
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>

            {/* AI Post Bid Analysis Widget */}
            <Link href="/post-bid-analysis">
              <Card className="border-0 shadow-sm hover:shadow-lg transition-all cursor-pointer group border-2 hover:border-purple-300 bg-gradient-to-br from-purple-50 to-indigo-50">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-purple-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg relative">
                      <Brain className="w-8 h-8 text-white" />
                      <Sparkles className="w-4 h-4 text-yellow-300 absolute -top-1 -right-1 drop-shadow-lg" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                        AI Post Bid Analysis
                      </h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Input project completion data for AI-powered trend analysis
                      </p>
                      <p className="text-xs text-purple-700 font-medium">
                        Track performance & insights →
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

