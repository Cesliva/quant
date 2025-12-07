/**
 * Email Verification Utilities
 * Handles email verification code generation, storage, and validation
 */

import { setDocument, getDocument, updateDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

export interface EmailVerificationCode {
  userId: string;
  email: string;
  code: string;
  expiresAt: Date;
  attempts: number;
  verified: boolean;
  createdAt: Date;
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Store verification code for a user
 */
export async function storeVerificationCode(
  userId: string,
  email: string,
  code: string
): Promise<void> {
  if (!isFirebaseConfigured()) {
    throw new Error("Firebase is not configured");
  }

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await setDocument(
    `emailVerifications/${userId}`,
    {
      userId,
      email: email.toLowerCase().trim(),
      code,
      expiresAt,
      attempts: 0,
      verified: false,
      createdAt: new Date(),
    },
    false
  );
}

/**
 * Verify email code
 */
export async function verifyEmailCode(
  userId: string,
  code: string
): Promise<{ valid: boolean; error?: string }> {
  if (!isFirebaseConfigured()) {
    return { valid: false, error: "Firebase is not configured" };
  }

  const verification = await getDocument<EmailVerificationCode>(
    `emailVerifications/${userId}`
  );

  if (!verification) {
    return { valid: false, error: "Verification code not found. Please request a new code." };
  }

  if (verification.verified) {
    return { valid: false, error: "Email already verified" };
  }

  // Check expiration
  const expiresAt = typeof verification.expiresAt === "string"
    ? new Date(verification.expiresAt)
    : verification.expiresAt;
  
  if (expiresAt < new Date()) {
    return { valid: false, error: "Verification code has expired. Please request a new code." };
  }

  // Check attempts (max 5 attempts)
  if (verification.attempts >= 5) {
    return { valid: false, error: "Too many failed attempts. Please request a new code." };
  }

  // Verify code
  if (verification.code !== code.trim()) {
    // Increment attempts
    await updateDocument(`emailVerifications`, userId, {
      attempts: (verification.attempts || 0) + 1,
    });
    return { valid: false, error: "Invalid verification code" };
  }

  // Mark as verified
  await updateDocument(`emailVerifications`, userId, {
    verified: true,
  });

  return { valid: true };
}

/**
 * Get verification status
 */
export async function getVerificationStatus(userId: string): Promise<{
  verified: boolean;
  email?: string;
  expiresAt?: Date;
}> {
  if (!isFirebaseConfigured()) {
    return { verified: false };
  }

  const verification = await getDocument<EmailVerificationCode>(
    `emailVerifications/${userId}`
  );

  if (!verification) {
    return { verified: false };
  }

  return {
    verified: verification.verified,
    email: verification.email,
    expiresAt: typeof verification.expiresAt === "string"
      ? new Date(verification.expiresAt)
      : verification.expiresAt,
  };
}

