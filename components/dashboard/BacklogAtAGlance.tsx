"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { Briefcase, DollarSign, Calendar } from "lucide-react";
import Link from "next/link";

interface BacklogAtAGlanceProps {
  companyId: string;
}

interface Project {
  id: string;
  projectName?: string;
  status?: string;
  awardValue?: number;
  estimatedValue?: string | number;
  archived?: boolean;
  estimatedHoursToCompletion?: number;
  fabHours?: number;
  actualTotalHours?: number;
}

export default function BacklogAtAGlance({ companyId }: BacklogAtAGlanceProps) {
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [totalContractValue, setTotalContractValue] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [estimatedWeeks, setEstimatedWeeks] = useState<number | null>(null);
  const [weeklyCapacity, setWeeklyCapacity] = useState<number | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      return;
    }

    // Load company settings to get weekly capacity
    const loadCompanySettings = async () => {
      try {
        const companyDoc = await getDocument(`companies/${companyId}`);
        if (companyDoc?.settings?.weeklyCapacity) {
          setWeeklyCapacity(companyDoc.settings.weeklyCapacity);
        }
      } catch (error) {
        console.error("Failed to load company settings:", error);
      }
    };

    loadCompanySettings();

    // Subscribe to projects
    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (projects) => {
        // Filter for active/awarded projects
        const active = projects.filter(
          (p) =>
            (p.status === "active" || p.status === "awarded" || p.status === "won") &&
            !p.archived
        );

        setActiveProjects(active);
        setTotalProjects(active.length);

        // Calculate total contract value
        const totalValue = active.reduce((sum, project) => {
          const value = project.awardValue || 
                       (typeof project.estimatedValue === "number" ? project.estimatedValue : 0) ||
                       (typeof project.estimatedValue === "string" ? parseFloat(project.estimatedValue) || 0 : 0);
          return sum + value;
        }, 0);

        setTotalContractValue(totalValue);

        // Calculate estimated weeks of coverage
        const totalHours = active.reduce((sum, project) => {
          return sum + (project.estimatedHoursToCompletion || 
                       project.fabHours || 
                       project.actualTotalHours || 
                       0);
        }, 0);

        if (weeklyCapacity && weeklyCapacity > 0 && totalHours > 0) {
          setEstimatedWeeks(Math.ceil(totalHours / weeklyCapacity));
        } else {
          setEstimatedWeeks(null);
        }
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  return (
    <Card className="w-full h-full flex flex-col p-2 md:p-3 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
      <CardHeader className="pb-3 mb-3 border-b border-gray-200/70">
        <CardTitle className="flex items-center gap-2 text-sm font-extrabold text-gray-900 tracking-wide uppercase">
          <Briefcase className="w-4 h-4 text-blue-600" />
          Backlog at a Glance
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="space-y-2">
          {/* Total Active Projects */}
          <div className="flex items-center justify-between p-2 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <Briefcase className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-gray-600">Active Projects</p>
                <p className="text-lg font-bold text-gray-900">{totalProjects}</p>
              </div>
            </div>
            <Link
              href="/projects"
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              View →
            </Link>
          </div>

          {/* Total Contract Value */}
          <div className="flex items-center justify-between p-2 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-600">Total Contract Value</p>
                <p className="text-lg font-bold text-gray-900 truncate">
                  {totalContractValue.toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Estimated Weeks of Coverage */}
          {estimatedWeeks !== null && weeklyCapacity ? (
            <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-600">Weeks Coverage</p>
                  <p className="text-lg font-bold text-gray-900">{estimatedWeeks} weeks</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    {weeklyCapacity.toLocaleString()} hrs/week
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-600">Weeks Coverage</p>
                  <p className="text-[10px] text-gray-500">
                    {weeklyCapacity 
                      ? "No hours data"
                      : "Set capacity in Settings"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

