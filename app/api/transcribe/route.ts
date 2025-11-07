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
    // In Next.js API routes (Node.js), we need to handle the file properly
    // Read the file as a stream or buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log("Received audio file:", {
      name: file.name,
      type: file.type,
      size: file.size,
      bufferSize: buffer.length,
    });

    let transcription;
    try {
      // Create a File object that works in Node.js environment
      // OpenAI SDK accepts File, but we need to ensure it's properly formatted
      const audioFile = new File(
        [buffer], 
        file.name || "audio.webm", 
        { type: file.type || "audio/webm" }
      );
      
      transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
      });
    } catch (apiError: any) {
      console.error("OpenAI API error:", {
        message: apiError.message,
        status: apiError.status,
        code: apiError.code,
        type: apiError.type,
        response: apiError.response?.data,
      });
      throw new Error(
        `OpenAI API error: ${apiError.message || "Connection error"}. ` +
        `Status: ${apiError.status || "unknown"}. ` +
        `Check your API key and network connection.`
      );
    }

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
    console.error("Error details:", {
      message: error.message,
      status: error.status,
      code: error.code,
      type: error.type,
    });
    return NextResponse.json(
      { 
        error: error.message || "Transcription failed",
        details: error.response?.data || error.cause || "Unknown error"
      },
      { status: error.status || 500 }
    );
  }
}

