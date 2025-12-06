import { createDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

export interface AIUsageLog {
  type: "spec-review" | "proposal";
  timestamp: Timestamp;
  tokens?: number;
  cost: number;
  input?: string;
  output?: string;
  error?: string;
}

export async function logAIUsage(
  companyId: string,
  projectId: string,
  usage: Omit<AIUsageLog, "timestamp">
): Promise<void> {
  const logPath = getProjectPath(companyId, projectId, "aiLogs");
  
  await createDocument(logPath, {
    ...usage,
    timestamp: Timestamp.now(),
  });
}

export function calculateGPT4Cost(tokens: number, model: string = "gpt-4o-mini"): number {
  // OpenAI pricing (per 1M tokens)
  // GPT-4o: $2.50 input, $10.00 output
  // GPT-4o-mini: $0.15 input, $0.60 output
  const isGPT4o = model === "gpt-4o";
  const inputCostPer1M = isGPT4o ? 2.50 : 0.15;
  const outputCostPer1M = isGPT4o ? 10.00 : 0.60;
  
  // Rough estimate: assume 80% input, 20% output
  const inputTokens = tokens * 0.8;
  const outputTokens = tokens * 0.2;
  
  return (inputTokens / 1000000) * inputCostPer1M + (outputTokens / 1000000) * outputCostPer1M;
}

