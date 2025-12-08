/**
 * License Serial Key Management
 * Handles validation and management of license serial keys for beta testing
 */

import { getDocument, setDocument, updateDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import crypto from "crypto";

export type LicenseType = "single-user" | "multi-user";
export type LicenseStatus = "active" | "used" | "expired" | "revoked";

export interface LicenseSerial {
  serial: string; // Hashed serial key
  type: LicenseType;
  status: LicenseStatus;
  maxUses?: number; // undefined = unlimited
  currentUses: number;
  expiresAt?: Date | any; // Firestore Timestamp
  createdAt: Date | any;
  createdBy?: string;
  description?: string;
  companyId?: string; // Which company is using this license
  activatedAt?: Date | any;
}

export interface LicenseConfig {
  enabled: boolean; // false = licenses REQUIRED
  message?: string; // Custom error message
}

/**
 * Hash a serial key for storage
 */
function hashSerial(serial: string): string {
  return crypto.createHash("sha256").update(serial.trim().toUpperCase()).digest("hex");
}

/**
 * Generate a secure license serial key
 * Format: XXXX-XXXX-XXXX-XXXX (16 characters, alphanumeric)
 */
export function generateLicenseSerial(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars (0, O, I, 1)
  let serial = "";
  
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      serial += "-";
    }
    serial += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return serial;
}

/**
 * Create a new license serial
 */
export async function createLicenseSerial(
  type: LicenseType,
  options: {
    maxUses?: number;
    expiresInDays?: number;
    description?: string;
    createdBy?: string;
  } = {}
): Promise<{ serial: string; licenseSerial: LicenseSerial }> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const serial = generateLicenseSerial();
  const serialHash = hashSerial(serial);
  
  const expiresAt = options.expiresInDays
    ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000)
    : undefined;

  const licenseSerial: LicenseSerial = {
    serial: serialHash,
    type,
    status: "active",
    maxUses: options.maxUses,
    currentUses: 0,
    expiresAt,
    createdAt: new Date(),
    ...(options.createdBy && { createdBy: options.createdBy }),
    ...(options.description && { description: options.description }),
  };

  await setDocument(`licenseSerials/${serialHash}`, licenseSerial, false);

  return { serial, licenseSerial };
}

/**
 * Validate a license serial key
 */
export async function validateLicenseSerial(
  serial: string,
  companyId?: string
): Promise<{
  valid: boolean;
  error?: string;
  license?: LicenseSerial;
  type?: LicenseType;
}> {
  if (!isFirebaseConfigured()) {
    // Fail open in development if Firebase not configured
    return { valid: true, type: "multi-user" };
  }

  if (!serial || serial.trim() === "") {
    return { valid: false, error: "License serial key is required" };
  }

  const serialHash = hashSerial(serial);
  const license = await getDocument<LicenseSerial>(`licenseSerials/${serialHash}`);

  if (!license) {
    return { valid: false, error: "Invalid license serial key" };
  }

  // Check if license is active
  if (license.status !== "active") {
    return { valid: false, error: `This license serial key has been ${license.status}` };
  }

  // Check expiration
  if (license.expiresAt) {
    const expiresAt = license.expiresAt.seconds
      ? new Date(license.expiresAt.seconds * 1000)
      : new Date(license.expiresAt);
    if (expiresAt < new Date()) {
      return { valid: false, error: "This license serial key has expired" };
    }
  }

  // Check usage limits
  if (license.maxUses && license.currentUses >= license.maxUses) {
    return { valid: false, error: "This license serial key has reached its usage limit" };
  }

  // Check if already used by another company (for single-user licenses)
  if (license.type === "single-user" && license.companyId && license.companyId !== companyId) {
    return { valid: false, error: "This license serial key is already in use by another company" };
  }

  return {
    valid: true,
    license,
    type: license.type,
  };
}

/**
 * Activate a license serial for a company
 */
export async function activateLicenseSerial(
  serial: string,
  companyId: string
): Promise<{ success: boolean; error?: string; license?: LicenseSerial }> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const validation = await validateLicenseSerial(serial, companyId);
  if (!validation.valid || !validation.license) {
    return { success: false, error: validation.error || "Invalid license serial" };
  }

  const serialHash = hashSerial(serial);
  const license = validation.license;

  // Update license usage
  await updateDocument("licenseSerials", serialHash, {
    currentUses: (license.currentUses || 0) + 1,
    companyId,
    activatedAt: new Date(),
    status: license.type === "single-user" ? "used" : "active", // Single-user becomes "used", multi-user stays "active"
  });

  return { success: true, license };
}

/**
 * Get license configuration
 */
export async function getLicenseConfig(): Promise<LicenseConfig | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  try {
    const config = await getDocument<LicenseConfig>("licenseConfig/config");
    return config;
  } catch (error) {
    return null;
  }
}

/**
 * Get license for a company
 */
export async function getCompanyLicense(companyId: string): Promise<LicenseSerial | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  try {
    const company = await getDocument<{ licenseSerial?: string; license?: LicenseSerial }>(
      `companies/${companyId}`
    );

    if (company?.licenseSerial) {
      // Get license by serial hash
      const license = await getDocument<LicenseSerial>(`licenseSerials/${company.licenseSerial}`);
      return license || null;
    }

    if (company?.license) {
      return company.license;
    }

    return null;
  } catch (error) {
    console.error("Failed to get company license:", error);
    return null;
  }
}

