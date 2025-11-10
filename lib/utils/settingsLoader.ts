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
}

export interface CompanySettings {
  companyInfo?: CompanyInfo;
  materialGrades: Array<{ grade: string; costPerPound: number }>;
  laborRates: Array<{ trade: string; rate: number }>;
  coatingTypes: Array<{ type: string; costPerSF: number }>;
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
    { type: "Galvanizing", costPerSF: 0.15 }, // Cost per pound (converted to SF equivalent for default)
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
        companyInfo: {
          ...DEFAULT_SETTINGS.companyInfo,
          ...company.settings.companyInfo,
        },
        laborRates: {
          ...DEFAULT_SETTINGS.laborRates,
          ...company.settings.laborRates,
        },
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
  
  return coating?.costPerSF || 0;
}

/**
 * Calculate total cost with overhead and profit
 */
export function calculateTotalCostWithMarkup(
  materialCost: number,
  laborCost: number,
  coatingCost: number,
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

  // Subtotal before overhead
  const subtotal = materialWithWaste + laborWithWaste + coatingCost;

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
export async function saveCompanySettings(
  companyId: string,
  settings: CompanySettings
): Promise<void> {
  if (!isFirebaseConfigured()) {
    console.warn("Firebase not configured - settings not saved");
    return;
  }

  try {
    const settingsPath = `companies/${companyId}/settings`;
    await setDocument(settingsPath, settings, true);
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
    await updateDocument(projectPath, projectId, { settings });
  } catch (error) {
    console.error("Failed to save project settings:", error);
    throw error;
  }
}

