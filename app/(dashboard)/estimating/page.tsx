"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EstimatingGrid from "@/components/estimating/EstimatingGrid";
import KPISummary from "@/components/estimating/KPISummary";
import VoiceHUD from "@/components/estimating/VoiceHUD";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { subscribeToCollection, createDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { parseVoiceTranscription, createEstimatingLineFromParsed } from "@/lib/utils/voiceParser";
import { FileText, ArrowRight } from "lucide-react";

// TODO: REMOVE - This flag enables sample data for testing
const USE_SAMPLE_DATA = false;

function EstimatingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = "default"; // TODO: Get from auth context
  
  const projectIdFromQuery = searchParams?.get("projectId");
  const [selectedProject, setSelectedProject] = useState<string>(
    projectIdFromQuery || "1"
  );
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [isManualMode, setIsManualMode] = useState(false);

  // Mock projects list - replace with real Firestore query
  const projects = [
    { id: "1", name: "Downtown Office Building" },
    { id: "2", name: "Industrial Warehouse" },
    { id: "3", name: "Bridge Restoration" },
  ];

  useEffect(() => {
    if (!selectedProject) return;

    // Use sample data if Firebase is not configured or USE_SAMPLE_DATA is true
    if (USE_SAMPLE_DATA || !isFirebaseConfigured()) {
      const sampleData = getSampleProjectData(selectedProject);
      setLines(sampleData.lines);
      return;
    }

    // Use Firebase if configured
    const linesPath = getProjectPath(companyId, selectedProject, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    return () => unsubscribe();
  }, [companyId, selectedProject]);

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
      const linesPath = getProjectPath(companyId, selectedProject, "lines");
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

  const handleProjectChange = (newProjectId: string) => {
    setSelectedProject(newProjectId);
    // Update URL with project ID as query param
    router.push(`/estimating?projectId=${newProjectId}`);
  };

  if (!selectedProject) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Project Selected
          </h3>
          <p className="text-gray-600 mb-6">
            Please select a project to view the estimating workspace.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/">
              <Button variant="outline">View Projects</Button>
            </Link>
            <Link href="/projects/new">
              <Button variant="primary">
                <ArrowRight className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Estimating Workspace</h1>
          <p className="text-sm text-gray-600 mt-1">
            Voice input or manual entry for estimating
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedProject}
            onChange={(e) => handleProjectChange(e.target.value)}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {(USE_SAMPLE_DATA || !isFirebaseConfigured()) && (
            <span className="text-xs text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-medium">
              Sample Data
            </span>
          )}
        </div>
      </div>

      {/* Voice HUD Controls */}
      <VoiceHUD
        companyId={companyId}
        projectId={selectedProject}
        onTranscriptionComplete={handleTranscription}
        isManualMode={isManualMode}
        onManualModeToggle={setIsManualMode}
      />

      {/* KPI Summary */}
      <KPISummary lines={lines} />

      {/* Estimating Grid */}
      <EstimatingGrid 
        companyId={companyId} 
        projectId={selectedProject}
        isManualMode={isManualMode}
      />
    </div>
  );
}

export default function EstimatingPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="flex items-center justify-center p-12">
          <div className="text-center">
            <p className="text-gray-600">Loading estimating workspace...</p>
          </div>
        </div>
      </div>
    }>
      <EstimatingContent />
    </Suspense>
  );
}

