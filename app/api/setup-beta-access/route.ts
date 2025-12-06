import { NextRequest, NextResponse } from "next/server";
import { setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

/**
 * Setup Beta Access Configuration
 * 
 * This API route initializes the beta access configuration in Firebase.
 * 
 * POST /api/setup-beta-access
 * 
 * Body (optional):
 * {
 *   enabled: boolean,      // false = require codes, true = optional
 *   codes: string[],       // Array of beta access codes
 *   message?: string       // Custom error message
 * }
 * 
 * If no body is provided, sets up a default closed beta configuration.
 */
export async function POST(request: NextRequest) {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    let config;
    try {
      const body = await request.json();
      config = body;
    } catch {
      // No body provided, use default configuration
      config = {
        enabled: false, // Require beta codes
        codes: ["BETA2024", "QUANT2024", "STEEL2024"],
        message: "Beta access code is required. Please contact support for access.",
      };
    }

    // Validate config structure
    if (typeof config.enabled !== "boolean") {
      return NextResponse.json(
        { error: "Invalid config: 'enabled' must be a boolean" },
        { status: 400 }
      );
    }

    if (!Array.isArray(config.codes)) {
      return NextResponse.json(
        { error: "Invalid config: 'codes' must be an array" },
        { status: 400 }
      );
    }

    // Set the beta access configuration in Firebase
    await setDocument("betaAccess/config", {
      enabled: config.enabled,
      codes: config.codes,
      message: config.message || (config.enabled === false 
        ? "Beta access code is required. Please contact support for access."
        : undefined),
    }, false);

    return NextResponse.json({
      success: true,
      message: "Beta access configuration created successfully",
      config: {
        enabled: config.enabled,
        codes: config.codes,
        message: config.message,
      },
    });
  } catch (error: any) {
    console.error("Setup beta access error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to setup beta access configuration" },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current beta access configuration
 */
export async function GET() {
  try {
    if (!isFirebaseConfigured()) {
      return NextResponse.json(
        { error: "Firebase is not configured" },
        { status: 500 }
      );
    }

    const { getDocument } = await import("@/lib/firebase/firestore");
    const config = await getDocument<{
      enabled: boolean;
      codes: string[];
      message?: string;
    }>("betaAccess/config");

    if (!config) {
      return NextResponse.json({
        exists: false,
        message: "Beta access configuration does not exist. Signups are open to everyone.",
      });
    }

    return NextResponse.json({
      exists: true,
      config: {
        enabled: config.enabled,
        codes: config.codes,
        message: config.message,
      },
    });
  } catch (error: any) {
    console.error("Get beta access error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get beta access configuration" },
      { status: 500 }
    );
  }
}

