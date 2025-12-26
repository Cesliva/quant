"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import {
  ArrowLeft,
  Edit,
  ClipboardList,
  FileCheck,
  FileEdit,
  FileText,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  Building2,
  MapPin,
  Clock,
  Target,
  Settings,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Archive,
  Sparkles,
  Package,
  Scissors,
} from "lucide-react";
import {
  getDocument,
  subscribeToCollection,
  updateDocument,
  getDocRef,
  getProjectPath,
} from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import ProjectSettingsPanel from "@/components/settings/ProjectSettingsPanel";
import { onSnapshot } from "firebase/firestore";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { syncProjectToWinLoss } from "@/lib/utils/syncWinLossRecord";

interface Project {
  id?: string;
  projectNumber?: string;
  projectName?: string;
  projectType?: string;
  status?: string;
  owner?: string;
  generalContractor?: string;
  gcContact?: string;
  gcPhone?: string;
  gcEmail?: string;
  estimator?: string;
  location?: string;
  bidDueDate?: string;
  decisionDate?: string;
  deliveryDate?: string;
  projectedStartDate?: string;
  fabHours?: number;
  fabWindowStart?: string;
  fabWindowEnd?: string;
  estimatedValue?: string | number;
  competitionLevel?: string;
  probabilityOfWin?: number;
  notes?: string;
  archived?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

interface ProjectDashboardClientProps {
  projectId: string;
}

export default function ProjectDashboardClient({ projectId }: ProjectDashboardClientProps) {
  const router = useRouter();
  const companyId = useCompanyId();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimatingStats, setEstimatingStats] = useState({
    totalLines: 0,
    totalWeight: 0,
    totalCost: 0,
    totalLabor: 0,
  });

  // Store the valid companyId when it's ready
  const [validCompanyId, setValidCompanyId] = useState<string | null>(null);

  // Track when companyId becomes valid (not "default")
  useEffect(() => {
    if (companyId && companyId !== "default") {
      setValidCompanyId(companyId);
    }
  }, [companyId]);

  // Timeout to prevent infinite loading if companyId never resolves
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!validCompanyId && loading) {
        console.warn("CompanyId took too long to load, proceeding with current value");
        // If we still have "default" after 5 seconds, try to load anyway
        // This handles edge cases where companyId might actually be "default"
        if (companyId) {
          setValidCompanyId(companyId);
        }
      }
    }, 5000);
    
    return () => clearTimeout(timeout);
  }, [validCompanyId, loading, companyId]);

  useEffect(() => {
    // Don't load until we have a valid companyId
    if (!validCompanyId) {
      return;
    }
    
    if (projectId && projectId !== "new") {
      loadProject();
      const unsubscribe = loadEstimatingStats();
      const unsubscribeProject = subscribeToProject();
      return () => {
        if (unsubscribe) unsubscribe();
        if (unsubscribeProject) unsubscribeProject();
      };
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, validCompanyId]);

  const subscribeToProject = () => {
    if (!isFirebaseConfigured() || !validCompanyId) {
      return () => {};
    }

    try {
      const projectPath = getProjectPath(validCompanyId, projectId);
      const projectDocRef = getDocRef(projectPath);

      return onSnapshot(
        projectDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setProject({ id: snapshot.id, ...snapshot.data() } as Project);
          }
        },
        (error) => {
          console.error("Error subscribing to project:", error);
        }
      );
    } catch (error) {
      console.error("Failed to subscribe to project:", error);
      return () => {};
    }
  };

  const loadEstimatingStats = () => {
    try {
      if (!isFirebaseConfigured() || !validCompanyId) {
        setEstimatingStats({
          totalLines: 0,
          totalWeight: 0,
          totalCost: 0,
          totalLabor: 0,
        });
        return () => {};
      }

      const linesPath = getProjectPath(validCompanyId, projectId, "lines");
      const unsubscribe = subscribeToCollection<EstimatingLine>(linesPath, (lines) => {
        const activeLines = lines.filter((line) => line.status !== "Void");
        const stats = {
          totalLines: activeLines.length,
          totalWeight: activeLines.reduce(
            (sum, line) =>
              sum +
              (line.materialType === "Rolled"
                ? line.totalWeight || 0
                : line.plateTotalWeight || 0),
            0
          ),
          totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
          totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
        };
        setEstimatingStats(stats);
      });
      return unsubscribe;
    } catch (error) {
      console.error("Failed to load estimating stats:", error);
      setEstimatingStats({
        totalLines: 0,
        totalWeight: 0,
        totalCost: 0,
        totalLabor: 0,
      });
      return () => {};
    }
  };

  const loadProject = async () => {
    try {
      setLoading(true);

      if (!isFirebaseConfigured() || !validCompanyId) {
        setProject(null);
        return;
      }

      const projectPath = getProjectPath(validCompanyId, projectId);
      const projectData = await getDocument<Project>(projectPath);

      setProject(projectData);
    } catch (error) {
      console.error("Failed to load project:", error);
      setProject(null);
    } finally {
      setLoading(false);
    }
  };

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case "draft":
        return {
          label: "Draft",
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: Edit,
        };
      case "active":
        return {
          label: "Active",
          color: "bg-blue-100 text-blue-800 border-blue-300",
          icon: Clock,
        };
      case "submitted":
        return {
          label: "Submitted",
          color: "bg-yellow-100 text-yellow-800 border-yellow-300",
          icon: AlertCircle,
        };
      case "won":
        return {
          label: "Won",
          color: "bg-green-100 text-green-800 border-green-300",
          icon: CheckCircle2,
        };
      case "lost":
        return {
          label: "Lost",
          color: "bg-red-100 text-red-800 border-red-300",
          icon: XCircle,
        };
      default:
        return {
          label: "Draft",
          color: "bg-gray-100 text-gray-800 border-gray-300",
          icon: Edit,
        };
    }
  };

  const getDaysUntilBid = (bidDate?: string) => {
    if (!bidDate) return null;
    const today = new Date();
    const bid = new Date(bidDate);
    const diffTime = bid.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const formatCurrency = (value?: string | number) => {
    if (!value) return "$0.00";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Not set";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Project Not Found</h1>
          <p className="text-gray-600 mb-6">The project you're looking for doesn't exist.</p>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Company Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(project.status);
  const StatusIcon = statusConfig.icon;
  const daysUntilBid = getDaysUntilBid(project.bidDueDate);
  const isUrgent = daysUntilBid !== null && daysUntilBid <= 7 && daysUntilBid >= 0;

  const quickActions = [
    {
      name: "Structural Steel Estimate",
      href: `/projects/${projectId}/estimating`,
      icon: ClipboardList,
      description: "Build your estimate",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    // {
    //   name: "Misc Metals AI",
    //   href: `/misc-metals?projectId=${projectId}`,
    //   icon: Package,
    //   aiIcon: Sparkles,
    //   description: "AI-powered misc metals estimation",
    //   color: "bg-indigo-500 hover:bg-indigo-600",
    // }, // Removed - will be in a later version
    {
      name: "Material Nesting & Cutting List",
      href: `/projects/${projectId}/material-nesting`,
      icon: Scissors,
      description: "Optimize material into stock lengths",
      color: "bg-teal-500 hover:bg-teal-600",
    },
    {
      name: "Structural Steel Estimate Summary",
      href: `/projects/${projectId}/reports`,
      icon: FileText,
      description: "Finalize estimate before proposal",
      color: "bg-amber-500 hover:bg-amber-600",
    },
    {
      name: "AI Spec Review",
      href: `/spec-review?projectId=${projectId}`,
      icon: FileCheck,
      aiIcon: Sparkles,
      description: "AI compliance check",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      name: "AI Generated Proposal",
      href: `/proposal?projectId=${projectId}`,
      icon: FileEdit,
      aiIcon: Sparkles,
      description: "AI-generated proposal",
      color: "bg-green-500 hover:bg-green-600",
    },
  ];

  const secondaryActions = [
    {
      name: "Import Quotes",
      href: `/import-quotes?projectId=${projectId}`,
      icon: Upload,
      description: "Import vendor quotes",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-8 text-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 md:mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900">{project.projectName || "Untitled Project"}</h1>
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusConfig.color}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {statusConfig.label}
              </span>
            </div>
            <p className="text-slate-500">
              {project.projectNumber && <span className="font-mono mr-3">{project.projectNumber}</span>}
              {project.owner && (
                <span className="flex items-center gap-1.5 inline-flex mr-3">
                  <Users className="w-4 h-4" />
                  {project.owner}
                </span>
              )}
              {project.generalContractor && (
                <span className="flex items-center gap-1.5 inline-flex mr-3">
                  <Building2 className="w-4 h-4" />
                  {project.generalContractor}
                </span>
              )}
              {project.location && (
                <span className="flex items-center gap-1.5 inline-flex">
                  <MapPin className="w-4 h-4" />
                  {project.location}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {project.archived ? (
              <Button
                onClick={async () => {
                  const activeCompanyId = validCompanyId || companyId;
                  if (confirm("Restore this project? It will appear in your active projects list.")) {
                    try {
                      const projectPath = getProjectPath(activeCompanyId, projectId);
                      const currentProject = await getDocument<Project>(projectPath);

                      await updateDocument(`companies/${activeCompanyId}/projects`, projectId, {
                        ...currentProject,
                        archived: false,
                      });
                      alert("Project restored successfully!");
                    } catch (error: any) {
                      console.error("Failed to restore project:", error);
                      alert(`Failed to restore project: ${error?.message || "Please try again."}`);
                    }
                  }
                }}
                className="px-5 py-2.5 rounded-2xl border border-green-200/80 bg-white text-green-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-green-50 hover:border-green-300 transition-all duration-200"
              >
                <Archive className="w-4 h-4 mr-2" />
                Restore
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  const activeCompanyId = validCompanyId || companyId;
                  if (
                    confirm(
                      "Archive this project? It will be hidden from your active projects but can be restored later."
                    )
                  ) {
                    try {
                      const projectPath = getProjectPath(activeCompanyId, projectId);
                      const currentProject = await getDocument<Project>(projectPath);

                      if (!currentProject) {
                        if (project) {
                          const { setDocument } = await import("@/lib/firebase/firestore");
                          const dataToSave = {
                            ...project,
                            archived: true,
                          };
                          await setDocument(projectPath, dataToSave, true);
                        } else {
                          alert(
                            "Project document not found in Firestore and no local project data available. Cannot archive."
                          );
                          return;
                        }
                      } else {
                        const { setDocument } = await import("@/lib/firebase/firestore");
                        const dataToSave = {
                          ...currentProject,
                          archived: true,
                        };
                        await setDocument(projectPath, dataToSave, true);
                      }

                      await new Promise((resolve) => setTimeout(resolve, 1000));
                      router.push("/");
                    } catch (error: any) {
                      console.error("Failed to archive project:", error);
                      alert(`Failed to archive project: ${error?.message || "Please try again."}`);
                    }
                  }
                }}
                className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
              >
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </Button>
            )}
          </div>
        </div>

        <div className="mb-4 md:mb-6">
          <ProjectSettingsPanel companyId={validCompanyId || companyId} projectId={projectId} compact />
        </div>

        {/* Key Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-4 md:mb-6">
          {/* Bid Due Date */}
          <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 border-l-4 border-l-blue-500">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
                    Bid Due Date
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatDate(project.bidDueDate)}
                  </p>
                  {daysUntilBid !== null && (
                    <p className={`text-xs mt-1 ${isUrgent ? "text-orange-600 font-semibold" : "text-slate-500"}`}>
                      {daysUntilBid === 0 
                        ? "Due today!" 
                        : daysUntilBid < 0 
                        ? `${Math.abs(daysUntilBid)} days overdue`
                        : `${daysUntilBid} days left`}
                    </p>
                  )}
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimated Value */}
          <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 border-l-4 border-l-green-500">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
                    Estimated Value
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(project.estimatedValue)}
                  </p>
                  {project.competitionLevel && (
                    <p className="text-xs text-slate-500 mt-1 capitalize">
                      {project.competitionLevel} competition
                    </p>
                  )}
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Win Probability */}
          <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 border-l-4 border-l-purple-500">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
                    Win Probability
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {project.probabilityOfWin || 0}%
                  </p>
                  <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
                    <div 
                      className="bg-purple-600 h-2 rounded-full transition-all"
                      style={{ width: `${project.probabilityOfWin || 0}%` }}
                    ></div>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimating Summary */}
          <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 border-l-4 border-l-amber-500">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
                    Estimate Total
                  </p>
                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(estimatingStats.totalCost)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {estimatingStats.totalLines} line{estimatingStats.totalLines !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="p-3 bg-amber-100 rounded-lg">
                  <Target className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="mb-4 md:mb-6">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4 tracking-tight">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              const AiIcon = (action as any).aiIcon;
              return (
                <Link key={action.name} href={action.href}>
                  <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 cursor-pointer group h-full hover:-translate-y-1">
                    <CardContent className="p-4 md:p-6 h-full flex flex-col">
                      <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative`}>
                        <Icon className="w-6 h-6 text-white" />
                        {AiIcon && (
                          <AiIcon className="w-4 h-4 text-yellow-300 absolute -top-1 -right-1 drop-shadow-lg" />
                        )}
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900 mb-1 line-clamp-2">
                        {action.name}
                      </h3>
                      <p className="text-sm text-slate-600 line-clamp-2 flex-grow">{action.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Secondary Actions & Project Info - Golden Ratio (1.618:1) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.618fr] gap-3 md:gap-4 lg:gap-5 mb-4 md:mb-6">
          {/* Secondary Actions (38.2%) */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4 tracking-tight">More Tools</h2>
            <div className="space-y-2">
              {secondaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.name} href={action.href}>
                    <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-slate-100 rounded-lg">
                            <Icon className="w-5 h-5 text-slate-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-900">
                              {action.name}
                            </h3>
                            <p className="text-xs text-slate-600">{action.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Project Timeline & Info (61.8%) */}
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4 tracking-tight">Project Timeline</h2>
            <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300">
              <CardContent className="p-4 md:p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-900">Bid Due Date</h3>
                      <p className="text-sm text-slate-600">{formatDate(project.bidDueDate)}</p>
                      {daysUntilBid !== null && (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isUrgent ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"
                        }`}>
                          {daysUntilBid === 0 
                            ? "Due today!" 
                            : daysUntilBid < 0 
                            ? `${Math.abs(daysUntilBid)} days overdue`
                            : `${daysUntilBid} days remaining`}
                        </span>
                      )}
                    </div>
                  </div>

                  {project.decisionDate && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                          <Clock className="w-5 h-5 text-yellow-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">Decision Date</h3>
                        <p className="text-sm text-slate-600">{formatDate(project.decisionDate)}</p>
                      </div>
                    </div>
                  )}

                  {project.deliveryDate && (
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">Delivery Date</h3>
                        <p className="text-sm text-slate-600">{formatDate(project.deliveryDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Project Lifecycle Controls */}
        <Card className="bg-white rounded-3xl border border-slate-100/50 shadow-[0_1px_3px_0_rgb(0,0,0,0.1),0_1px_2px_-1px_rgb(0,0,0,0.1),0_4px_12px_0_rgb(0,0,0,0.05)] hover:shadow-[0_4px_6px_-1px_rgb(0,0,0,0.1),0_2px_4px_-2px_rgb(0,0,0,0.1),0_8px_16px_0_rgb(0,0,0,0.08)] transition-all duration-300 bg-gradient-to-r from-blue-50/50 to-purple-50/50 border-blue-200/60">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-slate-900">
              <Settings className="w-5 h-5" />
              Project Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-slate-600">Change status:</span>
              {["draft", "active", "submitted", "won", "lost"].map((status) => {
                const config = getStatusConfig(status);
                const isCurrent = project.status === status;
                return (
                  <Button
                    key={status}
                    onClick={async () => {
                      const activeCompanyId = validCompanyId || companyId;
                      if (!isFirebaseConfigured() || !activeCompanyId || !projectId) {
                        alert("Unable to update status. Please check your connection.");
                        return;
                      }

                      try {
                        const oldStatus = project.status;
                        const projectPath = getProjectPath(activeCompanyId, projectId);
                        await updateDocument(`companies/${activeCompanyId}/projects`, projectId, {
                          status: status,
                        });
                        
                        // Sync to win/loss records if status is "won" or "lost"
                        if (status === "won" || status === "lost") {
                          await syncProjectToWinLoss(activeCompanyId, {
                            ...project,
                            id: projectId,
                            status: status,
                          }, oldStatus);
                        }
                        
                        // Status will update via the real-time subscription
                      } catch (error: any) {
                        console.error("Failed to update project status:", error);
                        alert(`Failed to update status: ${error?.message || "Please try again."}`);
                      }
                    }}
                    disabled={isCurrent}
                    className={isCurrent 
                      ? "px-4 py-2 rounded-2xl bg-blue-500 text-white text-sm font-medium shadow-[0_2px_4px_0_rgb(59,130,246,0.3),0_4px_8px_0_rgb(59,130,246,0.2)] hover:shadow-[0_4px_8px_0_rgb(59,130,246,0.4),0_8px_16px_0_rgb(59,130,246,0.25)] hover:bg-blue-600 transition-all duration-200"
                      : "px-4 py-2 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    }
                  >
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

