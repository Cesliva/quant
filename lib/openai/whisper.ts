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
    throw new Error("Transcription failed");
  }

  const data = await response.json();
  return data;
}

