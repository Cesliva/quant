"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import Link from "next/link";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  status?: string;
  archived?: boolean;
  estimatedValue?: number | string;
  awardValue?: number;
  actualTotalCost?: number;
  decisionDate?: string;
  deliveryDate?: string;
  updatedAt?: any;
}

interface EstimateVsActualCardProps {
  companyId: string;
}

export default function EstimateVsActualCard({ companyId }: EstimateVsActualCardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

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

  // Get completed projects (won status with decision date or delivery date)
  const completedProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (p.archived) return false;
        const status = p.status?.toLowerCase();
        // Include won projects that have been delivered or have a decision date
        return (
          status === "won" &&
          (p.deliveryDate || p.decisionDate) &&
          (p.estimatedValue || p.awardValue || p.actualTotalCost)
        );
      })
      .map((project) => {
        // Get estimate value (prefer estimatedValue, fallback to awardValue)
        const estimate = typeof project.estimatedValue === "string"
          ? parseFloat(project.estimatedValue) || 0
          : project.estimatedValue || project.awardValue || 0;
        
        // Get actual value (prefer actualTotalCost, fallback to awardValue)
        const actual = project.actualTotalCost || project.awardValue || estimate;
        
        const variance = actual - estimate;
        const variancePercent = estimate > 0 ? (variance / estimate) * 100 : 0;
        
        // Sort by most recent (deliveryDate or decisionDate or updatedAt)
        let sortDate: Date;
        if (project.deliveryDate) {
          sortDate = new Date(project.deliveryDate);
        } else if (project.decisionDate) {
          sortDate = new Date(project.decisionDate);
        } else if (project.updatedAt) {
          sortDate = project.updatedAt.toDate ? project.updatedAt.toDate() : new Date(project.updatedAt);
        } else {
          sortDate = new Date(0);
        }

        return {
          ...project,
          estimate,
          actual,
          variance,
          variancePercent,
          sortDate,
        };
      })
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
      .slice(0, 4); // Top 4 latest
  }, [projects]);

  if (loading) {
    return (
      <Card className="w-full h-full flex flex-col p-2 md:p-3 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Estimate vs Actual</CardTitle>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-xs text-slate-600">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (completedProjects.length === 0) {
    return (
      <Card className="w-full h-full flex flex-col cursor-pointer p-2 md:p-3 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
        <Link href="/estimate-vs-actual" className="flex flex-col flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>Estimate vs Actual</span>
              <ArrowRight className="w-3 h-3 text-slate-400" />
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 flex items-center justify-center">
            <p className="text-xs text-slate-500 text-center">
              No completed projects yet.
            </p>
          </CardContent>
        </Link>
      </Card>
    );
  }

  return (
    <Card className="w-full h-full flex flex-col cursor-pointer p-2 md:p-3 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
      <Link href="/estimate-vs-actual" className="flex flex-col flex-1">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-sm">
            <span>Estimate vs Actual</span>
            <ArrowRight className="w-3 h-3 text-slate-400" />
          </CardTitle>
          <p className="text-[10px] text-slate-500 mt-0.5">
            Latest {completedProjects.length} completed
          </p>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-2 overflow-y-auto">
          {completedProjects.slice(0, 3).map((project) => {
            const isOver = project.variance > 0;
            const isUnder = project.variance < 0;
            
            return (
              <div
                key={project.id}
                className="border border-slate-200 rounded-lg p-2 bg-white hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 text-xs truncate">
                      {project.projectName || project.projectNumber || "Untitled Project"}
                    </p>
                  </div>
                  <div className={`flex items-center gap-0.5 ml-2 ${
                    isOver ? "text-red-600" : isUnder ? "text-green-600" : "text-slate-600"
                  }`}>
                    {isOver ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : isUnder ? (
                      <TrendingDown className="w-3 h-3" />
                    ) : null}
                    <span className="text-xs font-semibold">
                      {isOver ? "+" : ""}
                      {project.variancePercent.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1 text-[10px]">
                  <div>
                    <span className="text-slate-500">Est:</span>
                    <span className="ml-1 font-medium text-slate-700">
                      ${(project.estimate / 1000).toFixed(0)}K
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500">Act:</span>
                    <span className="ml-1 font-medium text-slate-700">
                      ${(project.actual / 1000).toFixed(0)}K
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Link>
    </Card>
  );
}

