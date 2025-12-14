import { NextRequest, NextResponse } from "next/server";
import { createDocument, getDocument } from "@/lib/firebase/firestore";
import { serverTimestamp } from "firebase/firestore";

// Email service configuration
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || "console";

interface BetaInviteRequest {
  email: string;
  name?: string;
  companyName?: string;
  invitedBy?: string;
  expiresInDays?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { email, name, companyName, invitedBy, expiresInDays = 14 }: BetaInviteRequest =
      await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
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

    // Check if invitation already exists for this email
    try {
      const existingInvites = await getDocument("betaInvitations");
      // Note: In production, you'd query by email field
      // For now, we'll create a new invitation each time
    } catch (error) {
      // Collection doesn't exist yet, that's fine
    }

    // Create invitation token
    const invitationToken = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}-${Math.random().toString(36).substring(2, 10)}`;

    // Store invitation in Firestore
    await createDocument("betaInvitations", {
      email: email.toLowerCase().trim(),
      name: name || null,
      companyName: companyName || null,
      invitedBy: invitedBy || null,
      invitationToken,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000),
    });

    // Generate invitation link
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${baseUrl}/beta-signup/${invitationToken}`;

    // Send email
    let emailSent = false;
    let emailError: string | null = null;

    try {
      switch (EMAIL_SERVICE) {
        case "resend":
          emailSent = await sendViaResend(email, inviteLink, name || "there", companyName);
          break;
        case "sendgrid":
          emailSent = await sendViaSendGrid(email, inviteLink, name || "there", companyName);
          break;
        case "console":
        default:
          console.log("=== BETA TESTER INVITATION (Development Mode) ===");
          console.log(`To: ${email}`);
          console.log(`Subject: You're invited to beta test Quant Steel Estimating`);
          console.log(`Link: ${inviteLink}`);
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
      invitationToken,
      inviteLink,
      emailSent,
      emailError,
      message: emailSent
        ? "Beta invitation sent successfully"
        : "Invitation created but email failed to send",
    });
  } catch (error: any) {
    console.error("Beta invitation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create beta invitation" },
      { status: 500 }
    );
  }
}

async function sendViaResend(
  email: string,
  inviteLink: string,
  name: string,
  companyName?: string
): Promise<boolean> {
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
      subject: "You're invited to beta test Quant Steel Estimating",
      html: generateBetaInviteEmailHTML(inviteLink, name, companyName),
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to send email via Resend");
  }

  return true;
}

async function sendViaSendGrid(
  email: string,
  inviteLink: string,
  name: string,
  companyName?: string
): Promise<boolean> {
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
      subject: "You're invited to beta test Quant Steel Estimating",
      content: [
        {
          type: "text/html",
          value: generateBetaInviteEmailHTML(inviteLink, name, companyName),
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

function generateBetaInviteEmailHTML(
  inviteLink: string,
  name: string,
  companyName?: string
): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Beta Invitation - Quant Steel</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
  <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); padding: 40px 30px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">You're Invited to Beta Test</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Quant Steel Estimating</p>
    </div>
    
    <!-- Content -->
    <div style="padding: 40px 30px;">
      <p style="font-size: 16px; margin-bottom: 20px; color: #374151;">
        Hi ${name},
      </p>
      
      <p style="font-size: 16px; margin-bottom: 20px; color: #374151;">
        You've been invited to beta test <strong>Quant Steel Estimating</strong>, a professional estimating platform for structural steel projects.
      </p>
      
      ${companyName ? `<p style="font-size: 16px; margin-bottom: 20px; color: #374151;">Your workspace will be set up as: <strong>${companyName}</strong></p>` : ''}
      
      <p style="font-size: 16px; margin-bottom: 30px; color: #374151;">
        Click the button below to create your account and start testing:
      </p>
      
      <!-- CTA Button -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${inviteLink}" style="background: #3b82f6; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);">
          Accept Invitation & Create Account
        </a>
      </div>
      
      <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        <strong>What to expect:</strong>
      </p>
      <ul style="font-size: 14px; color: #6b7280; margin: 10px 0; padding-left: 20px;">
        <li>Create your account in under 2 minutes</li>
        <li>Full access to all features during beta</li>
        <li>Your own workspace to test with</li>
        <li>Direct feedback channel to our team</li>
      </ul>
      
      <p style="font-size: 14px; color: #9ca3af; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
        This invitation link will expire in 14 days. If you have any questions, reply to this email.
      </p>
    </div>
    
    <!-- Footer -->
    <div style="background: #f9fafb; padding: 20px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0;">
        © ${new Date().getFullYear()} Quant Steel. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}


