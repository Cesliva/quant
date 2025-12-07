"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect to enhanced proposal page
export default function ProposalPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get("projectId");

  useEffect(() => {
    // Redirect to enhanced proposal page
    const enhancedPath = projectId 
      ? `/proposal/enhanced?projectId=${projectId}`
      : "/proposal/enhanced";
    router.replace(enhancedPath);
  }, [projectId, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading enhanced proposal page...</p>
      </div>
    </div>
  );
}

function ProposalPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId");
  const companyId = useCompanyId();
  const [proposalText, setProposalText] = useState(
    "AI-generated proposal text appears here..."
  );
  const [projectSummary, setProjectSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{ message?: string; currentPage?: number; totalPages?: number } | null>(null);
  const [companyName, setCompanyName] = useState("Company");
  const [projectName, setProjectName] = useState("");
  const [projectNumber, setProjectNumber] = useState("");

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

  const handleGenerate = async () => {
    if (!projectSummary.trim()) {
      alert("Please enter a project summary");
      return;
    }

    setIsGenerating(true);
    try {
      // Build proposal context with project info
      const proposalContext = `
PROJECT INFORMATION:
- Project Name: ${projectName || "Project"}
- Project Number: ${projectNumber || ""}

PROJECT SUMMARY:
${projectSummary}
      `.trim();
      
      const result = await generateProposal(proposalContext);
      setProposalText(result.proposal);
    } catch (error: any) {
      console.error("Proposal generation error:", error);
      alert("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!proposalText.trim() || proposalText === "AI-generated proposal text appears here...") {
      alert("Please generate a proposal first");
      return;
    }
    
    // Use project name from loaded data, or extract from summary, or default
    const finalProjectName = projectName || (projectSummary.trim() 
      ? projectSummary.split('\n')[0].substring(0, 50) 
      : "Project");
    
    await exportProposalToPDF(proposalText, finalProjectName, projectNumber, companyName, companyId);
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

      <Card>
        <CardHeader>
          <CardTitle>Generated Proposal</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={proposalText}
            onChange={(e) => setProposalText(e.target.value)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="AI-generated proposal text appears here..."
          />
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Proposal"}
        </Button>
        <Button variant="outline" onClick={handleExportPDF}>
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
      </div>
    </div>
  );
}

export default function ProposalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <ProposalPageContent />
    </Suspense>
  );
}
