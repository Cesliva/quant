"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { subscribeToCollection, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getProjectPath } from "@/lib/firebase/firestore";
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
    <Card className="border border-gray-200 shadow-lg hover:shadow-xl transition-all duration-300 bg-white">
      <CardHeader className="pb-5">
        <CardTitle className="flex items-center gap-2 text-lg font-semibold">
          <Briefcase className="w-5 h-5 text-blue-600" />
          Backlog at a Glance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Total Active Projects */}
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Active Projects</p>
                <p className="text-2xl font-bold text-gray-900">{totalProjects}</p>
              </div>
            </div>
            <Link
              href="/projects"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              View All →
            </Link>
          </div>

          {/* Total Contract Value */}
          <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Total Contract Value</p>
                <p className="text-2xl font-bold text-gray-900">
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
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Estimated Weeks of Coverage</p>
                  <p className="text-2xl font-bold text-gray-900">{estimatedWeeks} weeks</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Based on {weeklyCapacity.toLocaleString()} hours/week capacity
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-400 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600">Estimated Weeks of Coverage</p>
                  <p className="text-sm text-gray-500">
                    {weeklyCapacity 
                      ? "No hours data available for active projects"
                      : "Set weekly capacity in Company Settings to calculate coverage"}
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

