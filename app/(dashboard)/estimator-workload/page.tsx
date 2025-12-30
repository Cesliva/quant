"use client";

import { useEffect, useState, useMemo } from "react";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { User, Calendar, Briefcase, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  assignedEstimator?: string;
  bidDate?: string;
  bidDueDate?: string;
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

interface WorkloadEntry {
  estimatorName: string;
  projectName: string;
  projectId?: string;
  bidDate: string;
  source: "project" | "bid";
}

export default function EstimatorWorkloadPage() {
  const companyId = useCompanyId();
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Estimator Workload</h1>
          <p className="text-slate-600">
            Active assignments from projects and bid schedule
          </p>
        </div>

        {workload.length === 0 ? (
          <Card>
            <CardContent className="p-12">
              <p className="text-center text-slate-500">
                No estimators assigned to projects yet. Assign estimators when creating projects or adding bids.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedByEstimator)
              .sort(([, a], [, b]) => b.length - a.length)
              .map(([estimatorName, entries]) => (
                <Card key={estimatorName} className="border border-slate-200 shadow-sm">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      {estimatorName}
                      <span className="text-sm font-normal text-slate-500">
                        ({entries.length} {entries.length === 1 ? "project" : "projects"})
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {entries.map((entry, idx) => (
                        <div
                          key={`${entry.projectId || entry.projectName}-${idx}`}
                          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-slate-300 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            {entry.projectId ? (
                              <Link
                                href={`/projects/${entry.projectId}`}
                                className="font-medium text-slate-900 hover:text-blue-600 transition-colors truncate block"
                              >
                                {entry.projectName}
                              </Link>
                            ) : (
                              <span className="font-medium text-slate-900 truncate block">
                                {entry.projectName}
                              </span>
                            )}
                            <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>
                                  {new Date(entry.bidDate).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Briefcase className="w-4 h-4" />
                                <span className="capitalize">{entry.source}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}






