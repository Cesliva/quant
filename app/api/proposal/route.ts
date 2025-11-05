import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { calculateGPT4Cost } from "@/lib/openai/usageTracker";

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

    const { projectSummary, template } = await request.json();

    if (!projectSummary) {
      return NextResponse.json(
        { error: "Project summary is required" },
        { status: 400 }
      );
    }

    const prompt = `Generate a professional steel fabrication proposal based on the following project summary.
    ${template ? `Use this template style: ${template}` : ""}
    
    Project Summary:
    ${projectSummary}
    
    Generate a comprehensive proposal in Markdown format including:
    - Executive summary
    - Project scope
    - Materials and specifications
    - Labor and timeline
    - Pricing breakdown
    - Terms and conditions`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a professional proposal writer for steel fabrication projects. Generate clear, professional proposals in Markdown format.",
        },
        { role: "user", content: prompt },
      ],
    });

    const proposal = completion.choices[0].message.content || "";
    const tokens = completion.usage?.total_tokens || 0;
    const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");

    // TODO: Log usage (need companyId and projectId from request)
    // await logAIUsage(companyId, projectId, {
    //   type: "proposal",
    //   tokens,
    //   cost,
    //   input: projectSummary,
    //   output: proposal,
    // });

    return NextResponse.json({
      proposal,
      tokens,
      cost,
    });
  } catch (error: any) {
    console.error("Proposal generation error:", error);
    return NextResponse.json(
      { error: error.message || "Proposal generation failed" },
      { status: 500 }
    );
  }
}

