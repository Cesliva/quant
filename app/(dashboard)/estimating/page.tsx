"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EstimatingGrid from "@/components/estimating/EstimatingGrid";
import KPISummary from "@/components/estimating/KPISummary";
import VoiceAgent from "@/components/estimating/VoiceAgent";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { VoiceAgentResponse } from "@/lib/openai/voiceAgent";
import { getSampleProjectData } from "@/lib/mock-data/sampleProjectData";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { parseVoiceTranscription, createEstimatingLineFromParsed, ParsedEditCommand, ParsedLine } from "@/lib/utils/voiceParser";
import { voiceCommandHistory } from "@/lib/utils/voiceCommandHistory";
import { createLineFromStructuredData } from "@/lib/utils/structuredVoiceParser";
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

  const handleStructuredData = async (data: Partial<EstimatingLine>, shouldProcess: boolean, createNewLine?: boolean) => {
    if (!shouldProcess) {
      // Check if we need to create a new blank line
      if (createNewLine || (data.lineId && !lines.find(l => l.lineId === data.lineId))) {
        // Create a new blank line immediately
        const defaultMaterialRate = 0.85;
        const defaultLaborRate = 50;
        const defaultCoatingRate = 2.50;
        
        const lineId = data.lineId || `L${lines.length + 1}`;
        
        // Create blank line with defaults
        const blankLine: Partial<EstimatingLine> = {
          lineId: lineId,
          drawingNumber: "",
          detailNumber: "",
          itemDescription: "",
          category: "Misc Metals",
          subCategory: "",
          materialType: "Rolled",
          status: "Active",
          materialRate: defaultMaterialRate,
          laborRate: defaultLaborRate,
          coatingRate: defaultCoatingRate,
          ...data, // Include any data already provided
        };
        
        try {
          const linesPath = getProjectPath(companyId, selectedProject, "lines");
          const documentId = await createDocument(linesPath, blankLine);
          console.log(`Created new blank line ${lineId}`);
          
          // Track create action for undo
          if (documentId) {
            voiceCommandHistory.addAction({
              type: "create",
              timestamp: Date.now(),
              documentId: documentId,
              lineId: lineId,
              newState: blankLine as EstimatingLine,
            });
          }
        } catch (error: any) {
          console.error("Failed to create new line:", error);
        }
        return;
      }
      
      // Real-time update: update the line in real-time as fields are spoken
      if (data.lineId) {
        const existingLine = lines.find(l => l.lineId === data.lineId);
        if (existingLine && existingLine.id) {
          // Update existing line in real-time
          try {
            const updatedLine = { ...existingLine, ...data };
            const linesPath = getProjectPath(companyId, selectedProject, "lines");
            await updateDocument(linesPath, existingLine.id, updatedLine);
            console.log(`Real-time update to line ${data.lineId}:`, data);
          } catch (error: any) {
            console.error("Failed to update line in real-time:", error);
          }
        } else {
          // Line doesn't exist yet - create it
          const defaultMaterialRate = 0.85;
          const defaultLaborRate = 50;
          const defaultCoatingRate = 2.50;
          
          const blankLine: Partial<EstimatingLine> = {
            lineId: data.lineId,
            drawingNumber: "",
            detailNumber: "",
            itemDescription: "",
            category: "Misc Metals",
            subCategory: "",
            materialType: "Rolled",
            status: "Active",
            materialRate: defaultMaterialRate,
            laborRate: defaultLaborRate,
            coatingRate: defaultCoatingRate,
            ...data,
          };
          
          try {
            const linesPath = getProjectPath(companyId, selectedProject, "lines");
            await createDocument(linesPath, blankLine);
            console.log(`Created new line ${data.lineId} with data:`, data);
          } catch (error: any) {
            console.error("Failed to create line:", error);
          }
        }
      } else {
        console.log("Accumulating data (no line ID yet):", data);
      }
      return;
    }

    // Process the accumulated data and create line (when "Enter" is said)
    console.log("Processing structured data (Enter command):", data);
    
    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Cannot save line.");
      return;
    }

    try {
      const defaultMaterialRate = 0.85;
      const defaultLaborRate = 50;
      const defaultCoatingRate = 2.50;
      
      // Use the line ID from data, or generate next one
      const lineId = data.lineId || `L${lines.length + 1}`;
      
      // Check if line already exists (from real-time updates)
      const existingLine = lines.find(l => l.lineId === lineId);
      
      if (existingLine && existingLine.id) {
        // Finalize the existing line
        const finalizedLine = createLineFromStructuredData(
          { ...existingLine, ...data },
          lineId,
          defaultMaterialRate,
          defaultLaborRate,
          defaultCoatingRate
        );
        
        const linesPath = getProjectPath(companyId, selectedProject, "lines");
        await updateDocument(linesPath, existingLine.id, finalizedLine);
        console.log(`Finalized line ${lineId}`);
      } else {
        // Create new line
        const newLine = createLineFromStructuredData(
          data,
          lineId,
          defaultMaterialRate,
          defaultLaborRate,
          defaultCoatingRate
        );

        const linesPath = getProjectPath(companyId, selectedProject, "lines");
        const documentId = await createDocument(linesPath, newLine);
        
        // Track create action for undo
        if (documentId) {
          voiceCommandHistory.addAction({
            type: "create",
            timestamp: Date.now(),
            documentId: documentId,
            lineId: lineId,
            newState: newLine,
          });
        }
        
        console.log(`Successfully created line ${lineId} from structured voice input`);
      }
    } catch (error: any) {
      console.error("Failed to create/update line from structured data:", error);
      alert(`Failed to process line: ${error.message}`);
    }
  };

  const handleVoiceAgentAction = async (response: VoiceAgentResponse) => {
    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Cannot process command.");
      return;
    }

    try {
      const defaultMaterialRate = 0.85;
      const defaultLaborRate = 50;
      const defaultCoatingRate = 2.50;
      const linesPath = getProjectPath(companyId, selectedProject, "lines");

      if (response.action === "create") {
        const lineId = response.lineId || `L${lines.length + 1}`;
        const newLine = createLineFromStructuredData(
          response.data || {},
          lineId,
          defaultMaterialRate,
          defaultLaborRate,
          defaultCoatingRate
        );

        const documentId = await createDocument(linesPath, newLine);
        
        if (documentId) {
          voiceCommandHistory.addAction({
            type: "create",
            timestamp: Date.now(),
            documentId: documentId,
            lineId: lineId,
            newState: newLine,
          });
        }
        console.log(`AI created line ${lineId}`);
      } else if (response.action === "update" && response.lineId) {
        const existingLine = lines.find(l => l.lineId === response.lineId);
        if (existingLine && existingLine.id && response.data) {
          const updatedLine = { ...existingLine, ...response.data };
          const finalizedLine = createLineFromStructuredData(
            updatedLine,
            response.lineId,
            defaultMaterialRate,
            defaultLaborRate,
            defaultCoatingRate
          );
          
          await updateDocument(linesPath, existingLine.id, finalizedLine);
          
          voiceCommandHistory.addAction({
            type: "update",
            timestamp: Date.now(),
            documentId: existingLine.id,
            lineId: response.lineId,
            previousState: existingLine,
            newState: finalizedLine,
          });
          console.log(`AI updated line ${response.lineId}`);
        }
      } else if (response.action === "delete" && response.lineId) {
        const existingLine = lines.find(l => l.lineId === response.lineId);
        if (existingLine && existingLine.id) {
          await deleteDocument(linesPath, existingLine.id);
          
          voiceCommandHistory.addAction({
            type: "delete",
            timestamp: Date.now(),
            documentId: existingLine.id,
            lineId: response.lineId,
            previousState: existingLine,
          });
          console.log(`AI deleted line ${response.lineId}`);
        }
      } else if (response.action === "query") {
        console.log(`AI query: ${response.message}`);
      }
    } catch (error: any) {
      console.error("Failed to execute AI action:", error);
      throw error;
    }
  };

  const handleTranscription = async (text: string) => {
    console.log("Transcribed text:", text);
    
    if (!text || text.trim().length === 0) {
      console.warn("Empty transcription received");
      alert("No speech detected. Please try again.");
      return;
    }
    
    try {
      // Parse the transcription - could be edit command, new lines, edit + new line, or undo/redo
      const parsed = parseVoiceTranscription(text);
      console.log("Parsed result:", parsed);
      
      // Check for undo/redo commands
      if ('command' in parsed) {
        if (parsed.command === "undo") {
          const action = voiceCommandHistory.undo();
          if (!action) {
            alert("Nothing to undo.");
            return;
          }
          
          const linesPath = getProjectPath(companyId, selectedProject, "lines");
          
          // Reverse the action
          if (action.type === "create" && action.documentId) {
            // Undo create = delete
            await deleteDocument(`${linesPath}/${action.documentId}`);
            console.log(`Undo: Deleted line ${action.lineId}`);
          } else if (action.type === "update" && action.documentId && action.previousState) {
            // Undo update = restore previous state
            await updateDocument(`${linesPath}/${action.documentId}`, action.previousState);
            console.log(`Undo: Restored line ${action.lineId}`);
          } else if (action.type === "delete" && action.documentId && action.previousState) {
            // Undo delete = recreate
            await createDocument(linesPath, action.previousState as EstimatingLine);
            console.log(`Undo: Recreated line ${action.lineId}`);
          }
          return;
        } else if (parsed.command === "redo") {
          const action = voiceCommandHistory.redo();
          if (!action) {
            alert("Nothing to redo.");
            return;
          }
          
          const linesPath = getProjectPath(companyId, selectedProject, "lines");
          
          // Re-apply the action
          if (action.type === "create" && action.documentId && action.newState) {
            // Redo create = recreate
            await createDocument(linesPath, action.newState as EstimatingLine);
            console.log(`Redo: Recreated line ${action.lineId}`);
          } else if (action.type === "update" && action.documentId && action.newState) {
            // Redo update = re-apply update
            await updateDocument(`${linesPath}/${action.documentId}`, action.newState);
            console.log(`Redo: Re-applied update to line ${action.lineId}`);
          } else if (action.type === "delete" && action.documentId) {
            // Redo delete = delete again
            await deleteDocument(`${linesPath}/${action.documentId}`);
            console.log(`Redo: Deleted line ${action.lineId}`);
          }
          return;
        }
      }
      
      // Check if it's an edit command followed by new lines
      if ('edit' in parsed && 'newLines' in parsed) {
        const { edit: editCmd, newLines } = parsed as { edit: ParsedEditCommand; newLines: ParsedLine[] };
        
        // Process the edit first
        if (!isFirebaseConfigured()) {
          alert(`Edit command parsed for ${editCmd.targetLineId}, but Firebase is not configured.`);
          return;
        }

        const lineToEdit = lines.find(l => l.lineId === editCmd.targetLineId);
        if (lineToEdit && lineToEdit.id) {
          // Recalculate if needed
          if (editCmd.updates.sizeDesignation) {
            const { getWeightPerFoot, getSurfaceAreaPerFoot } = await import("@/lib/utils/aiscShapes");
            editCmd.updates.weightPerFoot = getWeightPerFoot(editCmd.updates.sizeDesignation);
            editCmd.updates.surfaceAreaPerFoot = getSurfaceAreaPerFoot(editCmd.updates.sizeDesignation);
            const currentLengthFt = editCmd.updates.lengthFt ?? lineToEdit.lengthFt ?? 0;
            const currentLengthIn = editCmd.updates.lengthIn ?? lineToEdit.lengthIn ?? 0;
            const currentQty = editCmd.updates.qty ?? lineToEdit.qty ?? 1;
            const totalLength = currentLengthFt + (currentLengthIn / 12);
            editCmd.updates.totalWeight = (editCmd.updates.weightPerFoot || 0) * totalLength * currentQty;
            editCmd.updates.totalSurfaceArea = (editCmd.updates.surfaceAreaPerFoot || 0) * totalLength * currentQty;
          } else if (editCmd.updates.lengthFt !== undefined || editCmd.updates.lengthIn !== undefined || editCmd.updates.qty !== undefined) {
            const weightPerFoot = lineToEdit.weightPerFoot || 0;
            const surfaceAreaPerFoot = lineToEdit.surfaceAreaPerFoot || 0;
            const currentLengthFt = editCmd.updates.lengthFt ?? lineToEdit.lengthFt ?? 0;
            const currentLengthIn = editCmd.updates.lengthIn ?? lineToEdit.lengthIn ?? 0;
            const currentQty = editCmd.updates.qty ?? lineToEdit.qty ?? 1;
            const totalLength = currentLengthFt + (currentLengthIn / 12);
            editCmd.updates.totalWeight = weightPerFoot * totalLength * currentQty;
            editCmd.updates.totalSurfaceArea = surfaceAreaPerFoot * totalLength * currentQty;
          }

          const linesPath = getProjectPath(companyId, selectedProject, "lines");
          
          // Store previous state for undo
          const previousState = { ...lineToEdit };
          
          await updateDocument(`${linesPath}/${lineToEdit.id}`, editCmd.updates);
          
          // Track update action for undo
          voiceCommandHistory.addAction({
            type: "update",
            timestamp: Date.now(),
            documentId: lineToEdit.id,
            lineId: editCmd.targetLineId,
            previousState: previousState,
            newState: { ...lineToEdit, ...editCmd.updates },
          });
          
          console.log(`Successfully updated line ${editCmd.targetLineId}`);
        }

        // Now process the new lines
        if (newLines.length > 0) {
          const defaultMaterialRate = 0.85;
          const defaultLaborRate = 50;
          const defaultCoatingRate = 2.50;
          const linesPath = getProjectPath(companyId, selectedProject, "lines");
          
          for (const parsedLine of newLines) {
            const lineId = parsedLine.lineId || `L${lines.length + 1}`;
            const newLine = createEstimatingLineFromParsed(
              parsedLine,
              lineId,
              defaultMaterialRate,
              defaultLaborRate,
              defaultCoatingRate
            );
            const documentId = await createDocument(linesPath, newLine);
            
            // Track create action for undo
            if (documentId) {
              voiceCommandHistory.addAction({
                type: "create",
                timestamp: Date.now(),
                documentId: documentId,
                lineId: lineId,
                newState: newLine,
              });
            }
          }
          console.log(`Successfully created ${newLines.length} new line(s) after edit`);
        }
        return;
      }
      
      // Check if it's just an edit command
      if ('isEdit' in parsed && parsed.isEdit) {
        const editCmd = parsed as ParsedEditCommand;
        
        if (!isFirebaseConfigured()) {
          alert(`Edit command parsed for ${editCmd.targetLineId}, but Firebase is not configured.`);
          return;
        }

        // Find the line to edit by lineId
        const lineToEdit = lines.find(l => l.lineId === editCmd.targetLineId);
        if (!lineToEdit || !lineToEdit.id) {
          alert(`Line ${editCmd.targetLineId} not found. Please create the line first.`);
          return;
        }

        // Recalculate weight and surface area if size changed
        if (editCmd.updates.sizeDesignation) {
          const { getWeightPerFoot, getSurfaceAreaPerFoot } = await import("@/lib/utils/aiscShapes");
          editCmd.updates.weightPerFoot = getWeightPerFoot(editCmd.updates.sizeDesignation);
          editCmd.updates.surfaceAreaPerFoot = getSurfaceAreaPerFoot(editCmd.updates.sizeDesignation);
          
          // Recalculate total weight if length and qty are available
          const currentLengthFt = editCmd.updates.lengthFt ?? lineToEdit.lengthFt ?? 0;
          const currentLengthIn = editCmd.updates.lengthIn ?? lineToEdit.lengthIn ?? 0;
          const currentQty = editCmd.updates.qty ?? lineToEdit.qty ?? 1;
          const totalLength = currentLengthFt + (currentLengthIn / 12);
          editCmd.updates.totalWeight = (editCmd.updates.weightPerFoot || 0) * totalLength * currentQty;
          editCmd.updates.totalSurfaceArea = (editCmd.updates.surfaceAreaPerFoot || 0) * totalLength * currentQty;
        } else if (editCmd.updates.lengthFt !== undefined || editCmd.updates.lengthIn !== undefined || editCmd.updates.qty !== undefined) {
          // Length or quantity changed, recalculate totals
          const weightPerFoot = lineToEdit.weightPerFoot || 0;
          const surfaceAreaPerFoot = lineToEdit.surfaceAreaPerFoot || 0;
          const currentLengthFt = editCmd.updates.lengthFt ?? lineToEdit.lengthFt ?? 0;
          const currentLengthIn = editCmd.updates.lengthIn ?? lineToEdit.lengthIn ?? 0;
          const currentQty = editCmd.updates.qty ?? lineToEdit.qty ?? 1;
          const totalLength = currentLengthFt + (currentLengthIn / 12);
          editCmd.updates.totalWeight = weightPerFoot * totalLength * currentQty;
          editCmd.updates.totalSurfaceArea = surfaceAreaPerFoot * totalLength * currentQty;
        }

        // Update the line in Firestore
        const linesPath = getProjectPath(companyId, selectedProject, "lines");
        
        // Store previous state for undo
        const previousState = { ...lineToEdit };
        
        await updateDocument(`${linesPath}/${lineToEdit.id}`, editCmd.updates);
        
        // Track update action for undo
        voiceCommandHistory.addAction({
          type: "update",
          timestamp: Date.now(),
          documentId: lineToEdit.id,
          lineId: editCmd.targetLineId,
          previousState: previousState,
          newState: { ...lineToEdit, ...editCmd.updates },
        });
        
        console.log(`Successfully updated line ${editCmd.targetLineId}`);
        // The line will automatically update via Firestore subscription
        return;
      }

      // Otherwise, it's a new line creation
      const parsedLines = parsed as any[];
      console.log("Parsed lines:", parsedLines);
      
      if (!Array.isArray(parsedLines) || parsedLines.length === 0) {
        console.warn("Failed to parse transcription into lines:", text);
        alert(`Could not parse transcription: "${text}"\n\nTry phrases like:\n- "W12x65 column, 8 pieces, 20 feet"\n- "1/2 inch plate, 48 by 96, 2 pieces"\n- "L4 W10x15 beam, 5 pieces, 15 feet" (to specify line ID)\n- "edit L4, change member size to HSS 6x6x1/4" (to edit existing line)`);
        return;
      }

      if (!isFirebaseConfigured()) {
        console.warn("Firebase not configured, cannot save lines");
        alert(`Parsed ${parsedLines.length} line(s) from transcription, but Firebase is not configured.\n\nParsed items:\n${parsedLines.map((p, i) => `${i + 1}. ${p.itemDescription}${p.lineId ? ` (Line ${p.lineId})` : ""}`).join("\n")}`);
        return;
      }
      
      console.log(`Processing ${parsedLines.length} line(s) for creation`);

      // Default rates (TODO: Load from company settings)
      const defaultMaterialRate = 0.85;
      const defaultLaborRate = 50;
      const defaultCoatingRate = 2.50;

      // Create line items in Firestore
      const linesPath = getProjectPath(companyId, selectedProject, "lines");
      let createdCount = 0;

      for (let i = 0; i < parsedLines.length; i++) {
        const parsedLine = parsedLines[i];
        // Use voice-provided line ID if available, otherwise auto-generate
        const lineId = parsedLine.lineId || `L${lines.length + i + 1}`;
        
        const newLine = createEstimatingLineFromParsed(
          parsedLine,
          lineId,
          defaultMaterialRate,
          defaultLaborRate,
          defaultCoatingRate
        );

        console.log(`Creating line ${lineId}:`, newLine);
        
        try {
          const documentId = await createDocument(linesPath, newLine);
          console.log(`Created line ${lineId} with document ID: ${documentId}`);
          
          // Track create action for undo
          if (documentId) {
            voiceCommandHistory.addAction({
              type: "create",
              timestamp: Date.now(),
              documentId: documentId,
              lineId: lineId,
              newState: newLine,
            });
          }
          
          createdCount++;
        } catch (createError: any) {
          console.error(`Failed to create line ${lineId}:`, createError);
          alert(`Failed to create line ${lineId}: ${createError.message}`);
        }
      }

      // Success feedback
      if (createdCount > 0) {
        const lineIds = parsedLines.map(p => p.lineId || "auto").join(", ");
        console.log(`Successfully created ${createdCount} line item(s) from voice transcription (Line IDs: ${lineIds})`);
        // The lines will automatically appear via Firestore subscription
      } else {
        console.warn("No lines were created despite parsing success");
        alert("Failed to create any lines. Please check the console for details.");
      }
    } catch (error: any) {
      console.error("Failed to process transcription:", error);
      alert(`Failed to process voice command: ${error.message}`);
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

      {/* AI Voice Agent - Centered */}
      <div className="flex justify-center">
        <VoiceAgent
          companyId={companyId}
          projectId={selectedProject}
          existingLines={lines}
          onAction={handleVoiceAgentAction}
          isManualMode={isManualMode}
        />
      </div>

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

