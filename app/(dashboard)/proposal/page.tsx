"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FileDown, Sparkles, ArrowLeft } from "lucide-react";
import { generateProposal } from "@/lib/openai/gpt4";
import { exportProposalToPDF } from "@/lib/utils/export";

export default function ProposalPage() {
  const searchParams = useSearchParams();
  const projectId = searchParams?.get("projectId");
  const [proposalText, setProposalText] = useState(
    "AI-generated proposal text appears here..."
  );
  const [projectSummary, setProjectSummary] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!projectSummary.trim()) {
      alert("Please enter a project summary");
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateProposal(projectSummary);
      setProposalText(result.proposal);
    } catch (error: any) {
      console.error("Proposal generation error:", error);
      alert("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = () => {
    if (!proposalText.trim() || proposalText === "AI-generated proposal text appears here...") {
      alert("Please generate a proposal first");
      return;
    }
    
    // Extract project name from summary if available
    const projectName = projectSummary.trim() 
      ? projectSummary.split('\n')[0].substring(0, 50) 
      : "Project";
    
    exportProposalToPDF(proposalText, projectName, "", "Company");
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
        <CardContent>
          <textarea
            value={projectSummary}
            onChange={(e) => setProjectSummary(e.target.value)}
            className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter project summary, key details, scope, and requirements..."
          />
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

