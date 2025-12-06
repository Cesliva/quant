/**
 * Beta Access Code Management
 * 
 * This utility helps manage beta access codes stored in Firebase.
 * Beta codes are stored at: /betaAccess/config
 * 
 * Structure:
 * {
 *   enabled: boolean,  // If false, beta codes are REQUIRED. If true/undefined, codes are optional.
 *   codes: string[],   // Array of valid beta access codes
 *   message?: string   // Custom error message when code is required but missing
 * }
 */

import { setDocument, getDocument } from "@/lib/firebase/firestore";

export interface BetaAccessConfig {
  enabled: boolean;
  codes: string[];
  message?: string;
}

/**
 * Get current beta access configuration
 */
export async function getBetaAccessConfig(): Promise<BetaAccessConfig | null> {
  try {
    const config = await getDocument<BetaAccessConfig>("betaAccess/config");
    return config;
  } catch (error) {
    console.error("Failed to get beta access config:", error);
    return null;
  }
}

/**
 * Update beta access configuration
 * 
 * @param config - The beta access configuration
 * 
 * Examples:
 * 
 * // Require beta codes (closed beta)
 * await updateBetaAccessConfig({
 *   enabled: false,
 *   codes: ["BETA2024", "QUANT2024", "STEEL2024"],
 *   message: "Beta access code is required. Contact support@quant.com for access."
 * });
 * 
 * // Make codes optional (open beta)
 * await updateBetaAccessConfig({
 *   enabled: true,
 *   codes: ["BETA2024", "QUANT2024"],
 * });
 * 
 * // Disable beta requirement entirely (public signup)
 * await updateBetaAccessConfig({
 *   enabled: true,
 *   codes: [],
 * });
 */
export async function updateBetaAccessConfig(config: BetaAccessConfig): Promise<void> {
  try {
    await setDocument("betaAccess/config", config, false);
    console.log("Beta access config updated:", config);
  } catch (error) {
    console.error("Failed to update beta access config:", error);
    throw error;
  }
}

/**
 * Add a new beta access code
 */
export async function addBetaAccessCode(code: string): Promise<void> {
  const config = await getBetaAccessConfig();
  const currentCodes = config?.codes || [];
  
  if (currentCodes.includes(code)) {
    throw new Error(`Beta code "${code}" already exists`);
  }
  
  await updateBetaAccessConfig({
    enabled: config?.enabled ?? true,
    codes: [...currentCodes, code],
    message: config?.message,
  });
}

/**
 * Remove a beta access code
 */
export async function removeBetaAccessCode(code: string): Promise<void> {
  const config = await getBetaAccessConfig();
  const currentCodes = config?.codes || [];
  
  await updateBetaAccessConfig({
    enabled: config?.enabled ?? true,
    codes: currentCodes.filter(c => c !== code),
    message: config?.message,
  });
}

/**
 * Enable/disable beta access requirement
 */
export async function setBetaAccessRequired(required: boolean): Promise<void> {
  const config = await getBetaAccessConfig();
  
  await updateBetaAccessConfig({
    enabled: !required, // enabled: false means codes are REQUIRED
    codes: config?.codes || [],
    message: required 
      ? (config?.message || "Beta access code is required. Please contact support for access.")
      : config?.message,
  });
}

