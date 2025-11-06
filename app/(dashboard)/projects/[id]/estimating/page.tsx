"use client";

import { useParams } from "next/navigation";
import EstimatingGrid from "@/components/estimating/EstimatingGrid";
import KPISummary from "@/components/estimating/KPISummary";
import VoiceHUD from "@/components/estimating/VoiceHUD";
import { useState, useEffect } from "react";
import { subscribeToCollection, createDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { parseVoiceTranscription, createEstimatingLineFromParsed } from "@/lib/utils/voiceParser";

// TODO: REMOVE - This flag enables sample data for testing
// Set to false once Firebase is fully integrated
const USE_SAMPLE_DATA = false;

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

  const handleTranscription = async (text: string) => {
    console.log("Transcribed text:", text);
    
    try {
      // Parse the transcription into line items
      const parsedLines = parseVoiceTranscription(text);
      
      if (parsedLines.length === 0) {
        alert(`Could not parse transcription: "${text}"\n\nTry phrases like:\n- "W12x65 column, 8 pieces, 20 feet"\n- "1/2 inch plate, 48 by 96, 2 pieces"`);
        return;
      }

      if (!isFirebaseConfigured()) {
        alert(`Parsed ${parsedLines.length} line(s) from transcription, but Firebase is not configured.\n\nParsed items:\n${parsedLines.map((p, i) => `${i + 1}. ${p.itemDescription}`).join("\n")}`);
        return;
      }

      // Default rates (TODO: Load from company settings)
      const defaultMaterialRate = 0.85;
      const defaultLaborRate = 50;
      const defaultCoatingRate = 2.50;

      // Create line items in Firestore
      const linesPath = getProjectPath(companyId, projectId, "lines");
      let createdCount = 0;

      for (let i = 0; i < parsedLines.length; i++) {
        const parsed = parsedLines[i];
        const lineId = `L${lines.length + i + 1}`;
        
        const newLine = createEstimatingLineFromParsed(
          parsed,
          lineId,
          defaultMaterialRate,
          defaultLaborRate,
          defaultCoatingRate
        );

        await createDocument(linesPath, newLine);
        createdCount++;
      }

      // Success feedback
      if (createdCount > 0) {
        console.log(`Successfully created ${createdCount} line item(s) from voice transcription`);
        // The lines will automatically appear via Firestore subscription
      }
    } catch (error: any) {
      console.error("Failed to create line from transcription:", error);
      alert(`Failed to create line items: ${error.message}`);
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

