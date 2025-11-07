// OpenAI client is initialized in API routes, not here
// This module only provides client-side fetch wrappers

export interface TranscriptionResult {
  text: string;
  duration: number; // in minutes
  cost: number; // $0.006 per minute
}

export async function transcribeAudio(
  audioBlob: Blob
): Promise<TranscriptionResult> {
  const formData = new FormData();
  formData.append("file", audioBlob, "audio.webm");
  formData.append("model", "whisper-1");

  const response = await fetch("/api/transcribe", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
    console.error("Transcription API error:", errorMessage, errorData);
    throw new Error(errorMessage);
  }

  const data = await response.json();
  return data;
}

