import { NextRequest, NextResponse } from "next/server";
import { validateBetaCode, getBetaAccessConfig } from "@/lib/utils/betaAccessSecure";
import { getDocument } from "@/lib/firebase/firestore";
import crypto from "crypto";

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code.trim().toLowerCase()).digest("hex");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return NextResponse.json({ error: "Code is required" }, { status: 400 });
    }

    const codeHash = hashCode(code);
    const betaCode = await getDocument(`betaAccessCodes/${codeHash}`);
    const config = await getBetaAccessConfig();
    const validation = await validateBetaCode(code, "test-ip");

    return NextResponse.json({
      code,
      codeHash,
      found: !!betaCode,
      betaCode: betaCode ? {
        ...betaCode,
        expiresAt: betaCode.expiresAt ? {
          raw: betaCode.expiresAt,
          type: typeof betaCode.expiresAt,
          isObject: typeof betaCode.expiresAt === "object",
          hasToDate: typeof (betaCode.expiresAt as any)?.toDate === "function",
          hasSeconds: "seconds" in (betaCode.expiresAt || {}),
          seconds: (betaCode.expiresAt as any)?.seconds,
        } : null,
        isActive: betaCode.isActive,
        currentUses: betaCode.currentUses,
        maxUses: betaCode.maxUses,
      } : null,
      config,
      validation,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message, stack: error.stack },
      { status: 500 }
    );
  }
}

