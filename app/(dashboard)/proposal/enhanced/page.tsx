"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FileDown, Sparkles, ArrowLeft, Upload, Check, X, Save, FolderOpen, Plus, Trash2 } from "lucide-react";
import { useCompanyId } from "@/lib/hooks/useCompanyId";
import { useAuth } from "@/lib/hooks/useAuth";
import { getDocument, getProjectPath, subscribeToCollection, setDocument, queryDocuments, deleteDocument } from "@/lib/firebase/firestore";
import { query, where, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { extractTextFromFile } from "@/lib/utils/fileExtractor";
import { loadCompanySettings } from "@/lib/utils/settingsLoader";
import { exportProposalToPDF } from "@/lib/utils/export";
import type { EstimatingLine } from "@/components/estimating/EstimatingGrid";

interface ProposalFormData {
  // Header
  to: string;
  contractor: string;
  projectName: string;
  projectLocation: string;
  bidDate: string;
  preparedBy: string;
  
  // Scope
  scope: {
    structuralSteel: boolean;
    joistsDecking: boolean;
    miscellaneousMetals: boolean;
    detailingEngineering: boolean;
    delivery: boolean;
  };
  
  // Price
  totalLumpSum: number;
  includeBreakdowns: boolean;
  
  // Schedule
  shopDrawingsDays: number;
  fabricationWeeks: number;
  
  // Exclusions
  exclusions: {
    bonds: boolean;
    erection: boolean;
    fieldWelding: boolean;
    fireproofing: boolean;
    galvanizing: boolean;
    powderCoat: boolean;
    specialtyMetals: boolean;
    delegatedDesign: boolean;
    BIM: boolean;
  };
  
  // Custom exclusions
  customExclusions: string[];
  
  // Additional notes
  customNotes?: string;
  projectSummary?: string;
}

function EnhancedProposalPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams?.get("projectId");
  const companyId = useCompanyId();
  const { user } = useAuth();
  
  const [formData, setFormData] = useState<ProposalFormData>({
    to: "",
    contractor: "",
    projectName: "",
    projectLocation: "",
    bidDate: new Date().toLocaleDateString(),
    preparedBy: user?.displayName || user?.email || "",
    scope: {
      structuralSteel: true,
      joistsDecking: false,
      miscellaneousMetals: false,
      detailingEngineering: true,
      delivery: true,
    },
    totalLumpSum: 0,
    includeBreakdowns: false,
    shopDrawingsDays: 14,
    fabricationWeeks: 8,
    exclusions: {
      bonds: true,
      erection: true,
      fieldWelding: true,
      fireproofing: true,
      galvanizing: true,
      powderCoat: true,
      specialtyMetals: true,
      delegatedDesign: true,
      BIM: true,
    },
    customExclusions: [],
    projectSummary: "",
  });
  
  const [estimatingLines, setEstimatingLines] = useState<EstimatingLine[]>([]);
  const [estimatingTotals, setEstimatingTotals] = useState({
    totalCost: 0,
    totalWeight: 0,
    materialCost: 0,
    laborCost: 0,
    coatingCost: 0,
    hardwareCost: 0,
  });
  const [companyInfo, setCompanyInfo] = useState<any>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [proposalText, setProposalText] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState<{ message?: string; currentPage?: number; totalPages?: number } | null>(null);
  const [customExclusionInput, setCustomExclusionInput] = useState("");
  const [savedTemplates, setSavedTemplates] = useState<Array<{ id: string; name: string; createdAt: any }>>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

  // Load project and company data
  useEffect(() => {
    const loadData = async () => {
      if (!isFirebaseConfigured() || !companyId) return;

      try {
        // Load company settings
        const settings = await loadCompanySettings(companyId);
        setCompanyInfo(settings.companyInfo);
        setFormData(prev => ({
          ...prev,
          contractor: settings.companyInfo?.companyName || "",
        }));

        // Load project data if projectId provided
        if (projectId) {
          const projectPath = getProjectPath(companyId, projectId);
          const projectData = await getDocument(projectPath);
          
          if (projectData) {
            setFormData(prev => ({
              ...prev,
              projectName: projectData.projectName || "",
              projectLocation: projectData.projectLocation || "",
            }));
          }

          // Load estimating lines
          const linesPath = getProjectPath(companyId, projectId, "lines");
          const unsubscribe = subscribeToCollection<EstimatingLine>(
            linesPath,
            (lines) => {
              const activeLines = lines.filter(line => line.status !== "Void");
              setEstimatingLines(activeLines);
              
              // Calculate totals
              const totals = {
                totalCost: activeLines.reduce((sum, line) => sum + (line.totalCost || 0), 0),
                totalWeight: activeLines.reduce((sum, line) => 
                  sum + (line.materialType === "Material" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0)), 0
                ),
                materialCost: activeLines.reduce((sum, line) => sum + (line.materialCost || 0), 0),
                laborCost: activeLines.reduce((sum, line) => sum + (line.laborCost || 0), 0),
                coatingCost: activeLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0),
                hardwareCost: activeLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0),
              };
              setEstimatingTotals(totals);
              
              // Auto-populate total if estimate exists
              if (totals.totalCost > 0) {
                setFormData(prev => ({
                  ...prev,
                  totalLumpSum: totals.totalCost,
                }));
              }

              // Auto-detect scope from line items
              const hasStructuralSteel = activeLines.some(line => 
                line.category === "Columns" || line.category === "Beams" || line.shapeType
              );
              const hasJoists = activeLines.some(line => 
                line.category?.toLowerCase().includes("joist")
              );
              const hasMiscMetals = activeLines.some(line => 
                line.category === "Misc Metals" || line.category === "Rails" || line.category === "Ladders"
              );

              setFormData(prev => ({
                ...prev,
                scope: {
                  ...prev.scope,
                  structuralSteel: hasStructuralSteel || prev.scope.structuralSteel,
                  joistsDecking: hasJoists || prev.scope.joistsDecking,
                  miscellaneousMetals: hasMiscMetals || prev.scope.miscellaneousMetals,
                },
              }));
            }
          );

          return () => unsubscribe();
        }
      } catch (error) {
        console.error("Failed to load data:", error);
      }
    };

    loadData();
    loadSavedTemplates();
  }, [companyId, projectId, user]);

  // Load saved templates
  const loadSavedTemplates = async () => {
    if (!isFirebaseConfigured() || !companyId || !db) return;

    try {
      setIsLoadingTemplates(true);
      const templatesRef = collection(db, `companies/${companyId}/proposalTemplates`);
      const templatesQuery = query(templatesRef, where("companyId", "==", companyId));
      const snapshot = await getDocs(templatesQuery);
      
      const templates = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || "Unnamed Template",
        createdAt: doc.data().createdAt,
      }));
      
      setSavedTemplates(templates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  // Add custom exclusion
  const handleAddCustomExclusion = () => {
    if (!customExclusionInput.trim()) return;
    
    setFormData({
      ...formData,
      customExclusions: [...formData.customExclusions, customExclusionInput.trim()],
    });
    setCustomExclusionInput("");
  };

  // Remove custom exclusion
  const handleRemoveCustomExclusion = (index: number) => {
    setFormData({
      ...formData,
      customExclusions: formData.customExclusions.filter((_, i) => i !== index),
    });
  };

  // Save template
  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      alert("Please enter a template name");
      return;
    }

    if (!isFirebaseConfigured() || !companyId) {
      alert("Firebase is not configured");
      return;
    }

    setIsSavingTemplate(true);
    try {
      const templateData = {
        name: templateName.trim(),
        companyId,
        formData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const templateId = crypto.randomUUID();
      await setDocument(
        `companies/${companyId}/proposalTemplates/${templateId}`,
        templateData,
        false
      );

      alert("Template saved successfully!");
      setShowTemplateDialog(false);
      setTemplateName("");
      loadSavedTemplates();
    } catch (error: any) {
      console.error("Failed to save template:", error);
      alert("Failed to save template. Please try again.");
    } finally {
      setIsSavingTemplate(false);
    }
  };

  // Load template
  const handleLoadTemplate = async (templateId: string) => {
    if (!isFirebaseConfigured() || !companyId) return;

    try {
      const template = await getDocument(`companies/${companyId}/proposalTemplates/${templateId}`);
      if (template?.formData) {
        setFormData(template.formData as ProposalFormData);
        alert("Template loaded successfully!");
      }
    } catch (error: any) {
      console.error("Failed to load template:", error);
      alert("Failed to load template. Please try again.");
    }
  };

  // Delete template
  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;

    if (!isFirebaseConfigured() || !companyId) return;

    try {
      await deleteDocument(`companies/${companyId}/proposalTemplates`, templateId);
      loadSavedTemplates();
      alert("Template deleted successfully!");
    } catch (error: any) {
      console.error("Failed to delete template:", error);
      alert("Failed to delete template. Please try again.");
    }
  };

  const handleGenerate = async () => {
    if (!formData.projectSummary?.trim() && !formData.projectName) {
      alert("Please enter a project summary or ensure project name is set");
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch("/api/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formData,
          estimatingData: {
            totals: estimatingTotals,
            lineCount: estimatingLines.length,
            categories: [...new Set(estimatingLines.map(l => l.category).filter(Boolean))],
          },
          companyInfo,
          projectId,
          companyId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate proposal");
      }

      const result = await response.json();
      setProposalText(result.proposal);
    } catch (error: any) {
      console.error("Proposal generation error:", error);
      alert("Failed to generate proposal. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExportPDF = async () => {
    if (!proposalText.trim()) {
      alert("Please generate a proposal first");
      return;
    }
    
    await exportProposalToPDF(
      proposalText,
      formData.projectName || "Project",
      "",
      formData.contractor || "Company",
      companyId
    );
  };

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
          <span>AI Generated Proposal</span>
        </h1>
      </div>

      {/* Header Information */}
      <Card>
        <CardHeader>
          <CardTitle>Proposal Header</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <Input
                value={formData.to}
                onChange={(e) => setFormData({ ...formData, to: e.target.value })}
                placeholder="Client/General Contractor"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contractor</label>
              <Input
                value={formData.contractor}
                onChange={(e) => setFormData({ ...formData, contractor: e.target.value })}
                placeholder="Your Company Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
              <Input
                value={formData.projectName}
                onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                placeholder="Project Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Location</label>
              <Input
                value={formData.projectLocation}
                onChange={(e) => setFormData({ ...formData, projectLocation: e.target.value })}
                placeholder="City, State"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bid Date</label>
              <Input
                type="date"
                value={formData.bidDate}
                onChange={(e) => setFormData({ ...formData, bidDate: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prepared By</label>
              <Input
                value={formData.preparedBy}
                onChange={(e) => setFormData({ ...formData, preparedBy: e.target.value })}
                placeholder="Your Name"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Summary */}
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
                  const extractedText = await extractTextFromFile(file, (progress) => {
                    setExtractionProgress({
                      message: progress.message,
                      currentPage: progress.currentPage,
                      totalPages: progress.totalPages,
                    });
                  });
                  setFormData({ ...formData, projectSummary: extractedText });
                  setExtractionProgress(null);
                } catch (error: any) {
                  setExtractionProgress(null);
                  alert(`Failed to extract text: ${error.message}`);
                } finally {
                  setIsExtracting(false);
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
              Project Summary / Scope Description
            </label>
            <textarea
              value={formData.projectSummary}
              onChange={(e) => setFormData({ ...formData, projectSummary: e.target.value })}
              className="w-full h-32 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter project summary, key details, scope, and requirements..."
            />
          </div>
          {estimatingTotals.totalCost > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2">Estimate Data Available</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Total Cost:</span>
                  <span className="ml-2 font-semibold">${estimatingTotals.totalCost.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-gray-600">Total Weight:</span>
                  <span className="ml-2 font-semibold">{estimatingTotals.totalWeight.toLocaleString()} lbs</span>
                </div>
                <div>
                  <span className="text-gray-600">Line Items:</span>
                  <span className="ml-2 font-semibold">{estimatingLines.length}</span>
                </div>
                <div>
                  <span className="text-gray-600">Material Cost:</span>
                  <span className="ml-2 font-semibold">${estimatingTotals.materialCost.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scope of Work */}
      <Card>
        <CardHeader>
          <CardTitle>Scope of Work - Included</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { key: "structuralSteel", label: "Structural Steel" },
              { key: "joistsDecking", label: "Joists & Decking" },
              { key: "miscellaneousMetals", label: "Miscellaneous Metals" },
              { key: "detailingEngineering", label: "Detailing & Engineering" },
              { key: "delivery", label: "Delivery" },
            ].map((item) => (
              <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.scope[item.key as keyof typeof formData.scope]}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      scope: { ...formData.scope, [item.key]: e.target.checked },
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{item.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Price */}
      <Card>
        <CardHeader>
          <CardTitle>Price</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Lump Sum
              </label>
              <Input
                type="number"
                value={formData.totalLumpSum || ""}
                onChange={(e) =>
                  setFormData({ ...formData, totalLumpSum: parseFloat(e.target.value) || 0 })
                }
                placeholder="0.00"
                className="text-lg font-semibold"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.includeBreakdowns}
                onChange={(e) =>
                  setFormData({ ...formData, includeBreakdowns: e.target.checked })
                }
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Include breakdowns for structural steel, miscellaneous metals, joists, decking, engineering, or installation
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shop Drawings (days)
              </label>
              <Input
                type="number"
                value={formData.shopDrawingsDays}
                onChange={(e) =>
                  setFormData({ ...formData, shopDrawingsDays: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fabrication Lead Time (weeks)
              </label>
              <Input
                type="number"
                value={formData.fabricationWeeks}
                onChange={(e) =>
                  setFormData({ ...formData, fabricationWeeks: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exclusions */}
      <Card>
        <CardHeader>
          <CardTitle>Exclusions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { key: "bonds", label: "Performance and Payment Bonds" },
                { key: "erection", label: "Erection of Structural Steel" },
                { key: "fieldWelding", label: "Field Welding, Cutting, or Modifications" },
                { key: "fireproofing", label: "Fireproofing / Intumescent Coatings" },
                { key: "galvanizing", label: "Galvanizing (except where specified)" },
                { key: "powderCoat", label: "Powder Coat or Specialty Finishes" },
                { key: "specialtyMetals", label: "Stainless Steel, Aluminum, Specialty Metals" },
                { key: "delegatedDesign", label: "Delegated Connection Design" },
                { key: "BIM", label: "BIM Modeling beyond LOD 300" },
              ].map((item) => (
                <label key={item.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.exclusions[item.key as keyof typeof formData.exclusions]}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        exclusions: { ...formData.exclusions, [item.key]: e.target.checked },
                      })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{item.label}</span>
                </label>
              ))}
            </div>

            {/* Custom Exclusions */}
            <div className="border-t pt-4 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Custom Exclusions
              </label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={customExclusionInput}
                  onChange={(e) => setCustomExclusionInput(e.target.value)}
                  placeholder="Enter custom exclusion..."
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomExclusion();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddCustomExclusion}
                  disabled={!customExclusionInput.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
              {formData.customExclusions.length > 0 && (
                <div className="space-y-2">
                  {formData.customExclusions.map((exclusion, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200"
                    >
                      <span className="text-sm text-gray-700">{exclusion}</span>
                      <button
                        onClick={() => handleRemoveCustomExclusion(index)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Remove exclusion"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Generated Proposal */}
      <Card>
        <CardHeader>
          <CardTitle>Generated Proposal</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            value={proposalText}
            onChange={(e) => setProposalText(e.target.value)}
            className="w-full h-96 p-4 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            placeholder="Generated proposal will appear here..."
          />
        </CardContent>
      </Card>

      <div className="flex gap-3 flex-wrap">
        <Button
          variant="primary"
          onClick={handleGenerate}
          disabled={isGenerating}
        >
          {isGenerating ? "Generating..." : "Generate Proposal"}
        </Button>
        <Button variant="outline" onClick={handleExportPDF} disabled={!proposalText.trim()}>
          <FileDown className="w-4 h-4 mr-2" />
          Export PDF
        </Button>
        <Button
          variant="outline"
          onClick={() => setShowTemplateDialog(true)}
        >
          <Save className="w-4 h-4 mr-2" />
          Save Template
        </Button>
        {savedTemplates.length > 0 && (
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => {
                const dialog = document.getElementById("template-load-dialog") as HTMLDialogElement;
                dialog?.showModal();
              }}
            >
              <FolderOpen className="w-4 h-4 mr-2" />
              Load Template
            </Button>
          </div>
        )}
      </div>

      {/* Save Template Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Save Proposal Template</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Template Name
              </label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g., Standard Proposal Template"
                onKeyPress={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSaveTemplate();
                  }
                }}
              />
            </div>
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowTemplateDialog(false);
                  setTemplateName("");
                }}
                disabled={isSavingTemplate}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleSaveTemplate}
                disabled={isSavingTemplate || !templateName.trim()}
              >
                {isSavingTemplate ? "Saving..." : "Save Template"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Load Template Dialog */}
      <dialog id="template-load-dialog" className="rounded-lg p-0 max-w-2xl w-full">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Load Saved Template</h2>
          {isLoadingTemplates ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading templates...</p>
            </div>
          ) : savedTemplates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No saved templates found.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {savedTemplates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-gray-900">{template.name}</p>
                    {template.createdAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Created: {new Date(template.createdAt.toDate?.() || template.createdAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        handleLoadTemplate(template.id);
                        (document.getElementById("template-load-dialog") as HTMLDialogElement)?.close();
                      }}
                    >
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                (document.getElementById("template-load-dialog") as HTMLDialogElement)?.close();
              }}
            >
              Close
            </Button>
          </div>
        </div>
      </dialog>
    </div>
  );
}

export default function EnhancedProposalPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">Loading...</div>}>
      <EnhancedProposalPageContent />
    </Suspense>
  );
}

