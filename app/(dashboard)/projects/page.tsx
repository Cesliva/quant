"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { subscribeToCollection, getDocument, getProjectPath, setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";
import { useAuth } from "@/lib/hooks/useAuth";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import Input from "@/components/ui/Input";
import { Search, Archive, Filter } from "lucide-react";

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
  estimatedValue?: string | number;
  winProbability?: number;
  probabilityOfWin?: number;
  assignedEstimator?: string;
}

function ProjectsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = useCompanyId();
  const { user } = useAuth();
  const { permissions } = useUserPermissions();
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showSampleData, setShowSampleData] = useState(true);

  // Load filters from URL parameters
  useEffect(() => {
    const urlSearch = searchParams?.get("search");
    if (urlSearch) {
      setSearchQuery(urlSearch);
    }
    
    const urlStatus = searchParams?.get("status");
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);
  
  // Check if "upcoming" filter is in URL
  const isUpcomingFilter = searchParams?.get("upcoming") === "true";

  // Load showSampleData setting
  useEffect(() => {
    if (!companyId || companyId === "default") return;
    const loadSetting = async () => {
      try {
        const settings = await loadCompanySettings(companyId);
        setShowSampleData(settings.showSampleData !== false); // Default to true if not set
      } catch (error) {
        console.error("Failed to load sample data setting:", error);
      }
    };
    loadSetting();
  }, [companyId]);

  // Load projects from Firestore
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      setProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (projects) => {
        const mappedProjects = projects.map((p) => ({
          id: p.id,
          projectName: p.projectName || "Untitled Project",
          projectNumber: p.projectNumber || "",
          generalContractor: p.generalContractor || "",
          gcId: p.gcId,
          projectType: p.projectType || "",
          bidDueDate: p.bidDueDate || "",
          status: p.status || "draft",
          isSampleData: p.isSampleData || false,
          archived: p.archived === true,
          estimatedValue: p.estimatedValue,
          winProbability: p.probabilityOfWin ? p.probabilityOfWin / 100 : p.winProbability,
          assignedEstimator: p.assignedEstimator,
        }));

        // Filter out sample data if setting is disabled
        let filteredProjects = mappedProjects;
        if (!showSampleData) {
          filteredProjects = filteredProjects.filter(p => !p.isSampleData);
        }

        const uniqueProjects = filteredProjects.filter((project, index, self) =>
          index === self.findIndex((p) => p.id === project.id)
        );

        setProjects(uniqueProjects);
      }
    );

    return () => unsubscribe();
  }, [companyId, showSampleData]);

  // Filter projects based on user permissions and assignment
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    // Filter by archived status
    if (!showArchived) {
      filtered = filtered.filter((p) => !p.archived);
    }

    // Filter by user permissions
    if (permissions.role !== "admin") {
      filtered = filtered.filter((p) =>
        p.assignedEstimator === user?.uid ||
        (p as any).assignedTo?.includes(user?.uid)
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter((p) => p.status === statusFilter);
    }
    
    // Filter by upcoming (next 7 days) if requested
    if (isUpcomingFilter) {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((p) => {
        if (!p.bidDueDate && !p.bidDate) return false;
        const bidDate = p.bidDueDate || p.bidDate;
        if (!bidDate) return false;
        const date = new Date(bidDate);
        return date >= now && date <= sevenDaysFromNow && p.status === "active";
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.projectName?.toLowerCase().includes(query) ||
          p.projectNumber?.toLowerCase().includes(query) ||
          p.generalContractor?.toLowerCase().includes(query) ||
          p.projectType?.toLowerCase().includes(query)
      );
    }

    // Sort by bid due date (upcoming first), then by name
    return filtered.sort((a, b) => {
      if (a.bidDueDate && b.bidDueDate) {
        return new Date(a.bidDueDate).getTime() - new Date(b.bidDueDate).getTime();
      }
      if (a.bidDueDate) return -1;
      if (b.bidDueDate) return 1;
      return (a.projectName || "").localeCompare(b.projectName || "");
    });
  }, [projects, searchQuery, statusFilter, showArchived, permissions, user, isUpcomingFilter]);

  const handleRestore = async (projectId: string, projectName: string) => {
    if (!confirm(`Restore "${projectName}"? It will appear in your active projects list.`)) {
      return;
    }

    try {
      const projectPath = getProjectPath(companyId, projectId);
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

      await setDocument(`${projectsPath}/${projectId}`, dataToRestore, true);
    } catch (error: any) {
      console.error("Error restoring project:", error);
      alert(`Failed to restore project: ${error?.message || "Please try again."}`);
    }
  };

  const activeProjects = filteredProjects.filter((p) => !p.archived);
  const archivedProjects = filteredProjects.filter((p) => p.archived);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight mb-1 text-slate-900">All Projects</h1>
            <p className="text-slate-500">
              {filteredProjects.length} {showArchived ? "total" : "active"} project{filteredProjects.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/projects/new">
              <Button className="px-5 py-2.5 rounded-2xl bg-blue-500 text-white text-sm font-medium shadow-md hover:bg-blue-600 transition-all duration-200">
                + New Project
              </Button>
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-3xl border border-slate-100/50 shadow-sm p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                type="text"
                placeholder="Search projects by name, number, GC, or type..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-full"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
              </select>
            </div>

            {/* Archived Toggle */}
            <Button
              variant={showArchived ? "primary" : "outline"}
              onClick={() => setShowArchived(!showArchived)}
              className="flex items-center gap-2"
            >
              <Archive className="w-4 h-4" />
              {showArchived ? "Hide Archived" : "Show Archived"}
            </Button>
          </div>
        </div>

        {/* Projects List */}
        <div className="bg-white rounded-3xl border border-slate-100/50 shadow-sm overflow-hidden">
          {filteredProjects.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-400 mb-4">
                {searchQuery || statusFilter !== "all"
                  ? "No projects match your filters."
                  : "No projects yet."}
              </p>
              {permissions?.canCreateProjects && (
                <Link href="/projects/new">
                  <Button className="px-5 py-2.5 rounded-xl bg-blue-500 text-white">
                    Create Your First Project
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {/* Active Projects */}
              {activeProjects.length > 0 && (
                <>
                  {activeProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/projects/${project.id}`}
                      className="block hover:bg-slate-50 transition-colors"
                    >
                      <div className="p-6 flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-slate-900 truncate">
                              {project.projectName}
                            </h3>
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${
                                project.status === "active"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : project.status === "won"
                                  ? "bg-blue-100 text-blue-700"
                                  : project.status === "lost"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {project.status || "draft"}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
                            {project.projectNumber && (
                              <span>#{project.projectNumber}</span>
                            )}
                            {project.generalContractor && (
                              <span>GC: {project.generalContractor}</span>
                            )}
                            {project.projectType && (
                              <span>Type: {project.projectType}</span>
                            )}
                            {project.bidDueDate && (
                              <span>
                                Bid Due: {new Date(project.bidDueDate).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="ml-6 text-right">
                          {project.estimatedValue && (
                            <p className="text-lg font-semibold text-emerald-600">
                              {typeof project.estimatedValue === "string"
                                ? Number(project.estimatedValue).toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  })
                                : project.estimatedValue.toLocaleString("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                  })}
                            </p>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </>
              )}

              {/* Archived Projects */}
              {showArchived && archivedProjects.length > 0 && (
                <>
                  <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
                    <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">
                      Archived Projects ({archivedProjects.length})
                    </h3>
                  </div>
                  {archivedProjects.map((project) => (
                    <div
                      key={project.id}
                      className="p-6 flex items-center justify-between opacity-60"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-slate-500 truncate">
                            {project.projectName}
                          </h3>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
                            Archived
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                          {project.projectNumber && (
                            <span>#{project.projectNumber}</span>
                          )}
                          {project.generalContractor && (
                            <span>GC: {project.generalContractor}</span>
                          )}
                        </div>
                      </div>
                      <div className="ml-6 flex items-center gap-3">
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRestore(project.id, project.projectName || "Project");
                          }}
                        >
                          Restore
                        </Button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={
      <div className="max-w-7xl mx-auto space-y-6 p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading projects...</p>
          </div>
        </div>
      </div>
    }>
      <ProjectsPageContent />
    </Suspense>
  );
}