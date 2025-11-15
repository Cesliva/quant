"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import EstimatingGrid from "@/components/estimating/EstimatingGrid";
import KPISummary from "@/components/estimating/KPISummary";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { subscribeToCollection, createDocument, updateDocument, deleteDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { parseVoiceTranscription, createEstimatingLineFromParsed, ParsedEditCommand, ParsedLine } from "@/lib/utils/voiceParser";
import { voiceCommandHistory } from "@/lib/utils/voiceCommandHistory";
import { createLineFromStructuredData } from "@/lib/utils/structuredVoiceParser";
import { FileText, ArrowRight, Save, Upload } from "lucide-react";
import { exportToQuant, importFromQuant } from "@/lib/utils/quantExport";

function EstimatingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = "default"; // TODO: Get from auth context
  
  const projectIdFromQuery = searchParams?.get("projectId") || "";
  const [selectedProject, setSelectedProject] = useState<string>(projectIdFromQuery);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firebaseReady = isFirebaseConfigured();

  useEffect(() => {
    if (!firebaseReady) {
      setProjects([]);
      return () => {};
    }

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<{ id: string; projectName?: string }>(
      projectsPath,
      (data) => {
        const mapped = data.map((p) => ({
          id: p.id,
          name: p.projectName || "Untitled Project",
        }));
        setProjects(mapped);
        setSelectedProject((prev) => {
          if (prev) {
            return prev;
          }
          if (projectIdFromQuery && mapped.some((p) => p.id === projectIdFromQuery)) {
            return projectIdFromQuery;
          }
          return mapped[0]?.id || "";
        });
      }
    );

    return () => unsubscribe();
  }, [companyId, projectIdFromQuery, firebaseReady]);

  useEffect(() => {
    if (!selectedProject) {
      setLines([]);
      return () => {};
    }

    if (!firebaseReady) {
      setLines([]);
      return () => {};
    }

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

  // Removed: handleVoiceAgentAction - AI voice assistant removed

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

  const handleImportEstimate = async () => {
    // Trigger file input click
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again
    e.target.value = "";

    try {
      // Import the .quant file
      const quantFile = await importFromQuant(file);
      
      if (!quantFile.lines || quantFile.lines.length === 0) {
        alert("The imported file contains no estimate lines.");
        return;
      }

      // Confirm import
      const confirmMessage = `Import estimate with ${quantFile.lines.length} line(s)?\n\nProject: ${quantFile.metadata.projectName || quantFile.metadata.projectId}\nTotal Cost: $${quantFile.metadata.totalCost.toFixed(2)}`;
      if (!confirm(confirmMessage)) {
        return;
      }

      if (!isFirebaseConfigured()) {
        alert("Firebase is not configured. Cannot import estimate.");
        return;
      }

      // Import lines to Firestore
      const linesPath = getProjectPath(companyId, selectedProject, "lines");
      let importedCount = 0;
      let errorCount = 0;

      for (const line of quantFile.lines) {
        try {
          // Check if line with same lineId already exists
          const existingLine = lines.find(l => l.lineId === line.lineId);
          
          if (existingLine) {
            // Ask user if they want to replace or skip
            const replace = confirm(`Line ${line.lineId} already exists. Replace it?`);
            if (replace && existingLine.id) {
              await updateDocument(linesPath, existingLine.id, line);
              importedCount++;
            }
          } else {
            // Create new line
            await createDocument(linesPath, line);
            importedCount++;
          }
        } catch (error: any) {
          console.error(`Failed to import line ${line.lineId}:`, error);
          errorCount++;
        }
      }

      // Show results
      if (importedCount > 0) {
        alert(`Successfully imported ${importedCount} line(s)${errorCount > 0 ? `\n${errorCount} line(s) failed to import` : ""}`);
      } else {
        alert(`No lines were imported.${errorCount > 0 ? `\n${errorCount} line(s) failed to import` : ""}`);
      }
    } catch (error: any) {
      console.error("Failed to import estimate:", error);
      alert(`Failed to import estimate: ${error.message}`);
    }
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
            <option value="">Select Project...</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          {!firebaseReady && (
            <span className="text-xs text-orange-600 bg-orange-50 px-3 py-1 rounded-full font-medium">
              Firebase Not Configured
            </span>
          )}
          {/* Import Estimate Button */}
          <button
            onClick={handleImportEstimate}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 transition-all shadow-md font-medium"
            title="Import estimate from Quant proprietary format (.quant)"
          >
            <Upload className="w-4 h-4" />
            <span className="text-sm">Import Estimate</span>
          </button>
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".quant,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
          {/* Save Estimate Button */}
          <button
            onClick={async () => {
              try {
                await exportToQuant(lines, selectedProject, companyId);
                // Check if browser supports File System Access API
                const supportsSaveDialog = 'showSaveFilePicker' in window;
                if (supportsSaveDialog) {
                  alert("Estimate saved successfully to your chosen location!");
                } else {
                  alert("Estimate saved successfully!\n\nThe file has been downloaded to your default Downloads folder.");
                }
              } catch (error: any) {
                if (error.message === 'Save cancelled') {
                  // User cancelled - don't show error
                  return;
                }
                console.error("Failed to save estimate:", error);
                alert(`Failed to save estimate: ${error.message}`);
              }
            }}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 transition-all shadow-md font-medium"
            title="Save estimate in Quant proprietary format (.quant)"
          >
            <Save className="w-4 h-4" />
            <span className="text-sm">Save Estimate</span>
          </button>
        </div>
      </div>


      {/* KPI Summary */}
      <KPISummary lines={lines} />

      {/* Estimating Grid */}
      <EstimatingGrid 
        companyId={companyId} 
        projectId={selectedProject}
        isManualMode={true}
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

