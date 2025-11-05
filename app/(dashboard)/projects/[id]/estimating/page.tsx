"use client";

import { useParams } from "next/navigation";
import EstimatingGrid from "@/components/estimating/EstimatingGrid";
import KPISummary from "@/components/estimating/KPISummary";
import VoiceHUD from "@/components/estimating/VoiceHUD";
import { useState, useEffect } from "react";
import { subscribeToCollection } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import { isFirebaseConfigured } from "@/lib/firebase/config";

// TODO: REMOVE - This flag enables sample data for testing
// Set to false once Firebase is fully integrated
const USE_SAMPLE_DATA = true;

export default function EstimatingPage() {
  const params = useParams();
  const projectId = params.id as string;
  const companyId = "default"; // TODO: Get from auth context
  
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);

  useEffect(() => {
    // Use sample data if Firebase is not configured or USE_SAMPLE_DATA is true
    if (USE_SAMPLE_DATA || !isFirebaseConfigured()) {
      const sampleData = getSampleProjectData(projectId || "1");
      setLines(sampleData.lines);
      return;
    }

    // Use Firebase if configured
    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  const handleTranscription = (text: string) => {
    // TODO: Parse transcribed text and create estimating lines
    console.log("Transcribed text:", text);
    
    // For demo: Add a sample line from transcription
    if (USE_SAMPLE_DATA || !isFirebaseConfigured()) {
      // In demo mode, just show the transcription
      alert(`Transcription: ${text}\n\nLine parsing coming soon!`);
    } else {
      // Real implementation would parse and create lines
      alert(`Transcription: ${text}\n\nLine parsing coming soon!`);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estimating Workspace</h1>
          <p className="text-sm text-gray-600 mt-1">
            Voice input or manual entry for project {projectId || "N/A"}
          </p>
        </div>
        {(USE_SAMPLE_DATA || !isFirebaseConfigured()) && (
          <span className="text-xs text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-medium">
            Sample Data Mode
          </span>
        )}
      </div>

      {/* Voice HUD Controls */}
      <VoiceHUD
        companyId={companyId}
        projectId={projectId}
        onTranscriptionComplete={handleTranscription}
        isManualMode={isManualMode}
        onManualModeToggle={setIsManualMode}
      />

      {/* KPI Summary */}
      <KPISummary lines={lines} />

      {/* Estimating Grid */}
      <EstimatingGrid 
        companyId={companyId} 
        projectId={projectId}
        isManualMode={isManualMode}
      />
    </div>
  );
}

