import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { logAIUsage, calculateGPT4Cost } from "@/lib/openai/usageTracker";

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

    const { specText, projectData } = await request.json();

    if (!specText) {
      return NextResponse.json(
        { error: "Specification text is required" },
        { status: 400 }
      );
    }

    const prompt = `Review the following steel fabrication specification and check for compliance issues. 
    Return a JSON object with:
    - items: array of {item: string, status: "pass"|"warning"|"fail", message: string}
    - rfiSuggestions: array of {title: string, description: string}
    
    Specification:
    ${specText}
    
    Project Data:
    ${JSON.stringify(projectData || {})}
    
    Return only valid JSON.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a steel fabrication specification compliance expert. Analyze specifications and return structured JSON results.",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    const tokens = completion.usage?.total_tokens || 0;
    const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");

    // TODO: Log usage (need companyId and projectId from request)
    // await logAIUsage(companyId, projectId, {
    //   type: "spec-review",
    //   tokens,
    //   cost,
    //   input: specText,
    //   output: JSON.stringify(result),
    // });

    return NextResponse.json({
      ...result,
      tokens,
      cost,
    });
  } catch (error: any) {
    console.error("Spec review error:", error);
    return NextResponse.json(
      { error: error.message || "Spec review failed" },
      { status: 500 }
    );
  }
}

