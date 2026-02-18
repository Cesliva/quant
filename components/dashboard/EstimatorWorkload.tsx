"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { User, Calendar, Briefcase, BarChart3, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  assignedEstimator?: string;
  bidDate?: string;
  status?: string;
  archived?: boolean;
}

interface BidEvent {
  id?: string;
  date: string;
  projectName: string;
  projectId?: string;
  assignedEstimator?: string;
  generalContractor?: string;
  bidTime?: string;
  status?: string;
}

interface EstimatorWorkloadProps {
  companyId: string;
}

interface WorkloadEntry {
  estimatorName: string;
  projectName: string;
  projectId?: string;
  bidDate: string;
  source: "project" | "bid";
}

export default function EstimatorWorkload({ companyId }: EstimatorWorkloadProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [bidEvents, setBidEvents] = useState<BidEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Load projects
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || companyId === "default") {
      setLoading(false);
      return;
    }

    const unsubscribe = subscribeToCollection<Project>(
      `companies/${companyId}/projects`,
      (data) => {
        setProjects(data || []);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Load bid events
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || companyId === "default") {
      return;
    }

    const unsubscribe = subscribeToCollection<BidEvent>(
      `companies/${companyId}/bidEvents`,
      (data) => {
        setBidEvents(data || []);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Aggregate workload from projects and bid events
  const workload = useMemo(() => {
    const entries: WorkloadEntry[] = [];

    // From projects
    projects
      .filter((p) => !p.archived && p.assignedEstimator && (p.bidDate || p.bidDueDate))
      .forEach((project) => {
        entries.push({
          estimatorName: project.assignedEstimator || "Unassigned",
          projectName: project.projectName || project.projectNumber || "Untitled Project",
          projectId: project.id,
          bidDate: project.bidDate || project.bidDueDate || "",
          source: "project",
        });
      });

    // From bid events (if they have assignedEstimator)
    bidEvents
      .filter((event) => event.assignedEstimator && event.date)
      .forEach((event) => {
        // Only add if not already in entries from projects
        const exists = entries.some(
          (e) => e.projectId === event.projectId && e.estimatorName === event.assignedEstimator
        );
        if (!exists) {
          entries.push({
            estimatorName: event.assignedEstimator || "Unassigned",
            projectName: event.projectName,
            projectId: event.projectId,
            bidDate: event.date,
            source: "bid",
          });
        }
      });

    // Sort by bid date (soonest first)
    return entries.sort((a, b) => {
      const dateA = new Date(a.bidDate).getTime();
      const dateB = new Date(b.bidDate).getTime();
      return dateA - dateB;
    });
  }, [projects, bidEvents]);

  // Group by estimator
  const groupedByEstimator = useMemo(() => {
    const groups: Record<string, WorkloadEntry[]> = {};
    workload.forEach((entry) => {
      if (!groups[entry.estimatorName]) {
        groups[entry.estimatorName] = [];
      }
      groups[entry.estimatorName].push(entry);
    });
    return groups;
  }, [workload]);

  // Calculate summary statistics for the graph
  const workloadStats = useMemo(() => {
    const estimatorCounts = Object.entries(groupedByEstimator).map(([name, entries]) => ({
      name,
      count: entries.length,
      entries,
    }));
    
    const totalProjects = workload.length;
    const totalEstimators = estimatorCounts.length;
    const maxProjects = Math.max(...estimatorCounts.map(e => e.count), 0);
    
    return {
      estimatorCounts: estimatorCounts.sort((a, b) => b.count - a.count),
      totalProjects,
      totalEstimators,
      maxProjects,
    };
  }, [groupedByEstimator, workload]);

  if (loading) {
    return (
      <Card className="h-full flex flex-col p-3 md:p-4 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900 tracking-normal">
            <BarChart3 className="w-4 h-4" />
            Estimator Workload
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-xs text-slate-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (workload.length === 0) {
    return (
      <Card className="h-full flex flex-col p-3 md:p-4 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900 tracking-normal">
            <BarChart3 className="w-4 h-4" />
            Estimator Workload
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <p className="text-xs text-slate-500 text-center">
            No estimators assigned to projects yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link 
      href="/estimator-workload"
      className="h-full flex flex-col"
    >
      <Card className="h-full flex flex-col cursor-pointer p-3 md:p-4 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-0.5">
        <CardHeader className="pb-4 pt-5 mb-4 border-b border-gray-200/70">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold text-gray-900 tracking-normal">
              <BarChart3 className="w-4 h-4" />
              Estimator Workload
            </CardTitle>
            <ArrowRight className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {workloadStats.totalEstimators} estimator{workloadStats.totalEstimators !== 1 ? "s" : ""} • {workloadStats.totalProjects} project{workloadStats.totalProjects !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col">
          {/* Compact bar chart */}
          <div className="flex-1 flex flex-col justify-center space-y-2 min-h-0">
            {workloadStats.estimatorCounts.slice(0, 5).map((estimator, index) => {
              const barWidth = workloadStats.maxProjects > 0 
                ? (estimator.count / workloadStats.maxProjects) * 100 
                : 0;
              const displayName = estimator.name.length > 15 
                ? `${estimator.name.substring(0, 15)}...` 
                : estimator.name;
              
              return (
                <div key={estimator.name} className="flex items-center gap-2">
                  <div className="w-20 text-xs text-slate-600 truncate text-right" title={estimator.name}>
                    {displayName}
                  </div>
                  <div className="flex-1 h-5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 flex items-center justify-end pr-2"
                      style={{ width: `${barWidth}%` }}
                    >
                      {barWidth > 20 && (
                        <span className="text-[10px] font-semibold text-white">
                          {estimator.count}
                        </span>
                      )}
                    </div>
                  </div>
                  {barWidth <= 20 && (
                    <div className="w-6 text-xs text-slate-600 text-right">
                      {estimator.count}
                    </div>
                  )}
                </div>
              );
            })}
            {workloadStats.estimatorCounts.length > 5 && (
              <p className="text-[10px] text-slate-400 text-center mt-1">
                +{workloadStats.estimatorCounts.length - 5} more
              </p>
            )}
          </div>
          
          {/* Summary footer */}
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 text-center">
              Click to view detailed workload breakdown
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

