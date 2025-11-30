"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { subscribeToCollection, updateDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { Archive, ArrowLeft, Calendar, Users, Search } from "lucide-react";

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
  generalContractor?: string;
  bidDueDate?: string;
  bidDate?: string;
  name?: string;
  gc?: string;
  status?: string;
  isSampleData?: boolean;
  archived?: boolean;
}

import { useCompanyId } from "@/lib/hooks/useCompanyId";

export default function ArchivedProjectsPage() {
  const router = useRouter();
  const companyId = useCompanyId();
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setArchivedProjects([]);
      return;
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (projects) => {
        // Filter to only archived projects
        const archived = projects
          .filter((p) => p.archived === true)
          .map((p) => ({
            id: p.id,
            name: p.projectName || "Untitled Project",
            gc: p.generalContractor || "",
            bidDate: p.bidDueDate || "",
            status: p.status || "draft",
            isSampleData: p.isSampleData || false,
            projectNumber: p.projectNumber || "",
          }));
        setArchivedProjects(archived);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const handleRestore = async (projectId: string, projectName: string) => {
    if (!confirm(`Restore "${projectName}"? It will appear in your active projects list.`)) {
      return;
    }

    try {
      // Get current project data to preserve all fields
      const { getDocument, getProjectPath, setDocument } = await import("@/lib/firebase/firestore");
      const projectPath = getProjectPath(companyId, projectId);
      const currentProject = await getDocument(projectPath);
      
      if (!currentProject) {
        alert("Project not found in Firestore. Cannot restore.");
        return;
      }
      
      // Use setDocument with merge to ensure the document exists and all fields are preserved
      const projectsPath = `companies/${companyId}/projects`;
      const dataToRestore = {
        ...currentProject,
        archived: false, // Explicitly set to boolean false
      };
      
      console.log("Restoring project:", projectId, "Data:", dataToRestore);
      await setDocument(`${projectsPath}/${projectId}`, dataToRestore, true);
      
      // Wait a moment for Firestore to propagate
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Project will automatically disappear from this list due to real-time subscription
    } catch (error: any) {
      console.error("Error restoring project:", error);
      alert(`Failed to restore project: ${error?.message || "Please try again."}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active": return "bg-blue-100 text-blue-800";
      case "draft": return "bg-gray-100 text-gray-800";
      case "submitted": return "bg-green-100 text-green-800";
      case "won": return "bg-purple-100 text-purple-800";
      case "lost": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredProjects = archivedProjects.filter((project) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      project.projectNumber?.toLowerCase().includes(query) ||
      project.name?.toLowerCase().includes(query) ||
      project.gc?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Company Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Archived Projects</h1>
              <p className="text-sm text-gray-500 mt-1">
                {archivedProjects.length} archived project{archivedProjects.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search archived projects by number or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Archived Projects List */}
        {filteredProjects.length === 0 ? (
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12 text-center">
              <Archive className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {searchQuery ? "No matching archived projects" : "No archived projects"}
              </h3>
              <p className="text-gray-600 mb-6">
                {searchQuery 
                  ? "Try adjusting your search terms."
                  : "Projects you archive will appear here. You can restore them at any time."}
              </p>
              {!searchQuery && (
                <Link href="/">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Company Dashboard
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardContent className="p-0">
              <div className="divide-y divide-gray-100">
                {filteredProjects.map((project) => (
                  <div
                    key={project.id}
                    className="p-4 hover:bg-gray-50/80 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {project.name}
                          </h3>
                          {project.projectNumber && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-mono font-medium flex-shrink-0 bg-gray-100 text-gray-700 border border-gray-200">
                              {project.projectNumber}
                            </span>
                          )}
                          {project.isSampleData && (
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 bg-orange-100 text-orange-700 border border-orange-200">
                              Sample
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 ${getStatusColor(project.status || "draft")}`}>
                            {(project.status || "draft").charAt(0).toUpperCase() + (project.status || "draft").slice(1)}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0 bg-gray-200 text-gray-700">
                            Archived
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{project.gc}</p>
                        <div className="flex items-center gap-4 text-xs">
                          {project.bidDate && (
                            <span className="flex items-center gap-1.5 text-gray-500">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(project.bidDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(project.id, project.name || "Untitled Project")}
                          className="border-green-300 text-green-700 hover:bg-green-50"
                        >
                          Restore
                        </Button>
                        <Link href={`/projects/${project.id}`}>
                          <Button variant="outline" size="sm">
                            View
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

