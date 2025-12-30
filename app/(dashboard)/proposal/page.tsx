"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FileDown, Sparkles, ArrowLeft, Upload } from "lucide-react";
import { generateProposal } from "@/lib/openai/gpt4";
import { exportProposalToPDF } from "@/lib/utils/export";
import { exportProposalToDOCX, exportProposalToPDFStructured } from "@/lib/utils/proposalExport";
import ProposalTemplate from "@/components/proposal/ProposalTemplate";
import { StructuredProposal } from "@/lib/types/proposal";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { getDocument, getProjectPath, getDocRef } from "@/lib/firebase/firestore";
import { onSnapshot } from "firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { extractTextFromFile } from "@/lib/utils/fileExtractor";
import { subscribeToProposalSeeds } from "@/lib/services/proposalSeeds";
import { ProposalSeed, ProposalSeedType } from "@/lib/types/proposalSeeds";

function ProposalPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId");
  const companyId = useCompanyId();
  const [proposalText, setProposalText] = useState(
    "AI-generated proposal text appears here..."
  );
  const [structuredProposal, setStructuredProposal] = useState<StructuredProposal | null>(null);
  const [projectSummary, setProjectSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{ message?: string; currentPage?: number; totalPages?: number } | null>(null);
  const [companyName, setCompanyName] = useState("Company");
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");
  const [proposalSeeds, setProposalSeeds] = useState<ProposalSeed[]>([]);

  // Load company name and project info
  useEffect(() => {
    const loadData = async () => {
      if (!isFirebaseConfigured() || !companyId) return;

      try {
        // Load company settings for company name
        const settings = await loadCompanySettings(companyId);
        if (settings?.companyInfo?.companyName) {
          setCompanyName(settings.companyInfo.companyName);
        }

        // Load project info if projectId is available (initial load)
        if (projectId) {
          const projectPath = getProjectPath(companyId, projectId);
          const projectData = await getDocument<{ 
            projectName?: string; 
            projectNumber?: string;
          }>(projectPath);
          if (projectData) {
            setProjectName(projectData.projectName || "");
            setProjectNumber(projectData.projectNumber || "");
          }
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };

    loadData();

    // Real-time subscription for project data
    if (projectId && isFirebaseConfigured() && companyId) {
      const projectPath = getProjectPath(companyId, projectId);
      const projectDocRef = getDocRef(projectPath);

      const unsubscribe = onSnapshot(
        projectDocRef,
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            setProjectName(data.projectName || "");
            setProjectNumber(data.projectNumber || "");
          }
        },
        (error) => {
          console.error("Error subscribing to project:", error);
        }
      );

      return () => unsubscribe();
    }
  }, [companyId, projectId]);

  // Load proposal seeds
  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || !projectId) {
      setProposalSeeds([]);
      return;
    }

    const unsubscribe = subscribeToProposalSeeds(
      companyId,
      projectId,
      (seeds) => {
        setProposalSeeds(seeds);
      },
      false // Only active seeds
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  // Group seeds by type
  const groupedSeeds = (() => {
    const groups: Record<ProposalSeedType, ProposalSeed[]> = {
      inclusion: [],
      exclusion: [],
      clarification: [],
      assumption: [],
      allowance: [],
    };
    
    proposalSeeds.forEach(seed => {
      if (seed.status === "active" && groups[seed.type]) {
        groups[seed.type].push(seed);
      }
    });
    
    return groups;
  })();

  const handleGenerate = async () => {
    if (!projectSummary.trim() && proposalSeeds.length === 0) {
      alert("Please enter a project summary or add proposal seeds");
      return;
    }

    setIsGenerating(true);
    try {
      // Build proposal context with project info and seeds
      const seedsText = Object.entries(groupedSeeds)
        .filter(([_, seeds]) => seeds.length > 0)
        .map(([type, seeds]) => {
          const typeLabel = type.charAt(0).toUpperCase() + type.slice(1) + "s";
          const items = seeds.map(s => `- ${s.text}`).join("\n");
          return `${typeLabel}:\n${items}`;
        })
        .join("\n\n");

      const proposalContext = `
PROJECT INFORMATION:
- Project Name: ${projectName || "Project"}
- Project Number: ${projectNumber || ""}

PROJECT SUMMARY:
${projectSummary || "See inclusions/exclusions below."}

${seedsText ? `PROJECT-SPECIFIC REQUIREMENTS:\n${seedsText}` : ""}
      `.trim();
      
      const result = await generateProposal(proposalContext);
      setProposalText(result.proposal);
      
      // Convert structured proposal if available
      if (result.structuredProposal) {
        const structured: StructuredProposal = {
          header: {
            companyName: companyName || "Company",
            projectName: projectName || "Project",
            projectNumber: projectNumber || "",
            proposalDate: new Date().toLocaleDateString(),
            to: undefined,
            preparedBy: undefined,
          },
          sections: result.structuredProposal,
        };
        setStructuredProposal(structured);
      }
    } catch (error: any) {
      console.error("Proposal generation error:", error);
      alert("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAIDraft = async () => {
    if (proposalSeeds.length === 0) {
      alert("No proposal seeds found. Add seeds on the Estimating page first.");
      return;
    }

    setIsGenerating(true);
    try {
      // Build proposal using ONLY seeds + project info
      const seedsText = Object.entries(groupedSeeds)
        .filter(([_, seeds]) => seeds.length > 0)
        .map(([type, seeds]) => {
          const typeLabel = type === "inclusion" ? "Inclusions" :
                          type === "exclusion" ? "Exclusions" :
                          type === "clarification" ? "Clarifications" :
                          type === "assumption" ? "Assumptions" :
                          "Allowances";
          const items = seeds.map(s => `- ${s.text}`).join("\n");
          return `${typeLabel}:\n${items}`;
        })
        .join("\n\n");

      const proposalContext = `
PROJECT INFORMATION:
- Project Name: ${projectName || "Project"}
- Project Number: ${projectNumber || ""}

PROJECT-SPECIFIC REQUIREMENTS:
${seedsText}
      `.trim();
      
      const result = await generateProposal(proposalContext);
      setProposalText(result.proposal);
      
      // Convert structured proposal if available
      if (result.structuredProposal) {
        const structured: StructuredProposal = {
          header: {
            companyName: companyName || "Company",
            projectName: projectName || "Project",
            projectNumber: projectNumber || "",
            proposalDate: new Date().toLocaleDateString(),
            to: undefined,
            preparedBy: undefined,
          },
          sections: result.structuredProposal,
        };
        setStructuredProposal(structured);
      }
    } catch (error: any) {
      console.error("Proposal generation error:", error);
      alert("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (structuredProposal) {
      // Use new structured PDF export
      try {
        await exportProposalToPDFStructured(structuredProposal, companyId);
      } catch (error: any) {
        console.error("PDF export error:", error);
        alert("Failed to export PDF. Please try again.");
      }
    } else if (proposalText.trim() && proposalText !== "AI-generated proposal text appears here...") {
      // Fallback to legacy export
      const finalProjectName = projectName || (projectSummary.trim() 
        ? projectSummary.split('\n')[0].substring(0, 50) 
        : "Project");
      exportProposalToPDF(proposalText, finalProjectName, projectNumber, companyName);
    } else {
      alert("Please generate a proposal first");
    }
  };

  const handleExportDOCX = async () => {
    if (!structuredProposal) {
      alert("Please generate a structured proposal first");
      return;
    }
    
    try {
      await exportProposalToDOCX(structuredProposal, companyId);
    } catch (error: any) {
      console.error("DOCX export error:", error);
      alert("Failed to export DOCX. Please try again.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        {projectId && (
          <Link href={`/projects/${projectId}`}>
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Project
            </Button>
          </Link>
        )}
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="w-8 h-8 text-purple-500" />
          <span>AI Generated Proposal</span>
        </h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Project Document (Optional)
            </label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                setIsExtracting(true);
                setExtractionProgress({ message: "Starting extraction..." });
                try {
                  // Extract text from file with progress updates
                  const extractedText = await extractTextFromFile(file, (progress) => {
                    // Update UI with extraction progress
                    setExtractionProgress({
                      message: progress.message,
                      currentPage: progress.currentPage,
                      totalPages: progress.totalPages,
                    });
                  });
                  // Populate project summary with extracted text
                  setProjectSummary(extractedText);
                  setExtractionProgress(null);
                } catch (error: any) {
                  setExtractionProgress(null);
                  alert(`Failed to extract text: ${error.message}`);
                } finally {
                  setIsExtracting(false);
                  // Reset input so same file can be selected again
                  e.target.value = "";
                }
              }}
              disabled={isExtracting}
            />
            {isExtracting && extractionProgress && (
              <div className="mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-blue-700 font-medium">
                    {extractionProgress.message || "Extracting text from file..."}
                  </p>
                </div>
                {extractionProgress.totalPages && extractionProgress.currentPage && (
                  <div className="mt-2">
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(extractionProgress.currentPage / extractionProgress.totalPages) * 100}%`,
                        }}
                      ></div>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Page {extractionProgress.currentPage} of {extractionProgress.totalPages}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Or Enter Project Summary Manually
            </label>
            <textarea
              value={projectSummary}
              onChange={(e) => setProjectSummary(e.target.value)}
              className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project summary, key details, scope, and requirements... Or upload a PDF/DOC/DOCX file above."
            />
          </div>
        </CardContent>
      </Card>

      {/* Proposal Seeds Display */}
      {proposalSeeds.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Proposal Seeds</CardTitle>
            <p className="text-sm text-gray-500 mt-1">
              Captured during estimation. These will be included in the proposal.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {groupedSeeds.inclusion.length > 0 && (
              <div>
                <h4 className="font-semibold text-green-700 mb-2">Project-Specific Inclusions</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {groupedSeeds.inclusion.map(seed => (
                    <li key={seed.id}>{seed.text}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {groupedSeeds.exclusion.length > 0 && (
              <div>
                <h4 className="font-semibold text-red-700 mb-2">Project-Specific Exclusions</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {groupedSeeds.exclusion.map(seed => (
                    <li key={seed.id}>{seed.text}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {(groupedSeeds.clarification.length > 0 || 
              groupedSeeds.assumption.length > 0 || 
              groupedSeeds.allowance.length > 0) && (
              <div>
                <h4 className="font-semibold text-gray-700 mb-2">Clarifications / Assumptions / Allowances</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
                  {[...groupedSeeds.clarification, ...groupedSeeds.assumption, ...groupedSeeds.allowance].map(seed => (
                    <li key={seed.id}>{seed.text}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Generated Proposal</CardTitle>
          <div className="flex gap-3 mt-4">
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? "Generating..." : "Generate Proposal"}
            </Button>
            {proposalSeeds.length > 0 && (
              <Button
                variant="outline"
                onClick={handleAIDraft}
                disabled={isGenerating}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI Draft (Seeds Only)
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleExportPDF}
              disabled={!structuredProposal && (!proposalText.trim() || proposalText === "AI-generated proposal text appears here...")}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
            <Button
              variant="outline"
              onClick={handleExportDOCX}
              disabled={!structuredProposal}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export DOCX
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {structuredProposal ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <ProposalTemplate
                proposal={structuredProposal}
                editable={true}
                onContentChange={(section, content) => {
                  if (structuredProposal) {
                    const updated = { ...structuredProposal };
                    if (updated.sections[section as keyof typeof updated.sections]) {
                      updated.sections[section as keyof typeof updated.sections] = {
                        ...updated.sections[section as keyof typeof updated.sections]!,
                        content,
                      };
                      setStructuredProposal(updated);
                    }
                  }
                }}
              />
            </div>
          ) : (
            <textarea
              value={proposalText}
              onChange={(e) => setProposalText(e.target.value)}
              className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="AI-generated proposal text appears here..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <Suspense fallback={
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-8 h-8 text-purple-500" />
            <span>AI Generated Proposal</span>
          </h1>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading...</p>
        </div>
      </div>
    }>
      <ProposalPageContent />
    </Suspense>
  );
}

