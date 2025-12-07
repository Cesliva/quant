/**
 * Secure Beta Access Code Management
 * 
 * Enhanced security features:
 * - Individual code documents with metadata
 * - Rate limiting to prevent brute force
 * - Code expiration dates
 * - Usage tracking (single-use or limited-use)
 * - IP-based lockout after failed attempts
 * - Hashed code storage
 */

import { getDocument, setDocument, updateDocument, getDocRef } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import crypto from "crypto";

export interface BetaCode {
  id: string; // Code itself (hashed for storage)
  codeHash: string; // SHA-256 hash of the code
  maxUses?: number; // undefined = unlimited, 1 = single-use, etc.
  currentUses: number; // How many times it's been used
  expiresAt?: Date | string; // When the code expires
  createdAt: Date | string;
  createdBy?: string; // Admin who created it
  isActive: boolean; // Can be disabled without deleting
  description?: string; // Optional description
}

export interface BetaAccessConfig {
  enabled: boolean; // false = codes REQUIRED, true = optional
  message?: string; // Custom error message
  rateLimitAttempts: number; // Max failed attempts before lockout
  rateLimitWindowMinutes: number; // Time window for rate limiting
  lockoutDurationMinutes: number; // How long to lockout after max attempts
}

export interface RateLimitRecord {
  ip: string;
  attempts: number;
  lastAttempt: Date | string;
  lockedUntil?: Date | string;
}

/**
 * Hash a code using SHA-256
 */
function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

/**
 * Generate a secure random code
 * Format: XXXX-XXXX-XXXX (12 characters, alphanumeric)
 */
export function generateSecureCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed confusing chars (0, O, I, 1)
  const segments = [4, 4, 4];
  
  return segments.map(segmentLength => {
    return Array.from({ length: segmentLength }, () => 
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  }).join("-");
}

/**
 * Create a new beta access code
 */
export async function createBetaCode(
  code: string,
  options: {
    maxUses?: number;
    expiresInDays?: number;
    description?: string;
    createdBy?: string;
  } = {}
): Promise<BetaCode> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const codeHash = hashCode(code);
  
  // Check if code already exists
  const existingCode = await getDocument<BetaCode>(`betaAccessCodes/${codeHash}`);
  if (existingCode) {
    throw new Error("A code with this value already exists");
  }

  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const betaCode: BetaCode = {
    id: codeHash,
    codeHash,
    maxUses: options.maxUses,
    currentUses: 0,
    expiresAt,
    createdAt: new Date(),
    isActive: true,
    // Only include optional fields if they have values
    ...(options.createdBy && { createdBy: options.createdBy }),
    ...(options.description && { description: options.description }),
  };

  // Use setDocument to create document with specific ID (codeHash)
  // Use flat collection structure: betaAccessCodes/{codeHash}
  await setDocument(`betaAccessCodes/${codeHash}`, betaCode, false);
  return betaCode;
}

/**
 * Validate a beta access code
 */
export async function validateBetaCode(
  code: string,
  ipAddress?: string
): Promise<{
  valid: boolean;
  error?: string;
  code?: BetaCode;
}> {
  if (!isFirebaseConfigured()) {
    // Fail open in development if Firebase not configured
    return { valid: true };
  }

  if (!code || code.trim() === "") {
    return { valid: false, error: "Beta access code is required" };
  }

  // Check rate limiting if IP provided
  if (ipAddress) {
    const rateLimitCheck = await checkRateLimit(ipAddress);
    if (!rateLimitCheck.allowed) {
      const minutesRemaining = rateLimitCheck.lockedUntil
        ? Math.ceil(
            (new Date(rateLimitCheck.lockedUntil).getTime() - Date.now()) / 60000
          )
        : 0;
      return {
        valid: false,
        error: `Too many failed attempts. Please try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
      };
    }
  }

  const codeHash = hashCode(code);

  // New collection path (preferred)
  let betaCode = await getDocument<BetaCode>(`betaAccessCodes/${codeHash}`);

  // Backward compatibility: check legacy path if not found
  if (!betaCode) {
    betaCode = await getDocument<BetaCode>(`betaAccess/codes/${codeHash}`);
  }

  if (!betaCode) {
    // Record failed attempt
    if (ipAddress) {
      await recordFailedAttempt(ipAddress);
    }
    return { valid: false, error: "Invalid beta access code" };
  }

  // Check if code is active
  if (!betaCode.isActive) {
    if (ipAddress) {
      await recordFailedAttempt(ipAddress);
    }
    return { valid: false, error: "This beta access code has been deactivated" };
  }

  // Check expiration
  if (betaCode.expiresAt) {
    let expiresAt: Date;
    const exp = betaCode.expiresAt;
    
    // Handle different Firestore Timestamp formats
    if (typeof exp === "string") {
      expiresAt = new Date(exp);
    } else if (exp && typeof exp === "object") {
      // Check for Firestore Timestamp methods
      if (typeof (exp as any).toDate === "function") {
        expiresAt = (exp as any).toDate();
      } else if (typeof (exp as any).toMillis === "function") {
        expiresAt = new Date((exp as any).toMillis());
      } else if ("seconds" in exp) {
        // Firestore Timestamp object format { seconds: number, nanoseconds: number }
        expiresAt = new Date((exp as any).seconds * 1000);
      } else if (exp instanceof Date) {
        expiresAt = exp;
      } else {
        // Try to parse as date string
        expiresAt = new Date(exp as any);
      }
    } else {
      expiresAt = exp as Date;
    }
    
    // Validate the date
    if (isNaN(expiresAt.getTime())) {
      console.warn("Invalid expiration date format:", betaCode.expiresAt);
      // Don't fail on invalid date format, just skip expiration check
    } else if (expiresAt < new Date()) {
      return { valid: false, error: "This beta access code has expired" };
    }
  }

  // Check usage limit
  if (betaCode.maxUses !== undefined && betaCode.currentUses >= betaCode.maxUses) {
    return { valid: false, error: "This beta access code has reached its usage limit" };
  }

  // Code is valid - increment usage
  await incrementCodeUsage(codeHash);

  // Clear rate limit on success
  if (ipAddress) {
    await clearRateLimit(ipAddress);
  }

  return { valid: true, code: betaCode };
}

/**
 * Increment code usage count
 */
async function incrementCodeUsage(codeHash: string): Promise<void> {
  // Prefer new collection
  const betaCode = await getDocument<BetaCode>(`betaAccessCodes/${codeHash}`);
  if (betaCode) {
    await updateDocument(`betaAccessCodes`, codeHash, {
      currentUses: (betaCode.currentUses || 0) + 1,
    });
    return;
  }

  // Fallback to legacy collection
  const legacyCode = await getDocument<BetaCode>(`betaAccess/codes/${codeHash}`);
  if (legacyCode) {
    await updateDocument(`betaAccess/codes`, codeHash, {
      currentUses: (legacyCode.currentUses || 0) + 1,
    });
  }
}

/**
 * Check rate limiting for an IP address
 */
async function checkRateLimit(ipAddress: string): Promise<{
  allowed: boolean;
  lockedUntil?: Date | string;
}> {
  const config = await getBetaAccessConfig();
  if (!config) {
    return { allowed: true };
  }

  const rateLimitId = ipAddress.replace(/[^a-zA-Z0-9]/g, "_");
  const rateLimit = await getDocument<RateLimitRecord>(`betaAccessRateLimits/${rateLimitId}`);

  if (!rateLimit) {
    return { allowed: true };
  }

  // Check if locked
  if (rateLimit.lockedUntil) {
    const lockedUntil = typeof rateLimit.lockedUntil === "string"
      ? new Date(rateLimit.lockedUntil)
      : rateLimit.lockedUntil;
    if (lockedUntil > new Date()) {
      return { allowed: false, lockedUntil: rateLimit.lockedUntil };
    }
    // Lockout expired, reset
    await clearRateLimit(ipAddress);
    return { allowed: true };
  }

  // Check if exceeded attempts
  if (rateLimit.attempts >= (config.rateLimitAttempts || 5)) {
    const lockoutDuration = (config.lockoutDurationMinutes || 15) * 60 * 1000;
    const lockedUntil = new Date(Date.now() + lockoutDuration);
    
    await updateDocument(`betaAccessRateLimits`, rateLimitId, {
      lockedUntil,
    });

    return { allowed: false, lockedUntil };
  }

  // Check time window
  const lastAttempt = typeof rateLimit.lastAttempt === "string"
    ? new Date(rateLimit.lastAttempt)
    : rateLimit.lastAttempt;
  const windowMinutes = config.rateLimitWindowMinutes || 15;
  const windowExpiry = new Date(lastAttempt.getTime() + windowMinutes * 60 * 1000);

  if (windowExpiry < new Date()) {
    // Window expired, reset attempts
    await clearRateLimit(ipAddress);
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Record a failed attempt
 */
async function recordFailedAttempt(ipAddress: string): Promise<void> {
  const rateLimitId = ipAddress.replace(/[^a-zA-Z0-9]/g, "_");
  const rateLimitKey = `betaAccessRateLimits/${rateLimitId}`;
  const existing = await getDocument<RateLimitRecord>(rateLimitKey) 
    || await getDocument<RateLimitRecord>(`betaAccess/rateLimits/${rateLimitId}`);

  if (existing) {
    await updateDocument(`betaAccessRateLimits`, rateLimitId, {
      attempts: (existing.attempts || 0) + 1,
      lastAttempt: new Date(),
    });
    // Also update legacy path for compatibility
    await updateDocument(`betaAccess/rateLimits`, rateLimitId, {
      attempts: (existing.attempts || 0) + 1,
      lastAttempt: new Date(),
    });
  } else {
    await setDocument(rateLimitKey, {
      ip: ipAddress,
      attempts: 1,
      lastAttempt: new Date(),
    }, false);
    // Also create legacy path for compatibility
    await setDocument(`betaAccess/rateLimits/${rateLimitId}`, {
      ip: ipAddress,
      attempts: 1,
      lastAttempt: new Date(),
    }, false);
  }
}

/**
 * Clear rate limit for an IP
 */
async function clearRateLimit(ipAddress: string): Promise<void> {
  const rateLimitId = ipAddress.replace(/[^a-zA-Z0-9]/g, "_");
  // Delete the rate limit record
  const { deleteDocument } = await import("@/lib/firebase/firestore");
  try {
    await deleteDocument(`betaAccessRateLimits`, rateLimitId);
  } catch (error) {
    // Ignore if doesn't exist
  }
}

/**
 * Get beta access configuration
 */
export async function getBetaAccessConfig(): Promise<BetaAccessConfig | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  try {
    const config = await getDocument<BetaAccessConfig>("betaAccess/config");
    return config || null;
  } catch (error) {
    console.warn("Failed to load beta access config:", error);
    return null;
  }
}

/**
 * Update beta access configuration
 */
export async function updateBetaAccessConfig(config: Partial<BetaAccessConfig>): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const existing = await getBetaAccessConfig();
  const updated: BetaAccessConfig = {
    enabled: config.enabled ?? existing?.enabled ?? false,
    message: config.message ?? existing?.message,
    rateLimitAttempts: config.rateLimitAttempts ?? existing?.rateLimitAttempts ?? 5,
    rateLimitWindowMinutes: config.rateLimitWindowMinutes ?? existing?.rateLimitWindowMinutes ?? 15,
    lockoutDurationMinutes: config.lockoutDurationMinutes ?? existing?.lockoutDurationMinutes ?? 15,
  };

  await updateDocument("betaAccess", "config", updated);
}

/**
 * Deactivate a beta code
 */
export async function deactivateBetaCode(codeHash: string): Promise<void> {
  await updateDocument(`betaAccessCodes`, codeHash, {
    isActive: false,
  });
}

/**
 * Get all beta codes (for admin management)
 */
export async function getAllBetaCodes(): Promise<BetaCode[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }

  try {
    const { collection, getDocs } = await import("firebase/firestore");
    const { db } = await import("@/lib/firebase/config");
    
    if (!db) return [];

    const codesRef = collection(db, "betaAccessCodes");
    const snapshot = await getDocs(codesRef);
    
    return snapshot.docs.map(doc => doc.data() as BetaCode);
  } catch (error) {
    console.error("Failed to get beta codes:", error);
    return [];
  }
}

