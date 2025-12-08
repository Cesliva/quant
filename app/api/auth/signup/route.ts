import { NextRequest, NextResponse } from "next/server";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { setDocument, getDocument } from "@/lib/firebase/firestore";
import { validateBetaCode, getBetaAccessConfig } from "@/lib/utils/betaAccessSecure";
import { validateEmail } from "@/lib/utils/validation";
import { generateVerificationCode, storeVerificationCode } from "@/lib/utils/emailVerification";
import { validateLicenseSerial, activateLicenseSerial, getLicenseConfig, type LicenseType } from "@/lib/utils/licenseSerial";

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

// Email sending function (shared with send-verification-code route)
async function sendVerificationEmail(email: string, code: string): Promise<boolean> {
  try {
    switch (EMAIL_SERVICE) {
      case "resend":
        return await sendViaResend(email, code);
      case "sendgrid":
        return await sendViaSendGrid(email, code);
      case "smtp":
        return await sendViaSMTP(email, code);
      case "console":
      default:
        // Development mode: just log to console
        console.log("=== EMAIL VERIFICATION CODE (Development Mode) ===");
        console.log(`To: ${email}`);
        console.log(`Subject: Verify your email address`);
        console.log(`Code: ${code}`);
        console.log("==========================================");
        return true;
    }
  } catch (error: any) {
    console.error("Email sending error:", error);
    throw error;
  }
}

async function sendViaResend(email: string, code: string): Promise<boolean> {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "noreply@quantsteel.com",
      to: email,
      subject: "Verify your email address - Quant Steel",
      html: generateVerificationEmailHTML(code),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email via Resend");
  }

  return true;
}

async function sendViaSendGrid(email: string, code: string): Promise<boolean> {
  const sendgridApiKey = process.env.SENDGRID_API_KEY;
  if (!sendgridApiKey) {
    throw new Error("SENDGRID_API_KEY not configured");
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sendgridApiKey}`,
    },
    body: JSON.stringify({
      personalizations: [
        {
          to: [{ email }],
        },
      ],
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || "noreply@quantsteel.com",
        name: "Quant Steel",
      },
      subject: "Verify your email address - Quant Steel",
      content: [
        {
          type: "text/html",
          value: generateVerificationEmailHTML(code),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Failed to send email via SendGrid");
  }

  return true;
}

async function sendViaSMTP(email: string, code: string): Promise<boolean> {
  throw new Error("SMTP email not yet implemented. Please use Resend or SendGrid.");
}

function generateVerificationEmailHTML(code: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify your email</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
  </div>
  
  <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Thank you for signing up for Quant Steel Estimating!</p>
    
    <p style="font-size: 16px; margin-bottom: 30px;">Please enter the following verification code to complete your registration:</p>
    
    <div style="background: #f3f4f6; border: 2px dashed #3b82f6; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
      <div style="font-size: 36px; font-weight: bold; color: #3b82f6; letter-spacing: 8px; font-family: 'Courier New', monospace;">
        ${code}
      </div>
    </div>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
      This code will expire in 10 minutes. If you didn't request this code, please ignore this email.
    </p>
    
    <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
      Need help? Contact us at <a href="mailto:support@quantsteel.com" style="color: #3b82f6;">support@quantsteel.com</a>
    </p>
  </div>
  
  <div style="text-align: center; margin-top: 20px; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} Quant Steel. All rights reserved.</p>
  </div>
</body>
</html>
  `;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, companyName, betaAccessCode, licenseSerial, marketingOptIn } = body;

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

    // Validate license serial if provided
    let licenseType: LicenseType | undefined;
    let licenseSerialHash: string | undefined;
    
    if (licenseSerial && licenseSerial.trim()) {
      const licenseValidation = await validateLicenseSerial(licenseSerial.trim());
      if (!licenseValidation.valid) {
        return NextResponse.json(
          { error: licenseValidation.error || "Invalid license serial key" },
          { status: 403 }
        );
      }
      licenseType = licenseValidation.type;
    }

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

    // Activate license if provided
    if (licenseSerial && licenseSerial.trim() && licenseType) {
      const activation = await activateLicenseSerial(licenseSerial.trim(), companyId);
      if (!activation.success) {
        return NextResponse.json(
          { error: activation.error || "Failed to activate license" },
          { status: 400 }
        );
      }
      if (activation.license) {
        licenseSerialHash = activation.license.serial;
      }
    }

    // Determine user role and permissions based on license type
    // Single-user: user gets admin role with full settings access
    // Multi-user: user gets admin role but settings access is restricted to admins only
    // No license: default to admin with full access (backward compatibility)
    const userRole = "admin"; // All signups get admin role initially
    const canAccessSettings = licenseType === "single-user" ? true : licenseType === "multi-user" ? false : true;

    // Create company document
    await setDocument(
      `companies/${companyId}`,
      {
        companyName,
        createdAt: new Date(),
        ownerId: user.uid,
        licenseType,
        licenseSerial: licenseSerialHash,
        needsSetup: licenseType === "multi-user", // Multi-user licenses need setup
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

    // Create user document with role based on license type
    await setDocument(
      `companies/${companyId}/members/${user.uid}`,
      {
        userId: user.uid,
        email,
        name,
        role: userRole,
        permissions: {
          canCreateProjects: true,
          canEditProjects: true,
          canDeleteProjects: true,
          canViewReports: true,
          canManageUsers: licenseType === "multi-user" ? true : true, // Multi-user: only admins can manage users
          canAccessSettings: canAccessSettings, // Single-user: yes, Multi-user: only admins
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
      licenseType,
      needsSetup: licenseType === "multi-user",
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

