/**
 * Centralized branding constants for Quant application
 * 
 * This file contains all branded terminology and visual identity used across the UI.
 * Import these constants instead of hardcoding branded strings or colors.
 */

/** Quant brand colors — blue + indigo gradient (matches app, login, dashboard) */
export const BRAND = {
  primary: "#3b82f6",      // blue-500
  primaryDark: "#2563eb",  // blue-600
  accent: "#6366f1",       // indigo-500
  gradient: "linear-gradient(135deg, #2563eb 0%, #6366f1 100%)",
  /** Light background gradient (body, auth pages) */
  bgGradient: "linear-gradient(to bottom right, #e0f2fe 0%, #f3e8ff 100%)",
  /** Dark overlay tints for hero/sections */
  glowBlue: "rgba(59, 130, 246, 0.15)",
  glowIndigo: "rgba(99, 102, 241, 0.12)",
} as const;

export const PRODUCT_SYSTEM_NAME = "Quant Intelligent Advantage™";
export const LABOR_FINGERPRINT_NAME = "Quant Labor Fingerprint™";
export const LABOR_FINGERPRINT_SHORT = "Labor Fingerprint";
export const TRADEMARK_SYMBOL = "™";

/**
 * Tooltip content for Labor Fingerprint visualization
 */
export const LABOR_FINGERPRINT_TOOLTIP = 
  "Bubble size = MH/T. Hover for category, MH/T, and % of total. Larger bubbles dominate total labor intensity.";

/**
 * Subtitle/description for Labor Fingerprint visualization
 */
export const LABOR_FINGERPRINT_SUBTITLE = 
  "A normalized MH/T visualization showing where labor is consumed across categories.";

/**
 * Help text for Labor Fingerprint (for AI Help or onboarding)
 */
export const LABOR_FINGERPRINT_HELP = 
  "The Quant Labor Fingerprint™ shows how man hours per ton are distributed across labor categories. " +
  "Larger bubbles indicate categories consuming more MH/T. Use this to spot welding dominance, compare categories, " +
  "and investigate outliers that may indicate inefficiencies or opportunities for optimization.";



