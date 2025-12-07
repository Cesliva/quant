import { NextRequest, NextResponse } from "next/server";
import { verifyEmailCode } from "@/lib/utils/emailVerification";
import { updateDocument, getDocument } from "@/lib/firebase/firestore";

/**
 * Verify email verification code
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, code } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: "User ID and verification code are required" },
        { status: 400 }
      );
    }

    // Verify the code
    const verification = await verifyEmailCode(userId, code.trim());

    if (!verification.valid) {
      return NextResponse.json(
        { error: verification.error || "Invalid verification code" },
        { status: 400 }
      );
    }

    // Update user document to mark email as verified
    const userDoc = await getDocument(`users/${userId}`);
    if (userDoc) {
      await updateDocument("users", userId, {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      });
    }

    // Also update member document if exists
    if (userDoc?.company) {
      try {
        await updateDocument(
          `companies/${userDoc.company}/members`,
          userId,
          {
            emailVerified: true,
            emailVerifiedAt: new Date(),
          }
        );
      } catch (error) {
        // Member document might not exist yet, that's okay
        console.warn("Could not update member document:", error);
      }
    }

    return NextResponse.json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error: any) {
    console.error("Verify email error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to verify email" },
      { status: 500 }
    );
  }
}

