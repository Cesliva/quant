"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import InteractiveEstimateSummary from "@/components/estimating/InteractiveEstimateSummary";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { subscribeToCollection, getDocument, getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import ProjectBubbleChart from "@/components/estimating/ProjectBubbleChart";
import CategoryComparisonChart from "@/components/estimating/CategoryComparisonChart";

export default function EstimateSummaryPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;
  const companyId = useCompanyId();
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [selectedMetric, setSelectedMetric] = useState<"laborHoursPerTon" | "costPerTon">("laborHoursPerTon");
  const [adjustedTotals, setAdjustedTotals] = useState<any>(null);

  // Load project name
  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId || !companyId) return;

    const loadProject = async () => {
      try {
        const projectPath = getProjectPath(companyId, projectId);
        const projectData = await getDocument<{ projectName?: string }>(projectPath);
        if (projectData) {
          setProjectName(projectData.projectName || projectId);
        }
      } catch (error) {
        console.error("Failed to load project:", error);
      }
    };

    loadProject();
  }, [projectId, companyId]);

  // Load estimating lines
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || !projectId) {
      setLines([]);
      return;
    }

    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(linesPath, (data) => {
      setLines(data);
    });

    return () => unsubscribe();
  }, [companyId, projectId]);

  if (!isFirebaseConfigured() || !companyId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-slate-500">Firebase is not configured.</p>
        </div>
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Project
            </Button>
          </Link>
        </div>
        <div className="text-center py-12">
          <p className="text-slate-500">No estimate lines found. Add lines to see the interactive summary.</p>
          <Link href={`/projects/${projectId}/estimating`}>
            <Button className="mt-4">Go to Estimating</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link href={`/projects/${projectId}`}>
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Project Dashboard
          </Button>
        </Link>
      </div>

      <div className="space-y-6">
        <InteractiveEstimateSummary
          lines={lines}
          companyId={companyId}
          projectId={projectId}
          projectName={projectName}
          onTotalsChange={setAdjustedTotals}
        />

        {/* Charts that update with adjusted totals */}
        {lines.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ProjectBubbleChart
              lines={lines}
              companyId={companyId}
              projectName={projectName}
              currentProjectId={projectId}
              selectedMetric={selectedMetric}
              onMetricChange={setSelectedMetric}
            />
            <CategoryComparisonChart
              lines={lines}
              companyId={companyId}
              currentProjectId={projectId}
              selectedMetric={selectedMetric}
            />
          </div>
        )}
      </div>
    </div>
  );
}

