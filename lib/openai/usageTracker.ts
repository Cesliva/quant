import { createDocument } from "@/lib/firebase/firestore";
import { getProjectPath } from "@/lib/firebase/firestore";
import { Timestamp } from "firebase/firestore";

export interface AIUsageLog {
  type: "whisper" | "spec-review" | "proposal";
  timestamp: Timestamp;
  tokens?: number;
  duration?: number; // in minutes
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

export function calculateWhisperCost(durationMinutes: number): number {
  return durationMinutes * 0.006;
}

export function calculateGPT4Cost(tokens: number, model: string = "gpt-4o-mini"): number {
  // Approximate costs per 1K tokens
  const inputCostPer1K = model.includes("gpt-4") ? 0.15 : 0.15;
  const outputCostPer1K = model.includes("gpt-4") ? 0.6 : 0.6;
  
  // Rough estimate: assume 80% input, 20% output
  const inputTokens = tokens * 0.8;
  const outputTokens = tokens * 0.2;
  
  return (inputTokens / 1000) * inputCostPer1K + (outputTokens / 1000) * outputCostPer1K;
}

