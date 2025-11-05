"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { reviewSpecifications } from "@/lib/openai/gpt4";

export default function SpecReviewPage() {
  const [complianceItems, setComplianceItems] = useState<
    Array<{ item: string; status: "pass" | "warning" | "fail"; message: string }>
  >([]);
  const [rfiSuggestions, setRfiSuggestions] = useState<
    Array<{ title: string; description: string }>
  >([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [specText, setSpecText] = useState("");

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pass":
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case "warning":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "fail":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pass":
        return "text-green-600";
      case "warning":
        return "text-yellow-600";
      case "fail":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  };

  const handleAnalyze = async () => {
    if (!specText.trim()) {
      alert("Please enter specification text or upload a file");
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await reviewSpecifications(specText, {});
      setComplianceItems(result.items || []);
      setRfiSuggestions(result.rfiSuggestions || []);
    } catch (error: any) {
      console.error("Spec review error:", error);
      alert("Failed to analyze specifications. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">AI Spec Review</h1>
      
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Spec Compliance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {complianceItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                >
                  {getStatusIcon(item.status)}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{item.item}</div>
                    <div className={`text-sm ${getStatusColor(item.status)}`}>
                      {item.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Suggested RFIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rfiSuggestions.length === 0 ? (
                <p className="text-gray-500 text-sm">No RFI suggestions yet. Analyze specifications to generate suggestions.</p>
              ) : (
                rfiSuggestions.map((rfi, index) => (
                  <div key={index} className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-1">{rfi.title}</h4>
                    <p className="text-sm text-gray-700">{rfi.description}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specification Text
              </label>
              <textarea
                value={specText}
                onChange={(e) => setSpecText(e.target.value)}
                className="w-full h-48 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Paste specification text here or upload a document..."
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Upload Specification Document (Optional)
              </label>
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt"
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                onChange={(e) => {
                  // TODO: Extract text from uploaded file
                  alert("File upload and text extraction coming soon!");
                }}
              />
            </div>
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? "Analyzing..." : "Analyze Specifications"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

