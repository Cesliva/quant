"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks/useAuth";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { subscribeToCollection, getDocRef, getDocument, getProjectPath, setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useState, useMemo } from "react";
import { onSnapshot } from "firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import RecentActivity from "@/components/dashboard/RecentActivity";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  generalContractor?: string;
  gcId?: string;
  projectType?: string;
  bidDueDate?: string;
  bidDate?: string;
  name?: string;
  gc?: string;
  status?: string;
  isSampleData?: boolean;
  archived?: boolean;
  winProbability?: number;
  probabilityOfWin?: number;
  assignedEstimator?: string;
  estimatedHoursToCompletion?: number;
  estimatedStartDate?: string;
  estimatedCompletionDate?: string;
  awardValue?: number;
  actualHoursFabrication?: number;
  actualHoursWelding?: number;
  actualHoursPrepPaint?: number;
  actualHoursField?: number;
  actualTotalHours?: number;
  redFlags?: string[];
  opportunityScore?: number;
  estimatedValue?: string | number;
  projectedStartDate?: string;
  fabHours?: number;
  fabWindowStart?: string;
  fabWindowEnd?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);
  const companyId = useCompanyId();
  const { permissions } = useUserPermissions();
  const [winRate, setWinRate] = useState(0);
  const [totalBids, setTotalBids] = useState(0);
  const [activeProjects, setActiveProjects] = useState<Project[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [specReviews, setSpecReviews] = useState<Record<string, any>>({});
  const [aggregatedRisk, setAggregatedRisk] = useState({
    percentage: 0,
    label: "Low",
    averageGrade: "A"
  });
  const [projectFilter, setProjectFilter] = useState<"all" | "mine">("all");
  const [pipelineRanges, setPipelineRanges] = useState({
    small: { min: 0, max: 50000 },
    medium: { min: 50000, max: 100000 },
    large: { min: 100000, max: 250000 },
    xlarge: { min: 250000, max: 500000 },
    xxlarge: { min: 500000, max: 999999999 },
  });

  // Auth check is handled in layout, so we don't need to redirect here

  // Load win/loss data for win rate calculation
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection(
      recordsPath,
      (records: any[]) => {
        if (records.length > 0) {
          const wins = records.filter((r: any) => r.status === "won").length;
          const rate = (wins / records.length) * 100;
          setWinRate(Math.round(rate * 10) / 10);
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
    if (!isFirebaseConfigured() || !companyId) {
      setActiveProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (projects) => {
        const mappedProjects = projects.map((p) => ({
          id: p.id,
          name: p.projectName || "Untitled Project",
          gc: p.generalContractor || "",
          bidDate: p.bidDueDate || "",
          status: p.status || "draft",
          isSampleData: p.isSampleData || false,
          projectNumber: p.projectNumber || "",
          archived: p.archived === true,
          estimatedValue: p.estimatedValue,
          winProbability: p.probabilityOfWin ? p.probabilityOfWin / 100 : p.winProbability,
          bidDueDate: p.bidDueDate,
        }));
        
        const uniqueProjects = mappedProjects.filter((project, index, self) => 
          index === self.findIndex((p) => p.id === project.id)
        );
        
        setActiveProjects(uniqueProjects);
        const activeOnly = projects.filter((p) => p.archived !== true);
        setAllProjects(activeOnly);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Load contacts from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      return;
    }

    try {
      const companyPath = `companies/${companyId}`;
      const companyDocRef = getDocRef(companyPath);
      
      const unsubscribe = onSnapshot(
        companyDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            if (data && data.contacts && Array.isArray(data.contacts)) {
              const prioritized = data.contacts
                .sort((a: any, b: any) => {
                  const typePriority: any = { contractor: 1, customer: 2, vendor: 3, other: 4 };
                  const aPriority = typePriority[a.type] || 4;
                  const bPriority = typePriority[b.type] || 4;
                  if (aPriority !== bPriority) return aPriority - bPriority;
                  return (a.name || "").localeCompare(b.name || "");
                })
                .slice(0, 3);
              setContacts(prioritized);
            } else {
              setContacts([]);
            }
          } else {
            setContacts([]);
          }
        },
        (error) => {
          console.error("Error loading contacts:", error);
          setContacts([]);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up contacts subscription:", error);
    }
  }, [companyId]);

  const getContactBadge = (type: string) => {
    switch (type) {
      case "contractor":
        return "GC";
      case "customer":
        return "Owner";
      case "vendor":
        return "Vendor";
      default:
        return "Other";
    }
  };

  const getContactRole = (contact: any) => {
    if (contact.contactPerson) {
      return contact.contactPerson;
    }
    return contact.type === "contractor" ? "General Contractor" : 
           contact.type === "customer" ? "Owner Rep" : 
           contact.type === "vendor" ? "Vendor" : "Contact";
  };

  // Load spec reviews for risk calculation
  useEffect(() => {
    if (!isFirebaseConfigured() || activeProjects.length === 0 || !companyId) {
      setSpecReviews({});
      return;
    }

    const loadSpecReviews = async () => {
      const reviews: Record<string, any> = {};
      const reviewTypes = ["structural-steel", "misc-metals", "div-01", "div-09", "aess-noma", "div-03"];

      for (const project of activeProjects) {
        if (!project.id) continue;
        
        for (const type of reviewTypes) {
          try {
            const reviewPath = `companies/${companyId}/projects/${project.id}/specReviews/${type}`;
            const review = await getDocument(reviewPath);
            if (review?.result) {
              if (!reviews[project.id]) reviews[project.id] = {};
              reviews[project.id][type] = review.result;
            }
          } catch (error) {
            // Review doesn't exist, skip
          }
        }
      }

      setSpecReviews(reviews);
    };

    loadSpecReviews();
  }, [companyId, activeProjects]);

  // Calculate aggregated risk from all spec reviews
  useEffect(() => {
    if (!isFirebaseConfigured() || activeProjects.length === 0) {
      setAggregatedRisk({ percentage: 0, label: "Low", averageGrade: "A" });
      return;
    }

    const gradeToScore: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, F: 5 };
    const scoreToGrade: Record<number, string> = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "F" };
    
    const allGrades: number[] = [];
    
    activeProjects
      .filter((p) => p.status === "active" && !p.archived)
      .forEach((project) => {
        const projectReviews = specReviews[project.id];
        if (!projectReviews) return;

        Object.values(projectReviews).forEach((review: any) => {
          const grade = review?.summary?.overallRiskGrade;
          if (grade && gradeToScore[grade]) {
            allGrades.push(gradeToScore[grade]);
          }
        });
      });

    const averageScore = allGrades.length > 0
      ? allGrades.reduce((sum, score) => sum + score, 0) / allGrades.length
      : 1;

    const riskPercentage = ((averageScore - 1) / 4) * 100;

    const getRiskLabel = (percentage: number): string => {
      if (percentage < 30) return "Low";
      if (percentage < 50) return "Moderate";
      if (percentage < 70) return "High";
      return "Very High";
    };

    const riskLabel = getRiskLabel(riskPercentage);
    const averageGrade = scoreToGrade[Math.round(averageScore)] || "A";

    setAggregatedRisk({
      percentage: Math.round(riskPercentage),
      label: riskLabel,
      averageGrade
    });
  }, [activeProjects, specReviews]);

  const upcomingBids = activeProjects
    .filter((p) => p.status === "active" && p.bidDate && !p.archived)
    .sort((a, b) => new Date(a.bidDate!).getTime() - new Date(b.bidDate!).getTime())
    .slice(0, 3);

  const activeProjectsList = activeProjects.filter((p) => !p.archived);
  const archivedProjectsList = activeProjects.filter((p) => p.archived);
  
  const totalProjects = activeProjects.length;
  const activeBidCount = activeProjectsList.filter((p) => p.status === "active").length;
  const upcomingBidCount = upcomingBids.length;
  
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const bidsDueThisMonth = activeProjectsList.filter((p) => {
    if (!p.bidDate) return false;
    const bidDate = new Date(p.bidDate);
    return bidDate >= startOfMonth && bidDate <= endOfMonth && p.status === "active";
  }).length;

  const awardedThisMonth = totalBids > 0 ? Math.round((winRate / 100) * totalBids) : 0;

  const weightedPipeline = allProjects
    .filter((p) => p.status === "active" && !p.archived)
    .reduce((sum, project) => {
      const value =
        typeof project.estimatedValue === "string"
          ? parseFloat(project.estimatedValue) || 0
          : project.estimatedValue || 0;
      const probability = project.winProbability ?? 0.5;
      return sum + value * probability;
    }, 0);
  
  const filteredProjects = useMemo(() => {
    let projects = [...activeProjectsList];
    
    if (projectFilter === "mine") {
      if (user?.uid) {
        return projects.filter(p => 
          p.assignedEstimator === user.uid || 
          (p as any).assignedTo?.includes(user.uid)
        );
      }
      return [];
    }
    
    return projects;
  }, [activeProjectsList, projectFilter, user?.uid]);

  const topActiveProjects = filteredProjects.slice(0, 5);

  const pipelineDistribution = useMemo(() => {
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    const upcomingProjects = activeProjectsList.filter((project) => {
      if (!project.bidDueDate) return false;
      const bidDate = new Date(project.bidDueDate);
      return bidDate >= now && bidDate <= sixtyDaysFromNow;
    });

    const projectsByRange = {
      small: 0,
      medium: 0,
      large: 0,
      xlarge: 0,
      xxlarge: 0,
    };

    upcomingProjects.forEach((project) => {
      const value =
        typeof project.estimatedValue === "string"
          ? parseFloat(project.estimatedValue) || 0
          : project.estimatedValue || 0;
      const probability = project.winProbability ?? 0.5;
      const weightedValue = value * probability;

      if (weightedValue >= pipelineRanges.xxlarge.min) {
        projectsByRange.xxlarge += weightedValue;
      } else if (weightedValue >= pipelineRanges.xlarge.min) {
        projectsByRange.xlarge += weightedValue;
      } else if (weightedValue >= pipelineRanges.large.min) {
        projectsByRange.large += weightedValue;
      } else if (weightedValue >= pipelineRanges.medium.min) {
        projectsByRange.medium += weightedValue;
      } else {
        projectsByRange.small += weightedValue;
      }
    });

    const maxValue = Math.max(
      projectsByRange.small,
      projectsByRange.medium,
      projectsByRange.large,
      projectsByRange.xlarge,
      projectsByRange.xxlarge
    );

    return {
      values: projectsByRange,
      maxValue,
      colors: {
        small: "#ef4444",
        medium: "#f97316",
        large: "#f59e0b",
        xlarge: "#3b82f6",
        xxlarge: "#10b981",
      },
    };
  }, [activeProjectsList, pipelineRanges]);

  const primaryCards = [
    {
      label: "Total Projects",
      value: totalProjects.toString(),
      sublabel: "All time",
      className: "bg-blue-500",
      href: "/projects",
    },
    {
      label: "Active Bids",
      value: activeBidCount.toString(),
      sublabel: "In progress",
      className: "bg-emerald-500",
      href: "/projects",
    },
    {
      label: "Upcoming Bids",
      value: upcomingBidCount.toString(),
      sublabel: "Next 7 days",
      className: "bg-orange-500",
      href: "/projects",
    },
    {
      label: "Weighted Pipeline",
      value: weightedPipeline.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
      sublabel: "Based on win probability",
      className: "bg-indigo-500",
      href: "/reports",
    },
  ];

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render dashboard if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-10 text-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8 md:mb-10">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight mb-1">Company Dashboard</h1>
          <p className="text-slate-500">
            Welcome back ·{" "}
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/settings">
            <Button className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200">
              Company Settings
            </Button>
          </Link>
          {permissions?.canCreateProjects && (
            <Link href="/projects/new/details">
              <Button className="px-5 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-medium shadow-[0_2px_4px_0_rgb(59,130,246,0.3),0_4px_8px_0_rgb(59,130,246,0.2)] hover:shadow-[0_4px_8px_0_rgb(59,130,246,0.4),0_8px_16px_0_rgb(59,130,246,0.25)] hover:bg-blue-600 transition-all duration-200">
                + New Project
              </Button>
            </Link>
          )}
        </div>
      </div>

        {/* Top Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-8 md:mb-12">
        {primaryCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${card.className}`}
          >
            <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">{card.label}</p>
            <p className={`leading-none mb-2 ${card.label === "Weighted Pipeline" ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"} font-semibold`}>
              {card.value}
            </p>
            <p className="text-sm opacity-85">{card.sublabel}</p>
          </Link>
        ))}
      </div>

        {/* Graph Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8 mb-8 md:mb-12">
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
          <p className="text-sm font-semibold mb-1">Win Rate (Last 90 Days)</p>
          <p className="text-xs text-slate-400 mb-4">Company-wide</p>
          <div className="relative w-48 h-32 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
              {(() => {
                const getWinRateColor = (percentage: number) => {
                  if (percentage < 30) return "#ef4444";
                  if (percentage < 50) return "#f97316";
                  if (percentage < 70) return "#f59e0b";
                  return "#10b981";
                };
                
                const arcColor = getWinRateColor(winRate);
                
                return (
                  <path
                    d="M 20 80 A 80 80 0 0 1 180 80"
                    fill="none"
                    stroke={arcColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                );
              })()}
              {(() => {
                const rotationAngle = -90 + (winRate / 100) * 180;
                const getWinRateColor = (percentage: number) => {
                  if (percentage < 30) return "#ef4444";
                  if (percentage < 50) return "#f97316";
                  if (percentage < 70) return "#f59e0b";
                  return "#10b981";
                };
                
                const needleColor = getWinRateColor(winRate);
                
                return (
                  <g
                    transform={`translate(100, 80) rotate(${rotationAngle}) translate(-100, -80)`}
                    className="transition-transform duration-500"
                  >
                    <line
                      x1="100"
                      y1="80"
                      x2="100"
                      y2="20"
                      stroke={needleColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="100"
                      cy="80"
                      r="4"
                      fill={needleColor}
                    />
                  </g>
                );
              })()}
              <text
                x="100"
                y="75"
                textAnchor="middle"
                className="text-2xl font-semibold fill-slate-700"
                fontSize="24"
                fontWeight="600"
              >
                {Number(winRate || 0).toFixed(0)}%
              </text>
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
              <span className="text-[10px] text-slate-400">Low</span>
              <span className="text-[10px] text-slate-400">High</span>
            </div>
          </div>
          <p className="text-center text-xs text-slate-400 mt-4">
            {totalBids === 0 ? "No awarded bids in the last 90 days" : `${totalBids} decisions logged`}
          </p>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
          <p className="text-sm font-semibold mb-1">Pipeline Distribution</p>
          <p className="text-xs text-slate-400 mb-4">By bid value (next 60 days)</p>
          <div className="flex items-end gap-3 h-44 justify-center">
            {(() => {
              const ranges = [
                { key: "small", label: "Small" },
                { key: "medium", label: "Medium" },
                { key: "large", label: "Large" },
                { key: "xlarge", label: "X-Large" },
                { key: "xxlarge", label: "XX-Large" },
              ];
              
              const maxHeight = 120;
              const scale = pipelineDistribution.maxValue > 0 
                ? maxHeight / pipelineDistribution.maxValue 
                : 0;

              return ranges.map((range) => {
                const value = pipelineDistribution.values[range.key as keyof typeof pipelineDistribution.values];
                const height = Math.max(value * scale, 0);
                const color = pipelineDistribution.colors[range.key as keyof typeof pipelineDistribution.colors];
                
                return (
                  <div key={range.key} className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className="w-full rounded-xl transition-all duration-500"
                      style={{
                        height: `${height}px`,
                        backgroundColor: color,
                        minHeight: height > 0 ? "4px" : "0",
                      }}
                    />
                    <span className="text-[10px] text-slate-500 font-medium">
                      {value > 0 
                        ? `$${Math.round(value / 1000)}K`
                        : "$0"
                      }
                    </span>
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex justify-between mt-3 text-[11px] text-slate-400">
            <span>Small</span>
            <span>Medium</span>
            <span>Large</span>
            <span>X-Large</span>
            <span>XX-Large</span>
          </div>
        </div>
        <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
          <p className="text-sm font-semibold mb-1">Risk Exposure</p>
          <p className="text-xs text-slate-400 mb-4">Based on AI spec review</p>
          <div className="relative w-48 h-32 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
              {(() => {
                const getRiskColor = (percentage: number) => {
                  if (percentage < 30) return "#10b981";
                  if (percentage < 50) return "#f59e0b";
                  if (percentage < 70) return "#f97316";
                  return "#ef4444";
                };
                
                const arcColor = getRiskColor(aggregatedRisk.percentage);
                
                return (
                  <path
                    d="M 20 80 A 80 80 0 0 1 180 80"
                    fill="none"
                    stroke={arcColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    className="transition-all duration-500"
                  />
                );
              })()}
              {(() => {
                const rotationAngle = -90 + (aggregatedRisk.percentage / 100) * 180;
                const getRiskColor = (percentage: number) => {
                  if (percentage < 30) return "#10b981";
                  if (percentage < 50) return "#f59e0b";
                  if (percentage < 70) return "#f97316";
                  return "#ef4444";
                };
                
                const needleColor = getRiskColor(aggregatedRisk.percentage);
                
                return (
                  <g
                    transform={`translate(100, 80) rotate(${rotationAngle}) translate(-100, -80)`}
                    className="transition-transform duration-500"
                  >
                    <line
                      x1="100"
                      y1="80"
                      x2="100"
                      y2="20"
                      stroke={needleColor}
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="100"
                      cy="80"
                      r="4"
                      fill={needleColor}
                    />
                  </g>
                );
              })()}
            </svg>
            <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2">
              <span className="text-[10px] text-slate-400">Low</span>
              <span className="text-[10px] text-slate-400">High</span>
            </div>
          </div>
          <p className="text-center text-sm font-medium text-slate-700 mt-4">
            {aggregatedRisk.label}
          </p>
          <p className="text-center text-xs text-slate-500 mt-1">
            Grade: {aggregatedRisk.averageGrade} · {aggregatedRisk.percentage}% risk
          </p>
        </div>
      </div>

        {/* Lower Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6 lg:gap-8">
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-semibold">Projects</p>
              <p className="text-xs text-slate-400">
                {filteredProjects.length} active, {archivedProjectsList.length} archived
              </p>
            </div>
            <div className="flex gap-2 items-center">
              <Button
                onClick={() => setProjectFilter("all")}
                variant={projectFilter === "all" ? "primary" : "outline"}
                size="sm"
                className="text-xs px-3 py-1.5 rounded-xl"
              >
                All Projects
              </Button>
              <Button
                onClick={() => setProjectFilter("mine")}
                variant={projectFilter === "mine" ? "primary" : "outline"}
                size="sm"
                className="text-xs px-3 py-1.5 rounded-xl"
              >
                My Projects
              </Button>
              <Link href="/projects">
                <Button className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 bg-slate-50 hover:bg-slate-100">
                  View all
                </Button>
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-sm">
            {topActiveProjects.length === 0 ? (
              <p className="py-4 text-slate-400">No projects yet.</p>
            ) : (
              topActiveProjects.map((project) => {
                const isArchived = project.archived === true;
                const handleRestore = async (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!confirm(`Restore "${project.name}"? It will appear in your active projects list.`)) {
                    return;
                  }

                  try {
                    const projectPath = getProjectPath(companyId, project.id);
                    const currentProject = await getDocument(projectPath);
                    
                    if (!currentProject) {
                      alert("Project not found. Cannot restore.");
                      return;
                    }
                    
                    const projectsPath = `companies/${companyId}/projects`;
                    const dataToRestore = {
                      ...currentProject,
                      archived: false,
                    };
                    
                    await setDocument(projectsPath, project.id, dataToRestore, true);
                  } catch (error: any) {
                    console.error("Error restoring project:", error);
                    alert(`Failed to restore project: ${error?.message || "Please try again."}`);
                  }
                };

                return (
                  <div
                    key={project.id}
                    className={`flex items-center py-3 rounded-2xl px-2 -mx-2 transition-all duration-200 ${
                      isArchived 
                        ? "opacity-60 bg-slate-50/50" 
                        : "hover:bg-slate-50/80 hover:shadow-sm"
                    }`}
                  >
                    <Link
                      href={`/projects/${project.id}`}
                      className="flex-1 flex items-center"
                    >
                      <div className="flex-1">
                        <p className={`font-medium ${isArchived ? "text-slate-500" : "text-slate-800"}`}>
                          {project.name}
                          {isArchived && (
                            <span className="ml-2 text-xs text-slate-400 font-normal">(Archived)</span>
                          )}
                        </p>
                        <p className="text-xs text-slate-400">
                          {project.gc || "GC TBD"} ·{" "}
                          {project.bidDate
                            ? `Bid due ${new Date(project.bidDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}`
                            : "Bid date TBD"}
                        </p>
                      </div>
                      <div className="w-28 text-xs text-right font-medium">
                        {project.estimatedValue
                          ? (
                              <span className={isArchived ? "text-slate-400" : "text-emerald-500"}>
                                {Number(project.estimatedValue).toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            )
                          : "—"}
                      </div>
                      <div className="w-24 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border capitalize ${
                          isArchived
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : "bg-amber-50 text-amber-700 border-amber-100"
                        }`}>
                          {project.status || "draft"}
                        </span>
                      </div>
                    </Link>
                    {isArchived && (
                      <button
                        onClick={handleRestore}
                        className="ml-3 px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Restore project"
                      >
                        Restore
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <Link href="/address-book" className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 p-4 md:p-5">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">Company Address Book</p>
              <span className="text-xs text-slate-400">View all</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Key GC & client contacts</p>
            <div className="space-y-2 text-xs">
              {contacts.length === 0 ? (
                <p className="text-slate-400 py-2">No contacts yet. Add contacts in Settings.</p>
              ) : (
                contacts.map((contact) => (
                  <div key={contact.id} className="flex items-center justify-between hover:bg-slate-50/80 -mx-2 px-2 py-1 rounded-lg transition-all duration-200 hover:shadow-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-700 truncate">{contact.name}</p>
                      <p className="text-slate-400 truncate">{getContactRole(contact)}</p>
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100 ml-2 flex-shrink-0">
                      {getContactBadge(contact.type)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Link>
          <Link
            href="/bid-schedule"
            className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-300 p-4 md:p-5 text-left w-full"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">Bid & Production Calendar</p>
              <span className="text-xs text-slate-400">View calendar</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">This month at a glance</p>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3">
              <div className="rounded-2xl bg-slate-50/60 border border-slate-100/50 shadow-[0_1px_2px_0_rgb(0,0,0,0.03)] py-2">
                <p className="text-[10px] text-slate-400 mb-1">Bids Due</p>
                <p className="text-lg font-semibold">{bidsDueThisMonth}</p>
              </div>
              <div className="rounded-2xl bg-slate-50/60 border border-slate-100/50 shadow-[0_1px_2px_0_rgb(0,0,0,0.03)] py-2">
                <p className="text-[10px] text-slate-400 mb-1">Awarded</p>
                <p className="text-lg font-semibold">{awardedThisMonth}</p>
              </div>
              <div className="rounded-2xl bg-slate-50/60 border border-slate-100/50 shadow-[0_1px_2px_0_rgb(0,0,0,0.03)] py-2">
                <p className="text-[10px] text-slate-400 mb-1">Open Slots</p>
                <p className="text-lg font-semibold text-emerald-500">
                  {activeBidCount === 0 ? "High" : activeBidCount < 5 ? "Moderate" : "Low"}
                </p>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Use the calendar view to align estimating effort with shop capacity and backlog.
            </p>
          </Link>
          <div className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 p-4 md:p-5">
            <p className="text-sm font-semibold mb-1">Win / Loss Summary</p>
            <p className="text-xs text-slate-400 mb-4">Last 90 days</p>
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-2xl font-semibold">{Number(winRate || 0).toFixed(0)}%</p>
                <p className="text-xs text-slate-400">Win rate</p>
              </div>
              <div className="flex gap-3 items-end text-xs">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-6 bg-emerald-400 rounded-full" />
                  <span className="mt-1 text-slate-400">Wins</span>
                  <span className="font-medium text-slate-700">
                    {totalBids > 0 ? Math.round((winRate / 100) * totalBids) : 0}
                  </span>
                </div>
                <div className="flex flex-col items-center">
                  <div className="w-2 h-10 bg-rose-300 rounded-full" />
                  <span className="mt-1 text-slate-400">Losses</span>
                  <span className="font-medium text-slate-700">
                    {totalBids > 0 ? totalBids - Math.round((winRate / 100) * totalBids) : 0}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              As you log more decisions, Quant will trend your competitiveness and margin discipline.
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity Section */}
      <div className="mt-8">
        <RecentActivity companyId={companyId} limit={10} />
      </div>

      </div>
    </div>
  );
}
