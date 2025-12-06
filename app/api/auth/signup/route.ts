import { NextRequest, NextResponse } from "next/server";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { setDocument, getDocument } from "@/lib/firebase/firestore";

// Beta access codes - stored in Firebase for easy management
// To disable beta access, set enabled to false in Firebase
// To add/remove codes, update the codes array in Firebase
async function validateBetaAccess(betaCode: string | undefined): Promise<{ valid: boolean; error?: string }> {
  try {
    // Check if beta access is enabled
    const betaConfig = await getDocument<{
      enabled: boolean;
      codes: string[];
      message?: string;
    }>("betaAccess/config");

    // If no config exists, allow signups (open beta/public)
    if (!betaConfig) {
      return { valid: true };
    }

    // If beta access is disabled (enabled: false), require a code
    if (betaConfig.enabled === false) {
      if (!betaCode || betaCode.trim() === "") {
        return {
          valid: false,
          error: betaConfig.message || "Beta access code is required. Please contact support for access.",
        };
      }

      // Check if code is valid
      const validCodes = betaConfig.codes || [];
      const trimmedCode = betaCode.trim();
      if (!validCodes.includes(trimmedCode)) {
        return {
          valid: false,
          error: "Invalid beta access code. Please contact support for access.",
        };
      }
    }

    // If enabled is true or undefined, codes are optional - allow signup
    return { valid: true };
  } catch (error) {
    // If there's an error reading config, allow signup (fail open)
    console.warn("Error validating beta access, allowing signup:", error);
    return { valid: true };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, companyName, betaAccessCode } = body;

    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate beta access code if provided
    const betaValidation = await validateBetaAccess(betaAccessCode);
    if (!betaValidation.valid) {
      return NextResponse.json(
        { error: betaValidation.error },
        { status: 403 }
      );
    }

    if (!auth) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Generate company ID
    const companyId = crypto.randomUUID();

    // Create company document
    await setDocument(
      `companies/${companyId}`,
      {
        companyName,
        createdAt: new Date(),
        ownerId: user.uid,
        settings: {
          materialRate: 1.10,
          laborRate: 45.00,
          coatingTypes: [
            { type: "None", costPerSF: 0 },
            { type: "Galvanizing", costPerPound: 0.45 },
            { type: "Paint", costPerSF: 2.50 },
            { type: "Powder Coat", costPerSF: 3.00 },
          ],
        },
      },
      false
    );

    // Create user document
    await setDocument(
      `companies/${companyId}/members/${user.uid}`,
      {
        userId: user.uid,
        email,
        name,
        role: "admin",
        permissions: {
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewReports: true,
          canManageUsers: true,
        },
        status: "active",
        joinedAt: new Date(),
      },
      false
    );

    // Create user document with company reference
    await setDocument(
      `users/${user.uid}`,
      {
        email,
        name,
        company: companyId,
        createdAt: new Date(),
      },
      false
    );

    return NextResponse.json({
      success: true,
      userId: user.uid,
      companyId,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

