/**
 * Company Logo Utilities
 * Loads company logo from settings for use in documents
 */

import { loadCompanySettings } from "./settingsLoader";
import { isFirebaseConfigured } from "@/lib/firebase/config";

/**
 * Get company logo URL
 */
export async function getCompanyLogoUrl(companyId: string): Promise<string | null> {
  if (!isFirebaseConfigured() || !companyId || companyId === "default") {
    return null;
  }

  try {
    const settings = await loadCompanySettings(companyId);
    return settings.companyInfo?.logoUrl || null;
  } catch (error) {
    console.warn("Failed to load company logo:", error);
    return null;
  }
}

/**
 * Load logo as base64 for PDF generation
 * Note: This fetches the image and converts to base64
 * Works in browser context only (for PDF generation)
 */
export async function getCompanyLogoBase64(companyId: string): Promise<string | null> {
  // Only works in browser
  if (typeof window === "undefined") {
    return null;
  }

  const logoUrl = await getCompanyLogoUrl(companyId);
  if (!logoUrl) return null;

  try {
    // Fetch the image
    const response = await fetch(logoUrl);
    if (!response.ok) {
      return null;
    }
    
    const blob = await response.blob();
    
    // Convert to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn("Failed to convert logo to base64:", error);
    return null;
  }
}

