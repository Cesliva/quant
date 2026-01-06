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
import BacklogAtAGlance from "@/components/dashboard/BacklogAtAGlance";
import CostTrendAnalysis from "@/components/dashboard/CostTrendAnalysis";
import EstimatorWorkload from "@/components/dashboard/EstimatorWorkload";
import BidForecastModal from "@/components/dashboard/BidForecastModal";
import Input from "@/components/ui/Input";
import { Search, Lightbulb, TrendingUp, TrendingDown, AlertCircle, ArrowRight, Eye } from "lucide-react";
import { PRODUCT_SYSTEM_NAME } from "@/lib/branding";
import { Bid } from "@/lib/bids/types";
import { calculateBidForecast } from "@/lib/bids/forecast";
import { SEEDED_BIDS } from "@/lib/bids/seed";

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

  // CRITICAL SECURITY: Redirect to login if not authenticated
  // Also verify user has valid email (required for real authentication)
  useEffect(() => {
    if (!authLoading && (!user || !user.email || user.uid === "dev-user")) {
      router.replace("/login");
      return;
    }
  }, [user, authLoading, router]);

  // CRITICAL SECURITY: Don't render dashboard content if not authenticated
  // Also verify user has valid email (required for real authentication)
  if (!authLoading && (!user || !user.email || user.uid === "dev-user")) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }
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
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [bids, setBids] = useState<Bid[]>([]);
  const [showBidForecastModal, setShowBidForecastModal] = useState(false);
  
  // Debug: Log filter changes
  useEffect(() => {
    console.log("Project filter changed to:", projectFilter);
  }, [projectFilter]);
  const [pipelineRanges, setPipelineRanges] = useState({
    small: { min: 0, max: 50000 },
    medium: { min: 50000, max: 100000 },
    large: { min: 100000, max: 250000 },
    xlarge: { min: 250000, max: 500000 },
    xxlarge: { min: 500000, max: 999999999 },
  });
  const [userFirstName, setUserFirstName] = useState<string>("");
  const [showSampleData, setShowSampleData] = useState(true);

  // Auth check is handled in layout, so we don't need to redirect here

  // Load user's first name for personalized greeting
  useEffect(() => {
    if (!user || !companyId || companyId === "default") {
      setUserFirstName("");
      return;
    }

    const loadUserName = async () => {
      try {
        // Try to load from members collection first
        const memberPath = `companies/${companyId}/members/${user.uid}`;
        const memberDoc = await getDocument(memberPath);

        if (memberDoc?.name) {
          // Extract first name from full name
          const firstName = memberDoc.name.split(" ")[0];
          setUserFirstName(firstName);
        } else if (user.displayName) {
          // Fallback to displayName from auth
          const firstName = user.displayName.split(" ")[0];
          setUserFirstName(firstName);
        } else if (user.email) {
          // Fallback to email username
          const firstName = user.email.split("@")[0].split(".")[0];
          setUserFirstName(firstName.charAt(0).toUpperCase() + firstName.slice(1));
        }
      } catch (error) {
        console.error("Failed to load user name:", error);
        // Fallback to displayName or email if available
        if (user.displayName) {
          const firstName = user.displayName.split(" ")[0];
          setUserFirstName(firstName);
        } else if (user.email) {
          const firstName = user.email.split("@")[0].split(".")[0];
          setUserFirstName(firstName.charAt(0).toUpperCase() + firstName.slice(1));
        }
      }
    };

    loadUserName();
  }, [user, companyId]);

  // Load win/loss data for win rate calculation (current calendar year only)
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) return;

    const recordsPath = `companies/${companyId}/winLossRecords`;
    const unsubscribe = subscribeToCollection(
      recordsPath,
      (records: any[]) => {
        // Get current calendar year
        const currentYear = new Date().getFullYear();
        const yearStart = new Date(currentYear, 0, 1); // January 1st of current year
        const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59); // December 31st of current year

        // Filter records to current calendar year based on decisionDate
        const currentYearRecords = records.filter((r: any) => {
          if (!r.decisionDate) return false;
          
          try {
            const decisionDate = r.decisionDate.toDate ? r.decisionDate.toDate() : new Date(r.decisionDate);
            return decisionDate >= yearStart && decisionDate <= yearEnd;
          } catch (e) {
            // If date parsing fails, check if it's a string in YYYY-MM-DD format
            if (typeof r.decisionDate === 'string') {
              const dateStr = r.decisionDate.split('T')[0]; // Get YYYY-MM-DD part
              const year = parseInt(dateStr.split('-')[0]);
              return year === currentYear;
            }
            return false;
          }
        });

        if (currentYearRecords.length > 0) {
          const wins = currentYearRecords.filter((r: any) => r.status === "won").length;
          const rate = (wins / currentYearRecords.length) * 100;
          setWinRate(Math.round(rate * 10) / 10);
          setTotalBids(currentYearRecords.length);
        } else {
          setWinRate(0);
          setTotalBids(0);
        }
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Load showSampleData setting and pipeline ranges
  useEffect(() => {
    if (!companyId || companyId === "default") return;
    const loadSetting = async () => {
      try {
        const settings = await loadCompanySettings(companyId);
        setShowSampleData(settings.showSampleData !== false); // Default to true if not set
        
        // Load pipeline ranges from settings
        if (settings.pipelineRanges) {
          setPipelineRanges(settings.pipelineRanges);
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      }
    };
    loadSetting();
  }, [companyId]);

  // Load bids from Firestore (or use seed data for dev/demo)
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      // Use seed data if Firebase not configured
      setBids(SEEDED_BIDS);
      return;
    }

    const bidsPath = `companies/${companyId}/bids`;
    const unsubscribe = subscribeToCollection<Bid>(
      bidsPath,
      (loadedBids) => {
        if (loadedBids.length > 0) {
          setBids(loadedBids);
        } else {
          // Use seed data if no bids in Firebase (dev/demo mode)
          setBids(SEEDED_BIDS);
        }
      },
      (error) => {
        console.error("Error loading bids:", error);
        // Fallback to seed data on error
        setBids(SEEDED_BIDS);
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
        console.log("Dashboard: Loaded projects from Firestore:", projects.length, "projects");
        const mappedProjects = projects.map((p) => {
          if (!p.id) {
            console.warn("Dashboard: Project missing ID:", p);
          }
          return {
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
          };
        });
        
        // Filter out projects without IDs
        let validProjects = mappedProjects.filter(p => p.id);
        
        // Filter out sample data if setting is disabled
        if (!showSampleData) {
          validProjects = validProjects.filter(p => !p.isSampleData);
        }
        
        if (validProjects.length !== mappedProjects.length) {
          console.warn("Dashboard: Filtered out", mappedProjects.length - validProjects.length, "projects");
        }
        
        const uniqueProjects = validProjects.filter((project, index, self) => 
          index === self.findIndex((p) => p.id === project.id)
        );
        
        console.log("Dashboard: Setting active projects:", uniqueProjects.length);
        setActiveProjects(uniqueProjects);
        const activeOnly = projects.filter((p) => {
          if (p.archived === true) return false;
          if (!showSampleData && p.isSampleData) return false;
          return true;
        });
        setAllProjects(activeOnly);
      }
    );

    return () => unsubscribe();
  }, [companyId, showSampleData]);

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

  // Filter for active status projects only (not archived, not won/lost)
  const activeProjectsList = activeProjects.filter((p) => 
    !p.archived && p.status === "active"
  );
  const archivedProjectsList = activeProjects.filter((p) => p.archived);
  
  const totalProjects = activeProjects.length;
  const activeBidCount = activeProjectsList.filter((p) => p.status === "active").length;
  const submittedBidCount = activeProjectsList.filter((p) => p.status === "submitted").length;
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

  // Calculate Bid Forecast (replaces Weighted Pipeline)
  const bidForecast = useMemo(() => {
    return calculateBidForecast(bids, undefined, {
      activeOnly: true,
    });
  }, [bids]);
  
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
    
    // "all" filter - return all projects
    return projects;
  }, [activeProjectsList, projectFilter, user?.uid]);

  // Get projects to display - all projects when "all" is selected, all my projects when "mine" is selected
  const displayedProjects = useMemo(() => {
    return [...filteredProjects]
      .sort((a, b) => {
        const aValue = typeof a.estimatedValue === "string" 
          ? parseFloat(a.estimatedValue) || 0 
          : a.estimatedValue || 0;
        const bValue = typeof b.estimatedValue === "string" 
          ? parseFloat(b.estimatedValue) || 0 
          : b.estimatedValue || 0;
        return bValue - aValue; // Sort descending (highest first)
      });
  }, [filteredProjects]);

  const pipelineDistribution = useMemo(() => {
    const now = new Date();
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    
    // Filter for active pipeline projects (active, submitted, draft status)
    // Include ALL active projects regardless of bid date - pipeline is about future work
    const upcomingProjects = activeProjectsList.filter((project) => {
      const status = project.status?.toLowerCase();
      // Include active, submitted, and draft projects
      // Also include "won" projects that haven't been delivered (still in pipeline)
      const isActiveStatus = 
        status === "active" || 
        status === "submitted" || 
        status === "draft" ||
        status === "won"; // Won projects are still in pipeline until delivered
      
      return isActiveStatus;
    });

    const projectsByRange = {
      small: 0,
      medium: 0,
      large: 0,
      xlarge: 0,
      xxlarge: 0,
    };

    upcomingProjects.forEach((project) => {
      const rawValue = project.estimatedValue;
      let value = 0;
      
      // Parse value - handle string, number, or undefined
      if (typeof rawValue === "string") {
        // Remove any non-numeric characters except decimal point and minus sign
        const cleaned = rawValue.replace(/[^0-9.-]/g, "");
        value = parseFloat(cleaned) || 0;
      } else if (typeof rawValue === "number") {
        value = rawValue;
      }
      
      // Skip projects with no value
      if (value <= 0) return;
      
      // Handle winProbability - could be 0-1 or 0-100
      let probability = project.winProbability ?? 0.5;
      if (probability > 1) {
        probability = probability / 100; // Convert percentage to decimal
      }
      
      const weightedValue = value * probability;

      // Categorize by weighted value using pipeline ranges
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
      projectsByRange.xxlarge,
      1 // Ensure at least 1 to prevent division by zero in rendering
    );

    // Count projects per range for tooltips
    const projectCountsByRange = {
      small: 0,
      medium: 0,
      large: 0,
      xlarge: 0,
      xxlarge: 0,
    };

    upcomingProjects.forEach((project) => {
      const rawValue = project.estimatedValue;
      let projectValue = 0;
      if (typeof rawValue === "string") {
        const cleaned = rawValue.replace(/[^0-9.-]/g, "");
        projectValue = parseFloat(cleaned) || 0;
      } else if (typeof rawValue === "number") {
        projectValue = rawValue;
      }
      if (projectValue <= 0) return;
      
      let probability = project.winProbability ?? 0.5;
      if (probability > 1) probability = probability / 100;
      const weightedValue = projectValue * probability;
      
      if (weightedValue >= pipelineRanges.xxlarge.min) {
        projectCountsByRange.xxlarge += 1;
      } else if (weightedValue >= pipelineRanges.xlarge.min) {
        projectCountsByRange.xlarge += 1;
      } else if (weightedValue >= pipelineRanges.large.min) {
        projectCountsByRange.large += 1;
      } else if (weightedValue >= pipelineRanges.medium.min) {
        projectCountsByRange.medium += 1;
      } else {
        projectCountsByRange.small += 1;
      }
    });

    return {
      values: projectsByRange,
      maxValue,
      projectCounts: projectCountsByRange,
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
      href: "/projects?status=active",
    },
    {
      label: "Submitted Bids",
      value: submittedBidCount.toString(),
      sublabel: "Awaiting decision",
      className: "bg-orange-500",
      href: "/projects?status=submitted",
    },
    {
      label: "Bid Forecast",
      value: bidForecast.total.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }),
      sublabel: "Expected awarded value from active bids",
      breakdown: `Public: ${bidForecast.publicTotal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} • Private: ${bidForecast.privateTotal.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })}`,
      className: "bg-indigo-500",
      href: undefined, // Will be handled by onClick
      onClick: () => setShowBidForecastModal(true),
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-8 text-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 md:mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-semibold tracking-tight">Company Dashboard</h1>
            <span className="px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-100 rounded-md border border-slate-200">
              {PRODUCT_SYSTEM_NAME}
            </span>
          </div>
          <p className="text-slate-500">
            {userFirstName ? `Welcome back ${userFirstName}` : "Welcome back"} ·{" "}
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
          <Link href="/projects/new">
            <Button className="px-5 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-medium shadow-[0_2px_4px_0_rgb(59,130,246,0.3),0_4px_8px_0_rgb(59,130,246,0.2)] hover:shadow-[0_4px_8px_0_rgb(59,130,246,0.4),0_8px_16px_0_rgb(59,130,246,0.25)] hover:bg-blue-600 transition-all duration-200">
              + New Project
            </Button>
          </Link>
        </div>
      </div>

        {/* Top Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
        {primaryCards.map((card) => {
          const CardWrapper = card.href ? Link : "div";
              const cardProps: any = card.href 
            ? { href: card.href }
            : { 
                onClick: (card as any).onClick,
                className: "cursor-pointer",
                role: "button",
                tabIndex: 0,
                onKeyDown: (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    (card as any).onClick?.();
                  }
                }
              };

          return (
            <CardWrapper
              key={card.label}
              {...cardProps}
              className={`rounded-3xl p-4 md:p-6 text-white border border-white/10 shadow-[0_4px_6px_-1px_rgb(0,0,0,0.2),0_2px_4px_-2px_rgb(0,0,0,0.2),0_12px_24px_0_rgb(0,0,0,0.15)] hover:shadow-[0_8px_12px_-2px_rgb(0,0,0,0.25),0_4px_6px_-3px_rgb(0,0,0,0.25),0_16px_32px_0_rgb(0,0,0,0.2)] transition-all duration-300 hover:-translate-y-1 focus:outline-none focus-visible:ring-4 focus-visible:ring-white/50 ${card.className} ${cardProps.className || ""}`}
              title={card.label === "Bid Forecast" ? "Bid Forecast = Σ (Bid Amount × Probability). Public bids use historical win rate; private bids use stage-based probabilities." : undefined}
            >
              <p className="uppercase text-xs tracking-[0.18em] opacity-80 mb-2">{card.label}</p>
              <p className={`leading-none mb-2 ${card.label === "Bid Forecast" ? "text-3xl md:text-4xl" : "text-4xl md:text-5xl"} font-semibold`}>
                {card.value}
              </p>
              <p className="text-sm opacity-85">{card.sublabel}</p>
              {card.breakdown && (
                <p className="text-xs opacity-75 mt-1">{card.breakdown}</p>
              )}
            </CardWrapper>
          );
        })}
      </div>

        {/* Graph Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Win Rate ({new Date().getFullYear()})</p>
              <p className="text-xs text-slate-500 mt-0.5">Current calendar year • Company-wide</p>
            </div>
            {/* Trend indicator */}
            {(() => {
              // Calculate trend (would need previous period data - placeholder for now)
              const hasTrend = totalBids >= 2;
              const trendDirection = winRate >= 50 ? "up" : "down";
              return hasTrend ? (
                <div className={`flex items-center gap-1 text-xs ${
                  trendDirection === "up" ? "text-emerald-600" : "text-red-600"
                }`}>
                  {trendDirection === "up" ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  <span className="font-medium">vs target</span>
                </div>
              ) : null;
            })()}
          </div>
          <div className="relative w-48 h-32 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
              {/* Target line at 50% */}
              <line
                x1="20"
                y1="80"
                x2="180"
                y2="80"
                stroke="#e5e7eb"
                strokeWidth="1"
                strokeDasharray="4 4"
                opacity="0.5"
              />
              <text
                x="190"
                y="82"
                textAnchor="end"
                className="text-[9px] fill-slate-400"
                fontSize="9"
              >
                50% target
              </text>
              {(() => {
                // Gradient: 50% = yellow, >50% = yellow to red, <50% = yellow to green
                const getWinRateColor = (percentage: number) => {
                  if (percentage === 50) return "#eab308"; // Base yellow
                  
                  if (percentage > 50) {
                    // Gradient from yellow (#eab308) to bright red (#ef4444)
                    const ratio = (percentage - 50) / 50; // 0 to 1
                    const r = Math.round(234 + (239 - 234) * ratio); // 234->239
                    const g = Math.round(179 + (68 - 179) * ratio);   // 179->68
                    const b = Math.round(8 + (68 - 8) * ratio);       // 8->68
                    return `rgb(${r}, ${g}, ${b})`;
                  } else {
                    // Gradient from yellow (#eab308) to full green (#22c55e)
                    const ratio = percentage / 50; // 0 to 1
                    const r = Math.round(34 + (234 - 34) * (1 - ratio)); // 34->234
                    const g = Math.round(197 + (179 - 197) * (1 - ratio)); // 197->179
                    const b = Math.round(94 + (8 - 94) * (1 - ratio));     // 94->8
                    return `rgb(${r}, ${g}, ${b})`;
                  }
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
                // Gradient: 50% = yellow, >50% = yellow to red, <50% = yellow to green
                const getWinRateColor = (percentage: number) => {
                  if (percentage === 50) return "#eab308"; // Base yellow
                  
                  if (percentage > 50) {
                    // Gradient from yellow (#eab308) to bright red (#ef4444)
                    const ratio = (percentage - 50) / 50; // 0 to 1
                    const r = Math.round(234 + (239 - 234) * ratio); // 234->239
                    const g = Math.round(179 + (68 - 179) * ratio);   // 179->68
                    const b = Math.round(8 + (68 - 8) * ratio);       // 8->68
                    return `rgb(${r}, ${g}, ${b})`;
                  } else {
                    // Gradient from yellow (#eab308) to full green (#22c55e)
                    const ratio = percentage / 50; // 0 to 1
                    const r = Math.round(34 + (234 - 34) * (1 - ratio)); // 34->234
                    const g = Math.round(197 + (179 - 197) * (1 - ratio)); // 197->179
                    const b = Math.round(94 + (8 - 94) * (1 - ratio));     // 94->8
                    return `rgb(${r}, ${g}, ${b})`;
                  }
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
          <p className="text-center text-xs text-slate-500 mt-4">
            {totalBids === 0 
              ? `No decisions logged in ${new Date().getFullYear()}` 
              : `${totalBids} decision${totalBids !== 1 ? 's' : ''} logged this year`}
          </p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <p className="text-sm font-semibold text-slate-900 mb-1">Pipeline Distribution</p>
          <p className="text-xs text-slate-500 mb-3">By bid value (next 60 days)</p>
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
                : 1; // Use scale of 1 when no data so bars still render

              return ranges.map((range) => {
                const value = pipelineDistribution.values[range.key as keyof typeof pipelineDistribution.values];
                const height = Math.max(value * scale, 0);
                const color = pipelineDistribution.colors[range.key as keyof typeof pipelineDistribution.colors];
                const projectCount = pipelineDistribution.projectCounts?.[range.key as keyof typeof pipelineDistribution.projectCounts] || 0;
                
                return (
                  <div 
                    key={range.key} 
                    className="flex flex-col items-center gap-1 flex-1 group relative"
                    title={projectCount > 0 ? `${projectCount} project${projectCount !== 1 ? 's' : ''} in ${range.label} range ($${Math.round(value).toLocaleString()} weighted value)` : `${range.label} range: No projects`}
                  >
                    <div
                      className={`w-full rounded-lg transition-all duration-500 cursor-help ${
                        value > 0 ? "opacity-100 hover:opacity-90" : "opacity-20"
                      }`}
                      style={{
                        height: `${Math.max(height, 2)}px`,
                        backgroundColor: color,
                        minHeight: "2px",
                      }}
                    />
                    <span className="text-[10px] text-slate-600 font-medium">
                      {value > 0 
                        ? `$${Math.round(value / 1000)}K`
                        : "$0"
                      }
                    </span>
                    {projectCount > 0 && (
                      <span className="text-[9px] text-slate-400 mt-0.5">
                        {projectCount} {projectCount === 1 ? 'project' : 'projects'}
                      </span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          <div className="flex justify-between mt-3 text-[11px] text-slate-500">
            <span>Small</span>
            <span>Medium</span>
            <span>Large</span>
            <span>X-Large</span>
            <span>XX-Large</span>
          </div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
          <p className="text-sm font-semibold text-slate-900 mb-1">Risk Exposure</p>
          <p className="text-xs text-slate-500 mb-3">Based on AI spec review</p>
          <div className="relative w-48 h-32 mx-auto">
            <svg className="w-full h-full" viewBox="0 0 200 100" preserveAspectRatio="xMidYMid meet">
              {/* Background arc - always visible, muted gray */}
              <path
                d="M 20 80 A 80 80 0 0 1 180 80"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
                strokeLinecap="round"
                className="opacity-30"
              />
              {/* Active risk arc - always show, use green for 0% risk */}
              {(() => {
                const getRiskColor = (percentage: number) => {
                  if (percentage === 0) return "#10b981"; // Green for no risk
                  if (percentage < 30) return "#10b981";
                  if (percentage < 50) return "#f59e0b";
                  if (percentage < 70) return "#f97316";
                  return "#ef4444";
                };
                
                const arcColor = getRiskColor(aggregatedRisk.percentage);
                // Always show arc, even at 0% (shows as green)
                const arcPercentage = Math.max(aggregatedRisk.percentage, 1); // Minimum 1% to show arc
                
                return (
                  <path
                    d="M 20 80 A 80 80 0 0 1 180 80"
                    fill="none"
                    stroke={arcColor}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={arcPercentage === 0 ? "0" : "none"}
                    className="transition-all duration-500"
                    style={{
                      strokeDashoffset: arcPercentage === 0 ? 0 : "none",
                      opacity: arcPercentage === 0 ? 0.3 : 1,
                    }}
                  />
                );
              })()}
              {/* Needle indicator - always show, positioned based on risk percentage */}
              {(() => {
                // Always show needle, even at 0% (points to Low)
                const rotationAngle = -90 + (Math.max(aggregatedRisk.percentage, 0) / 100) * 180;
                const getRiskColor = (percentage: number) => {
                  if (percentage === 0) return "#10b981"; // Green for no risk
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
          <p className="text-center text-sm font-medium text-slate-900 mt-4">
            {aggregatedRisk.label}
          </p>
          <p className="text-center text-xs text-slate-500 mt-1">
            Grade: {aggregatedRisk.averageGrade} · {aggregatedRisk.percentage}% risk
          </p>
        </div>
      </div>

        {/* Lower Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-5 items-stretch">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Active Projects</p>
              <p className="text-xs text-slate-500 mt-0.5">
                {projectFilter === "all" 
                  ? `${filteredProjects.length} total active projects`
                  : `${displayedProjects.length} my projects`
                }
              </p>
            </div>
            <div className="flex gap-2 items-center" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  router.push("/projects");
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all duration-200 cursor-pointer relative z-10 ${
                  projectFilter === "all"
                    ? "bg-blue-500 text-white shadow-md hover:bg-blue-600"
                    : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
                }`}
                style={{ pointerEvents: "auto", userSelect: "none" }}
              >
                All Projects
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  console.log("My Projects button clicked, current filter:", projectFilter);
                  const newFilter: "all" | "mine" = "mine";
                  setProjectFilter(newFilter);
                  console.log("Filter set to:", newFilter);
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all duration-200 cursor-pointer relative z-10 ${
                  projectFilter === "mine"
                    ? "bg-blue-500 text-white shadow-md hover:bg-blue-600"
                    : "bg-white text-blue-600 border border-blue-200 hover:bg-blue-50"
                }`}
                style={{ pointerEvents: "auto", userSelect: "none" }}
              >
                My Projects
              </button>
            </div>
          </div>
          
          {/* Search Bar */}
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search all projects..."
                value={projectSearchQuery}
                onChange={(e) => setProjectSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && projectSearchQuery.trim()) {
                    router.push(`/projects?search=${encodeURIComponent(projectSearchQuery.trim())}`);
                  }
                }}
                className="pl-10 pr-4 py-2 text-sm"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Press Enter to search all projects • {filteredProjects.length > 3 && `Showing top 3 of ${filteredProjects.length} projects`}
            </p>
          </div>
          <div className="text-sm">
            {displayedProjects.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-slate-500 font-medium mb-1">No projects found</p>
                <p className="text-xs text-slate-400 mb-4">
                  {projectFilter === "all" 
                    ? "Create your first project to get started"
                    : "You don't have any assigned projects yet"
                  }
                </p>
                {projectFilter === "all" && (
                  <Link href="/projects/new">
                    <Button size="sm" className="text-xs">
                      + New Project
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-0">
              {displayedProjects.map((project, index) => {
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
                    
                    await setDocument(`${projectsPath}/${project.id}`, dataToRestore, true);
                  } catch (error: any) {
                    console.error("Error restoring project:", error);
                    alert(`Failed to restore project: ${error?.message || "Please try again."}`);
                  }
                };

                return (
                  <div
                    key={project.id}
                    className={`flex items-center py-3 rounded-2xl px-2 -mx-2 transition-all duration-200 ${
                      index > 0 ? "border-t border-slate-100" : ""
                    } ${
                      isArchived 
                        ? "opacity-60 bg-slate-50/50" 
                        : "hover:bg-slate-50/80 hover:shadow-sm"
                    }`}
                  >
                    <Link
                      href={project.id ? `/projects/${project.id}` : "#"}
                      className="flex-1 flex items-center group"
                      onClick={(e) => {
                        if (!project.id) {
                          e.preventDefault();
                          console.error("Project ID is missing:", project);
                          alert("Project ID is missing. Cannot navigate to project.");
                        } else {
                          console.log("Navigating to project:", project.id, project.name);
                        }
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`font-medium truncate ${isArchived ? "text-slate-500" : "text-slate-900 group-hover:text-blue-600 transition-colors"}`}>
                            {project.name}
                          </p>
                          {isArchived && (
                            <span className="text-[10px] text-slate-400 font-normal bg-slate-100 px-1.5 py-0.5 rounded">Archived</span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {project.gc || "GC TBD"} ·{" "}
                          {project.bidDate
                            ? `Bid due ${new Date(project.bidDate).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                              })}`
                            : "Bid date TBD"}
                        </p>
                      </div>
                      <div className="w-28 text-xs text-right font-semibold">
                        {project.estimatedValue
                          ? (
                              <span className={isArchived ? "text-slate-400" : "text-emerald-600"}>
                                {Number(project.estimatedValue).toLocaleString("en-US", {
                                  style: "currency",
                                  currency: "USD",
                                  maximumFractionDigits: 0,
                                })}
                              </span>
                            )
                          : <span className="text-slate-400">—</span>}
                      </div>
                      <div className="w-24 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border capitalize ${
                          isArchived
                            ? "bg-slate-100 text-slate-600 border-slate-200"
                            : project.status === "active"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : project.status === "submitted"
                                ? "bg-orange-50 text-orange-700 border-orange-200"
                                : project.status === "won"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : project.status === "lost"
                                    ? "bg-red-50 text-red-700 border-red-200"
                                    : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}>
                          {project.status || "draft"}
                        </span>
                      </div>
                    </Link>
                    {!isArchived && (
                      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          href={project.id ? `/projects/${project.id}` : "#"}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View project"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
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
              })}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:gap-4 h-full">
          {/* Top Card - Bid & Production Calendar */}
          <Link
            href="/bid-schedule"
            className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 p-4 text-left w-full flex-1 flex flex-col"
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold">Bid & Production Calendar</p>
              <span className="text-xs text-slate-400">View calendar</span>
            </div>
            <p className="text-xs text-slate-400 mb-3">This month at a glance</p>
            <div className="grid grid-cols-3 gap-2 text-center text-[11px] mb-3 flex-shrink-0">
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
            <p className="text-[11px] text-slate-400 mt-auto">
              Use the calendar view to align estimating effort with shop capacity and backlog.
            </p>
          </Link>
          
          {/* Bottom Card - Estimator Workload */}
          {companyId && companyId !== "default" && (
            <div className="flex-1">
              <EstimatorWorkload companyId={companyId} />
            </div>
          )}
        </div>
      </div>

      {/* Cost Trend Analysis Section */}
      {companyId && companyId !== "default" && (
        <CostTrendAnalysis companyId={companyId} />
      )}

      </div>

      {/* Bid Forecast Modal */}
      <BidForecastModal
        bids={bids}
        isOpen={showBidForecastModal}
        onClose={() => setShowBidForecastModal(false)}
      />
    </div>
  );
}
