"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { 
  Brain, 
  Sparkles, 
  Save, 
  ArrowLeft,
  Calendar,
  DollarSign,
  Clock,
  AlertCircle,
  CheckCircle,
  FileText,
  TrendingUp
} from "lucide-react";
import { 
  subscribeToCollection,
  createDocument,
  updateDocument,
  getDocument
} from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import Link from "next/link";

interface PostBidAnalysis {
  id?: string;
  projectId?: string;
  projectName: string;
  projectNumber?: string;
  
  // Completion Dates
  completionDate: string; // YYYY-MM-DD
  estimatedCompletionDate?: string; // YYYY-MM-DD
  actualDurationDays?: number; // Calculated
  
  // Financial Data
  estimatedCost?: number;
  actualMaterialCost?: number;
  actualLaborCost?: number;
  actualCoatingCost?: number;
  actualTotalCost?: number;
  finalProjectValue?: number;
  profitMargin?: number; // Calculated
  costVariance?: number; // Calculated
  
  // Performance Metrics
  estimatedWeight?: number; // lbs
  actualWeight?: number; // lbs
  estimatedLaborHours?: number;
  actualLaborHours?: number;
  laborEfficiency?: number; // Calculated
  
  // Quality & Issues
  qualityRating?: number; // 1-5 scale
  reworkRequired?: boolean;
  reworkHours?: number;
  reworkCost?: number;
  issuesEncountered?: string[];
  majorIssues?: string;
  
  // Client Feedback
  clientSatisfaction?: number; // 1-5 scale
  clientFeedback?: string;
  repeatClient?: boolean;
  
  // Lessons Learned
  lessonsLearned?: string;
  whatWentWell?: string;
  whatCouldImprove?: string;
  recommendations?: string;
  
  // Competitive Intelligence
  competitorsBid?: number;
  marketConditions?: string;
  
  // Additional Notes
  notes?: string;
  
  createdAt?: any;
  updatedAt?: any;
}

interface Project {
  id: string;
  projectName?: string;
  projectNumber?: string;
}

export default function PostBidAnalysisPage() {
  const router = useRouter();
  const companyId = "default"; // TODO: Get from auth context
  
  const [analyses, setAnalyses] = useState<PostBidAnalysis[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  const [formData, setFormData] = useState<Partial<PostBidAnalysis>>({
    projectName: "",
    projectNumber: "",
    completionDate: new Date().toISOString().split("T")[0],
    qualityRating: 5,
    clientSatisfaction: 5,
  });

  // Load projects for dropdown
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const projectsPath = `companies/${companyId}/projects`;
    const unsubscribe = subscribeToCollection<Project>(
      projectsPath,
      (data) => {
        setProjects(data.filter(p => p.projectName || p.projectNumber));
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Load analyses
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    const analysesPath = `companies/${companyId}/postBidAnalyses`;
    const unsubscribe = subscribeToCollection<PostBidAnalysis>(
      analysesPath,
      (data) => {
        setAnalyses(data.sort((a, b) => 
          new Date(b.completionDate).getTime() - new Date(a.completionDate).getTime()
        ));
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  const handleProjectSelect = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      setFormData({
        ...formData,
        projectId: project.id,
        projectName: project.projectName || "",
        projectNumber: project.projectNumber || "",
      });
    }
  };

  const calculateMetrics = (data: Partial<PostBidAnalysis>): Partial<PostBidAnalysis> => {
    const calculated = { ...data };
    
    // Calculate actual duration
    if (data.completionDate && data.estimatedCompletionDate) {
      const completion = new Date(data.completionDate);
      const estimated = new Date(data.estimatedCompletionDate);
      calculated.actualDurationDays = Math.ceil(
        (completion.getTime() - estimated.getTime()) / (1000 * 60 * 60 * 24)
      );
    }
    
    // Calculate total actual cost
    const material = data.actualMaterialCost || 0;
    const labor = data.actualLaborCost || 0;
    const coating = data.actualCoatingCost || 0;
    calculated.actualTotalCost = material + labor + coating;
    
    // Calculate cost variance
    if (data.estimatedCost && calculated.actualTotalCost) {
      calculated.costVariance = calculated.actualTotalCost - data.estimatedCost;
    }
    
    // Calculate profit margin
    if (data.finalProjectValue && calculated.actualTotalCost) {
      calculated.profitMargin = 
        ((data.finalProjectValue - calculated.actualTotalCost) / data.finalProjectValue) * 100;
    }
    
    // Calculate labor efficiency
    if (data.estimatedLaborHours && data.actualLaborHours) {
      calculated.laborEfficiency = 
        (data.estimatedLaborHours / data.actualLaborHours) * 100;
    }
    
    return calculated;
  };

  const handleSave = async () => {
    if (!formData.projectName || !formData.completionDate) {
      alert("Please fill in required fields: Project Name and Completion Date");
      return;
    }

    if (!isFirebaseConfigured()) {
      alert("Firebase is not configured. Cannot save analysis.");
      return;
    }

    try {
      const analysesPath = `companies/${companyId}/postBidAnalyses`;
      const calculatedData = calculateMetrics(formData);
      
      const analysisData: Omit<PostBidAnalysis, "id"> = {
        ...calculatedData,
        projectId: formData.projectId,
        projectName: formData.projectName!,
        projectNumber: formData.projectNumber,
        completionDate: formData.completionDate!,
        estimatedCompletionDate: formData.estimatedCompletionDate,
        estimatedCost: formData.estimatedCost,
        actualMaterialCost: formData.actualMaterialCost,
        actualLaborCost: formData.actualLaborCost,
        actualCoatingCost: formData.actualCoatingCost,
        finalProjectValue: formData.finalProjectValue,
        estimatedWeight: formData.estimatedWeight,
        actualWeight: formData.actualWeight,
        estimatedLaborHours: formData.estimatedLaborHours,
        actualLaborHours: formData.actualLaborHours,
        qualityRating: formData.qualityRating,
        reworkRequired: formData.reworkRequired || false,
        reworkHours: formData.reworkHours,
        reworkCost: formData.reworkCost,
        issuesEncountered: formData.issuesEncountered,
        majorIssues: formData.majorIssues,
        clientSatisfaction: formData.clientSatisfaction,
        clientFeedback: formData.clientFeedback,
        repeatClient: formData.repeatClient || false,
        lessonsLearned: formData.lessonsLearned,
        whatWentWell: formData.whatWentWell,
        whatCouldImprove: formData.whatCouldImprove,
        recommendations: formData.recommendations,
        competitorsBid: formData.competitorsBid,
        marketConditions: formData.marketConditions,
        notes: formData.notes,
        updatedAt: new Date(),
      };

      if (editingId) {
        await updateDocument(analysesPath, editingId, analysisData);
      } else {
        analysisData.createdAt = new Date();
        await createDocument(analysesPath, analysisData);
      }

      setIsFormOpen(false);
      setEditingId(null);
      setFormData({
        projectName: "",
        projectNumber: "",
        completionDate: new Date().toISOString().split("T")[0],
        qualityRating: 5,
        clientSatisfaction: 5,
      });
    } catch (error: any) {
      console.error("Failed to save post-bid analysis:", error);
      alert(`Failed to save: ${error.message}`);
    }
  };

  const handleEdit = (analysis: PostBidAnalysis) => {
    setFormData(analysis);
    setEditingId(analysis.id || null);
    setIsFormOpen(true);
  };

  const handleNew = () => {
    setFormData({
      projectName: "",
      projectNumber: "",
      completionDate: new Date().toISOString().split("T")[0],
      qualityRating: 5,
      clientSatisfaction: 5,
    });
    setEditingId(null);
    setIsFormOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              <Brain className="w-8 h-8 text-purple-500" />
              <Sparkles className="w-6 h-6 text-purple-400" />
              <span>AI Post Bid Analysis</span>
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Input project completion data for AI-powered trend analysis and insights
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={handleNew}>
          <FileText className="w-4 h-4 mr-2" />
          New Analysis
        </Button>
      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <Card className="border-2 border-purple-200 shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-500" />
              {editingId ? "Edit" : "New"} Post Bid Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Project Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Project *
                </label>
                <select
                  value={formData.projectId || ""}
                  onChange={(e) => handleProjectSelect(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Choose a project...</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.projectNumber ? `${project.projectNumber} - ` : ""}
                      {project.projectName || "Untitled Project"}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Name *
                </label>
                <Input
                  value={formData.projectName || ""}
                  onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                  placeholder="Project name"
                />
              </div>
            </div>

            {/* Completion Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Completion Date *
                </label>
                <Input
                  type="date"
                  value={formData.completionDate || ""}
                  onChange={(e) => setFormData({ ...formData, completionDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Completion Date
                </label>
                <Input
                  type="date"
                  value={formData.estimatedCompletionDate || ""}
                  onChange={(e) => setFormData({ ...formData, estimatedCompletionDate: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Actual Duration (days)
                </label>
                <Input
                  type="number"
                  value={formData.actualDurationDays || ""}
                  readOnly
                  className="bg-gray-50"
                  placeholder="Auto-calculated"
                />
              </div>
            </div>

            {/* Financial Data */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Financial Data
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Cost ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.estimatedCost || ""}
                    onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Final Project Value ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.finalProjectValue || ""}
                    onChange={(e) => setFormData({ ...formData, finalProjectValue: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Material Cost ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualMaterialCost || ""}
                    onChange={(e) => setFormData({ ...formData, actualMaterialCost: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Labor Cost ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualLaborCost || ""}
                    onChange={(e) => setFormData({ ...formData, actualLaborCost: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Coating Cost ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualCoatingCost || ""}
                    onChange={(e) => setFormData({ ...formData, actualCoatingCost: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Actual Cost ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualTotalCost || ""}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Auto-calculated"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost Variance ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.costVariance || ""}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Auto-calculated"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profit Margin (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.profitMargin?.toFixed(2) || ""}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Auto-calculated"
                  />
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Performance Metrics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Weight (lbs)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.estimatedWeight || ""}
                    onChange={(e) => setFormData({ ...formData, estimatedWeight: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Weight (lbs)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.actualWeight || ""}
                    onChange={(e) => setFormData({ ...formData, actualWeight: parseFloat(e.target.value) || undefined })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Estimated Labor Hours
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.estimatedLaborHours || ""}
                    onChange={(e) => setFormData({ ...formData, estimatedLaborHours: parseFloat(e.target.value) || undefined })}
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Labor Hours
                  </label>
                  <Input
                    type="number"
                    step="0.1"
                    value={formData.actualLaborHours || ""}
                    onChange={(e) => setFormData({ ...formData, actualLaborHours: parseFloat(e.target.value) || undefined })}
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Labor Efficiency (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.laborEfficiency?.toFixed(2) || ""}
                    readOnly
                    className="bg-gray-50"
                    placeholder="Auto-calculated"
                  />
                </div>
              </div>
            </div>

            {/* Quality & Issues */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                Quality & Issues
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Quality Rating (1-5)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.qualityRating || ""}
                    onChange={(e) => setFormData({ ...formData, qualityRating: parseInt(e.target.value) || undefined })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Rework Required
                  </label>
                  <select
                    value={formData.reworkRequired ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, reworkRequired: e.target.value === "true" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                {formData.reworkRequired && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rework Hours
                      </label>
                      <Input
                        type="number"
                        step="0.1"
                        value={formData.reworkHours || ""}
                        onChange={(e) => setFormData({ ...formData, reworkHours: parseFloat(e.target.value) || undefined })}
                        placeholder="0.0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Rework Cost ($)
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        value={formData.reworkCost || ""}
                        onChange={(e) => setFormData({ ...formData, reworkCost: parseFloat(e.target.value) || undefined })}
                        placeholder="0.00"
                      />
                    </div>
                  </>
                )}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Major Issues
                  </label>
                  <textarea
                    value={formData.majorIssues || ""}
                    onChange={(e) => setFormData({ ...formData, majorIssues: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Describe any major issues encountered..."
                  />
                </div>
              </div>
            </div>

            {/* Client Feedback */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Client Feedback
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Satisfaction (1-5)
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={formData.clientSatisfaction || ""}
                    onChange={(e) => setFormData({ ...formData, clientSatisfaction: parseInt(e.target.value) || undefined })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Repeat Client
                  </label>
                  <select
                    value={formData.repeatClient ? "true" : "false"}
                    onChange={(e) => setFormData({ ...formData, repeatClient: e.target.value === "true" })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Client Feedback
                  </label>
                  <textarea
                    value={formData.clientFeedback || ""}
                    onChange={(e) => setFormData({ ...formData, clientFeedback: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Client feedback and comments..."
                  />
                </div>
              </div>
            </div>

            {/* Lessons Learned */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-purple-600" />
                Lessons Learned
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What Went Well
                  </label>
                  <textarea
                    value={formData.whatWentWell || ""}
                    onChange={(e) => setFormData({ ...formData, whatWentWell: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="What went well on this project..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What Could Improve
                  </label>
                  <textarea
                    value={formData.whatCouldImprove || ""}
                    onChange={(e) => setFormData({ ...formData, whatCouldImprove: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="What could be improved..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendations
                  </label>
                  <textarea
                    value={formData.recommendations || ""}
                    onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Recommendations for future projects..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    General Lessons Learned
                  </label>
                  <textarea
                    value={formData.lessonsLearned || ""}
                    onChange={(e) => setFormData({ ...formData, lessonsLearned: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    rows={3}
                    placeholder="Key lessons learned from this project..."
                  />
                </div>
              </div>
            </div>

            {/* Additional Notes */}
            <div className="border-t pt-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Notes</h3>
              <textarea
                value={formData.notes || ""}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={4}
                placeholder="Any additional notes or observations..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="primary" onClick={handleSave} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                Save Analysis
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingId(null);
                  setFormData({
                    projectName: "",
                    projectNumber: "",
                    completionDate: new Date().toISOString().split("T")[0],
                    qualityRating: 5,
                    clientSatisfaction: 5,
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Analyses List */}
      {analyses.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {analyses.map((analysis) => (
            <Card key={analysis.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{analysis.projectName}</CardTitle>
                {analysis.projectNumber && (
                  <p className="text-sm text-gray-600 font-mono">{analysis.projectNumber}</p>
                )}
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar className="w-4 h-4" />
                  <span>Completed: {new Date(analysis.completionDate).toLocaleDateString()}</span>
                </div>
                {analysis.actualTotalCost && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <DollarSign className="w-4 h-4" />
                    <span>Cost: ${analysis.actualTotalCost.toLocaleString()}</span>
                  </div>
                )}
                {analysis.profitMargin !== undefined && (
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4" />
                    <span className={analysis.profitMargin >= 0 ? "text-green-600" : "text-red-600"}>
                      Margin: {analysis.profitMargin.toFixed(1)}%
                    </span>
                  </div>
                )}
                {analysis.qualityRating && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Quality: {analysis.qualityRating}/5</span>
                  </div>
                )}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEdit(analysis)}
                  className="w-full mt-4"
                >
                  Edit Analysis
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No Post Bid Analyses Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start tracking project completion data to enable AI-powered trend analysis and insights.
            </p>
            <Button variant="primary" onClick={handleNew}>
              <FileText className="w-4 h-4 mr-2" />
              Create First Analysis
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}


