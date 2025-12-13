"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Download, Printer } from "lucide-react";
import Button from "@/components/ui/Button";
import { getDocument, getProjectPath, getDocRef } from "@/lib/firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import ProjectReportsView from "@/components/reports/ProjectReportsView";
import { exportReportsToPDF } from "@/lib/utils/export";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";

interface Project {
  id?: string;
  projectNumber?: string;
  projectName?: string;
  projectType?: string;
  projectTypeSubCategory?: string;
  status?: string;
  owner?: string;
  generalContractor?: string;
  location?: string;
  bidDueDate?: string;
  estimatedValue?: string | number;
  probabilityOfWin?: number;
  [key: string]: any; // Allow any other fields from Firestore
}

import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useUserPermissions } from "@/lib/hooks/useUserPermissions";
import { useAuth } from "@/lib/hooks/useAuth";
import { updateDocument } from "@/lib/firebase/firestore";
import { createAuditLog, createAuditChanges } from "@/lib/utils/auditLog";
import { Save, Shield } from "lucide-react";

export default function ProjectReportsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const companyId = useCompanyId();
  const { permissions } = useUserPermissions();
  const { user } = useAuth();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<{
    financials: any;
    metrics: any;
    buyouts: any[];
  } | null>(null);
  const [companyName, setCompanyName] = useState("Company");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projectId && projectId !== "new") {
      loadProject();
      const unsubscribe = subscribeToProject();
      return () => {
        if (unsubscribe) unsubscribe();
      };
    } else {
      setLoading(false);
    }
  }, [projectId, companyId]);

  // Load company name
  useEffect(() => {
    const loadCompanyName = async () => {
      if (!isFirebaseConfigured() || !companyId) return;
      try {
        const settings = await loadCompanySettings(companyId);
        if (settings?.companyInfo?.companyName) {
          setCompanyName(settings.companyInfo.companyName);
        }
      } catch (error) {
        console.error("Failed to load company name:", error);
      }
    };
    loadCompanyName();
  }, [companyId]);

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

  const subscribeToProject = () => {
    if (!isFirebaseConfigured()) {
      return () => {};
    }

    try {
      const projectPath = getProjectPath(companyId, projectId);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-gray-500">Loading estimating summary...</div>
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
    <>
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          .print-break {
            page-break-after: always;
          }
        }
      `}</style>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
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
                Estimating Summary
              </h1>
              <div className="mt-1 text-sm text-gray-600">
                {project.projectNumber && <span className="font-medium">{project.projectNumber}</span>}
                {project.projectNumber && project.projectName && " - "}
                {project.projectName || "Untitled Project"}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                if (reportsData && project) {
                  try {
                    await exportReportsToPDF(
                      reportsData.financials,
                      reportsData.metrics,
                      project.projectName || "Untitled Project",
                      project.projectNumber || "",
                      companyName,
                      reportsData.buyouts,
                      {
                        projectType: project.projectType,
                        projectTypeSubCategory: project.projectTypeSubCategory,
                        probabilityOfWin: project.probabilityOfWin
                      },
                      companyId
                    );
                  } catch (error: any) {
                    if (error.message === 'Save cancelled') {
                      return;
                    }
                    console.error("Failed to export PDF:", error);
                    alert(`Failed to export PDF: ${error.message}`);
                  }
                }
              }}
              disabled={!reportsData}
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                window.print();
              }}
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Reports View */}
        <ProjectReportsView 
          companyId={companyId} 
          projectId={projectId} 
          project={project}
          onDataReady={(data) => setReportsData(data)}
        />
        </div>
      </div>
    </>
  );
}

