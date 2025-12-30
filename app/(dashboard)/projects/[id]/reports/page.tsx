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

export default function ProjectReportsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const companyId = useCompanyId();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportsData, setReportsData] = useState<{
    financials: any;
    metrics: any;
    buyouts: any[];
  } | null>(null);
  const [companyName, setCompanyName] = useState("Company");

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Loading estimating summary...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-slate-500 mb-4">Project not found</div>
          <Link href="/">
            <Button variant="outline">Return to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatCurrency = (value?: string | number) => {
    if (!value) return "$0";
    const num = typeof value === "string" ? parseFloat(value) : value;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(num);
  };

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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-6 md:py-8 text-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-4 md:mb-6 no-print">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-4xl font-semibold tracking-tight text-slate-900">Estimating Summary</h1>
              </div>
              <p className="text-slate-500">
                {project.projectNumber && <span className="font-mono mr-3">{project.projectNumber}</span>}
                {project.projectName || "Untitled Project"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link href={`/projects/${projectId}`}>
                <Button className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
              <Button 
                className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
                onClick={() => {
                  if (reportsData && project) {
                    exportReportsToPDF(
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
                      }
                    );
                  }
                }}
                disabled={!reportsData}
              >
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              <Button 
                className="px-5 py-2.5 rounded-2xl border border-slate-200/80 bg-white text-slate-700 text-sm font-medium shadow-[0_1px_2px_0_rgb(0,0,0,0.05),0_2px_4px_0_rgb(0,0,0,0.03)] hover:shadow-[0_2px_4px_0_rgb(0,0,0,0.08),0_4px_8px_0_rgb(0,0,0,0.05)] hover:bg-slate-50 hover:border-slate-300 transition-all duration-200"
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

