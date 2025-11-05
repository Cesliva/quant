"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { FileDown } from "lucide-react";
import { generateProposal } from "@/lib/openai/gpt4";

export default function ProposalPage() {
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
    // TODO: Implement PDF export
    alert("PDF export functionality coming soon");
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Proposal Generator</h1>
      
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

