"use client";

import { useEffect, useState, useMemo } from "react";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { TrendingUp, TrendingDown, ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  status?: string;
  archived?: boolean;
  estimatedValue?: number | string;
  awardValue?: number;
  actualTotalCost?: number;
  actualHoursFabrication?: number;
  actualHoursWelding?: number;
  actualHoursPrepPaint?: number;
  actualHoursField?: number;
  estimatedHoursToCompletion?: number;
  decisionDate?: string;
  deliveryDate?: string;
  updatedAt?: any;
  createdAt?: any;
  generalContractor?: string;
  owner?: string;
}

export default function EstimateVsActualPage() {
  const companyId = useCompanyId();
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

  // Get all completed projects with estimate vs actual data
  const completedProjects = useMemo(() => {
    return projects
      .filter((p) => {
        if (p.archived) return false;
        const status = p.status?.toLowerCase();
        return (
          status === "won" &&
          (p.deliveryDate || p.decisionDate) &&
          (p.estimatedValue || p.awardValue || p.actualTotalCost)
        );
      })
      .map((project) => {
        const estimate = typeof project.estimatedValue === "string"
          ? parseFloat(project.estimatedValue) || 0
          : project.estimatedValue || project.awardValue || 0;
        
        const actual = project.actualTotalCost || project.awardValue || estimate;
        
        const variance = actual - estimate;
        const variancePercent = estimate > 0 ? (variance / estimate) * 100 : 0;
        
        // Hours comparison
        const estimatedHours = project.estimatedHoursToCompletion || 0;
        const actualHours = (project.actualHoursFabrication || 0) +
          (project.actualHoursWelding || 0) +
          (project.actualHoursPrepPaint || 0) +
          (project.actualHoursField || 0);
        const hoursVariance = actualHours - estimatedHours;
        const hoursVariancePercent = estimatedHours > 0 ? (hoursVariance / estimatedHours) * 100 : 0;

        // Sort by most recent
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
          estimatedHours,
          actualHours,
          hoursVariance,
          hoursVariancePercent,
          sortDate,
        };
      })
      .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime());
  }, [projects]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (completedProjects.length === 0) {
      return {
        totalProjects: 0,
        totalEstimate: 0,
        totalActual: 0,
        totalVariance: 0,
        avgVariancePercent: 0,
        overBudget: 0,
        underBudget: 0,
        onBudget: 0,
      };
    }

    const totalEstimate = completedProjects.reduce((sum, p) => sum + p.estimate, 0);
    const totalActual = completedProjects.reduce((sum, p) => sum + p.actual, 0);
    const totalVariance = totalActual - totalEstimate;
    const avgVariancePercent = totalEstimate > 0 ? (totalVariance / totalEstimate) * 100 : 0;

    const overBudget = completedProjects.filter((p) => p.variance > 0).length;
    const underBudget = completedProjects.filter((p) => p.variance < 0).length;
    const onBudget = completedProjects.filter((p) => Math.abs(p.variancePercent) < 1).length;

    return {
      totalProjects: completedProjects.length,
      totalEstimate,
      totalActual,
      totalVariance,
      avgVariancePercent,
      overBudget,
      underBudget,
      onBudget,
    };
  }, [completedProjects]);

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
          <h1 className="text-4xl font-semibold tracking-tight mb-2">Estimate vs Actual</h1>
          <p className="text-slate-600">
            Post-project analysis comparing estimated costs and hours to actual performance
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Total Projects</p>
              <p className="text-2xl font-semibold text-gray-900">{summary.totalProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Total Variance</p>
              <p className={`text-2xl font-semibold ${
                summary.totalVariance > 0 ? "text-red-600" : summary.totalVariance < 0 ? "text-green-600" : "text-gray-900"
              }`}>
                {summary.totalVariance >= 0 ? "+" : ""}
                ${(summary.totalVariance / 1000).toFixed(0)}K
              </p>
              <p className="text-xs text-gray-500">
                {summary.avgVariancePercent >= 0 ? "+" : ""}
                {summary.avgVariancePercent.toFixed(1)}% average
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Over Budget</p>
              <p className="text-2xl font-semibold text-red-600">{summary.overBudget}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Under Budget</p>
              <p className="text-2xl font-semibold text-green-600">{summary.underBudget}</p>
            </CardContent>
          </Card>
        </div>

        {/* Projects List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Completed Projects Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            {completedProjects.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-600 mb-2">No completed projects found</p>
                <p className="text-sm text-slate-500">
                  Projects marked as "won" with delivery or decision dates will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {completedProjects.map((project) => {
                  const isOver = project.variance > 0;
                  const isUnder = project.variance < 0;
                  
                  return (
                    <Link
                      key={project.id}
                      href={project.id ? `/projects/${project.id}` : "#"}
                      className="block border border-slate-200 rounded-xl p-4 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-900">
                              {project.projectName || project.projectNumber || "Untitled Project"}
                            </h3>
                            {project.projectNumber && (
                              <span className="text-xs text-slate-500">({project.projectNumber})</span>
                            )}
                          </div>
                          {project.generalContractor && (
                            <p className="text-sm text-slate-600">{project.generalContractor}</p>
                          )}
                          {project.deliveryDate && (
                            <p className="text-xs text-slate-500 mt-1">
                              Delivered: {new Date(project.deliveryDate).toLocaleDateString("en-US", {
                                month: "long",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </p>
                          )}
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${
                          isOver ? "bg-red-50 text-red-700" : isUnder ? "bg-green-50 text-green-700" : "bg-slate-50 text-slate-700"
                        }`}>
                          {isOver ? (
                            <TrendingUp className="w-4 h-4" />
                          ) : isUnder ? (
                            <TrendingDown className="w-4 h-4" />
                          ) : null}
                          <span className="font-semibold">
                            {isOver ? "+" : ""}
                            {project.variancePercent.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                        <div className="border-l-2 border-blue-500 pl-3">
                          <p className="text-xs text-slate-500 mb-1">Estimated Cost</p>
                          <p className="text-lg font-semibold text-slate-900">
                            ${project.estimate.toLocaleString()}
                          </p>
                        </div>
                        <div className="border-l-2 border-purple-500 pl-3">
                          <p className="text-xs text-slate-500 mb-1">Actual Cost</p>
                          <p className="text-lg font-semibold text-slate-900">
                            ${project.actual.toLocaleString()}
                          </p>
                        </div>
                        <div className="border-l-2 border-amber-500 pl-3">
                          <p className="text-xs text-slate-500 mb-1">Variance</p>
                          <p className={`text-lg font-semibold ${
                            isOver ? "text-red-600" : isUnder ? "text-green-600" : "text-slate-900"
                          }`}>
                            {isOver ? "+" : ""}
                            ${project.variance.toLocaleString()}
                          </p>
                        </div>
                        {project.estimatedHours > 0 && (
                          <div className="border-l-2 border-indigo-500 pl-3">
                            <p className="text-xs text-slate-500 mb-1">Hours Variance</p>
                            <p className={`text-lg font-semibold ${
                              project.hoursVariance > 0 ? "text-red-600" : project.hoursVariance < 0 ? "text-green-600" : "text-slate-900"
                            }`}>
                              {project.hoursVariance >= 0 ? "+" : ""}
                              {project.hoursVariance.toFixed(0)} hrs
                            </p>
                            <p className="text-xs text-slate-500">
                              ({project.hoursVariancePercent >= 0 ? "+" : ""}
                              {project.hoursVariancePercent.toFixed(1)}%)
                            </p>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}






