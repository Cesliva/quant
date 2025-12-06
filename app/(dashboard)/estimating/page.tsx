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
import { FileText, ArrowRight, Save, Upload } from "lucide-react";
import { exportToQuant, importFromQuant } from "@/lib/utils/quantExport";
import {
  loadCompanySettings,
  getMaterialRateForGrade,
  getLaborRate,
  getCoatingRate,
  type CompanySettings,
} from "@/lib/utils/settingsLoader";

import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useAuth } from "@/lib/hooks/useAuth";
import { createAuditLog } from "@/lib/utils/auditLog";

function EstimatingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyId = useCompanyId();
  const { user } = useAuth();
  
  const projectIdFromQuery = searchParams?.get("projectId") || "";
  const [selectedProject, setSelectedProject] = useState<string>(projectIdFromQuery);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const firebaseReady = isFirebaseConfigured();

  // Load company settings
  useEffect(() => {
    if (!firebaseReady) {
      setCompanySettings(null);
      return;
    }
    loadCompanySettings(companyId).then(setCompanySettings);
  }, [companyId, firebaseReady]);

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

  // Voice features removed - handleStructuredData, handleVoiceAgentAction, and handleTranscription no longer needed

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
                
                // Log audit trail for Quant export
                const currentProject = projects.find(p => p.id === selectedProject);
                await createAuditLog(
                  companyId,
                  'EXPORT',
                  'EXPORT',
                  selectedProject || 'all',
                  user,
                  {
                    projectId: selectedProject,
                    entityName: `${currentProject?.name || selectedProject} - Quant Export`,
                    metadata: {
                      exportType: 'Quant',
                      lineCount: lines.length,
                    },
                  }
                );
                
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

