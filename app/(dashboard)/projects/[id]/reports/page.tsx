"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Download, Printer } from "lucide-react";
import Button from "@/components/ui/Button";
import { getDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import ProjectReportsView from "@/components/reports/ProjectReportsView";

interface Project {
  id?: string;
  projectNumber?: string;
  projectName?: string;
  projectType?: string;
  status?: string;
  owner?: string;
  generalContractor?: string;
  location?: string;
  bidDueDate?: string;
  estimatedValue?: string | number;
  probabilityOfWin?: number;
}

export default function ProjectReportsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const companyId = "default"; // TODO: Get from auth context

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (projectId && projectId !== "new") {
      loadProject();
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const loadProject = async () => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      const projectPath = getProjectPath(companyId, projectId);
      const projectData = await getDocument<Project>(projectPath);
      if (projectData) {
        setProject({ id: projectId, ...projectData });
      }
    } catch (error) {
      console.error("Failed to load project:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Loading project reports...</div>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500 mb-4">Project not found</div>
          <Link href="/">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${projectId}`}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <FileText className="w-8 h-8 text-blue-600" />
                Project Reports
              </h1>
              <div className="mt-1 text-sm text-gray-600">
                {project.projectNumber && <span className="font-medium">{project.projectNumber}</span>}
                {project.projectNumber && project.projectName && " - "}
                {project.projectName || "Untitled Project"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button variant="outline" size="sm">
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Reports View */}
        <ProjectReportsView companyId={companyId} projectId={projectId} project={project} />
      </div>
    </div>
  );
}

