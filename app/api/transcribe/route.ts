import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    if (!openai) {
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Convert File to format OpenAI expects
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const blob = new Blob([buffer], { type: file.type });

    // Create File-like object for OpenAI
    const audioFile = new File([blob], file.name, { type: file.type });

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile as any,
      model: "whisper-1",
    });

    // Calculate cost: $0.006 per minute
    // Estimate duration from file size (rough approximation)
    const estimatedDuration = 1; // TODO: Calculate actual duration
    const cost = estimatedDuration * 0.006;

    return NextResponse.json({
      text: transcription.text,
      duration: estimatedDuration,
      cost,
    });
  } catch (error: any) {
    console.error("Transcription error:", error);
    return NextResponse.json(
      { error: error.message || "Transcription failed" },
      { status: 500 }
    );
  }
}

