import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { calculateGPT4Cost } from "@/lib/openai/usageTracker";

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null;

interface EstimatingLine {
  lineId?: string;
  itemDescription?: string;
  category?: string;
  subCategory?: string;
  materialType?: "Rolled" | "Plate";
  shapeType?: string;
  sizeDesignation?: string;
  grade?: string;
  qty?: number;
  lengthFt?: number;
  lengthIn?: number;
  thickness?: number;
  width?: number;
  plateLength?: number;
  plateQty?: number;
  plateGrade?: string;
  coatingSystem?: string;
  laborUnload?: number;
  laborCut?: number;
  laborCope?: number;
  laborProcessPlate?: number;
  laborDrillPunch?: number;
  laborFit?: number;
  laborWeld?: number;
  laborPrepClean?: number;
  laborPaint?: number;
  laborHandleMove?: number;
  laborLoadShip?: number;
  drawingNumber?: string;
  detailNumber?: string;
  notes?: string;
}

interface VoiceAgentResponse {
  action: "create" | "update" | "delete" | "query" | "unknown";
  lineId?: string;
  data?: Partial<EstimatingLine>;
  message: string;
  confidence: number;
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== Voice agent API called ===");
    console.log("OpenAI initialized:", !!openai);
    console.log("API key exists:", !!process.env.OPENAI_API_KEY);
    
    if (!openai) {
      console.error("OpenAI not initialized - API key missing");
      const errorMsg = process.env.OPENAI_API_KEY 
        ? "OpenAI API key is set but OpenAI client failed to initialize"
        : "OpenAI API key not configured in environment variables";
      return NextResponse.json(
        { 
          error: errorMsg,
          message: errorMsg,
          action: "unknown",
          confidence: 0
        },
        { status: 500 }
      );
    }

    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError: any) {
      console.error("Failed to parse request body:", parseError);
      return NextResponse.json(
        { 
          error: "Invalid request body",
          message: parseError.message,
          action: "unknown",
          confidence: 0
        },
        { status: 400 }
      );
    }

    const { 
      userMessage, 
      existingLines = [], 
      conversationHistory = [] 
    } = requestBody;

    console.log("Received request:", { 
      userMessage, 
      existingLinesCount: existingLines?.length || 0,
      conversationHistoryLength: conversationHistory?.length || 0
    });

    if (!userMessage || typeof userMessage !== 'string') {
      return NextResponse.json(
        { 
          error: "User message is required and must be a string",
          message: "User message is required and must be a string",
          action: "unknown",
          confidence: 0
        },
        { status: 400 }
      );
    }

    // Build context about existing lines
    const linesContext = existingLines?.length > 0
      ? `\n\nExisting lines:\n${existingLines.map((line: any) => 
          `- ${line.lineId || 'N/A'}: ${line.itemDescription || 'No description'} | ${line.sizeDesignation || 'No size'} | Qty: ${line.qty || 0}`
        ).join('\n')}`
      : "\n\nNo existing lines yet.";

    const systemPrompt = `You are an AI assistant for a steel fabrication estimating system. Your job is to understand natural language commands and convert them into structured data operations.

Available actions:
1. CREATE - Add a new line item (e.g., "Add a column W12x14, 5 pieces, 20 feet")
2. UPDATE - Modify an existing line (e.g., "Change line 3 quantity to 6", "Update L2, make it 25 feet")
3. DELETE - Remove a line (e.g., "Delete line 5", "Remove L3")
4. QUERY - Ask about data (e.g., "What's on line 2?", "Show me all columns")

Line ID formats: "L3", "line 3", "line id 3", "line number 3"

Field mappings:
- Item/Description: itemDescription
- Category: category (Columns, Beams, Misc Metals, Plates)
- Sub-Category: subCategory (Base Plate, Gusset, Stiffener, etc.)
- Type/Shape: shapeType (W, HSS, C, L, T)
- Spec/Size: sizeDesignation (e.g., W12x14, HSS 6x6x1/4)
- Grade: grade (A992, A572 Gr50, etc.)
- Quantity/Qty: qty
- Length: lengthFt (feet) and lengthIn (inches)
- Labor fields: laborWeld, laborCut, laborFit, laborHandleMove, etc. (in hours)

Material types:
- "Rolled" for shapes like W, HSS, C, L, T
- "Plate" for plate materials

Shape type mappings:
- "Wide Flange", "W shape", "W" → "W"
- "HSS", "Tube" → "HSS"
- "Channel", "C shape" → "C"
- "Angle", "L shape" → "L"
- "Tee", "T shape" → "T"

Return a JSON object with this structure:
{
  "action": "create" | "update" | "delete" | "query" | "unknown",
  "lineId": "L3" (if applicable),
  "data": { ... field updates ... },
  "message": "Human-readable response to the user",
  "confidence": 0.0-1.0
}

Examples:
User: "Add a column, W12x14, 5 pieces, 20 feet each"
Response: {
  "action": "create",
  "data": {
    "itemDescription": "Column",
    "category": "Columns",
    "shapeType": "W",
    "sizeDesignation": "W12X14",
    "qty": 5,
    "lengthFt": 20,
    "materialType": "Rolled"
  },
  "message": "Creating new column line: W12x14, 5 pieces, 20 feet each",
  "confidence": 0.95
}

User: "Update line 3, change quantity to 6"
Response: {
  "action": "update",
  "lineId": "L3",
  "data": { "qty": 6 },
  "message": "Updating line L3: changing quantity to 6",
  "confidence": 0.98
}

User: "Delete line 5"
Response: {
  "action": "delete",
  "lineId": "L5",
  "message": "Deleting line L5",
  "confidence": 0.99
}

User: "What's on line 2?"
Response: {
  "action": "query",
  "lineId": "L2",
  "message": "Line L2 contains: [description from existing lines]",
  "confidence": 0.95
}

Always return valid JSON only. Be confident and accurate.`;

    const userPrompt = `${userMessage}${linesContext}`;

    console.log("Calling OpenAI API...");
    console.log("User prompt length:", userPrompt.length);
    console.log("System prompt length:", systemPrompt.length);
    console.log("User message:", userMessage);
    
    let completion;
    try {
      const messages = [
        {
          role: "system" as const,
          content: systemPrompt,
        },
        ...conversationHistory.map((msg: any) => ({
          role: (msg.role === "user" ? "user" : "assistant") as "user" | "assistant",
          content: msg.content || "",
        })),
        { role: "user" as const, content: userPrompt },
      ];
      
      console.log("Sending to OpenAI:", {
        model: "gpt-4o-mini",
        messageCount: messages.length,
        responseFormat: "json_object",
      });
      
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages,
        response_format: { type: "json_object" },
        temperature: 0.3,
      });
      
      console.log("OpenAI API call successful");
      console.log("Completion:", {
        hasChoices: !!completion.choices,
        choicesLength: completion.choices?.length || 0,
        hasUsage: !!completion.usage,
      });
      
      if (!completion.choices || completion.choices.length === 0) {
        throw new Error("OpenAI API returned no choices in response");
      }
      
      if (!completion.choices[0].message) {
        throw new Error("OpenAI API returned invalid message structure");
      }
    } catch (openaiError: any) {
      console.error("=== OpenAI API error ===");
      console.error("Error:", openaiError);
      console.error("Error message:", openaiError.message);
      console.error("Error status:", openaiError.status);
      console.error("Error code:", openaiError.code);
      console.error("Error type:", openaiError.type);
      console.error("Error response:", openaiError.response);
      
      // Check for specific OpenAI error types
      if (openaiError.status === 401) {
        throw new Error("OpenAI API key is invalid or expired. Please check your API key in .env.local");
      } else if (openaiError.status === 429) {
        // Rate limit error - provide more helpful message
        const retryAfter = openaiError.response?.headers?.['retry-after'] || openaiError.response?.headers?.['x-ratelimit-reset-requests'];
        const message = retryAfter 
          ? `OpenAI API rate limit exceeded. Please wait ${retryAfter} seconds before trying again.`
          : "OpenAI API rate limit exceeded. You've made too many requests too quickly. Please wait a minute and try again.";
        throw new Error(message);
      } else if (openaiError.status === 500 || openaiError.status === 502 || openaiError.status === 503) {
        throw new Error("OpenAI API server error. Please try again in a moment.");
      } else if (openaiError.code === 'ECONNRESET' || openaiError.code === 'ETIMEDOUT') {
        throw new Error("Network connection error. Please check your internet connection and try again.");
      } else {
        throw new Error(`OpenAI API error: ${openaiError.message || "Unknown error"} (Status: ${openaiError.status || "N/A"})`);
      }
    }

    const responseText = completion.choices[0].message.content;
    
    if (!responseText) {
      console.error("OpenAI returned empty response");
      throw new Error("OpenAI API returned empty response content");
    }
    
    console.log("OpenAI response text:", responseText);
    console.log("Response text length:", responseText.length);
    
    // Parse JSON with error handling
    let result: VoiceAgentResponse;
    try {
      result = JSON.parse(responseText);
      console.log("Parsed result:", result);
    } catch (parseError: any) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Response text:", responseText);
      throw new Error(`Failed to parse AI response: ${parseError.message}. Response: ${responseText.substring(0, 200)}`);
    }
    
    // Validate required fields
    if (!result.action || !result.message) {
      console.error("Invalid AI response structure:", result);
      throw new Error(`AI returned invalid response structure. Missing action or message. Response: ${JSON.stringify(result)}`);
    }
    
    const tokens = completion.usage?.total_tokens || 0;
    const cost = calculateGPT4Cost(tokens, "gpt-4o-mini");

    console.log("Returning successful response:", { action: result.action, confidence: result.confidence });
    
    return NextResponse.json({
      ...result,
      tokens,
      cost,
    });
  } catch (error: any) {
    console.error("=== Voice agent error ===");
    console.error("Error:", error);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("Error name:", error.name);
    console.error("Error response:", error.response?.data);
    console.error("Error status:", error.status);
    console.error("Error code:", error.code);
    console.error("Error type:", error.type);
    
    // Return more detailed error information
    const errorMessage = error.message || "Unknown error occurred";
    const errorDetails = error.response?.data || error.stack || "No additional details";
    
    console.error("Returning error response:", { errorMessage, errorDetails });
    console.error("Full error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    
    // Include the actual error message in the response so client can see it
    return NextResponse.json(
      { 
        error: "Failed to process voice command",
        message: errorMessage,
        details: typeof errorDetails === 'string' ? errorDetails.substring(0, 1000) : JSON.stringify(errorDetails).substring(0, 1000),
        action: "unknown",
        confidence: 0,
        serverError: errorMessage // Include the actual error message
      },
      { status: 500 }
    );
  }
}

