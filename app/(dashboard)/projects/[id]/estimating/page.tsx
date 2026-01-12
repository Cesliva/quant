"use client";

import { useParams, useSearchParams } from "next/navigation";
import EstimatingGrid from "@/components/estimating/EstimatingGrid";
import KPISummary from "@/components/estimating/KPISummary";
import { useState, useEffect } from "react";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument, getDocument, getDocRef } from "@/lib/firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import {
  loadCompanySettings,
  getMaterialRateForGrade,
  getLaborRate,
  getCoatingRate,
  type CompanySettings,
} from "@/lib/utils/settingsLoader";

import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { UserPresence } from "@/components/collaboration/UserPresence";
import { logActivity } from "@/lib/utils/activityLogger";
import ProposalSeedsCard from "@/components/estimating/ProposalSeedsCard";
import ProjectBubbleChart from "@/components/estimating/ProjectBubbleChart";

export default function EstimatingPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.id as string;
  const companyId = useCompanyId();
  const lineIdFromUrl = searchParams.get("lineId");
  
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [projectName, setProjectName] = useState<string>("");
  const [projectNumber, setProjectNumber] = useState<string>("");
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(lineIdFromUrl || null);
  const [addLineHandler, setAddLineHandler] = useState<(() => void) | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<"laborHoursPerTon" | "costPerTon">("laborHoursPerTon");

  // Load company settings
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId) {
      setCompanySettings(null);
      return;
    }
    loadCompanySettings(companyId).then(setCompanySettings);
  }, [companyId]);


  // Load project name and number with real-time subscription
  useEffect(() => {
    if (!isFirebaseConfigured() || !projectId) {
      setProjectName("");
      setProjectNumber("");
      return;
    }

    // Initial load
    const loadProject = async () => {
      try {
        const projectPath = getProjectPath(companyId, projectId);
        const projectData = await getDocument<{ projectName?: string; projectNumber?: string }>(projectPath);
        if (projectData) {
          setProjectName(projectData.projectName || projectId);
          setProjectNumber(projectData.projectNumber || "");
        } else {
          setProjectName(projectId);
          setProjectNumber("");
        }
      } catch (error) {
        console.error("Failed to load project:", error);
        setProjectName(projectId);
        setProjectNumber("");
      }
    };

    loadProject();

    // Real-time subscription
    const projectPath = getProjectPath(companyId, projectId);
    const projectDocRef = getDocRef(projectPath);

    const unsubscribe = onSnapshot(
      projectDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setProjectName(data.projectName || projectId);
          setProjectNumber(data.projectNumber || "");
        }
      },
      (error) => {
        console.error("Error subscribing to project:", error);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLines([]);
      return () => {};
    }

    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  // Log activity when viewing page
  useEffect(() => {
    if (projectId && companyId) {
      logActivity(companyId, projectId, "viewed_estimating");
    }
  }, [projectId, companyId]);

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 overflow-y-auto">
      <div className="flex flex-col space-y-4 pb-4">
        {/* User Presence */}
        <div className="flex items-center justify-end">
          <UserPresence projectId={projectId} currentPage="estimating" />
        </div>
        
        {/* Header - Compact */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
        <div className="flex items-center gap-4 min-w-0 flex-shrink">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">Structural Steel Estimate</h1>
            <p className="text-sm text-gray-600 mt-1 truncate">
              {projectNumber ? `${projectNumber} - ` : ""}{projectName || projectId || "N/A"}
            </p>
          </div>
        </div>
      </div>


      {/* KPI Summary - Sticky at top */}
      <div className="flex-shrink-0">
        <KPISummary 
          lines={lines} 
          onAddLine={addLineHandler || undefined}
          isManualMode={true}
        />
      </div>

      {/* Estimating Grid - Expands to show full detail view */}
      <div className="flex-shrink-0">
        <EstimatingGrid 
          companyId={companyId} 
          projectId={projectId}
          isManualMode={true}
          highlightLineId={lineIdFromUrl}
          onAddLineRef={setAddLineHandler}
        />
      </div>

      {/* Progressive Inclusions/Exclusions - Fixed height, no scroll */}
      <div className="flex-shrink-0">
        <ProposalSeedsCard
          companyId={companyId}
          projectId={projectId}
          selectedLineId={selectedLineId}
          lines={lines}
        />
      </div>

      {/* Real-time Bubble Chart Feedback */}
      {lines.length > 0 && (
        <div className="flex-shrink-0 mt-6">
          <ProjectBubbleChart
            lines={lines}
            companyId={companyId}
            projectName={projectName}
            currentProjectId={projectId}
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
          />
        </div>
      )}
      </div>
    </div>
  );
}
