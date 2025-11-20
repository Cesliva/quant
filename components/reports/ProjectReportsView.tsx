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
  FileCheck,
  Shield,
  CheckCircle,
  FileText,
  Download,
  Plus,
  X,
  ChevronRight
} from "lucide-react";
import Button from "@/components/ui/Button";
import { subscribeToCollection, updateDocument, getDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SpecReviewSummary from "./SpecReviewSummary";
import {
  loadCompanySettings,
  loadProjectSettings,
  calculateTotalCostWithMarkup,
  getMaterialRateForGrade,
  getLaborRate,
  getCoatingRate,
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
    projectType?: string;
    projectTypeSubCategory?: string;
    status?: string;
    estimatedValue?: string | number;
    probabilityOfWin?: number;
    bidDueDate?: string;
    approvedBudget?: ApprovedBudget;
    budgetStatus?: "draft" | "under_review" | "approved";
  };
  onDataReady?: (data: {
    financials: ReportFinancials;
    metrics: any;
    buyouts: BuyoutItem[];
  }) => void;
}

interface CostCode {
  id: string;
  code: string; // e.g., "03-15-10.10" or "MAT-001"
  description: string;
  category: "Material" | "Labor" | "Coating" | "Hardware" | "Buyout" | "Overhead" | "Profit" | "Other";
}

interface ApprovedBudget {
  approvedAt: string; // ISO date string
  approvedBy?: string;
  version: number;
  // Financial snapshot
  materialCost: number;
  laborCost: number;
  coatingCost: number;
  hardwareCost: number;
  buyouts: number;
  subtotal: number;
  overheadPercentage: number;
  overheadAmount: number;
  profitPercentage: number;
  profitAmount: number;
  totalCost: number;
  materialWasteFactor: number;
  laborWasteFactor: number;
  // Metrics snapshot
  totalWeight: number;
  totalLaborHours: number;
  totalSurfaceArea: number;
  lineItemCount: number;
  // Cost codes for budget tracking
  costCodes: CostCode[];
  // Line items snapshot (for budget tracking)
  lineItems?: Array<{
    lineId: string;
    itemDescription: string;
    materialCost: number;
    laborCost: number;
    coatingCost: number;
    hardwareCost: number;
    totalCost: number;
    weight: number;
    laborHours: number;
    costCode?: string; // Optional cost code for this line item
  }>;
}

interface ReportFinancials {
  materialCost: number;
  laborCost: number;
  coatingCost: number;
  hardwareCost: number;
  buyouts: number; // Total buyouts/subcontractor costs
  subtotal: number;
  overheadPercentage: number;
  overheadAmount: number;
  profitPercentage: number;
  profitAmount: number;
  totalCost: number;
  materialWasteFactor: number;
  laborWasteFactor: number;
}

interface BuyoutItem {
  id: string;
  name: string;
  amount: number;
}

export default function ProjectReportsView({ companyId, projectId, project, onDataReady }: ProjectReportsViewProps) {
  const router = useRouter();
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
    buyouts: 0,
    subtotal: 0,
    overheadPercentage: 15,
    overheadAmount: 0,
    profitPercentage: 10,
    profitAmount: 0,
    totalCost: 0,
    materialWasteFactor: 5,
    laborWasteFactor: 10,
  });

  // Buyout items (subcontractor costs) - defined outside to avoid dependency issues
  const defaultBuyouts: BuyoutItem[] = [
    { id: "steel_detailing", name: "Steel Detailing", amount: 0 },
    { id: "metal_deck", name: "Metal Deck", amount: 0 },
    { id: "grating", name: "Grating", amount: 0 },
    { id: "engineering", name: "Engineering", amount: 0 },
    { id: "joist", name: "Joist", amount: 0 },
    { id: "misc_hardware", name: "Misc Hardware", amount: 0 },
    { id: "erection", name: "Erection", amount: 0 },
    { id: "bolting", name: "Bolting", amount: 0 },
    { id: "welding_inspection", name: "Welding Inspection", amount: 0 },
    { id: "other", name: "Other", amount: 0 },
  ];

  const [buyouts, setBuyouts] = useState<BuyoutItem[]>(defaultBuyouts);

  const [locks, setLocks] = useState({
    overheadPercentage: true,
    profitPercentage: true,
    materialWasteFactor: true,
    laborWasteFactor: true,
  });

  const [approvedBudget, setApprovedBudget] = useState<ApprovedBudget | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showCostCodeModal, setShowCostCodeModal] = useState(false);
  const [showCategoryDetailModal, setShowCategoryDetailModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"Material" | "Labor" | "Coating" | "Hardware" | "Buyouts" | null>(null);
  const [similarProjects, setSimilarProjects] = useState<any[]>([]);
  const [loadingSimilarProjects, setLoadingSimilarProjects] = useState(false);
  
  // Cost codes for budget
  const [costCodes, setCostCodes] = useState<CostCode[]>([
    { id: "mat", code: "", description: "Material", category: "Material" },
    { id: "lab", code: "", description: "Labor", category: "Labor" },
    { id: "coat", code: "", description: "Coating", category: "Coating" },
    { id: "hw", code: "", description: "Hardware", category: "Hardware" },
    { id: "buy", code: "", description: "Buyouts", category: "Buyout" },
    { id: "oh", code: "", description: "Overhead", category: "Overhead" },
    { id: "prof", code: "", description: "Profit", category: "Profit" },
  ]);

  // Formatting utilities (defined early for use throughout component)
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number, decimals: number = 2): string => {
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

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

      // Load approved budget and lock status if it exists
      const projectPath = getProjectPath(companyId, projectId);
      const projectData = await getDocument<{ 
        approvedBudget?: ApprovedBudget; 
        budgetStatus?: string; 
        buyouts?: BuyoutItem[];
        estimateSummaryLocked?: boolean;
        costCodes?: CostCode[];
      }>(projectPath);
      if (projectData?.approvedBudget) {
        setApprovedBudget(projectData.approvedBudget);
        setIsLocked(true);
        if (projectData.approvedBudget.costCodes && projectData.approvedBudget.costCodes.length > 0) {
          setCostCodes(projectData.approvedBudget.costCodes);
        }
      }
      if (projectData?.estimateSummaryLocked) {
        setIsLocked(true);
      }
      
      // Load saved buyouts if they exist
      if (projectData?.buyouts && Array.isArray(projectData.buyouts)) {
        // Merge saved buyouts with defaults (preserve defaults, add custom ones)
        const savedBuyoutIds = new Set(projectData.buyouts.map(b => b.id));
        const mergedBuyouts = [
          ...defaultBuyouts,
          ...projectData.buyouts.filter(b => !defaultBuyouts.some(db => db.id === b.id))
        ];
        setBuyouts(mergedBuyouts);
      }
      
      // Load cost codes (from budget or project level)
      if (projectData?.costCodes && projectData.costCodes.length > 0 && !projectData.approvedBudget?.costCodes) {
        setCostCodes(projectData.costCodes);
      }

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

  // Calculate total buyouts and update financials
  useEffect(() => {
    const totalBuyouts = buyouts.reduce((sum, item) => sum + (item.amount || 0), 0);
    setFinancials((prev) => ({
      ...prev,
      buyouts: totalBuyouts,
    }));
  }, [buyouts]);

  // Save buyouts to Firestore when they change (debounced)
  useEffect(() => {
    if (!isFirebaseConfigured() || isLocked) return;
    
    const saveTimeout = setTimeout(async () => {
      try {
        const projectPath = getProjectPath(companyId, projectId);
        // Only save custom buyouts (not defaults)
        const customBuyouts = buyouts.filter(b => b.id.startsWith("custom_") || 
          (b.amount > 0 && !defaultBuyouts.some(db => db.id === b.id)));
        
        // Save all buyouts (including defaults with amounts) for persistence
        await updateDocument(
          `companies/${companyId}/projects`,
          projectId,
          { buyouts: buyouts }
        );
      } catch (error) {
        console.error("Failed to save buyouts:", error);
      }
    }, 1000); // Debounce by 1 second

    return () => clearTimeout(saveTimeout);
  }, [buyouts, companyId, projectId, isLocked]);

  // Calculate financials from lines
  const calculatedFinancials = useMemo(() => {
    const activeLines = lines.filter((line) => line.status !== "Void");

    // Calculate costs for each line (recalculate from raw data to ensure accuracy)
    const lineCosts = activeLines.map((line) => {
      // Calculate total labor if not present
      let totalLabor = line.totalLabor || 0;
      if (!totalLabor) {
        totalLabor = 
          (line.laborUnload || 0) +
          (line.laborCut || 0) +
          (line.laborCope || 0) +
          (line.laborProcessPlate || 0) +
          (line.laborDrillPunch || 0) +
          (line.laborFit || 0) +
          (line.laborWeld || 0) +
          (line.laborPrepClean || 0) +
          (line.laborPaint || 0) +
          (line.laborHandleMove || 0) +
          (line.laborLoadShip || 0);
      }

      // Get rates (use stored or calculate from settings)
      const grade = line.materialType === "Material" ? line.grade : line.plateGrade;
      const materialRate = line.materialRate || 
        (projectSettings?.materialRate || getMaterialRateForGrade(grade, companySettings));
      const laborRate = line.laborRate || 
        (projectSettings?.laborRate || getLaborRate(undefined, companySettings));
      const coatingRate = line.coatingRate || 
        (projectSettings?.coatingRate || getCoatingRate(line.coatingSystem, companySettings));

      // Calculate total weight
      const totalWeight = line.materialType === "Material" 
        ? (line.totalWeight || 0)
        : (line.plateTotalWeight || 0);

      // Calculate surface area
      const surfaceArea = line.materialType === "Material"
        ? (line.totalSurfaceArea || 0)
        : (line.plateSurfaceArea || 0);

      // Calculate base costs (before waste/overhead/profit)
      const materialCost = totalWeight * materialRate;
      const laborCost = totalLabor * laborRate;
      const hardwareCost = (line.hardwareQuantity || 0) * (line.hardwareCostPerSet || 0);

      // Coating cost calculation
      let coatingCost = 0;
      const coatingSystem = line.coatingSystem || "None";
      if (coatingSystem === "Galvanizing") {
        coatingCost = totalWeight * coatingRate;
      } else if (coatingSystem === "Paint" || coatingSystem === "Powder Coat" || coatingSystem === "Specialty Coating") {
        coatingCost = surfaceArea * coatingRate;
      } else if (coatingSystem === "Standard Shop Primer" || coatingSystem === "Zinc Primer") {
        coatingCost = surfaceArea * coatingRate;
      }

      // Calculate line totalCost using the same method as estimating grid
      // This matches what's shown in the estimate summary
      const lineTotalCost = line.totalCost || calculateTotalCostWithMarkup(
        materialCost,
        laborCost,
        coatingCost,
        hardwareCost,
        companySettings || { markupSettings: { materialWasteFactor: 5, laborWasteFactor: 10, overheadPercentage: 15, profitPercentage: 10 }, coatingTypes: [] },
        projectSettings || undefined
      );

      return {
        materialCost,
        laborCost,
        coatingCost,
        hardwareCost,
        lineTotalCost,
      };
    });

    // Sum up all costs
    const materialCost = lineCosts.reduce((sum, costs) => sum + costs.materialCost, 0);
    const laborCost = lineCosts.reduce((sum, costs) => sum + costs.laborCost, 0);
    const coatingCost = lineCosts.reduce((sum, costs) => sum + costs.coatingCost, 0);
    const hardwareCost = lineCosts.reduce((sum, costs) => sum + costs.hardwareCost, 0);
    
    // Total cost is the sum of all line totalCosts + buyouts (matching estimate page)
    const baseTotalCost = lineCosts.reduce((sum, costs) => sum + costs.lineTotalCost, 0);
    // Buyouts are added after overhead/profit (they're subcontractor costs, not subject to markup)
    const totalCost = baseTotalCost + financials.buyouts;

    const subtotal = materialCost + laborCost + coatingCost + hardwareCost + financials.buyouts;

    // Apply waste factors (for display purposes in breakdown)
    const materialWithWaste = materialCost * (1 + financials.materialWasteFactor / 100);
    const laborWithWaste = laborCost * (1 + financials.laborWasteFactor / 100);
    const subtotalWithWaste = materialWithWaste + laborWithWaste + coatingCost + hardwareCost + financials.buyouts;

    // Calculate overhead and profit amounts from the totalCost
    // Reverse engineer to show breakdown
    const overheadAmount = subtotalWithWaste * (financials.overheadPercentage / 100);
    const subtotalWithOverhead = subtotalWithWaste + overheadAmount;
    const profitAmount = subtotalWithOverhead * (financials.profitPercentage / 100);

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
  }, [lines, financials.overheadPercentage, financials.profitPercentage, financials.materialWasteFactor, financials.laborWasteFactor, financials.buyouts, companySettings, projectSettings]);

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
    // Calculate total labor hours (sum individual labor fields if totalLabor is missing)
    const totalLaborHours = activeLines.reduce((sum, line) => {
      let lineLabor = line.totalLabor || 0;
      if (!lineLabor) {
        lineLabor = 
          (line.laborUnload || 0) +
          (line.laborCut || 0) +
          (line.laborCope || 0) +
          (line.laborProcessPlate || 0) +
          (line.laborDrillPunch || 0) +
          (line.laborFit || 0) +
          (line.laborWeld || 0) +
          (line.laborPrepClean || 0) +
          (line.laborPaint || 0) +
          (line.laborHandleMove || 0) +
          (line.laborLoadShip || 0);
      }
      return sum + lineLabor;
    }, 0);
    const totalSurfaceArea = activeLines.reduce((sum, line) => {
      if (line.materialType === "Material") {
        return sum + (line.totalSurfaceArea || 0);
      } else {
        return sum + (line.plateSurfaceArea || 0);
      }
    }, 0);

    // Profit margin = profit / (total cost - profit) = profit / subtotal with overhead
    // Or equivalently: profit / (totalCost - profitAmount) * 100
    const subtotalWithOverhead = financials.totalCost - financials.profitAmount;
    const margin = subtotalWithOverhead > 0
      ? ((financials.profitAmount / subtotalWithOverhead) * 100)
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

    // Strategic Financial Metrics for Competitive Advantage
    const breakEvenPrice = subtotalWithOverhead; // Minimum price to cover all costs (no profit)
    const discountCapacity = financials.profitAmount; // How much we can discount and still break even
    const discountCapacityPercent = financials.totalCost > 0 ? (discountCapacity / financials.totalCost) * 100 : 0;
    
    // ROI potential (if we win at this price)
    const estimatedValue = typeof project.estimatedValue === 'string' 
      ? parseFloat(project.estimatedValue) 
      : (project.estimatedValue || financials.totalCost);
    const roi = estimatedValue > 0 ? ((financials.profitAmount / estimatedValue) * 100) : 0;
    const winProbability = project.probabilityOfWin || 0;
    const expectedValue = (financials.profitAmount * winProbability) / 100; // Risk-adjusted profit
    
    // Cost structure efficiency
    const directCostPercentage = financials.subtotal > 0 ? (financials.subtotal / financials.totalCost) * 100 : 0;
    const overheadPercentageOfTotal = financials.totalCost > 0 ? (financials.overheadAmount / financials.totalCost) * 100 : 0;
    const profitPercentageOfTotal = financials.totalCost > 0 ? (financials.profitAmount / financials.totalCost) * 100 : 0;
    
    // Labor productivity metrics
    const laborProductivity = totalLaborHours > 0 ? totalWeight / totalLaborHours : 0; // lbs per hour
    const laborEfficiency = totalLaborHours > 0 ? financials.subtotal / totalLaborHours : 0; // $ per hour
    
    // Material utilization
    const materialEfficiency = totalWeight > 0 ? financials.materialCost / totalWeight : 0; // $ per lb material
    const wasteCost = financials.materialCost * (financials.materialWasteFactor / 100);
    
    // Competitive positioning
    const priceCompetitiveness = estimatedValue > 0 
      ? ((estimatedValue - financials.totalCost) / estimatedValue) * 100 
      : 0; // How much below/above estimated value
    const minimumViableBid = breakEvenPrice * 1.05; // 5% minimum profit buffer

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
      // Strategic Financial Metrics
      breakEvenPrice,
      discountCapacity,
      discountCapacityPercent,
      roi,
      expectedValue,
      directCostPercentage,
      overheadPercentageOfTotal,
      profitPercentageOfTotal,
      laborProductivity,
      laborEfficiency,
      materialEfficiency,
      wasteCost,
      priceCompetitiveness,
      minimumViableBid,
    };
  }, [lines, financials, project]);

  // Notify parent when data is ready
  useEffect(() => {
    if (onDataReady && calculatedFinancials && metrics) {
      onDataReady({
        financials: calculatedFinancials,
        metrics: metrics,
        buyouts: buyouts,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calculatedFinancials, metrics, buyouts]);

  // Handle unlock estimate summary
  const handleUnlockEstimateSummary = async () => {
    if (!confirm("Are you sure you want to unlock this estimate summary? This will allow editing but will NOT delete the approved budget. The budget will remain available for reference.")) {
      return;
    }

    try {
      const projectPath = getProjectPath(companyId, projectId);
      
      // Remove lock status but keep the approved budget for reference
      await updateDocument(`companies/${companyId}/projects`, projectId, {
        estimateSummaryLocked: false,
      });

      setIsLocked(false);
      alert("Estimate summary unlocked successfully. You can now make edits.");
    } catch (error: any) {
      console.error("Failed to unlock estimate summary:", error);
      alert(`Failed to unlock estimate summary: ${error.message}`);
    }
  };

  // Handle lock estimate summary and create budget
  const handleLockEstimateSummary = async () => {
    // Validate cost codes are filled
    const emptyCostCodes = costCodes.filter(cc => !cc.code || cc.code.trim() === "");
    if (emptyCostCodes.length > 0) {
      const missing = emptyCostCodes.map(cc => cc.description).join(", ");
      if (!confirm(`Some cost codes are missing: ${missing}\n\nDo you want to continue anyway? You can add cost codes later.`)) {
        return;
      }
    }

    if (!confirm("Are you sure you want to lock this estimate summary? Once locked, it cannot be changed and will create the official budget with cost codes for project management.")) {
      return;
    }

    setIsApproving(true);
    try {
      const projectPath = getProjectPath(companyId, projectId);
      
      // Create approved budget snapshot with cost codes
      const budgetSnapshot: ApprovedBudget = {
        approvedAt: new Date().toISOString(),
        version: (approvedBudget?.version || 0) + 1,
        materialCost: financials.materialCost,
        laborCost: financials.laborCost,
        coatingCost: financials.coatingCost,
        hardwareCost: financials.hardwareCost,
        buyouts: financials.buyouts,
        subtotal: financials.subtotal,
        overheadPercentage: financials.overheadPercentage,
        overheadAmount: financials.overheadAmount,
        profitPercentage: financials.profitPercentage,
        profitAmount: financials.profitAmount,
        totalCost: financials.totalCost,
        materialWasteFactor: financials.materialWasteFactor,
        laborWasteFactor: financials.laborWasteFactor,
        totalWeight: metrics.totalWeight,
        totalLaborHours: metrics.totalLaborHours,
        totalSurfaceArea: metrics.totalSurfaceArea,
        lineItemCount: metrics.lineItemCount,
        costCodes: costCodes, // Include cost codes in budget
        // Create line items snapshot for budget tracking
        lineItems: lines
          .filter(line => line.status !== "Void")
          .map(line => ({
            lineId: line.lineId || "",
            itemDescription: line.itemDescription || "",
            materialCost: line.materialCost || 0,
            laborCost: line.laborCost || 0,
            coatingCost: line.coatingCost || 0,
            hardwareCost: line.hardwareCost || 0,
            totalCost: line.totalCost || 0,
            weight: line.materialType === "Material" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0),
            laborHours: line.totalLabor || 0,
          })),
      };

      // Save to project document
      await updateDocument(`companies/${companyId}/projects`, projectId, {
        approvedBudget: budgetSnapshot,
        budgetStatus: "approved",
        estimateSummaryLocked: true,
        costCodes: costCodes,
      });

      setApprovedBudget(budgetSnapshot);
      setIsLocked(true);
      setShowCostCodeModal(false);
      alert("Estimate summary locked and budget created successfully!");
    } catch (error: any) {
      console.error("Failed to lock estimate summary:", error);
      alert(`Failed to lock estimate summary: ${error.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  // Export approved budget for PM use (Fortune 500 format)  
  const handleExportBudget = () => {
    if (!approvedBudget) {
      alert("No approved budget to export");
      return;
    }

    // Create CSV format suitable for PM budget tracking
    const csvRows: string[] = [];
    
    // Header
    csvRows.push("Project Budget Export");
    csvRows.push(`Project: ${project.projectName || projectId}`);
    csvRows.push(`Project Number: ${project.projectNumber || "N/A"}`);
    csvRows.push(`Approved Date: ${new Date(approvedBudget.approvedAt).toLocaleDateString()}`);
    csvRows.push(`Version: ${approvedBudget.version}`);
    csvRows.push("");
    
    // Cost Codes Section
    if (approvedBudget.costCodes && approvedBudget.costCodes.length > 0) {
      csvRows.push("COST CODES");
      csvRows.push("Category,Cost Code,Description");
      approvedBudget.costCodes.forEach(cc => {
        csvRows.push(`${cc.category},${cc.code || "N/A"},"${cc.description}"`);
      });
      csvRows.push("");
    }
    
    // Summary Section
    csvRows.push("SUMMARY");
    csvRows.push("Category,Cost Code,Amount");
    const getCostCode = (category: string) => {
      const cc = approvedBudget.costCodes?.find(c => c.category === category || c.description === category);
      return cc?.code || "";
    };
    csvRows.push(`Material Cost,${getCostCode("Material")},${formatCurrency(approvedBudget.materialCost)}`);
    csvRows.push(`Labor Cost,${getCostCode("Labor")},${formatCurrency(approvedBudget.laborCost)}`);
    csvRows.push(`Coating Cost,${getCostCode("Coating")},${formatCurrency(approvedBudget.coatingCost)}`);
    csvRows.push(`Hardware Cost,${getCostCode("Hardware")},${formatCurrency(approvedBudget.hardwareCost)}`);
    csvRows.push(`Buyouts,${getCostCode("Buyout")},${formatCurrency(approvedBudget.buyouts || 0)}`);
    csvRows.push(`Subtotal,,${formatCurrency(approvedBudget.subtotal)}`);
    csvRows.push(`Overhead (${approvedBudget.overheadPercentage}%),${getCostCode("Overhead")},${formatCurrency(approvedBudget.overheadAmount)}`);
    csvRows.push(`Profit (${approvedBudget.profitPercentage}%),${getCostCode("Profit")},${formatCurrency(approvedBudget.profitAmount)}`);
    csvRows.push(`TOTAL COST,,${formatCurrency(approvedBudget.totalCost)}`);
    csvRows.push("");
    
    // Metrics
    csvRows.push("METRICS");
    csvRows.push("Metric,Value");
    csvRows.push(`Total Weight (lbs),${formatNumber(approvedBudget.totalWeight, 0)}`);
    csvRows.push(`Total Weight (tons),${formatNumber(approvedBudget.totalWeight / 2000, 2)}`);
    csvRows.push(`Total Labor Hours,${formatNumber(approvedBudget.totalLaborHours, 1)}`);
    csvRows.push(`Total Surface Area (SF),${formatNumber(approvedBudget.totalSurfaceArea, 0)}`);
    csvRows.push(`Line Item Count,${approvedBudget.lineItemCount}`);
    csvRows.push("");
    
    // Line Items Detail (if available)
    if (approvedBudget.lineItems && approvedBudget.lineItems.length > 0) {
      csvRows.push("LINE ITEMS DETAIL");
      csvRows.push("Line ID,Description,Material Cost,Labor Cost,Coating Cost,Hardware Cost,Total Cost,Weight (lbs),Labor Hours");
      approvedBudget.lineItems.forEach(item => {
        csvRows.push([
          item.lineId,
          `"${item.itemDescription}"`,
          formatCurrency(item.materialCost),
          formatCurrency(item.laborCost),
          formatCurrency(item.coatingCost),
          formatCurrency(item.hardwareCost),
          formatCurrency(item.totalCost),
          formatNumber(item.weight, 0),
          formatNumber(item.laborHours, 2),
        ].join(","));
      });
    }
    
    // Download CSV
    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Budget_${project.projectNumber || projectId}_v${approvedBudget.version}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">Loading reports...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Estimate Summary Lock Status Banner */}
      {isLocked && approvedBudget ? (
        <Card className="border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardHeader className="bg-green-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-6 h-6" />
                <CardTitle className="text-xl">Estimate Summary Locked - Budget Created</CardTitle>
              </div>
              <div className="text-sm text-green-100">
                Locked {new Date(approvedBudget.approvedAt).toLocaleDateString()} • Version {approvedBudget.version}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Total Budget Cost</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(approvedBudget.totalCost)}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Profit Amount</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(approvedBudget.profitAmount)}
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Total Weight</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(approvedBudget.totalWeight, 0)} lbs
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="text-xs text-gray-600 mb-1">Line Items</div>
                <div className="text-2xl font-bold text-gray-900">
                  {approvedBudget.lineItemCount}
                </div>
              </div>
            </div>
            {approvedBudget.costCodes && approvedBudget.costCodes.length > 0 && (
              <div className="mb-4 p-3 bg-white rounded-lg border border-gray-200">
                <div className="text-xs font-semibold text-gray-700 mb-2">Cost Codes:</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {approvedBudget.costCodes.map((cc) => (
                    <div key={cc.id} className="flex items-center gap-1">
                      <span className="font-medium text-gray-900">{cc.code || "N/A"}</span>
                      <span className="text-gray-600">- {cc.description}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span>Estimate summary is locked. Budget with cost codes created for project management.</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleUnlockEstimateSummary}
                  variant="outline"
                  className="border-amber-500 text-amber-600 hover:bg-amber-50"
                  title="Unlock to make edits (budget will be preserved for reference)"
                >
                  <Unlock className="w-4 h-4 mr-2" />
                  Unlock
                </Button>
                <Button
                  onClick={handleExportBudget}
                  className="bg-green-600 text-white hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export Budget for PM
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardHeader className="bg-amber-600 text-white rounded-t-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-6 h-6" />
                <CardTitle className="text-xl">Draft Estimate Summary</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setShowCostCodeModal(true)}
                  disabled={isApproving}
                  className="bg-amber-500 text-white hover:bg-amber-400 font-semibold"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Set Cost Codes
                </Button>
                <Button
                  onClick={handleLockEstimateSummary}
                  disabled={isApproving}
                  className="bg-white text-amber-600 hover:bg-amber-50 font-semibold"
                >
                  {isApproving ? (
                    <>Processing...</>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Lock Estimate Summary
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <p className="text-sm text-amber-800">
              Review and adjust values below. Set cost codes, then click "Lock Estimate Summary" to create the official budget for project management.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cost Code Modal */}
      {showCostCodeModal && !isLocked && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader className="bg-blue-600 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Set Cost Codes for Budget</CardTitle>
                <button
                  onClick={() => setShowCostCodeModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-blue-100 mt-1">
                Enter cost codes for each category. These will be included in the budget for project management tracking.
              </p>
            </CardHeader>
            <CardContent className="p-6">
              <div className="space-y-4">
                {costCodes.map((costCode) => (
                  <div key={costCode.id} className="flex items-center gap-3">
                    <div className="w-32">
                      <label className="text-sm font-medium text-gray-700">
                        {costCode.description}:
                      </label>
                    </div>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={costCode.code}
                        onChange={(e) => {
                          setCostCodes((prev) =>
                            prev.map((cc) =>
                              cc.id === costCode.id ? { ...cc, code: e.target.value } : cc
                            )
                          );
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., 03-15-10.10 or MAT-001"
                      />
                    </div>
                    <div className="w-24 text-xs text-gray-500">
                      {costCode.category}
                    </div>
                  </div>
                ))}
                <div className="pt-4 border-t border-gray-200 flex justify-end gap-2">
                  <Button
                    onClick={() => setShowCostCodeModal(false)}
                    variant="outline"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={() => {
                      setShowCostCodeModal(false);
                      handleLockEstimateSummary();
                    }}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    Save & Lock Estimate Summary
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Detail Modal */}
      {showCategoryDetailModal && selectedCategory && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={(e) => {
            // Close modal if clicking on the overlay
            if (e.target === e.currentTarget) {
              setShowCategoryDetailModal(false);
              setSelectedCategory(null);
            }
          }}
        >
          <Card 
            className="w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="bg-blue-600 text-white rounded-t-lg flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  {selectedCategory === "Material" && <Package className="w-6 h-6" />}
                  {selectedCategory === "Labor" && <Users className="w-6 h-6" />}
                  {selectedCategory === "Coating" && <Paintbrush className="w-6 h-6" />}
                  {selectedCategory === "Hardware" && <Wrench className="w-6 h-6" />}
                  {selectedCategory === "Buyouts" && <Package className="w-6 h-6" />}
                  {selectedCategory} Cost Details
                </CardTitle>
                <button
                  onClick={() => {
                    setShowCategoryDetailModal(false);
                    setSelectedCategory(null);
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-2 text-sm text-blue-100">
                {selectedCategory === "Material" && `Total: ${formatCurrency(financials.materialCost)}`}
                {selectedCategory === "Labor" && `Total: ${formatCurrency(financials.laborCost)}`}
                {selectedCategory === "Coating" && `Total: ${formatCurrency(financials.coatingCost)}`}
                {selectedCategory === "Hardware" && `Total: ${formatCurrency(financials.hardwareCost)}`}
                {selectedCategory === "Buyouts" && `Total: ${formatCurrency(financials.buyouts)}`}
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto flex-1">
              {selectedCategory === "Buyouts" ? (
                // Buyouts detail view
                <div className="space-y-3">
                  {buyouts.filter(b => (b.amount || 0) > 0).length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No buyout items with costs
                    </div>
                  ) : (
                    buyouts
                      .filter(b => (b.amount || 0) > 0)
                      .map((buyout) => (
                        <div key={buyout.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900">{buyout.name}</div>
                            </div>
                            <div className="text-lg font-bold text-gray-900">
                              {formatCurrency(buyout.amount || 0)}
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              ) : (
                // Line items detail view for Material, Labor, Coating, Hardware
                <div className="space-y-2">
                  {(() => {
                    const activeLines = lines.filter(line => line.status !== "Void");
                    const categoryLines = activeLines.filter(line => {
                      if (selectedCategory === "Material") {
                        return (line.materialCost || 0) > 0;
                      } else if (selectedCategory === "Labor") {
                        return (line.laborCost || 0) > 0;
                      } else if (selectedCategory === "Coating") {
                        return (line.coatingCost || 0) > 0;
                      } else if (selectedCategory === "Hardware") {
                        return (line.hardwareCost || 0) > 0;
                      }
                      return false;
                    });

                    if (categoryLines.length === 0) {
                      return (
                        <div className="text-center py-8 text-gray-500">
                          No line items with {selectedCategory.toLowerCase()} costs
                        </div>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-100 border-b-2 border-gray-300">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-gray-700">Line ID</th>
                              <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-gray-700">Description</th>
                              <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-gray-700">Spec</th>
                              <th className="px-3 py-2 text-left font-semibold text-xs uppercase text-gray-700">Qty</th>
                              {selectedCategory === "Material" && (
                                <>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Weight (lbs)</th>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Rate</th>
                                </>
                              )}
                              {selectedCategory === "Labor" && (
                                <>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Hours</th>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Rate</th>
                                </>
                              )}
                              {selectedCategory === "Coating" && (
                                <>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Surface Area (SF)</th>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Rate</th>
                                </>
                              )}
                              {selectedCategory === "Hardware" && (
                                <>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Quantity</th>
                                  <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">Cost/Set</th>
                                </>
                              )}
                              <th className="px-3 py-2 text-right font-semibold text-xs uppercase text-gray-700">{selectedCategory} Cost</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryLines.map((line, index) => {
                              const categoryCost = 
                                selectedCategory === "Material" ? (line.materialCost || 0) :
                                selectedCategory === "Labor" ? (line.laborCost || 0) :
                                selectedCategory === "Coating" ? (line.coatingCost || 0) :
                                selectedCategory === "Hardware" ? (line.hardwareCost || 0) : 0;

                              return (
                                <tr 
                                  key={line.id || index} 
                                  className="border-b border-gray-200 hover:bg-blue-50 cursor-pointer transition-colors"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    // Close the modal first
                                    setShowCategoryDetailModal(false);
                                    setSelectedCategory(null);
                                    // Navigate to estimate page with lineId parameter
                                    if (line.id) {
                                      router.push(`/projects/${projectId}/estimating?lineId=${line.id}`);
                                    } else {
                                      console.warn("Line item missing id:", line);
                                    }
                                  }}
                                  title="Click to edit this line item in the estimate"
                                >
                                  <td className="px-3 py-2 text-gray-900 font-medium">{line.lineId || "-"}</td>
                                  <td className="px-3 py-2 text-gray-700">{line.itemDescription || "-"}</td>
                                  <td className="px-3 py-2 text-gray-600 text-xs">
                                    {line.materialType === "Material" 
                                      ? `${line.shapeType || ""} ${line.sizeDesignation || ""}`.trim() || "-"
                                      : line.materialType === "Plate"
                                      ? `${line.thickness || ""} × ${line.width || ""} × ${line.plateLength || ""}`.trim() || "-"
                                      : "-"}
                                  </td>
                                  <td className="px-3 py-2 text-gray-700">
                                    {line.materialType === "Plate" ? (line.plateQty || line.qty || 0) : (line.qty || 0)}
                                  </td>
                                  {selectedCategory === "Material" && (
                                    <>
                                      <td className="px-3 py-2 text-right text-gray-700">
                                        {formatNumber(line.materialType === "Material" ? (line.totalWeight || 0) : (line.plateTotalWeight || 0), 0)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600 text-xs">
                                        {line.materialRate ? formatCurrency(line.materialRate) : "-"}
                                      </td>
                                    </>
                                  )}
                                  {selectedCategory === "Labor" && (
                                    <>
                                      <td className="px-3 py-2 text-right text-gray-700">
                                        {formatNumber(line.totalLabor || 0, 2)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600 text-xs">
                                        {line.laborRate ? formatCurrency(line.laborRate) : "-"}
                                      </td>
                                    </>
                                  )}
                                  {selectedCategory === "Coating" && (
                                    <>
                                      <td className="px-3 py-2 text-right text-gray-700">
                                        {formatNumber(line.materialType === "Material" ? (line.totalSurfaceArea || 0) : (line.plateSurfaceArea || 0), 2)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600 text-xs">
                                        {line.coatingRate ? formatCurrency(line.coatingRate) : "-"}
                                      </td>
                                    </>
                                  )}
                                  {selectedCategory === "Hardware" && (
                                    <>
                                      <td className="px-3 py-2 text-right text-gray-700">
                                        {line.hardwareQuantity || 0}
                                      </td>
                                      <td className="px-3 py-2 text-right text-gray-600 text-xs">
                                        {line.hardwareCostPerSet ? formatCurrency(line.hardwareCostPerSet) : "-"}
                                      </td>
                                    </>
                                  )}
                                  <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                    {formatCurrency(categoryCost)}
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                              <td colSpan={selectedCategory === "Material" ? 6 : selectedCategory === "Labor" ? 6 : selectedCategory === "Coating" ? 6 : 6} className="px-3 py-3 text-right text-gray-900">
                                Total {selectedCategory} Cost:
                              </td>
                              <td className="px-3 py-3 text-right text-lg text-gray-900">
                                {formatCurrency(
                                  selectedCategory === "Material" ? financials.materialCost :
                                  selectedCategory === "Labor" ? financials.laborCost :
                                  selectedCategory === "Coating" ? financials.coatingCost :
                                  selectedCategory === "Hardware" ? financials.hardwareCost : 0
                                )}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              )}
            </CardContent>
            <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0 flex justify-end">
              <Button
                onClick={() => {
                  setShowCategoryDetailModal(false);
                  setSelectedCategory(null);
                }}
                variant="outline"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Executive Summary */}
      <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="bg-blue-600 text-white rounded-t-lg">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Target className="w-6 h-6" />
              Executive Summary
            </CardTitle>
            {(project.projectType || project.projectTypeSubCategory) && (
              <div className="flex items-center gap-2 text-sm">
                {project.projectType && (
                  <span className="px-3 py-1 bg-white/20 rounded-full font-medium">
                    {project.projectType}
                  </span>
                )}
                {project.projectTypeSubCategory && (
                  <span className="px-3 py-1 bg-white/10 rounded-full text-white/90">
                    {project.projectTypeSubCategory}
                  </span>
                )}
              </div>
            )}
          </div>
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

      {/* Similar Projects Comparison */}
      {project.projectType && similarProjects.length > 0 && (
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="bg-purple-600 text-white rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="w-6 h-6" />
              Similar Projects Comparison
            </CardTitle>
            <p className="text-sm text-purple-100 mt-1">
              Compare this estimate with similar {project.projectType} projects for strategic advantage
            </p>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              {similarProjects.map((similar) => (
                <div
                  key={similar.id}
                  className="p-4 bg-white rounded-lg border border-gray-200 hover:border-purple-300 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold text-gray-900">
                          {similar.projectNumber || ""} {similar.projectNumber && similar.projectName ? "- " : ""}
                          {similar.projectName}
                        </h4>
                        {similar.projectTypeSubCategory && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            {similar.projectTypeSubCategory}
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-xs text-gray-600">Budget Total</div>
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(similar.budget?.totalCost || 0)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Cost per Pound</div>
                          <div className="font-semibold text-gray-900">
                            {similar.budget?.totalWeight && similar.budget.totalWeight > 0
                              ? formatCurrency((similar.budget.totalCost || 0) / similar.budget.totalWeight)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Man Hours per Ton</div>
                          <div className="font-semibold text-gray-900">
                            {similar.budget?.totalWeight && similar.budget.totalWeight > 0
                              ? formatNumber(((similar.budget.totalLaborHours || 0) / similar.budget.totalWeight) * 2000, 2)
                              : "-"}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-600">Weight</div>
                          <div className="font-semibold text-gray-900">
                            {formatNumber(similar.budget?.totalWeight || 0, 0)} lbs
                          </div>
                        </div>
                      </div>
                    </div>
                    <Link
                      href={`/projects/${similar.id}/reports`}
                      className="ml-4 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                    >
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-600" />
            Cost Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Visual Cost Breakdown Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Cost Distribution Stacked Bar */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost Distribution</h3>
              <div className="space-y-4">
                <div className="text-center mb-4">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(financials.subtotal)}
                  </div>
                  <div className="text-xs text-gray-500">Total Subtotal</div>
                </div>
                {(() => {
                  const total = financials.subtotal || 1;
                  const costs = [
                    { label: "Material", value: financials.materialCost, color: "bg-blue-500", pct: (financials.materialCost / total) * 100 },
                    { label: "Labor", value: financials.laborCost, color: "bg-green-500", pct: (financials.laborCost / total) * 100 },
                    { label: "Coating", value: financials.coatingCost, color: "bg-purple-500", pct: (financials.coatingCost / total) * 100 },
                    { label: "Hardware", value: financials.hardwareCost, color: "bg-orange-500", pct: (financials.hardwareCost / total) * 100 },
                    { label: "Buyouts", value: financials.buyouts, color: "bg-indigo-500", pct: (financials.buyouts / total) * 100 },
                  ].filter(c => c.value > 0);
                  
                  return (
                    <>
                      <div className="w-full bg-gray-200 rounded-full h-8 overflow-hidden flex">
                        {costs.map((cost, index) => (
                          <div
                            key={cost.label}
                            className={`${cost.color} transition-all duration-500 flex items-center justify-center`}
                            style={{ width: `${cost.pct}%` }}
                            title={`${cost.label}: ${formatCurrency(cost.value)} (${formatNumber(cost.pct, 1)}%)`}
                          >
                            {cost.pct > 8 && (
                              <span className="text-xs text-white font-medium px-1">
                                {formatNumber(cost.pct, 1)}%
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-4">
                        {costs.map((cost) => (
                          <div key={cost.label} className="flex items-center justify-between text-xs p-2 bg-white rounded border border-gray-200">
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${cost.color}`}></div>
                              <span className="text-gray-700">{cost.label}</span>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-gray-900">{formatCurrency(cost.value)}</div>
                              <div className="text-gray-500">{formatNumber(cost.pct, 1)}%</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Cost Breakdown Bar Chart */}
            <div className="bg-gradient-to-br from-gray-50 to-white rounded-lg p-6 border border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Cost Comparison</h3>
              <div className="space-y-4">
                {(() => {
                  const maxCost = Math.max(
                    financials.materialCost,
                    financials.laborCost,
                    financials.coatingCost,
                    financials.hardwareCost,
                    financials.buyouts,
                    1
                  );
                  
                  const costs = [
                    { label: "Material", value: financials.materialCost, color: "bg-blue-500", icon: Package },
                    { label: "Labor", value: financials.laborCost, color: "bg-green-500", icon: Users },
                    { label: "Coating", value: financials.coatingCost, color: "bg-purple-500", icon: Paintbrush },
                    { label: "Hardware", value: financials.hardwareCost, color: "bg-orange-500", icon: Wrench },
                    { label: "Buyouts", value: financials.buyouts, color: "bg-indigo-500", icon: Package },
                  ];
                  
                  return costs.map(({ label, value, color, icon: Icon }) => {
                    const percentage = (value / maxCost) * 100;
                    return (
                      <div key={label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-gray-600" />
                            <span className="text-gray-700 font-medium">{label}</span>
                          </div>
                          <span className="text-gray-900 font-semibold">{formatCurrency(value)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`${color} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          {/* Direct Costs */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Direct Costs</h3>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setSelectedCategory("Material");
                  setShowCategoryDetailModal(true);
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Material Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(financials.materialCost)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency((calculatedFinancials as any).materialWithWaste)} with {formatNumber(financials.materialWasteFactor, 1)}% waste
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedCategory("Labor");
                  setShowCategoryDetailModal(true);
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Labor Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(financials.laborCost)}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatCurrency((calculatedFinancials as any).laborWithWaste)} with {formatNumber(financials.laborWasteFactor, 1)}% waste
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedCategory("Coating");
                  setShowCategoryDetailModal(true);
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Paintbrush className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-gray-700">Coating Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(financials.coatingCost)}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedCategory("Hardware");
                  setShowCategoryDetailModal(true);
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5 text-orange-600" />
                  <span className="text-sm font-medium text-gray-700">Hardware Cost</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(financials.hardwareCost)}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
              <button
                onClick={() => {
                  setSelectedCategory("Buyouts");
                  setShowCategoryDetailModal(true);
                }}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer w-full text-left"
              >
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">Buyouts (Subcontractors)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatCurrency(financials.buyouts)}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </div>
              </button>
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

          {/* Buyouts Section */}
          <div className="pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Buyouts & Subcontractor Costs</h3>
              {!approvedBudget && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    Editable - Add subcontractor costs
                  </span>
                  <Button
                    onClick={() => {
                      const newId = `custom_${Date.now()}`;
                      setBuyouts((prev) => [
                        ...prev,
                        { id: newId, name: "New Buyout", amount: 0 },
                      ]);
                    }}
                    size="sm"
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Category
                  </Button>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              {buyouts.map((buyout) => {
                const isCustom = buyout.id.startsWith("custom_");
                const isDefault = defaultBuyouts.some(db => db.id === buyout.id);
                const canDelete = isCustom && !isLocked;
                
                return (
                  <div key={buyout.id} className="flex items-center gap-2">
                    <div className="flex-1 flex items-center gap-2">
                      {isCustom && !isLocked ? (
                        <input
                          type="text"
                          value={buyout.name}
                          onChange={(e) => {
                            setBuyouts((prev) =>
                              prev.map((item) =>
                                item.id === buyout.id ? { ...item, name: e.target.value } : item
                              )
                            );
                          }}
                          className="flex-1 px-2 py-1 border rounded text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Category name"
                        />
                      ) : (
                        <label className="flex-1 text-xs font-medium text-gray-700">
                          {buyout.name}:
                        </label>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => {
                            setBuyouts((prev) => prev.filter((item) => item.id !== buyout.id));
                          }}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                          title="Remove this category"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">$</span>
                      <input
                        type="number"
                        value={buyout.amount || ""}
                        onChange={(e) => {
                          const newAmount = parseFloat(e.target.value) || 0;
                          setBuyouts((prev) =>
                            prev.map((item) =>
                              item.id === buyout.id ? { ...item, amount: newAmount } : item
                            )
                          );
                        }}
                        disabled={isLocked}
                        className={`w-full pl-6 pr-2 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          isLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white"
                        }`}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between p-3 bg-indigo-50 rounded-lg border-2 border-indigo-200">
              <span className="text-sm font-semibold text-gray-900">Total Buyouts</span>
              <div className="text-lg font-bold text-indigo-900">
                {formatCurrency(financials.buyouts)}
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

      {/* Strategic Financial Analysis */}
      <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white">
        <CardHeader className="bg-purple-600 text-white rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-6 h-6" />
            Strategic Financial Analysis
          </CardTitle>
          <p className="text-sm text-purple-100 mt-1">
            Competitive advantage metrics for bidding strategy
          </p>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Pricing Strategy */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              Pricing Strategy & Flexibility
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Break-Even Price</div>
                <div className="text-xl font-bold text-gray-900 mb-1">
                  {formatCurrency(metrics.breakEvenPrice)}
                </div>
                <div className="text-xs text-gray-500">
                  Minimum to cover all costs
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-blue-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Discount Capacity</div>
                <div className="text-xl font-bold text-blue-900 mb-1">
                  {formatCurrency(metrics.discountCapacity)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatNumber(metrics.discountCapacityPercent, 1)}% discount possible
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-amber-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Minimum Viable Bid</div>
                <div className="text-xl font-bold text-amber-900 mb-1">
                  {formatCurrency(metrics.minimumViableBid)}
                </div>
                <div className="text-xs text-gray-500">
                  5% minimum profit buffer
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-purple-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Price vs Estimated Value</div>
                <div className={`text-xl font-bold mb-1 ${
                  metrics.priceCompetitiveness > 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {metrics.priceCompetitiveness > 0 ? '-' : '+'}{formatNumber(Math.abs(metrics.priceCompetitiveness), 1)}%
                </div>
                <div className="text-xs text-gray-500">
                  {metrics.priceCompetitiveness > 0 ? 'Below' : 'Above'} estimated value
                </div>
              </div>
            </div>
          </div>

          {/* ROI & Expected Value */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-600" />
              Return on Investment Analysis
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-lg border-2 border-blue-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Potential ROI</div>
                <div className="text-2xl font-bold text-blue-900 mb-1">
                  {formatNumber(metrics.roi, 1)}%
                </div>
                <div className="text-xs text-gray-500">
                  If won at current price
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-purple-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Expected Value</div>
                <div className="text-2xl font-bold text-purple-900 mb-1">
                  {formatCurrency(metrics.expectedValue)}
                </div>
                <div className="text-xs text-gray-500">
                  Risk-adjusted profit ({project.probabilityOfWin || 0}% win prob)
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border-2 border-green-200 shadow-sm">
                <div className="text-xs text-gray-600 mb-1">Profit Potential</div>
                <div className="text-2xl font-bold text-green-900 mb-1">
                  {formatCurrency(financials.profitAmount)}
                </div>
                <div className="text-xs text-gray-500">
                  {formatNumber(metrics.profitPercentageOfTotal, 1)}% of total cost
                </div>
              </div>
            </div>
          </div>

          {/* Cost Structure Efficiency */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-amber-600" />
              Cost Structure Efficiency
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-xs text-gray-600 mb-3">Cost Distribution</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">Direct Costs</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatNumber(metrics.directCostPercentage, 1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${metrics.directCostPercentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">Overhead</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatNumber(metrics.overheadPercentageOfTotal, 1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-amber-500 h-2 rounded-full"
                      style={{ width: `${metrics.overheadPercentageOfTotal}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">Profit</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {formatNumber(metrics.profitPercentageOfTotal, 1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${metrics.profitPercentageOfTotal}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-white rounded-lg border border-gray-200">
                <div className="text-xs text-gray-600 mb-3">Productivity Metrics</div>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700">Labor Productivity</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatNumber(metrics.laborProductivity, 0)} lbs/hr
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatNumber(metrics.laborEfficiency, 0)} $/hr efficiency
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700">Material Efficiency</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(metrics.materialEfficiency)}/lb
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Waste cost: {formatCurrency(metrics.wasteCost)}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-700">Material:Labor Ratio</span>
                      <span className="text-sm font-semibold text-gray-900">
                        {formatNumber(metrics.materialToLaborRatio, 2)}:1
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {metrics.materialToLaborRatio >= 0.8 && metrics.materialToLaborRatio <= 2.5 
                        ? '✓ Typical range' 
                        : '⚠ Review structure'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Project Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">Project Summary</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <div className="text-xs text-gray-600 mb-2">Total Weight</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(metrics.totalWeight, 0)} lbs
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {formatNumber(metrics.totalWeight / 2000, 2)} tons
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-2">Total Labor Hours</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(metrics.totalLaborHours, 1)} hrs
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600 mb-2">Total Surface Area</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatNumber(metrics.totalSurfaceArea, 0)} SF
                </div>
              </div>
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-600 mb-2">Line Items</div>
                <div className="text-xl font-bold text-gray-900">
                  {metrics.lineItemCount}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">Risk & Probability</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-700">Win Probability</span>
              </div>
              <span className="text-lg font-bold text-blue-700">
                {project.probabilityOfWin || 0}%
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-600" />
                <span className="text-xs text-gray-700">Expected Value</span>
              </div>
              <span className="text-lg font-bold text-purple-700">
                {formatCurrency(metrics.expectedValue)}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-700">Estimate Status</span>
              </div>
              <span className="text-sm font-semibold text-green-700 capitalize">
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

      {/* AI Spec Review Summary */}
      <div className="mt-6">
        <SpecReviewSummary companyId={companyId} projectId={projectId} />
      </div>
    </div>
  );
}

