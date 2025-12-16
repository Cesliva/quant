import { NextRequest, NextResponse } from "next/server";
import { getDocument, createDocument } from "@/lib/firebase/firestore";
import { serverTimestamp } from "firebase/firestore";

// Email service configuration
// Supports multiple email providers via environment variables
const EMAIL_SERVICE = process.env.EMAIL_SERVICE || "console"; // "console", "resend", "sendgrid", "smtp"

interface InviteRequest {
  companyId: string;
  email: string;
  role: "admin" | "estimator" | "viewer";
  invitedBy: string;
  companyName?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { companyId, email, role, invitedBy, companyName }: InviteRequest =
      await request.json();

    if (!companyId || !email || !role || !invitedBy) {
      return NextResponse.json(
        { error: "Missing required fields" },
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

    // Get company info
    let companyInfo = { companyName: companyName || "Your Company" };
    try {
      const companyDoc = await getDocument(`companies/${companyId}`);
      if (companyDoc?.companyInfo?.companyName) {
        companyInfo.companyName = companyDoc.companyInfo.companyName;
      }
    } catch (error) {
      console.warn("Could not fetch company info:", error);
    }

    // Create invitation token
    const invitationToken = `${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 15)}`;

    // Store invitation in Firestore
    const invitationPath = `companies/${companyId}/invitations`;
    await createDocument(invitationPath, {
      email: email.toLowerCase().trim(),
      role,
      invitedBy,
      invitationToken,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    // Generate invitation link
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const inviteLink = `${baseUrl}/invite/${invitationToken}`;

    // Send email based on configured service
    let emailSent = false;
    let emailError: string | null = null;

    try {
      switch (EMAIL_SERVICE) {
        case "resend":
          emailSent = await sendViaResend(email, inviteLink, companyInfo.companyName, role);
          break;
        case "sendgrid":
          emailSent = await sendViaSendGrid(email, inviteLink, companyInfo.companyName, role);
          break;
        case "smtp":
          emailSent = await sendViaSMTP(email, inviteLink, companyInfo.companyName, role);
          break;
        case "console":
        default:
          // Development mode: just log to console
          console.log("=== INVITATION EMAIL (Development Mode) ===");
          console.log(`To: ${email}`);
          console.log(`Subject: You've been invited to join ${companyInfo.companyName}`);
          console.log(`Link: ${inviteLink}`);
          console.log("==========================================");
          emailSent = true;
          break;
      }
    } catch (error: any) {
      console.error("Email sending error:", error);
      emailError = error.message;
      // Don't fail the invitation if email fails - it's stored in Firestore
    }

    return NextResponse.json({
      success: true,
      invitationToken,
      inviteLink,
      emailSent,
      emailError,
      message: emailSent
        ? "Invitation sent successfully"
        : "Invitation created but email failed to send",
    });
  } catch (error: any) {
    console.error("Invitation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create invitation" },
      { status: 500 }
    );
  }
}

// Email service implementations
async function sendViaResend(
  email: string,
  inviteLink: string,
  companyName: string,
  role: string
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
      from: process.env.RESEND_FROM_EMAIL || "noreply@example.com",
      to: email,
      subject: `You've been invited to join ${companyName}`,
      html: generateInviteEmailHTML(inviteLink, companyName, role),
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
  companyName: string,
  role: string
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
        email: process.env.SENDGRID_FROM_EMAIL || "noreply@example.com",
        name: companyName,
      },
      subject: `You've been invited to join ${companyName}`,
      content: [
        {
          type: "text/html",
          value: generateInviteEmailHTML(inviteLink, companyName, role),
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

async function sendViaSMTP(
  email: string,
  inviteLink: string,
  companyName: string,
  role: string
): Promise<boolean> {
  // For SMTP, you would use nodemailer or similar
  // This is a placeholder - implement based on your SMTP provider
  throw new Error("SMTP email not yet implemented. Please use Resend or SendGrid.");
}

function generateInviteEmailHTML(
  inviteLink: string,
  companyName: string,
  role: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">You've Been Invited!</h1>
      </div>
      <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px;">
        <p style="font-size: 16px;">You've been invited to join <strong>${companyName}</strong> as a <strong>${role}</strong>.</p>
        <p style="font-size: 16px;">Click the button below to accept the invitation and create your account:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteLink}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Accept Invitation</a>
        </div>
        <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
        <p style="font-size: 12px; color: #999; word-break: break-all;">${inviteLink}</p>
        <p style="font-size: 14px; color: #666; margin-top: 30px;">This invitation will expire in 7 days.</p>
      </div>
    </body>
    </html>
  `;
}

