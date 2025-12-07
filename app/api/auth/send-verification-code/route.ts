import { NextRequest, NextResponse } from "next/server";
import { generateVerificationCode, storeVerificationCode } from "@/lib/utils/emailVerification";
import { getDocument } from "@/lib/firebase/firestore";

// Email service configuration
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || "console";

/**
 * Generate and send email verification code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: "User ID and email are required" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Generate verification code
    const code = generateVerificationCode();

    // Store code
    await storeVerificationCode(userId, email, code);

    // Send email
    let emailSent = false;
    let emailError: string | null = null;

    try {
      switch (EMAIL_SERVICE) {
        case "resend":
          emailSent = await sendViaResend(email, code);
          break;
        case "sendgrid":
          emailSent = await sendViaSendGrid(email, code);
          break;
        case "smtp":
          emailSent = await sendViaSMTP(email, code);
          break;
        case "console":
        default:
          // Development mode: just log to console
          console.log("=== EMAIL VERIFICATION CODE (Development Mode) ===");
          console.log(`To: ${email}`);
          console.log(`Subject: Verify your email address`);
          console.log(`Code: ${code}`);
          console.log("==========================================");
          emailSent = true;
          break;
      }
    } catch (error: any) {
      console.error("Email sending error:", error);
      emailError = error.message;
    }

    return NextResponse.json({
      success: true,
      emailSent,
      ...(emailError && { emailError }),
      ...(EMAIL_SERVICE === "console" && { code }), // Return code in dev mode
    });
  } catch (error: any) {
    console.error("Send verification code error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to send verification code" },
      { status: 500 }
    );
  }
}

// Email service implementations
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
  // For SMTP, you would use nodemailer or similar
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

