import { NextRequest, NextResponse } from "next/server";
import {
  createBetaCode,
  generateSecureCode,
  getAllBetaCodes,
  deactivateBetaCode,
  updateBetaAccessConfig,
  getBetaAccessConfig,
} from "@/lib/utils/betaAccessSecure";
import { isFirebaseConfigured } from "@/lib/firebase/config";

/**
 * GET /api/beta-codes
 * Get all beta codes (admin only - add auth check in production)
 */
export async function GET() {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured" },
      { status: 500 }
    );
  }

  try {
    const codes = await getAllBetaCodes();
    return NextResponse.json({ codes });
  } catch (error: any) {
    console.error("Failed to get beta codes:", error);
    return NextResponse.json(
      { error: error.message || "Failed to get beta codes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/beta-codes
 * Create a new beta code
 * 
 * Body:
 * {
 *   code?: string,           // Optional - if not provided, generates secure code
 *   maxUses?: number,        // Optional - undefined = unlimited
 *   expiresInDays?: number,  // Optional - undefined = never expires
 *   description?: string     // Optional description
 * }
 */
export async function POST(request: NextRequest) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const {
      code,
      maxUses,
      expiresInDays,
      description,
    } = body;

    // Generate code if not provided
    const finalCode = code || generateSecureCode();

    const betaCode = await createBetaCode(finalCode, {
      maxUses,
      expiresInDays,
      description,
    });

    return NextResponse.json({
      success: true,
      code: finalCode, // Return the plain code (only shown once)
      betaCode: {
        ...betaCode,
        codeHash: undefined, // Don't expose hash
      },
    });
  } catch (error: any) {
    console.error("Failed to create beta code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create beta code" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/beta-codes
 * Update beta access configuration or deactivate a code
 * 
 * Body:
 * {
 *   action: "deactivate" | "updateConfig",
 *   codeHash?: string,      // For deactivate action
 *   config?: {              // For updateConfig action
 *     enabled?: boolean,
 *     rateLimitAttempts?: number,
 *     rateLimitWindowMinutes?: number,
 *     lockoutDurationMinutes?: number,
 *     message?: string
 *   }
 * }
 */
export async function PATCH(request: NextRequest) {
  if (!isFirebaseConfigured()) {
    return NextResponse.json(
      { error: "Firebase is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { action, codeHash, config } = body;

    if (action === "deactivate" && codeHash) {
      await deactivateBetaCode(codeHash);
      return NextResponse.json({ success: true, message: "Code deactivated" });
    }

    if (action === "updateConfig" && config) {
      await updateBetaAccessConfig(config);
      return NextResponse.json({ success: true, message: "Config updated" });
    }

    return NextResponse.json(
      { error: "Invalid action or missing parameters" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Failed to update beta code:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update beta code" },
      { status: 500 }
    );
  }
}

