/**
 * Settings Loader Utility
 * Loads and saves company and project default settings from Firestore
 */

import { getDocument, setDocument, updateDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export interface CompanyInfo {
  companyName: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  email?: string;
  licenseNumber?: string;
  taxId?: string;
  logoUrl?: string; // URL to company logo in Firebase Storage
}

export interface Estimator {
  id: string;
  name: string;
  weeklyCapacityHours: number;
  email?: string;
  active?: boolean;
}

export interface CompanySettings {
  companyInfo?: CompanyInfo;
  materialGrades: Array<{ grade: string; costPerPound: number }>;
  laborRates: Array<{ trade: string; rate: number }>;
  coatingTypes: Array<{ type: string; costPerSF?: number; costPerPound?: number }>;
  markupSettings: {
    overheadPercentage: number;
    profitPercentage: number;
    materialWasteFactor: number;
    laborWasteFactor: number;
    salesTaxRate: number;
    useTaxRate: number;
  };
  advancedSettings?: {
    defaultUnit: string;
    currencySymbol: string;
    stockRounding: number;
    defaultEstimator?: string;
    autoSave: boolean;
  };
  // Executive Dashboard Settings
  estimators?: Estimator[];
  fabricationBurnRateMonthly?: number; // Legacy: Monthly shop capacity in dollars (deprecated)
  shopCapacityHoursMonthly?: number; // Legacy: monthly capacity in hours (deprecated)
  // Hours-based backlog calculation
  shopCapacityHoursPerWeek?: number; // e.g. 800 hrs/week
  shopCapacityHoursPerDay?: number; // e.g. 100 hrs/day
  backlogForecastWeeks?: number; // e.g. 24 (≈ 6 months)
  underUtilizedThreshold?: number; // e.g. 0.7 → weeks < 70% used are "gaps"
  workingDays?: string[]; // e.g. ["mon","tue",...]
  holidays?: string[]; // ISO YYYY-MM-DD strings
  // Pipeline Distribution Settings
  pipelineRanges?: {
    small: { min: number; max: number }; // 0-50K
    medium: { min: number; max: number }; // 50K-100K
    large: { min: number; max: number }; // 100K-250K
    xlarge: { min: number; max: number }; // 250K-500K
    xxlarge: { min: number; max: number }; // 500K+
  };
}

export interface ProjectSettings {
  materialRate?: number; // Override company default
  laborRate?: number; // Override company default
  coatingRate?: number; // Override company default
  overheadPercentage?: number; // Override company default
  profitPercentage?: number; // Override company default
  laborRates?: Array<{ trade: string; rate: number }>; // Project-specific labor rates
}

const DEFAULT_SETTINGS: CompanySettings = {
  materialGrades: [
    { grade: "A36", costPerPound: 0.85 },
    { grade: "A572 Gr50", costPerPound: 1.15 },
    { grade: "A992", costPerPound: 1.05 },
    { grade: "A500 GrB", costPerPound: 1.20 },
    { grade: "A500 GrC", costPerPound: 1.25 },
    { grade: "A53", costPerPound: 1.10 },
  ],
  laborRates: [
    { trade: "Fabricator", rate: 45 },
    { trade: "Welder", rate: 55 },
    { trade: "Fitter", rate: 50 },
    { trade: "Painter", rate: 40 },
  ],
  coatingTypes: [
    { type: "None", costPerSF: 0 },
    { type: "Standard Shop Primer", costPerSF: 0.75 },
    { type: "Zinc Primer", costPerSF: 1.25 },
    { type: "Paint", costPerSF: 2.50 }, // Cost per gallon × coverage (typically 400 SF/gallon)
    { type: "Powder Coat", costPerSF: 3.50 }, // Cost per gallon × coverage
    { type: "Galvanizing", costPerPound: 0.15 }, // Cost per pound (default for galvanizing)
    { type: "Specialty Coating", costPerSF: 5.00 },
  ],
  markupSettings: {
    overheadPercentage: 15,
    profitPercentage: 10,
    materialWasteFactor: 5,
    laborWasteFactor: 10,
    salesTaxRate: 0,
    useTaxRate: 0,
  },
  shopCapacityHoursPerWeek: 0,
  shopCapacityHoursPerDay: 0,
  backlogForecastWeeks: 24,
  underUtilizedThreshold: 0.7,
  workingDays: ["mon", "tue", "wed", "thu", "fri"],
  holidays: [],
  pipelineRanges: {
    small: { min: 0, max: 50000 },
    medium: { min: 50000, max: 100000 },
    large: { min: 100000, max: 250000 },
    xlarge: { min: 250000, max: 500000 },
    xxlarge: { min: 500000, max: 999999999 },
  },
};

/**
 * Load company settings from Firestore
 */
export async function loadCompanySettings(companyId: string): Promise<CompanySettings> {
  if (!isFirebaseConfigured()) {
    return DEFAULT_SETTINGS;
  }

  try {
    // Settings should be a subcollection: companies/{companyId}/settings/{settingsId}
    // Or a field in the company document: companies/{companyId}
    // For now, use the company document itself and access settings field
    const companyPath = `companies/${companyId}`;
    const company = await getDocument<{ settings?: CompanySettings }>(companyPath);
    if (company?.settings) {
      return {
        ...DEFAULT_SETTINGS,
        ...company.settings,
        workingDays:
          company.settings.workingDays && company.settings.workingDays.length > 0
            ? company.settings.workingDays
            : DEFAULT_SETTINGS.workingDays,
        holidays: company.settings.holidays ?? DEFAULT_SETTINGS.holidays,
        companyInfo: {
          ...DEFAULT_SETTINGS.companyInfo,
          ...company.settings.companyInfo,
        },
        // Ensure arrays remain arrays (don't spread them as objects)
        materialGrades: Array.isArray(company.settings.materialGrades) && company.settings.materialGrades.length > 0
          ? company.settings.materialGrades
          : DEFAULT_SETTINGS.materialGrades,
        laborRates: Array.isArray(company.settings.laborRates) && company.settings.laborRates.length > 0
          ? company.settings.laborRates
          : DEFAULT_SETTINGS.laborRates,
        coatingTypes: Array.isArray(company.settings.coatingTypes) && company.settings.coatingTypes.length > 0
          ? company.settings.coatingTypes
          : DEFAULT_SETTINGS.coatingTypes,
        markupSettings: {
          ...DEFAULT_SETTINGS.markupSettings,
          ...company.settings.markupSettings,
        },
      };
    }
  } catch (error) {
    console.warn("Failed to load company settings, using defaults:", error);
  }

  return DEFAULT_SETTINGS;
}

/**
 * Load project settings from Firestore
 */
export async function loadProjectSettings(
  companyId: string,
  projectId: string
): Promise<ProjectSettings> {
  if (!isFirebaseConfigured()) {
    return {};
  }

  try {
    // Project settings should be a field in the project document
    const projectPath = `companies/${companyId}/projects/${projectId}`;
    const project = await getDocument<{ settings?: ProjectSettings }>(projectPath);
    return project?.settings || {};
  } catch (error) {
    console.warn("Failed to load project settings:", error);
    return {};
  }
}

/**
 * Get material rate for a specific grade
 */
export function getMaterialRateForGrade(
  grade: string | undefined,
  companySettings: CompanySettings
): number {
  if (!grade) {
    // Return average rate if no grade specified
    const avgRate = companySettings.materialGrades.reduce(
      (sum, g) => sum + g.costPerPound,
      0
    ) / companySettings.materialGrades.length;
    return avgRate;
  }

  const materialGrade = companySettings.materialGrades.find(
    (g) => g.grade.toUpperCase() === grade.toUpperCase()
  );
  
  return materialGrade?.costPerPound || companySettings.materialGrades[0]?.costPerPound || 0.85;
}

/**
 * Get labor rate (average of all trades or specific trade)
 */
export function getLaborRate(
  trade?: string,
  companySettings: CompanySettings
): number {
  // Ensure laborRates is an array
  if (!Array.isArray(companySettings.laborRates) || companySettings.laborRates.length === 0) {
    return 50; // Default rate
  }

  if (trade) {
    const laborRate = companySettings.laborRates.find(
      (r) => r.trade.toLowerCase() === trade.toLowerCase()
    );
    if (laborRate) return laborRate.rate;
  }

  // Return average labor rate
  const avgRate = companySettings.laborRates.reduce(
    (sum, r) => sum + r.rate,
    0
  ) / companySettings.laborRates.length;
  
  return avgRate || 50;
}

/**
 * Get coating rate for a specific coating type
 * Prefers costPerPound for galvanizing, falls back to costPerSF
 */
export function getCoatingRate(
  coatingType: string | undefined,
  companySettings: CompanySettings
): number {
  if (!coatingType || coatingType === "None") {
    return 0;
  }

  const coating = companySettings.coatingTypes.find(
    (c) => c.type.toLowerCase() === coatingType.toLowerCase()
  );
  
  if (!coating) return 0;
  
  // For galvanizing, prefer costPerPound, otherwise use costPerSF
  const isGalvanizing = coatingType.toLowerCase().includes("galv");
  if (isGalvanizing && coating.costPerPound !== undefined) {
    return coating.costPerPound;
  }
  
  return coating.costPerSF || 0;
}

/**
 * Calculate total cost with overhead and profit
 */
export function calculateTotalCostWithMarkup(
  materialCost: number,
  laborCost: number,
  coatingCost: number,
  hardwareCost: number = 0,
  companySettings: CompanySettings,
  projectSettings?: ProjectSettings
): number {
  // Apply waste factors
  const materialWasteFactor = projectSettings?.overheadPercentage !== undefined
    ? (projectSettings.overheadPercentage / 100)
    : (companySettings.markupSettings.materialWasteFactor / 100);
  
  const laborWasteFactor = projectSettings?.overheadPercentage !== undefined
    ? (projectSettings.overheadPercentage / 100)
    : (companySettings.markupSettings.laborWasteFactor / 100);

  const materialWithWaste = materialCost * (1 + materialWasteFactor);
  const laborWithWaste = laborCost * (1 + laborWasteFactor);

  // Subtotal before overhead (hardware cost added directly, no waste factor)
  const subtotal = materialWithWaste + laborWithWaste + coatingCost + hardwareCost;

  // Apply overhead
  const overheadPercentage = projectSettings?.overheadPercentage !== undefined
    ? projectSettings.overheadPercentage
    : companySettings.markupSettings.overheadPercentage;
  
  const withOverhead = subtotal * (1 + overheadPercentage / 100);

  // Apply profit
  const profitPercentage = projectSettings?.profitPercentage !== undefined
    ? projectSettings.profitPercentage
    : companySettings.markupSettings.profitPercentage;
  
  const withProfit = withOverhead * (1 + profitPercentage / 100);

  return withProfit;
}

/**
 * Save company settings to Firestore
 */
function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefined(item)) as T;
  }
  if (value && typeof value === "object") {
    const cleaned: Record<string, any> = {};
    Object.entries(value as Record<string, any>).forEach(([key, val]) => {
      if (val === undefined) return;
      cleaned[key] = removeUndefined(val);
    });
    return cleaned as T;
  }
  return value;
}

export async function saveCompanySettings(
  companyId: string,
  settings: CompanySettings
): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured - settings not saved");
    return;
  }

  try {
    const companyDocPath = `companies/${companyId}`;
    const cleanedSettings = removeUndefined(settings);

    await setDocument(
      companyDocPath,
      {
        settings: cleanedSettings,
      },
      true
    );
  } catch (error) {
    console.error("Failed to save company settings:", error);
    throw error;
  }
}

/**
 * Save project settings to Firestore
 */
export async function saveProjectSettings(
  companyId: string,
  projectId: string,
  settings: ProjectSettings
): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured - settings not saved");
    return;
  }

  try {
    // Project settings should be saved as a field in the project document
    const projectPath = `companies/${companyId}/projects`;
    const fullProjectPath = `${projectPath}/${projectId}`;
    
    // Check if project document exists
    const { getDocument, setDocument } = await import("@/lib/firebase/firestore");
    const existingProject = await getDocument(fullProjectPath);
    
    // Clean settings - remove undefined values
    const cleanedSettings: any = {};
    Object.keys(settings).forEach(key => {
      const value = settings[key as keyof ProjectSettings];
      if (value !== undefined) {
        cleanedSettings[key] = value;
      }
    });
    
    if (existingProject) {
      // Document exists, update it
      const { updateDocument } = await import("@/lib/firebase/firestore");
      await updateDocument(projectPath, projectId, { settings: cleanedSettings });
    } else {
      // Document doesn't exist, create it with settings
      await setDocument(fullProjectPath, { settings: cleanedSettings }, true);
    }
  } catch (error) {
    console.error("Failed to save project settings:", error);
    throw error;
  }
}

