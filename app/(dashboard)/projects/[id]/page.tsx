"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { 
  ArrowLeft, 
  Edit,
  ClipboardList, 
  FileCheck, 
  FileEdit, 
  BarChart3,
  Calendar,
  DollarSign,
  TrendingUp,
  Users,
  MapPin,
  Clock,
  Target,
  Settings,
  Package,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreVertical
} from "lucide-react";
import { getDocument, subscribeToCollection } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import ProjectSettingsPanel from "@/components/settings/ProjectSettingsPanel";

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
  estimatedValue?: string | number;
  competitionLevel?: string;
  probabilityOfWin?: number;
  notes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export default function ProjectDashboard() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const companyId = "default"; // TODO: Get from auth context
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimatingStats, setEstimatingStats] = useState({
    totalLines: 0,
    totalWeight: 0,
    totalCost: 0,
    totalLabor: 0,
  });

  useEffect(() => {
    if (projectId && projectId !== "new") {
      loadProject();
      const unsubscribe = loadEstimatingStats();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const loadEstimatingStats = () => {
    try {
      // Check if Firebase is configured
      if (!isFirebaseConfigured()) {
        // Use sample data if Firebase is not configured
        const sampleData = getSampleProjectData(projectId);
        if (sampleData && sampleData.lines) {
          const activeLines = sampleData.lines.filter(line => line.status !== "Void");
          const stats = {
            totalLines: activeLines.length,
            totalWeight: activeLines.reduce((sum, line) => 
              sum + (line.materialType === "Rolled" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0)), 0
            ),
            totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
            totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
          };
          setEstimatingStats(stats);
        }
        return () => {}; // Return no-op unsubscribe function
      }
      
      // Try to load from Firestore
      const linesPath = getProjectPath(companyId, projectId, "lines");
      const unsubscribe = subscribeToCollection<EstimatingLine>(
        linesPath,
        (lines) => {
          const activeLines = lines.filter(line => line.status !== "Void");
          const stats = {
            totalLines: activeLines.length,
            totalWeight: activeLines.reduce((sum, line) => 
              sum + (line.materialType === "Rolled" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0)), 0
            ),
            totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
            totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
          };
          setEstimatingStats(stats);
        }
      );
      return unsubscribe;
    } catch (error) {
      console.error("Failed to load estimating stats:", error);
      // Try sample data as fallback
      try {
        const sampleData = getSampleProjectData(projectId);
        if (sampleData && sampleData.lines) {
          const activeLines = sampleData.lines.filter(line => line.status !== "Void");
          const stats = {
            totalLines: activeLines.length,
            totalWeight: activeLines.reduce((sum, line) => 
              sum + (line.materialType === "Rolled" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0)), 0
            ),
            totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
            totalLabor: activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0),
          };
          setEstimatingStats(stats);
        }
      } catch (fallbackError) {
        console.error("Failed to load sample estimating stats:", fallbackError);
      }
      return () => {}; // Return no-op function if subscription fails
    }
  };

  const loadProject = async () => {
    try {
      setLoading(true);
      
      // Check if Firebase is configured
      if (!isFirebaseConfigured()) {
        // Use sample data if Firebase is not configured
        const sampleProject = getSampleProject(projectId);
        if (sampleProject) {
          setProject(sampleProject);
          setLoading(false);
          return;
        }
      }
      
      // Try to load from Firestore
      const projectPath = getProjectPath(companyId, projectId);
      const projectData = await getDocument<Project>(projectPath);
      
      if (projectData) {
        setProject(projectData);
      } else {
        // If not found in Firestore, try sample data as fallback
        const sampleProject = getSampleProject(projectId);
        if (sampleProject) {
          setProject(sampleProject);
        }
      }
    } catch (error) {
      console.error("Failed to load project:", error);
      // Try sample data as fallback
      const sampleProject = getSampleProject(projectId);
      if (sampleProject) {
        setProject(sampleProject);
      }
    } finally {
      setLoading(false);
    }
  };

  const getSampleProject = (id: string): Project | null => {
    // Sample projects matching the landing page
    const sampleProjects: Record<string, Project> = {
      "1": {
        id: "1",
        projectNumber: "PROJ-2024-001",
        projectName: "Downtown Office Building",
        projectType: "structural",
        status: "draft",
        generalContractor: "ABC Construction",
        estimator: "John Smith",
        location: "123 Main St, Downtown",
        bidDueDate: "2024-12-15",
        decisionDate: "2024-12-20",
        deliveryDate: "2025-03-01",
        estimatedValue: "2500000",
        competitionLevel: "medium",
        probabilityOfWin: 65,
        notes: "Large office building project with structural steel frame.",
      },
      "2": {
        id: "2",
        projectNumber: "PROJ-2024-002",
        projectName: "Industrial Warehouse",
        projectType: "structural",
        status: "active",
        generalContractor: "XYZ Builders",
        estimator: "Jane Doe",
        location: "456 Industrial Blvd",
        bidDueDate: "2024-12-20",
        decisionDate: "2024-12-25",
        deliveryDate: "2025-04-15",
        estimatedValue: "1800000",
        competitionLevel: "high",
        probabilityOfWin: 45,
        notes: "Warehouse expansion with steel structure.",
      },
      "3": {
        id: "3",
        projectNumber: "PROJ-2024-003",
        projectName: "Bridge Restoration",
        projectType: "bridge",
        status: "active",
        generalContractor: "Infrastructure Co",
        estimator: "Mike Johnson",
        location: "Highway 101, Bridge #5",
        bidDueDate: "2024-12-10",
        decisionDate: "2024-12-15",
        deliveryDate: "2025-06-30",
        estimatedValue: "3500000",
        competitionLevel: "low",
        probabilityOfWin: 80,
        notes: "Bridge restoration project requiring structural steel repairs.",
      },
    };
    
    return sampleProjects[id] || null;
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
              Back to Dashboard
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
      name: "Estimating",
      href: `/projects/${projectId}/estimating`,
      icon: ClipboardList,
      description: "Build your estimate",
      color: "bg-blue-500 hover:bg-blue-600",
    },
    {
      name: "Spec Review",
      href: `/spec-review?projectId=${projectId}`,
      icon: FileCheck,
      description: "AI compliance check",
      color: "bg-purple-500 hover:bg-purple-600",
    },
    {
      name: "Proposal",
      href: `/proposal?projectId=${projectId}`,
      icon: FileEdit,
      description: "Generate proposal",
      color: "bg-green-500 hover:bg-green-600",
    },
    {
      name: "Reports",
      href: `/reports?projectId=${projectId}`,
      icon: BarChart3,
      description: "View analytics",
      color: "bg-amber-500 hover:bg-amber-600",
    },
  ];

  const secondaryActions = [
    {
      name: "Material Nesting",
      href: `/material-nesting?projectId=${projectId}`,
      icon: Package,
      description: "Optimize material usage",
    },
    {
      name: "Import Quotes",
      href: `/import-quotes?projectId=${projectId}`,
      icon: Upload,
      description: "Import vendor quotes",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold text-gray-900">
                  {project.projectName || "Untitled Project"}
                </h1>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${statusConfig.color}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConfig.label}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-600">
                {project.projectNumber && (
                  <span className="font-mono">{project.projectNumber}</span>
                )}
                {project.generalContractor && (
                  <span className="flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    {project.generalContractor}
                  </span>
                )}
                {project.location && (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" />
                    {project.location}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Project Settings - Moved to top, collapsible */}
        <div>
          <ProjectSettingsPanel companyId={companyId} projectId={projectId} compact={true} />
        </div>

        {/* Key Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Bid Due Date */}
          <Card className="border-l-4 border-l-blue-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                    Bid Due Date
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatDate(project.bidDueDate)}
                  </p>
                  {daysUntilBid !== null && (
                    <p className={`text-xs mt-1 ${isUrgent ? "text-orange-600 font-semibold" : "text-gray-500"}`}>
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
          <Card className="border-l-4 border-l-green-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                    Estimated Value
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(project.estimatedValue)}
                  </p>
                  {project.competitionLevel && (
                    <p className="text-xs text-gray-500 mt-1 capitalize">
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
          <Card className="border-l-4 border-l-purple-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                    Win Probability
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {project.probabilityOfWin || 0}%
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
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
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-600 uppercase tracking-wide mb-1">
                    Estimate Total
                  </p>
                  <p className="text-lg font-semibold text-gray-900">
                    {formatCurrency(estimatingStats.totalCost)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
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
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.name} href={action.href}>
                  <Card className="hover:shadow-lg transition-all cursor-pointer group border-2 hover:border-blue-300">
                    <CardContent className="p-6">
                      <div className={`w-12 h-12 ${action.color} rounded-lg flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {action.name}
                      </h3>
                      <p className="text-sm text-gray-600">{action.description}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Secondary Actions & Project Info */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Secondary Actions */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">More Tools</h2>
            <div className="space-y-2">
              {secondaryActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Link key={action.name} href={action.href}>
                    <Card className="hover:shadow-md transition-all cursor-pointer">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-gray-100 rounded-lg">
                            <Icon className="w-5 h-5 text-gray-600" />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900">
                              {action.name}
                            </h3>
                            <p className="text-xs text-gray-600">{action.description}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Project Timeline & Info */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Project Timeline</h2>
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-blue-600" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">Bid Due Date</h3>
                      <p className="text-sm text-gray-600">{formatDate(project.bidDueDate)}</p>
                      {daysUntilBid !== null && (
                        <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                          isUrgent ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"
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
                        <h3 className="font-semibold text-gray-900">Decision Date</h3>
                        <p className="text-sm text-gray-600">{formatDate(project.decisionDate)}</p>
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
                        <h3 className="font-semibold text-gray-900">Delivery Date</h3>
                        <p className="text-sm text-gray-600">{formatDate(project.deliveryDate)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Project Lifecycle Controls */}
        <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Project Lifecycle
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-gray-600">Change status:</span>
              {["draft", "active", "submitted", "won", "lost"].map((status) => {
                const config = getStatusConfig(status);
                const isCurrent = project.status === status;
                return (
                  <Button
                    key={status}
                    variant={isCurrent ? "primary" : "outline"}
                    size="sm"
                    onClick={() => {
                      // TODO: Update project status in Firestore
                      console.log(`Change status to ${status}`);
                    }}
                    disabled={isCurrent}
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
