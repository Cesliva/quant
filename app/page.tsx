"use client";

import Link from "next/link";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { Plus, Calendar, TrendingUp, FileText, Clock, Search } from "lucide-react";

export default function Home() {
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Section */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Quant Estimating AI</h1>
            <p className="text-lg text-gray-600">
              Steel fabrication estimating software with AI integration
            </p>
          </div>
          <Link href="/projects/new">
            <Button variant="primary" size="lg" className="gap-2">
              <Plus className="w-5 h-5" />
              New Project
            </Button>
          </Link>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Projects</p>
                  <p className="text-2xl font-bold text-gray-900">{activeProjects.length}</p>
                </div>
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Bids</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {activeProjects.filter(p => p.status === "active").length}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Upcoming Bids</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {upcomingBids.length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold text-gray-900">$0.00</p>
                  <p className="text-xs text-gray-500">AI Usage</p>
                </div>
                <Clock className="w-8 h-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active Projects Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">Active Projects</h2>
              <Link href="/projects">
                <Button variant="outline" size="sm">View All</Button>
              </Link>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {activeProjects.map((project) => {
                    const daysUntil = getDaysUntilBid(project.bidDate);
                    const isUrgent = daysUntil <= 7 && daysUntil >= 0;
                    
                    return (
                      <Link
                        key={project.id}
                        href={`/projects/${project.id}`}
                        className="block p-4 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold text-gray-900">{project.name}</h3>
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}>
                                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600">{project.gc}</p>
                            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Bid Due: {new Date(project.bidDate).toLocaleDateString()}
                              </span>
                              {isUrgent && (
                                <span className="text-orange-600 font-medium">
                                  {daysUntil === 0 ? "Due Today!" : `${daysUntil} days left`}
                                </span>
                              )}
                            </div>
                          </div>
                          <Button variant="outline" size="sm">Open</Button>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <Link href="/projects/new">
                    <Button variant="primary" className="w-full justify-start gap-2">
                      <Plus className="w-4 h-4" />
                      New Estimate
                    </Button>
                  </Link>
                  <Link href="/spec-review">
                    <Button variant="secondary" className="w-full justify-start gap-2">
                      <FileText className="w-4 h-4" />
                      Spec Review
                    </Button>
                  </Link>
                  <Link href="/reports?projectId=1">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <TrendingUp className="w-4 h-4" />
                      View Reports
                    </Button>
                  </Link>
                  <Link href="/settings">
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Search className="w-4 h-4" />
                      Settings
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Bids Sidebar */}
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Bids</h2>
            
            <Card>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-200">
                  {upcomingBids.length > 0 ? (
                    upcomingBids.map((project) => {
                      const daysUntil = getDaysUntilBid(project.bidDate);
                      const isUrgent = daysUntil <= 7;
                      
                      return (
                        <div key={project.id} className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-medium text-gray-900 text-sm">{project.name}</h4>
                            {isUrgent && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                                Urgent
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-600 mb-2">{project.gc}</p>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            <span>
                              {daysUntil === 0 
                                ? "Due Today" 
                                : daysUntil === 1 
                                ? "Due Tomorrow" 
                                : `${daysUntil} days`}
                            </span>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Link href={`/projects/${project.id}`} className="flex-1">
                              <Button variant="outline" size="sm" className="w-full">
                                View Details
                              </Button>
                            </Link>
                            <Link href={`/reports?projectId=${project.id}`} className="flex-1">
                              <Button variant="primary" size="sm" className="w-full">
                                Reports
                              </Button>
                            </Link>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      No upcoming bids
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Project Templates */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Start Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href="/projects/new?template=structural">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    Structural Steel
                  </Button>
                </Link>
                <Link href="/projects/new?template=misc">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    Miscellaneous Metals
                  </Button>
                </Link>
                <Link href="/projects/new?template=stairs">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    Stairs & Railings
                  </Button>
                </Link>
                <Link href="/projects/new?template=bridge">
                  <Button variant="outline" className="w-full justify-start" size="sm">
                    Bridge Work
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

