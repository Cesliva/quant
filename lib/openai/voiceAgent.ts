import { EstimatingLine } from "@/components/estimating/EstimatingGrid";

export interface VoiceAgentResponse {
  action: "create" | "update" | "delete" | "query" | "unknown";
  lineId?: string;
  data?: Partial<EstimatingLine>;
  message: string;
  confidence: number;
  tokens?: number;
  cost?: number;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export async function processVoiceCommand(
  userMessage: string,
  existingLines: EstimatingLine[] = [],
  conversationHistory: ConversationMessage[] = []
): Promise<VoiceAgentResponse> {
  console.log("Calling /api/voice-agent with:", {
    userMessage,
    existingLinesCount: existingLines.length,
    conversationHistoryLength: conversationHistory.length,
  });

  let response;
  try {
    response = await fetch("/api/voice-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userMessage,
        existingLines: existingLines.map(line => ({
          lineId: line.lineId,
          itemDescription: line.itemDescription,
          category: line.category,
          sizeDesignation: line.sizeDesignation,
          qty: line.qty,
          lengthFt: line.lengthFt,
        })),
        conversationHistory,
      }),
    });
    console.log("Response status:", response.status, response.statusText);
  } catch (fetchError: any) {
    console.error("Fetch error:", fetchError);
    throw new Error(`Network error: ${fetchError.message || "Failed to reach server"}`);
  }

  if (!response.ok) {
    let errorData: any = {};
    try {
      errorData = await response.json();
    } catch (e) {
      console.error("Failed to parse error response as JSON");
      const text = await response.text().catch(() => "Unknown error");
      errorData = { error: text, message: text };
    }
    
    // Prefer serverError, then message, then error, then status text
    const errorMessage = errorData.serverError || errorData.message || errorData.error || errorData.details || `HTTP ${response.status}: ${response.statusText}`;
    console.error("Voice agent API error:", {
      status: response.status,
      statusText: response.statusText,
      errorData,
      fullError: JSON.stringify(errorData, null, 2),
      extractedMessage: errorMessage,
    });
    throw new Error(errorMessage);
  }

  const result = await response.json();
  console.log("API response received:", result);
  
  // Validate response structure
  if (!result.action) {
    console.error("Invalid response from voice agent:", result);
    throw new Error("Invalid response from AI agent: missing action field");
  }
  
  return result;
}

