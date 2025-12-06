import { NextRequest, NextResponse } from "next/server";
import { setDocument } from "@/lib/firebase/firestore";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Initialize Firebase on server side if not already initialized
function initializeFirebaseServer() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  
  if (!apiKey || apiKey.length < 10 || apiKey.includes("your_") || apiKey.includes("placeholder")) {
    return null;
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  try {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const db = getFirestore(app);
    return db;
  } catch (error) {
    console.error("Firebase server initialization error:", error);
    return null;
  }
}

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
    const db = initializeFirebaseServer();
    if (!db) {
      return NextResponse.json(
        { error: "Firebase is not configured. Please set valid Firebase credentials in .env.local" },
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
    const db = initializeFirebaseServer();
    if (!db) {
      return NextResponse.json(
        { error: "Firebase is not configured. Please set valid Firebase credentials in .env.local" },
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

