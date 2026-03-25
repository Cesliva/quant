"use client";

import { useState, useEffect, useMemo } from "react";
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

const TOP_BY_SIZE = 4;

function parseContractValue(project: Project): number {
  if (project.awardValue != null && project.awardValue > 0) return project.awardValue;
  const ev = project.estimatedValue;
  if (ev === undefined || ev === null) return 0;
  if (typeof ev === "number") return ev;
  const cleaned = String(ev).replace(/[^0-9.-]/g, "");
  return parseFloat(cleaned) || 0;
}

export default function BacklogAtAGlance({ companyId }: BacklogAtAGlanceProps) {
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [totalContractValue, setTotalContractValue] = useState(0);
  const [totalProjects, setTotalProjects] = useState(0);
  const [estimatedWeeks, setEstimatedWeeks] = useState<number | null>(null);
  const [weeklyCapacity, setWeeklyCapacity] = useState<number | null>(null);

  const topProjectsBySize = useMemo(() => {
    return [...activeProjects]
      .sort((a, b) => parseContractValue(b) - parseContractValue(a))
      .slice(0, TOP_BY_SIZE);
  }, [activeProjects]);

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      return;
    }

    const loadCompanySettings = async () => {
      try {
        const companyDoc = await getDocument(`companies/${companyId}`);
        const settings = companyDoc?.settings as Record<string, unknown> | undefined;
        const cap =
          (typeof settings?.weeklyCapacity === "number" ? settings.weeklyCapacity : null) ??
          (typeof settings?.shopCapacityHoursPerWeek === "number"
            ? settings.shopCapacityHoursPerWeek
            : null);
        if (cap != null && cap > 0) {
          setWeeklyCapacity(cap);
        }
      } catch (error) {
        console.error("Failed to load company settings:", error);
      }
    };

    loadCompanySettings();

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (projects) => {
        const active = projects.filter(
          (p) =>
            (p.status === "active" || p.status === "awarded" || p.status === "won") &&
            !p.archived
        );

        setActiveProjects(active);
        setTotalProjects(active.length);

        const totalValue = active.reduce((sum, project) => {
          return sum + parseContractValue(project);
        }, 0);

        setTotalContractValue(totalValue);

      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Recompute weeks when weekly capacity or project hours change
  useEffect(() => {
    if (!weeklyCapacity || weeklyCapacity <= 0) {
      setEstimatedWeeks(null);
      return;
    }
    if (activeProjects.length === 0) {
      setEstimatedWeeks(null);
      return;
    }
    const totalHours = activeProjects.reduce((sum, project) => {
      return (
        sum +
        (project.estimatedHoursToCompletion ||
          project.fabHours ||
          project.actualTotalHours ||
          0)
      );
    }, 0);
    if (totalHours > 0) {
      setEstimatedWeeks(Math.ceil(totalHours / weeklyCapacity));
    } else {
      setEstimatedWeeks(null);
    }
  }, [weeklyCapacity, activeProjects]);

  return (
    <Card className="w-full flex flex-col p-2 md:p-3 rounded-2xl border border-slate-100/50 shadow-sm hover:shadow-md transition-all duration-300">
      <CardHeader className="pb-2 mb-2 border-b border-gray-200/70 px-0 pt-0">
        <CardTitle className="flex items-center gap-1.5 text-xs font-extrabold text-gray-900 tracking-wide uppercase">
          <Briefcase className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          Backlog at a Glance
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0 pt-0 space-y-1.5">
        {/* Active count + top 4 by size (rolled up) */}
        <div className="rounded-lg border border-blue-100 bg-blue-50/80 p-2">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-blue-500 rounded-md flex items-center justify-center shrink-0">
                <Briefcase className="w-3.5 h-3.5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-gray-600 leading-tight">Active Projects</p>
                <p className="text-base font-bold text-gray-900 leading-tight">{totalProjects}</p>
              </div>
            </div>
            <Link
              href="/projects"
              className="text-[10px] text-blue-600 hover:text-blue-700 font-medium shrink-0"
            >
              View →
            </Link>
          </div>
          {topProjectsBySize.length > 0 && (
            <div className="border-t border-blue-200/60 pt-1.5 mt-1.5">
              <p className="text-[9px] font-semibold text-blue-900/80 uppercase tracking-wide mb-1">
                Top {Math.min(TOP_BY_SIZE, topProjectsBySize.length)} by size
              </p>
              <ul className="space-y-0.5">
                {topProjectsBySize.map((p) => {
                  const v = parseContractValue(p);
                  return (
                    <li key={p.id} className="flex items-center justify-between gap-1 text-[10px] min-w-0">
                      <Link
                        href={`/projects/${p.id}`}
                        className="truncate text-gray-800 hover:text-blue-700 font-medium"
                      >
                        {p.projectName || "Untitled"}
                      </Link>
                      <span className="text-emerald-700 font-semibold tabular-nums shrink-0">
                        {v > 0
                          ? v.toLocaleString("en-US", {
                              style: "currency",
                              currency: "USD",
                              maximumFractionDigits: 0,
                            })
                          : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg border border-emerald-100">
          <div className="w-7 h-7 bg-emerald-500 rounded-md flex items-center justify-center shrink-0">
            <DollarSign className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-gray-600">Total Contract Value</p>
            <p className="text-sm font-bold text-gray-900 truncate tabular-nums">
              {totalContractValue.toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              })}
            </p>
          </div>
        </div>

        {estimatedWeeks !== null && weeklyCapacity ? (
          <div className="flex items-center gap-2 p-2 bg-orange-50 rounded-lg border border-orange-100">
            <div className="w-7 h-7 bg-orange-500 rounded-md flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-gray-600">Weeks Coverage</p>
              <p className="text-sm font-bold text-gray-900">{estimatedWeeks} wk</p>
              <p className="text-[9px] text-gray-500">{weeklyCapacity.toLocaleString()} hrs/wk</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-100">
            <div className="w-7 h-7 bg-gray-400 rounded-md flex items-center justify-center shrink-0">
              <Calendar className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-medium text-gray-600">Weeks Coverage</p>
              <p className="text-[10px] text-gray-500 leading-snug">
                {weeklyCapacity ? "No hours data" : "Set capacity in Settings"}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
