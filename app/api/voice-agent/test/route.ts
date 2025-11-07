import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Voice agent API test endpoint is working",
    openaiConfigured: !!process.env.OPENAI_API_KEY,
    timestamp: new Date().toISOString(),
  });
}

