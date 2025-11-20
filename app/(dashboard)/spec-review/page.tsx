"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { CheckCircle, AlertTriangle, XCircle, Sparkles, ArrowLeft, DollarSign, Shield, FileQuestion, Lightbulb, TrendingUp, AlertCircle, Info, Wrench, Save } from "lucide-react";
import { reviewSpecifications, type SpecReviewResult } from "@/lib/openai/gpt4";
import { extractTextFromFile } from "@/lib/utils/fileExtractor";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { setDocument, getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export default function SpecReviewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get("projectId");
  const viewType = searchParams?.get("view"); // "view" to show saved analysis
  const companyId = useCompanyId();
  const [analysisResult, setAnalysisResult] = useState<SpecReviewResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [specText, setSpecText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [analysisType, setAnalysisType] = useState<"structural" | "misc" | "finishes" | "aess" | "div01" | "div03">("structural");

  // Load saved analysis if viewing from summary
  useEffect(() => {
    const loadSavedAnalysis = async () => {
      if (viewType === "view" && projectId && companyId && isFirebaseConfigured()) {
        const analysisTypeParam = searchParams?.get("analysisType") || "structural";
        const validTypes = ["structural", "misc", "finishes", "aess", "div01", "div03"];
        const type = validTypes.includes(analysisTypeParam) ? analysisTypeParam as AnalysisType : "structural";
        
        setAnalysisType(type);
        
        try {
          const specReviewPath = `companies/${companyId}/projects/${projectId}/specReviews/${type}`;
          const saved = await getDocument<{ result: SpecReviewResult; specText: string }>(specReviewPath);
          if (saved) {
            setAnalysisResult(saved.result);
            setSpecText(saved.specText || "");
          }
        } catch (error) {
          console.error("Failed to load saved analysis:", error);
        }
      } else {
        // Load spec text from localStorage if available
        const savedSpecText = localStorage.getItem(`specText_${projectId || 'default'}`);
        if (savedSpecText) {
          setSpecText(savedSpecText);
        }
        const savedAnalysisType = localStorage.getItem(`analysisType_${projectId || 'default'}`);
        if (savedAnalysisType) {
          const validTypes = ["structural", "misc", "finishes", "aess", "div01", "div03"];
          if (validTypes.includes(savedAnalysisType)) {
            setAnalysisType(savedAnalysisType as AnalysisType);
          }
        }
      }
    };

    loadSavedAnalysis();
  }, [viewType, projectId, companyId, searchParams]);

  type AnalysisType = "structural" | "misc" | "finishes" | "aess" | "div01" | "div03";

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
    setAnalysisResult(null);
    try {
      const result = await reviewSpecifications(specText, {}, analysisType, companyId, projectId || undefined);
      console.log("Analysis result:", result); // Debug log
      
      // Ensure complianceItems exists even if AI doesn't return it
      // Try to generate from other fields if needed
      if (!result.complianceItems && !result.items) {
        // If we have costImpactTable, convert to complianceItems
        if (result.costImpactTable && result.costImpactTable.length > 0) {
          result.complianceItems = result.costImpactTable.map(item => ({
            item: item.requirement,
            specSection: item.specSection,
            status: item.costImpactLevel === "High" ? "fail" : item.costImpactLevel === "Medium" ? "warning" : "pass",
            message: item.impactExplanation,
            category: "cost-impact"
          }));
        }
      }
      
      setAnalysisResult(result);
      
      // Save spec text to localStorage
      if (projectId) {
        localStorage.setItem(`specText_${projectId}`, specText);
        localStorage.setItem(`analysisType_${projectId}`, analysisType);
      }
    } catch (error: any) {
      console.error("Spec review error:", error);
      alert("Failed to analyze specifications. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!analysisResult) {
      alert("No analysis to save. Please run an analysis first.");
      return;
    }

    if (!projectId || !companyId) {
      alert("Cannot save: Project ID is required. Please navigate from a project.");
      return;
    }

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Cannot save analysis.");
      return;
    }

    setIsSaving(true);
    try {
      const specReviewPath = `companies/${companyId}/projects/${projectId}/specReviews/${analysisType}`;
      
      await setDocument(specReviewPath, {
        analysisType: analysisType,
        result: analysisResult,
        specText: specText.substring(0, 1000), // Store first 1000 chars for reference
        analyzedAt: new Date().toISOString(),
        version: 1,
      });

      // Clear the page and navigate to summary
      setAnalysisResult(null);
      setSpecText("");
      localStorage.removeItem(`specText_${projectId}`);
      localStorage.removeItem(`analysisType_${projectId}`);
      
      // Navigate to reports page
      router.push(`/projects/${projectId}/reports`);
    } catch (error: any) {
      console.error("Failed to save analysis:", error);
      alert("Failed to save analysis. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const getRiskGradeColor = (grade?: string) => {
    switch (grade) {
      case "A": return "text-green-600 bg-green-50 border-green-200";
      case "B": return "text-blue-600 bg-blue-50 border-blue-200";
      case "C": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "D": return "text-orange-600 bg-orange-50 border-orange-200";
      case "F": return "text-red-600 bg-red-50 border-red-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getCostImpactColor = (level?: string) => {
    switch (level) {
      case "High": return "text-red-600 bg-red-50 border-red-200";
      case "Medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "Low": return "text-green-600 bg-green-50 border-green-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "High": return "text-red-600 bg-red-50 border-red-200";
      case "Medium": return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "Low": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  // Use new structure if available, fall back to legacy
  const complianceItems = analysisResult?.complianceItems || analysisResult?.items || [];
  const rfiSuggestions = analysisResult?.rfiSuggestions || [];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
          <span>AI Spec Review</span>
        </h1>
      </div>
      
      {/* Analysis Results */}
      {analysisResult && (
        <div className="space-y-6">
          {/* Summary & Risk Assessment */}
          {analysisResult.summary && (
            <Card className="border-2">
              <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
                <CardTitle className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-blue-600" />
                  Executive Summary & Risk Assessment
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {analysisResult.summary.keyRequirements && (
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">Key Requirements</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{analysisResult.summary.keyRequirements}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {analysisResult.summary.overallRiskGrade && (
                    <div className={`p-4 rounded-lg border-2 ${getRiskGradeColor(analysisResult.summary.overallRiskGrade)}`}>
                      <div className="text-sm font-medium mb-1">Overall Risk Grade</div>
                      <div className="text-3xl font-bold">{analysisResult.summary.overallRiskGrade}</div>
                    </div>
                  )}
                  {analysisResult.summary.riskExposure && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="text-sm font-medium text-gray-700 mb-2">Risk Exposure</div>
                      <p className="text-gray-900">{analysisResult.summary.riskExposure}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost Impact Table */}
          {analysisResult.costImpactTable && analysisResult.costImpactTable.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-green-600" />
                  Cost Impact Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analysisResult.costImpactTable.map((item, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 ${getCostImpactColor(item.costImpactLevel)}`}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
                        <div className="font-semibold text-gray-900 flex-1">{item.requirement}</div>
                        <div className="flex items-center gap-2">
                          {item.specSection && (
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                              {item.specSection}
                            </span>
                          )}
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                            item.costImpactLevel === "High" ? "bg-red-100 text-red-700" :
                            item.costImpactLevel === "Medium" ? "bg-yellow-100 text-yellow-700" :
                            "bg-green-100 text-green-700"
                          }`}>
                            {item.costImpactLevel} Impact
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{item.impactExplanation}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Hidden Traps */}
          {analysisResult.hiddenTraps && analysisResult.hiddenTraps.length > 0 && (
            <Card className="border-2 border-red-200">
              <CardHeader className="bg-red-50">
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <Shield className="w-5 h-5" />
                  Hidden Scope Traps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.hiddenTraps.map((trap, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{trap}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Missing or Contradictory Information */}
          {analysisResult.missingOrContradictory && analysisResult.missingOrContradictory.length > 0 && (
            <Card className="border-2 border-yellow-200">
              <CardHeader className="bg-yellow-50">
                <CardTitle className="flex items-center gap-2 text-yellow-700">
                  <FileQuestion className="w-5 h-5" />
                  Missing or Contradictory Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.missingOrContradictory.map((item, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{item}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Exclusions */}
          {analysisResult.recommendedExclusions && analysisResult.recommendedExclusions.length > 0 && (
            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-orange-50">
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <XCircle className="w-5 h-5" />
                  Recommended Bid Exclusions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.recommendedExclusions.map((exclusion, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <XCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{exclusion}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Clarifications */}
          {analysisResult.recommendedClarifications && analysisResult.recommendedClarifications.length > 0 && (
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <FileQuestion className="w-5 h-5" />
                  Recommended RFI Clarifications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.recommendedClarifications.map((clarification, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <FileQuestion className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{clarification}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommended Alternates */}
          {analysisResult.recommendedAlternates && analysisResult.recommendedAlternates.length > 0 && (
            <Card className="border-2 border-green-200">
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2 text-green-700">
                  <Lightbulb className="w-5 h-5" />
                  Recommended Alternates & Value Engineering
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.recommendedAlternates.map((alternate, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
                      <TrendingUp className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{alternate}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AESS Finish Level Table */}
          {analysisResult.finishLevelTable && analysisResult.finishLevelTable.length > 0 && (
            <Card className="border-2 border-purple-200">
              <CardHeader className="bg-purple-50">
                <CardTitle className="flex items-center gap-2 text-purple-700">
                  <Info className="w-5 h-5" />
                  AESS/NOMA Finish Level Table
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-3 font-semibold text-gray-700">Element</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Required Finish</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Category</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Cost Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResult.finishLevelTable.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="p-3 font-medium text-gray-900">{item.element}</td>
                          <td className="p-3 text-gray-700">{item.requiredFinish}</td>
                          <td className="p-3">
                            <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-semibold">
                              {item.category}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              item.costImpact === "High" ? "bg-red-100 text-red-700" :
                              item.costImpact === "Medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {item.costImpact}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Welding & Grinding Requirements (AESS) */}
          {analysisResult.weldingGrindingRequirements && analysisResult.weldingGrindingRequirements.length > 0 && (
            <Card className="border-2 border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2 text-blue-700">
                  <Wrench className="w-5 h-5" />
                  Welding & Grinding Requirements Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.weldingGrindingRequirements.map((req, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Wrench className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{req}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coating Requirements (AESS) */}
          {analysisResult.coatingRequirements && analysisResult.coatingRequirements.length > 0 && (
            <Card className="border-2 border-indigo-200">
              <CardHeader className="bg-indigo-50">
                <CardTitle className="flex items-center gap-2 text-indigo-700">
                  <DollarSign className="w-5 h-5" />
                  AESS Coating Requirements Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.coatingRequirements.map((req, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                      <DollarSign className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{req}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Erection & Handling Requirements (AESS) */}
          {analysisResult.erectionHandlingRequirements && analysisResult.erectionHandlingRequirements.length > 0 && (
            <Card className="border-2 border-teal-200">
              <CardHeader className="bg-teal-50">
                <CardTitle className="flex items-center gap-2 text-teal-700">
                  <AlertCircle className="w-5 h-5" />
                  Erection & Handling Requirements Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.erectionHandlingRequirements.map((req, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-teal-50 rounded-lg border border-teal-200">
                      <AlertCircle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{req}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coordination & Responsibility Shifts (Division 01) */}
          {analysisResult.coordinationResponsibilityShifts && analysisResult.coordinationResponsibilityShifts.length > 0 && (
            <Card className="border-2 border-amber-200">
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center gap-2 text-amber-700">
                  <Shield className="w-5 h-5" />
                  Coordination & Responsibility Shifts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.coordinationResponsibilityShifts.map((shift, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                      <Shield className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{shift}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Anchor Bolt & Embed Responsibility Table (Division 03) */}
          {analysisResult.anchorBoltResponsibilityTable && analysisResult.anchorBoltResponsibilityTable.length > 0 && (
            <Card className="border-2 border-slate-200">
              <CardHeader className="bg-slate-50">
                <CardTitle className="flex items-center gap-2 text-slate-700">
                  <Info className="w-5 h-5" />
                  Anchor Bolt & Embed Responsibility Table
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left p-3 font-semibold text-gray-700">Item</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Requirement</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Responsible Party</th>
                        <th className="text-left p-3 font-semibold text-gray-700">Cost Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResult.anchorBoltResponsibilityTable.map((item, index) => (
                        <tr key={index} className="border-b border-gray-100">
                          <td className="p-3 font-medium text-gray-900">{item.item}</td>
                          <td className="p-3 text-gray-700">{item.requirement}</td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              item.responsibleParty.includes("Ambiguous") || item.responsibleParty.includes("Steel")
                                ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-700"
                            }`}>
                              {item.responsibleParty}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              item.costImpact === "High" ? "bg-red-100 text-red-700" :
                              item.costImpact === "Medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-green-100 text-green-700"
                            }`}>
                              {item.costImpact}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tolerance Conflicts (Division 03) */}
          {analysisResult.toleranceConflicts && analysisResult.toleranceConflicts.length > 0 && (
            <Card className="border-2 border-orange-200">
              <CardHeader className="bg-orange-50">
                <CardTitle className="flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="w-5 h-5" />
                  Tolerance Conflicts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.toleranceConflicts.map((conflict, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-orange-50 rounded-lg border border-orange-200">
                      <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{conflict}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Coordination Requirements (Division 03) */}
          {analysisResult.coordinationRequirements && analysisResult.coordinationRequirements.length > 0 && (
            <Card className="border-2 border-cyan-200">
              <CardHeader className="bg-cyan-50">
                <CardTitle className="flex items-center gap-2 text-cyan-700">
                  <FileQuestion className="w-5 h-5" />
                  Coordination Requirements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysisResult.coordinationRequirements.map((req, index) => (
                    <div key={index} className="flex items-start gap-2 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                      <FileQuestion className="w-5 h-5 text-cyan-600 mt-0.5 flex-shrink-0" />
                      <p className="text-gray-900">{req}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Detailed Compliance Items */}
          {complianceItems.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Detailed Compliance Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {complianceItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      {getStatusIcon(item.status)}
                      <div className="flex-1">
                        {item.specSection && (
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded mb-2 inline-block">
                            {item.specSection}
                          </span>
                        )}
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-medium text-gray-900">{item.item}</div>
                          {item.category && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-700 text-xs rounded">
                              {item.category}
                            </span>
                          )}
                        </div>
                        <div className={`text-sm ${getStatusColor(item.status)}`}>
                          {item.message}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Enhanced RFI Suggestions */}
          {rfiSuggestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recommended RFIs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {rfiSuggestions.map((rfi, index) => (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 ${getPriorityColor(rfi.priority)}`}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2 flex-wrap">
                        <h4 className="font-semibold text-gray-900 flex-1">{rfi.title}</h4>
                        <div className="flex items-center gap-2">
                          {rfi.specSection && (
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-1 rounded whitespace-nowrap">
                              {rfi.specSection}
                            </span>
                          )}
                          {rfi.priority && (
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                              rfi.priority === "High" ? "bg-red-100 text-red-700" :
                              rfi.priority === "Medium" ? "bg-yellow-100 text-yellow-700" :
                              "bg-blue-100 text-blue-700"
                            }`}>
                              {rfi.priority} Priority
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700">{rfi.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cost & Token Info */}
          {analysisResult.cost && (
            <div className="text-sm text-gray-500 text-center">
              Analysis completed. Cost: ${analysisResult.cost.toFixed(4)} | Tokens: {analysisResult.tokens?.toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Empty State - Only show if not viewing saved analysis */}
      {!analysisResult && !isAnalyzing && viewType !== "view" && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Upload or paste specification text to begin AI analysis</p>
          </CardContent>
        </Card>
      )}
      
      {/* Loading state for saved analysis */}
      {viewType === "view" && !analysisResult && !isAnalyzing && (
        <Card>
          <CardHeader>
            <CardTitle>Loading Analysis...</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">Loading saved analysis...</p>
          </CardContent>
        </Card>
      )}

      {/* Input form - only show if not viewing saved analysis */}
      {viewType !== "view" && (
      <Card>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Analysis Type
              </label>
              <select
                value={analysisType}
                onChange={(e) => setAnalysisType(e.target.value as "structural" | "misc" | "finishes" | "aess" | "div01" | "div03")}
                className="w-full p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isAnalyzing}
              >
                <option value="structural">Structural Steel</option>
                <option value="misc">Miscellaneous Metals</option>
                <option value="finishes">Division 09 - Finishes & Coatings</option>
                <option value="aess">AESS & NOMA Requirements</option>
                <option value="div01">Division 01 - General Requirements</option>
                <option value="div03">Division 03 - Concrete</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {analysisType === "structural"
                  ? "Comprehensive analysis for structural steel fabrication"
                  : analysisType === "misc"
                  ? "Detailed analysis for miscellaneous metals, stairs, rails, decking, and architectural metals"
                  : analysisType === "finishes"
                  ? "Critical analysis of Division 09 coating requirements, Div 05 conflicts, and hidden finishing costs"
                  : analysisType === "aess"
                  ? "Critical analysis of AESS (Architecturally Exposed Structural Steel) and NOMA requirements that can increase costs 3-10x"
                  : analysisType === "div01"
                  ? "Critical analysis of Division 01 requirements: submittals, delegated design, coordination, schedule restrictions, and hidden costs"
                  : "Critical analysis of Division 03 requirements: anchor bolts, embeds, grouting, concrete strength delays, field fixes, and coordination traps"}
              </p>
            </div>
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
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  setIsExtracting(true);
                  try {
                    const extractedText = await extractTextFromFile(file);
                    setSpecText(extractedText);
                  } catch (error: any) {
                    alert(`Failed to extract text: ${error.message}`);
                  } finally {
                    setIsExtracting(false);
                    // Reset input so same file can be selected again
                    e.target.value = "";
                  }
                }}
                disabled={isExtracting}
              />
              {isExtracting && (
                <p className="text-sm text-blue-600 mt-2">Extracting text from file...</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                {isAnalyzing ? "Analyzing..." : "Analyze Specifications"}
              </Button>
              {analysisResult && projectId && (
                <Button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  variant="default"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save & Go to Summary"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      )}
    </div>
  );
}

