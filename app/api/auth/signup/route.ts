import { NextRequest, NextResponse } from "next/server";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { setDocument, getDocument } from "@/lib/firebase/firestore";
import { validateBetaCode, getBetaAccessConfig } from "@/lib/utils/betaAccessSecure";
import { validateEmail } from "@/lib/utils/validation";
import { generateVerificationCode, storeVerificationCode } from "@/lib/utils/emailVerification";

// Email service configuration
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || "console";

// Initialize Firebase on server side for API routes
function getServerAuth() {
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
    return getAuth(app);
  } catch (error) {
    console.error("Firebase server initialization error:", error);
    return null;
  }
}

// Get client IP address from request
function getClientIP(request: NextRequest): string {
  // Check various headers for IP (handles proxies, load balancers, etc.)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  
  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  // Fallback to connection remote address (may not be available in serverless)
  return request.ip || "unknown";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, companyName, betaAccessCode, marketingOptIn } = body;

    if (!email || !password || !name || !companyName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate email format
    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: "Please enter a valid email address" },
        { status: 400 }
      );
    }

    // Validate beta access code using secure system
    const clientIP = getClientIP(request);
    const betaConfig = await getBetaAccessConfig();
    
    // If no config exists, allow signups (open beta/public)
    if (!betaConfig) {
      // No beta access system configured - allow signup
    } else if (betaConfig.enabled === false) {
      // Beta access is required
      if (!betaAccessCode || betaAccessCode.trim() === "") {
        return NextResponse.json(
          {
            error: betaConfig.message || "Beta access code is required. Please contact support for access.",
          },
          { status: 403 }
        );
      }

      // Validate the code using secure system
      const validation = await validateBetaCode(betaAccessCode.trim(), clientIP);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || "Invalid beta access code" },
          { status: 403 }
        );
      }
    }
    // If enabled is true, codes are optional - allow signup

    // Initialize Firebase Auth on server side
    const serverAuth = getServerAuth();
    if (!serverAuth) {
      return NextResponse.json(
        { error: "Firebase is not configured. Please set valid Firebase credentials in .env.local" },
        { status: 500 }
      );
    }

    // Create user account
    const userCredential = await createUserWithEmailAndPassword(serverAuth, email, password);
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

    // Create user document with company reference and marketing data
    await setDocument(
      `users/${user.uid}`,
      {
        email: email.toLowerCase().trim(),
        name,
        company: companyId,
        createdAt: new Date(),
        emailVerified: false,
        emailVerifiedAt: null,
        marketingOptIn: body.marketingOptIn !== false, // Default to true unless explicitly false
        signupSource: "web",
        signupDate: new Date(),
      },
      false
    );

    // Generate and store verification code
    const verificationCode = generateVerificationCode();
    try {
      await storeVerificationCode(user.uid, email, verificationCode);
      
      // Send verification email directly (don't wait for it to complete)
      sendVerificationEmail(email, verificationCode).catch((error) => {
        console.error("Failed to send verification email:", error);
        // Don't fail signup if email fails
      });
    } catch (error) {
      console.error("Failed to create verification code:", error);
      // Don't fail signup if verification code creation fails
    }

    return NextResponse.json({
      success: true,
      userId: user.uid,
      companyId,
      emailVerificationRequired: true,
      ...(process.env.EMAIL_SERVICE === "console" && { verificationCode }), // Return code in dev mode
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create account" },
      { status: 500 }
    );
  }
}

