"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  AlertTriangle, 
  FileText,
  ExternalLink,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { getDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import Link from "next/link";
import { SpecReviewResult } from "@/lib/openai/gpt4";

interface SpecReviewSummaryProps {
  companyId: string;
  projectId: string;
}

type AnalysisType = "structural" | "misc" | "finishes" | "aess" | "div01" | "div03";

interface SavedAnalysis {
  analysisType: AnalysisType;
  result: SpecReviewResult;
  analyzedAt: string;
  tokens: number;
  cost: number;
}

const ANALYSIS_TYPES: Array<{
  key: AnalysisType;
  label: string;
  description: string;
}> = [
  { key: "structural", label: "Structural Steel", description: "Beams, columns, braces, frames, trusses" },
  { key: "misc", label: "Miscellaneous Metals", description: "Stairs, rails, lintels, supports, misc steel" },
  { key: "finishes", label: "Division 09 Finishes", description: "Paint, coatings, surface prep, touchup" },
  { key: "aess", label: "AESS & NOMA", description: "Architecturally exposed structural steel" },
  { key: "div01", label: "Division 01", description: "General requirements, submittals, delegated design" },
  { key: "div03", label: "Division 03", description: "Concrete, anchor bolts, embeds, grouting" },
];

export default function SpecReviewSummary({ companyId, projectId }: SpecReviewSummaryProps) {
  const [analyses, setAnalyses] = useState<Record<AnalysisType, SavedAnalysis | null>>({
    structural: null,
    misc: null,
    finishes: null,
    aess: null,
    div01: null,
    div03: null,
  });
  const [loading, setLoading] = useState(true);
  const [expandedAnalyses, setExpandedAnalyses] = useState<Set<AnalysisType>>(new Set());

  useEffect(() => {
    if (!isFirebaseConfigured() || !companyId || !projectId) {
      setLoading(false);
      return;
    }

    loadAnalyses();
  }, [companyId, projectId]);

  const loadAnalyses = async () => {
    setLoading(true);
    const loadedAnalyses: Record<AnalysisType, SavedAnalysis | null> = {
      structural: null,
      misc: null,
      finishes: null,
      aess: null,
      div01: null,
      div03: null,
    };

    try {
      for (const analysisType of ANALYSIS_TYPES) {
        try {
          const specReviewPath = `companies/${companyId}/projects/${projectId}/specReviews/${analysisType.key}`;
          const data = await getDocument<SavedAnalysis>(specReviewPath);
          if (data) {
            loadedAnalyses[analysisType.key] = data;
          }
        } catch (error) {
          // Analysis not found, leave as null
          console.log(`No analysis found for ${analysisType.key}`);
        }
      }
    } catch (error) {
      console.error("Failed to load spec reviews:", error);
    } finally {
      setAnalyses(loadedAnalyses);
      setLoading(false);
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

  const toggleExpand = (type: AnalysisType) => {
    const newExpanded = new Set(expandedAnalyses);
    if (newExpanded.has(type)) {
      newExpanded.delete(type);
    } else {
      newExpanded.add(type);
    }
    setExpandedAnalyses(newExpanded);
  };

  const analyzedCount = Object.values(analyses).filter(a => a !== null).length;
  const totalCount = ANALYSIS_TYPES.length;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-600" />
            AI Spec Review Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">Loading analyses...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Spec Review Summary
          <span className="text-sm font-normal text-gray-500">
            ({analyzedCount} of {totalCount} analyzed)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {ANALYSIS_TYPES.map((analysisType) => {
          const analysis = analyses[analysisType.key];
          const isExpanded = expandedAnalyses.has(analysisType.key);
          const hasAnalysis = analysis !== null;

          return (
            <div
              key={analysisType.key}
              className={`border rounded-lg ${
                hasAnalysis
                  ? "border-gray-200 bg-white"
                  : "border-yellow-200 bg-yellow-50"
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{analysisType.label}</h3>
                      {hasAnalysis ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{analysisType.description}</p>
                    {hasAnalysis && analysis.result.summary && (
                      <div className="flex items-center gap-4 text-sm">
                        {analysis.result.summary.overallRiskGrade && (
                          <div className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRiskGradeColor(analysis.result.summary.overallRiskGrade)}`}>
                            Risk Grade: {analysis.result.summary.overallRiskGrade}
                          </div>
                        )}
                        <span className="text-gray-500">
                          Analyzed: {new Date(analysis.analyzedAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {!hasAnalysis && (
                      <div className="flex items-center gap-2 text-sm text-yellow-700 bg-yellow-100 px-3 py-2 rounded">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Not Analyzed</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {hasAnalysis && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleExpand(analysisType.key)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-4 h-4 mr-1" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4 mr-1" />
                            Expand
                          </>
                        )}
                      </Button>
                    )}
                    <Link href={hasAnalysis 
                      ? `/spec-review?projectId=${projectId}&analysisType=${analysisType.key}&view=view`
                      : `/spec-review?projectId=${projectId}&analysisType=${analysisType.key}`
                    }>
                      <Button variant="outline" size="sm">
                        {hasAnalysis ? (
                          <>
                            <ExternalLink className="w-4 h-4 mr-1" />
                            View Full
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-1" />
                            Analyze
                          </>
                        )}
                      </Button>
                    </Link>
                  </div>
                </div>

                {hasAnalysis && isExpanded && analysis.result && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    {analysis.result.summary?.keyRequirements && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Key Requirements</h4>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">
                          {analysis.result.summary.keyRequirements}
                        </p>
                      </div>
                    )}
                    {analysis.result.summary?.riskExposure && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Risk Exposure</h4>
                        <p className="text-sm text-gray-600">{analysis.result.summary.riskExposure}</p>
                      </div>
                    )}
                    {analysis.result.costImpactTable && analysis.result.costImpactTable.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Cost Impact Items</h4>
                        <div className="space-y-2">
                          {analysis.result.costImpactTable.slice(0, 5).map((item, index) => (
                            <div key={index} className="text-sm p-2 bg-gray-50 rounded">
                              <div className="font-medium text-gray-900">{item.requirement}</div>
                              {item.specSection && (
                                <div className="text-xs text-gray-500 mt-1">Section: {item.specSection}</div>
                              )}
                              <div className="text-gray-600 mt-1">{item.impactExplanation}</div>
                              <div className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-semibold ${
                                item.costImpactLevel === "High" ? "bg-red-100 text-red-700" :
                                item.costImpactLevel === "Medium" ? "bg-yellow-100 text-yellow-700" :
                                "bg-green-100 text-green-700"
                              }`}>
                                {item.costImpactLevel} Impact
                              </div>
                            </div>
                          ))}
                          {analysis.result.costImpactTable.length > 5 && (
                            <div className="text-xs text-gray-500 text-center py-2">
                              + {analysis.result.costImpactTable.length - 5} more items
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {analysis.result.hiddenTraps && analysis.result.hiddenTraps.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">Hidden Traps</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                          {analysis.result.hiddenTraps.slice(0, 3).map((trap, index) => (
                            <li key={index}>{trap}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {analysis.result.rfiSuggestions && analysis.result.rfiSuggestions.length > 0 && (
                      <div>
                        <h4 className="font-semibold text-sm text-gray-700 mb-2">RFI Suggestions</h4>
                        <div className="space-y-2">
                          {analysis.result.rfiSuggestions.slice(0, 3).map((rfi, index) => (
                            <div key={index} className="text-sm p-2 bg-blue-50 rounded">
                              <div className="font-medium text-gray-900">{rfi.title}</div>
                              {rfi.specSection && (
                                <div className="text-xs text-gray-500 mt-1">Section: {rfi.specSection}</div>
                              )}
                              <div className="text-gray-600 mt-1">{rfi.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="pt-2 border-t border-gray-200">
                      <Link href={`/spec-review?projectId=${projectId}&analysisType=${analysisType.key}&view=view`}>
                        <Button variant="outline" size="sm" className="w-full">
                          <FileText className="w-4 h-4 mr-2" />
                          View Full Analysis
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

