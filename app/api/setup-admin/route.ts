import { NextRequest, NextResponse } from "next/server";
import { createDefaultAdmin } from "@/lib/utils/createDefaultAdmin";

export async function POST(request: NextRequest) {
  try {
    const { companyId } = await request.json();
    const result = await createDefaultAdmin(companyId || "default");
    
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Setup admin error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to create admin user" },
      { status: 500 }
    );
  }
}

