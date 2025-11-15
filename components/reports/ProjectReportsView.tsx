"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import { 
  DollarSign, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Unlock, 
  RotateCcw,
  BarChart3,
  Package,
  Wrench,
  Paintbrush,
  Users,
  Target,
  FileCheck
} from "lucide-react";
import { subscribeToCollection, updateDocument, getDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import {
  loadCompanySettings,
  loadProjectSettings,
  calculateTotalCostWithMarkup,
  type CompanySettings,
  type ProjectSettings,
} from "@/lib/utils/settingsLoader";

interface ProjectReportsViewProps {
  companyId: string;
  projectId: string;
  project: {
    id?: string;
    projectNumber?: string;
    projectName?: string;
    status?: string;
    estimatedValue?: string | number;
    probabilityOfWin?: number;
    bidDueDate?: string;
  };
}

interface ReportFinancials {
  materialCost: number;
  laborCost: number;
  coatingCost: number;
  hardwareCost: number;
  subtotal: number;
  overheadPercentage: number;
  overheadAmount: number;
  profitPercentage: number;
  profitAmount: number;
  totalCost: number;
  materialWasteFactor: number;
  laborWasteFactor: number;
}

export default function ProjectReportsView({ companyId, projectId, project }: ProjectReportsViewProps) {
  const [lines, setLines] = useState<EstimatingLine[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [projectSettings, setProjectSettings] = useState<ProjectSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Financial overrides with lock state
  const [financials, setFinancials] = useState<ReportFinancials>({
    materialCost: 0,
    laborCost: 0,
    coatingCost: 0,
    hardwareCost: 0,
    subtotal: 0,
    overheadPercentage: 15,
    overheadAmount: 0,
    profitPercentage: 10,
    profitAmount: 0,
    totalCost: 0,
    materialWasteFactor: 5,
    laborWasteFactor: 10,
  });

  const [locks, setLocks] = useState({
    overheadPercentage: true,
    profitPercentage: true,
    materialWasteFactor: true,
    laborWasteFactor: true,
  });

  // Load data
  useEffect(() => {
    loadData();
  }, [companyId, projectId]);

  const loadData = async () => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    try {
      // Load company and project settings
      const [company, project] = await Promise.all([
        loadCompanySettings(companyId),
        loadProjectSettings(companyId, projectId),
      ]);

      setCompanySettings(company);
      setProjectSettings(project);

      // Set default financials from settings
      setFinancials((prev) => ({
        ...prev,
        overheadPercentage: project.overheadPercentage ?? company.markupSettings.overheadPercentage,
        profitPercentage: project.profitPercentage ?? company.markupSettings.profitPercentage,
        materialWasteFactor: company.markupSettings.materialWasteFactor,
        laborWasteFactor: company.markupSettings.laborWasteFactor,
      }));
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to estimating lines
  useEffect(() => {
    if (!isFirebaseConfigured()) {
      return;
    }

    const linesPath = getProjectPath(companyId, projectId, "lines");
    const unsubscribe = subscribeToCollection<EstimatingLine>(
      linesPath,
      (data) => {
        setLines(data);
      }
    );

    return () => unsubscribe();
  }, [companyId, projectId]);

  // Calculate financials from lines
  const calculatedFinancials = useMemo(() => {
    const activeLines = lines.filter((line) => line.status !== "Void");

    const materialCost = activeLines.reduce((sum, line) => sum + (line.materialCost || 0), 0);
    const laborCost = activeLines.reduce((sum, line) => sum + (line.laborCost || 0), 0);
    const coatingCost = activeLines.reduce((sum, line) => sum + (line.coatingCost || 0), 0);
    const hardwareCost = activeLines.reduce((sum, line) => sum + (line.hardwareCost || 0), 0);

    const subtotal = materialCost + laborCost + coatingCost + hardwareCost;

    // Apply waste factors
    const materialWithWaste = materialCost * (1 + financials.materialWasteFactor / 100);
    const laborWithWaste = laborCost * (1 + financials.laborWasteFactor / 100);
    const subtotalWithWaste = materialWithWaste + laborWithWaste + coatingCost + hardwareCost;

    // Apply overhead and profit
    const overheadAmount = subtotalWithWaste * (financials.overheadPercentage / 100);
    const subtotalWithOverhead = subtotalWithWaste + overheadAmount;
    const profitAmount = subtotalWithOverhead * (financials.profitPercentage / 100);
    const totalCost = subtotalWithOverhead + profitAmount;

    return {
      materialCost,
      laborCost,
      coatingCost,
      hardwareCost,
      subtotal,
      overheadPercentage: financials.overheadPercentage,
      overheadAmount,
      profitPercentage: financials.profitPercentage,
      profitAmount,
      totalCost,
      materialWasteFactor: financials.materialWasteFactor,
      laborWasteFactor: financials.laborWasteFactor,
      materialWithWaste,
      laborWithWaste,
      subtotalWithWaste,
    };
  }, [lines, financials.overheadPercentage, financials.profitPercentage, financials.materialWasteFactor, financials.laborWasteFactor]);

  // Update financials when calculated values change
  useEffect(() => {
    setFinancials((prev) => ({
      ...prev,
      ...calculatedFinancials,
    }));
  }, [calculatedFinancials]);

  const handleFinancialChange = async (field: keyof ReportFinancials, value: number) => {
    setFinancials((prev) => ({ ...prev, [field]: value }));

    // Save to project settings if it's a percentage or factor
    if (field === "overheadPercentage" || field === "profitPercentage") {
      try {
        const projectPath = getProjectPath(companyId, projectId);
        const currentProject = await getDocument(projectPath);
        if (currentProject) {
          await updateDocument(
            `companies/${companyId}/projects`,
            projectId,
            {
              [`settings.${field}`]: value,
            }
          );
        }
      } catch (error) {
        console.error("Failed to save financial override:", error);
      }
    }
  };

  const toggleLock = (field: keyof typeof locks) => {
    setLocks((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const resetToDefault = (field: keyof ReportFinancials) => {
    if (!companySettings || !projectSettings) return;

    let defaultValue = 0;
    if (field === "overheadPercentage") {
      defaultValue = projectSettings.overheadPercentage ?? companySettings.markupSettings.overheadPercentage;
    } else if (field === "profitPercentage") {
      defaultValue = projectSettings.profitPercentage ?? companySettings.markupSettings.profitPercentage;
    } else if (field === "materialWasteFactor") {
      defaultValue = companySettings.markupSettings.materialWasteFactor;
    } else if (field === "laborWasteFactor") {
      defaultValue = companySettings.markupSettings.laborWasteFactor;
    }

    handleFinancialChange(field, defaultValue);
    setLocks((prev) => ({ ...prev, [field]: true }));
  };

  const getDefaultValue = (field: keyof ReportFinancials): number => {
    if (!companySettings || !projectSettings) return 0;

    if (field === "overheadPercentage") {
      return projectSettings.overheadPercentage ?? companySettings.markupSettings.overheadPercentage;
    } else if (field === "profitPercentage") {
      return projectSettings.profitPercentage ?? companySettings.markupSettings.profitPercentage;
    } else if (field === "materialWasteFactor") {
      return companySettings.markupSettings.materialWasteFactor;
    } else if (field === "laborWasteFactor") {
      return companySettings.markupSettings.laborWasteFactor;
    }
    return 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 0) => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Calculate metrics
  const metrics = useMemo(() => {
    const activeLines = lines.filter((line) => line.status !== "Void");
    const totalWeight = activeLines.reduce((sum, line) => {
      if (line.materialType === "Material") {
        return sum + (line.totalWeight || 0);
      } else {
        return sum + (line.plateTotalWeight || 0);
      }
    }, 0);
    const totalLaborHours = activeLines.reduce((sum, line) => sum + (line.totalLabor || 0), 0);
    const totalSurfaceArea = activeLines.reduce((sum, line) => {
      if (line.materialType === "Material") {
        return sum + (line.totalSurfaceArea || 0);
      } else {
        return sum + (line.plateSurfaceArea || 0);
      }
    }, 0);

    const margin = financials.totalCost > 0
      ? ((financials.profitAmount / financials.totalCost) * 100)
      : 0;

    const costPerPound = totalWeight > 0 ? financials.totalCost / totalWeight : 0;
    const costPerTon = totalWeight > 0 ? (financials.totalCost / totalWeight) * 2000 : 0;
    const costPerLaborHour = totalLaborHours > 0 ? financials.laborCost / totalLaborHours : 0;
    
    // Sanity check metrics
    const manHoursPerPound = totalWeight > 0 ? totalLaborHours / totalWeight : 0;
    const manHoursPerTon = totalWeight > 0 ? (totalLaborHours / totalWeight) * 2000 : 0;
    const materialCostPerPound = totalWeight > 0 ? financials.materialCost / totalWeight : 0;
    const materialCostPerTon = totalWeight > 0 ? (financials.materialCost / totalWeight) * 2000 : 0;
    const laborCostPerPound = totalWeight > 0 ? financials.laborCost / totalWeight : 0;
    const laborCostPerTon = totalWeight > 0 ? (financials.laborCost / totalWeight) * 2000 : 0;
    
    // Efficiency metrics
    const poundsPerLaborHour = totalLaborHours > 0 ? totalWeight / totalLaborHours : 0;
    const tonsPerLaborHour = totalLaborHours > 0 ? (totalWeight / totalLaborHours) / 2000 : 0;
    const surfaceAreaPerPound = totalWeight > 0 ? totalSurfaceArea / totalWeight : 0;
    const surfaceAreaPerTon = totalWeight > 0 ? (totalSurfaceArea / totalWeight) * 2000 : 0;
    
    // Cost ratios
    const materialToLaborRatio = financials.laborCost > 0 ? financials.materialCost / financials.laborCost : 0;
    const materialPercentage = financials.subtotal > 0 ? (financials.materialCost / financials.subtotal) * 100 : 0;
    const laborPercentage = financials.subtotal > 0 ? (financials.laborCost / financials.subtotal) * 100 : 0;
    const coatingPercentage = financials.subtotal > 0 ? (financials.coatingCost / financials.subtotal) * 100 : 0;
    const hardwarePercentage = financials.subtotal > 0 ? (financials.hardwareCost / financials.subtotal) * 100 : 0;

    return {
      totalWeight,
      totalLaborHours,
      totalSurfaceArea,
      margin,
      costPerPound,
      costPerTon,
      costPerLaborHour,
      lineItemCount: activeLines.length,
      // Sanity checks
      manHoursPerPound,
      manHoursPerTon,
      materialCostPerPound,
      materialCostPerTon,
      laborCostPerPound,
      laborCostPerTon,
      // Efficiency
      poundsPerLaborHour,
      tonsPerLaborHour,
      surfaceAreaPerPound,
      surfaceAreaPerTon,
      // Ratios
      materialToLaborRatio,
      materialPercentage,
      laborPercentage,
      coatingPercentage,
      hardwarePercentage,
    };
  }, [lines, financials]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="bg-blue-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="w-6 h-6" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Total Project Cost</div>
              <div className="text-3xl font-bold text-gray-900">
                {formatCurrency(financials.totalCost)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Including overhead & profit</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Profit Margin</div>
              <div className="text-3xl font-bold text-green-600">
                {formatNumber(metrics.margin, 1)}%
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {formatCurrency(financials.profitAmount)} profit
              </div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Win Probability</div>
              <div className="text-3xl font-bold text-blue-600">
                {project.probabilityOfWin || 0}%
              </div>
              <div className="text-xs text-gray-500 mt-1">Based on project settings</div>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="text-xs text-gray-600 mb-1">Line Items</div>
              <div className="text-3xl font-bold text-gray-900">
                {metrics.lineItemCount}
              </div>
              <div className="text-xs text-gray-500 mt-1">Active estimate lines</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Direct Costs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Direct Costs</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Material Cost</span>
                </div>
                  <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(financials.materialCost)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency((calculatedFinancials as any).materialWithWaste)} with {formatNumber(financials.materialWasteFactor, 1)}% waste
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Labor Cost</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(financials.laborCost)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency((calculatedFinancials as any).laborWithWaste)} with {formatNumber(financials.laborWasteFactor, 1)}% waste
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Paintbrush className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Coating Cost</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(financials.coatingCost)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Hardware Cost</span>
                </div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatCurrency(financials.hardwareCost)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <span className="text-sm font-semibold text-gray-900">Subtotal (Before Waste)</span>
                <div className="text-lg font-bold text-blue-900">
                  {formatCurrency(financials.subtotal)}
                </div>
              </div>
              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                <span className="text-sm font-semibold text-gray-900">Subtotal (After Waste)</span>
                <div className="text-lg font-bold text-blue-900">
                  {formatCurrency((calculatedFinancials as any).subtotalWithWaste)}
                </div>
              </div>
            </div>
          </div>

          {/* Markup & Profit */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Markup & Profit</h3>
            <div className="space-y-4">
              {/* Overhead */}
              <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Overhead</span>
                    {locks.overheadPercentage ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {projectSettings ? "Project" : "Company"} Default
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        Override
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!locks.overheadPercentage && (
                      <button
                        type="button"
                        onClick={() => resetToDefault("overheadPercentage")}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        title={`Reset to default: ${formatNumber(getDefaultValue("overheadPercentage"), 1)}%`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLock("overheadPercentage")}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      {locks.overheadPercentage ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Overhead %</label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={financials.overheadPercentage.toString()}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (!locks.overheadPercentage) {
                            handleFinancialChange("overheadPercentage", value);
                          }
                        }}
                        disabled={locks.overheadPercentage}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Default: {formatNumber(getDefaultValue("overheadPercentage"), 1)}%
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Overhead Amount</label>
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(financials.overheadAmount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Profit */}
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Profit</span>
                    {locks.profitPercentage ? (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {projectSettings ? "Project" : "Company"} Default
                      </span>
                    ) : (
                      <span className="text-xs text-amber-600 flex items-center gap-1">
                        <Unlock className="w-3 h-3" />
                        Override
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!locks.profitPercentage && (
                      <button
                        type="button"
                        onClick={() => resetToDefault("profitPercentage")}
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                        title={`Reset to default: ${formatNumber(getDefaultValue("profitPercentage"), 1)}%`}
                      >
                        <RotateCcw className="w-3 h-3" />
                        Reset
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLock("profitPercentage")}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      {locks.profitPercentage ? (
                        <Unlock className="w-4 h-4" />
                      ) : (
                        <Lock className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Profit %</label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={financials.profitPercentage.toString()}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0;
                          if (!locks.profitPercentage) {
                            handleFinancialChange("profitPercentage", value);
                          }
                        }}
                        disabled={locks.profitPercentage}
                        className="pr-8"
                      />
                      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Default: {formatNumber(getDefaultValue("profitPercentage"), 1)}%
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Profit Amount</label>
                    <div className="text-lg font-semibold text-green-700">
                      {formatCurrency(financials.profitAmount)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Cost */}
              <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg text-white">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold">Total Project Cost</span>
                  <div className="text-3xl font-bold">
                    {formatCurrency(financials.totalCost)}
                  </div>
                </div>
                <div className="mt-2 text-sm text-blue-100">
                  Margin: {formatNumber(metrics.margin, 1)}%
                </div>
              </div>
            </div>
          </div>

          {/* Waste Factors */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Waste Factors</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Material Waste Factor</label>
                  <div className="flex items-center gap-1">
                    {!locks.materialWasteFactor && (
                      <button
                        type="button"
                        onClick={() => resetToDefault("materialWasteFactor")}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        title={`Reset to default: ${formatNumber(getDefaultValue("materialWasteFactor"), 1)}%`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLock("materialWasteFactor")}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      {locks.materialWasteFactor ? (
                        <Unlock className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={financials.materialWasteFactor.toString()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (!locks.materialWasteFactor) {
                        handleFinancialChange("materialWasteFactor", value);
                      }
                    }}
                    disabled={locks.materialWasteFactor}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">Labor Waste Factor</label>
                  <div className="flex items-center gap-1">
                    {!locks.laborWasteFactor && (
                      <button
                        type="button"
                        onClick={() => resetToDefault("laborWasteFactor")}
                        className="text-xs text-blue-600 hover:text-blue-800"
                        title={`Reset to default: ${formatNumber(getDefaultValue("laborWasteFactor"), 1)}%`}
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleLock("laborWasteFactor")}
                      className="text-xs text-gray-600 hover:text-gray-800"
                    >
                      {locks.laborWasteFactor ? (
                        <Unlock className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={financials.laborWasteFactor.toString()}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value) || 0;
                      if (!locks.laborWasteFactor) {
                        handleFinancialChange("laborWasteFactor", value);
                      }
                    }}
                    disabled={locks.laborWasteFactor}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sanity Checks - Critical Estimator Validation Metrics */}
      <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="bg-green-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-xl">
            <CheckCircle2 className="w-6 h-6" />
            Sanity Checks & Validation Metrics
          </CardTitle>
          <p className="text-sm text-green-100 mt-1">
            Critical metrics used by estimators to validate estimate accuracy
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Primary Sanity Checks */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-green-600" />
              Primary Sanity Checks
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Total Cost per Pound</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrency(metrics.costPerPound)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(metrics.costPerTon)} per ton
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Typical range: $1.50 - $3.50/lb
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Total Cost per Ton</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatCurrency(metrics.costPerTon)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(metrics.costPerPound)} per lb
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Typical range: $3,000 - $7,000/ton
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Man Hours per Pound</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatNumber(metrics.manHoursPerPound, 4)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatNumber(metrics.manHoursPerTon, 2)} hrs per ton
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Typical range: 0.001 - 0.005 hrs/lb
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Man Hours per Ton</div>
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {formatNumber(metrics.manHoursPerTon, 2)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatNumber(metrics.manHoursPerPound, 4)} hrs per lb
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Typical range: 2 - 10 hrs/ton
                </div>
              </div>
            </div>
          </div>

          {/* Cost Breakdown per Unit */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Cost Breakdown per Unit
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-xs text-gray-600 mb-1">Material Cost</div>
                <div className="text-lg font-semibold text-blue-900">
                  {formatCurrency(metrics.materialCostPerPound)}/lb
                </div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(metrics.materialCostPerTon)}/ton
                </div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="text-xs text-gray-600 mb-1">Labor Cost</div>
                <div className="text-lg font-semibold text-green-900">
                  {formatCurrency(metrics.laborCostPerPound)}/lb
                </div>
                <div className="text-xs text-gray-500">
                  {formatCurrency(metrics.laborCostPerTon)}/ton
                </div>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                <div className="text-xs text-gray-600 mb-1">Labor Rate Efficiency</div>
                <div className="text-lg font-semibold text-purple-900">
                  {formatCurrency(metrics.costPerLaborHour)}/hr
                </div>
                <div className="text-xs text-gray-500">
                  Cost per labor hour
                </div>
              </div>
            </div>
          </div>

          {/* Production Efficiency */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              Production Efficiency Metrics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Pounds per Labor Hour</div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatNumber(metrics.poundsPerLaborHour, 0)} lbs/hr
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatNumber(metrics.tonsPerLaborHour, 2)} tons/hr
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Higher = more efficient production
                </div>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Surface Area per Pound</div>
                <div className="text-xl font-semibold text-gray-900">
                  {formatNumber(metrics.surfaceAreaPerPound, 3)} SF/lb
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatNumber(metrics.surfaceAreaPerTon, 0)} SF/ton
                </div>
                <div className="mt-2 text-xs text-gray-500 italic">
                  Higher = more coating surface area
                </div>
              </div>
            </div>
          </div>

          {/* Cost Distribution */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600" />
              Cost Distribution Analysis
            </h3>
            <div className="space-y-3">
              <div className="p-3 bg-white rounded-lg border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Material to Labor Ratio</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatNumber(metrics.materialToLaborRatio, 2)}:1
                  </span>
                </div>
                <div className="text-xs text-gray-500 italic">
                  Typical range: 0.8:1 to 2.5:1 (material:labor)
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-center">
                  <div className="text-xs text-gray-600 mb-1">Material</div>
                  <div className="text-lg font-bold text-blue-900">
                    {formatNumber(metrics.materialPercentage, 1)}%
                  </div>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-center">
                  <div className="text-xs text-gray-600 mb-1">Labor</div>
                  <div className="text-lg font-bold text-green-900">
                    {formatNumber(metrics.laborPercentage, 1)}%
                  </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200 text-center">
                  <div className="text-xs text-gray-600 mb-1">Coating</div>
                  <div className="text-lg font-bold text-purple-900">
                    {formatNumber(metrics.coatingPercentage, 1)}%
                  </div>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200 text-center">
                  <div className="text-xs text-gray-600 mb-1">Hardware</div>
                  <div className="text-lg font-bold text-orange-900">
                    {formatNumber(metrics.hardwarePercentage, 1)}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Validation Checklist */}
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              Quick Validation Checklist
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className={`p-3 rounded-lg border-2 ${
                metrics.costPerPound >= 1.50 && metrics.costPerPound <= 3.50
                  ? "bg-green-50 border-green-300"
                  : metrics.costPerPound > 0
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-gray-50 border-gray-300"
              }`}>
                <div className="flex items-center gap-2">
                  {metrics.costPerPound >= 1.50 && metrics.costPerPound <= 3.50 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    Cost per lb in typical range ($1.50-$3.50)
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-lg border-2 ${
                metrics.manHoursPerPound >= 0.001 && metrics.manHoursPerPound <= 0.005
                  ? "bg-green-50 border-green-300"
                  : metrics.manHoursPerPound > 0
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-gray-50 border-gray-300"
              }`}>
                <div className="flex items-center gap-2">
                  {metrics.manHoursPerPound >= 0.001 && metrics.manHoursPerPound <= 0.005 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    Man hours per lb in typical range (0.001-0.005)
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-lg border-2 ${
                metrics.materialToLaborRatio >= 0.8 && metrics.materialToLaborRatio <= 2.5
                  ? "bg-green-50 border-green-300"
                  : metrics.materialToLaborRatio > 0
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-gray-50 border-gray-300"
              }`}>
                <div className="flex items-center gap-2">
                  {metrics.materialToLaborRatio >= 0.8 && metrics.materialToLaborRatio <= 2.5 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    Material:Labor ratio typical (0.8:1 to 2.5:1)
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-lg border-2 ${
                metrics.margin >= 8 && metrics.margin <= 15
                  ? "bg-green-50 border-green-300"
                  : metrics.margin > 0
                  ? "bg-yellow-50 border-yellow-300"
                  : "bg-gray-50 border-gray-300"
              }`}>
                <div className="flex items-center gap-2">
                  {metrics.margin >= 8 && metrics.margin <= 15 ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  )}
                  <span className="text-xs font-medium text-gray-700">
                    Profit margin reasonable (8-15%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">Project Metrics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Weight</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatNumber(metrics.totalWeight, 0)} lbs
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Labor Hours</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatNumber(metrics.totalLaborHours, 1)} hrs
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Total Surface Area</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatNumber(metrics.totalSurfaceArea, 0)} SF
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Cost per Pound</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(metrics.costPerPound)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Cost per Labor Hour</span>
              <span className="text-sm font-semibold text-gray-900">
                {formatCurrency(metrics.costPerLaborHour)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">Risk Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-yellow-50 rounded">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                <span className="text-xs text-gray-700">Competition Level</span>
              </div>
              <span className="text-xs font-semibold text-yellow-700">
                {project.status === "active" ? "High" : "Medium"}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-700">Win Probability</span>
              </div>
              <span className="text-xs font-semibold text-blue-700">
                {project.probabilityOfWin || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-2 bg-green-50 rounded">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-700">Estimate Status</span>
              </div>
              <span className="text-xs font-semibold text-green-700 capitalize">
                {project.status || "Draft"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">Key Assumptions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-gray-600">
            <div className="flex items-start gap-2">
              <FileCheck className="w-3 h-3 mt-0.5 text-gray-400" />
              <span>Material waste factor: {formatNumber(financials.materialWasteFactor, 1)}%</span>
            </div>
            <div className="flex items-start gap-2">
              <FileCheck className="w-3 h-3 mt-0.5 text-gray-400" />
              <span>Labor waste factor: {formatNumber(financials.laborWasteFactor, 1)}%</span>
            </div>
            <div className="flex items-start gap-2">
              <FileCheck className="w-3 h-3 mt-0.5 text-gray-400" />
              <span>Overhead: {formatNumber(financials.overheadPercentage, 1)}%</span>
            </div>
            <div className="flex items-start gap-2">
              <FileCheck className="w-3 h-3 mt-0.5 text-gray-400" />
              <span>Profit margin: {formatNumber(financials.profitPercentage, 1)}%</span>
            </div>
            <div className="flex items-start gap-2">
              <FileCheck className="w-3 h-3 mt-0.5 text-gray-400" />
              <span>Based on {metrics.lineItemCount} active line items</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

