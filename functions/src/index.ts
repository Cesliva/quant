import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import OpenAI from "openai";

admin.initializeApp();

const openai = new OpenAI({
  apiKey: functions.config().openai?.key || process.env.OPENAI_API_KEY,
});

// Whisper transcription function
export const transcribeAudio = functions.https.onCall(
  async (data, context) => {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { audioBase64, companyId, projectId } = data;

    if (!audioBase64) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Audio data is required"
      );
    }

    try {
      // Convert base64 to buffer
      const audioBuffer = Buffer.from(audioBase64, "base64");

      // Create a File-like object for OpenAI
      const audioFile = new File([audioBuffer], "audio.webm", {
        type: "audio/webm",
      });

      const transcription = await openai.audio.transcriptions.create({
        file: audioFile as any,
        model: "whisper-1",
      });

      const estimatedDuration = 1; // TODO: Calculate actual duration
      const cost = estimatedDuration * 0.006;

      // Log usage
      if (companyId && projectId) {
        await admin.firestore().collection(`companies/${companyId}/projects/${projectId}/aiLogs`).add({
          type: "whisper",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          duration: estimatedDuration,
          cost,
          output: transcription.text,
        });
      }

      return {
        text: transcription.text,
        duration: estimatedDuration,
        cost,
      };
    } catch (error: any) {
      console.error("Transcription error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Transcription failed",
        error.message
      );
    }
  }
);

// Spec review function
export const reviewSpecifications = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { specText, projectData, companyId, projectId } = data;

    if (!specText) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Specification text is required"
      );
    }

    try {
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
      const cost = (tokens / 1000) * 0.15; // Approximate cost

      // Log usage
      if (companyId && projectId) {
        await admin.firestore().collection(`companies/${companyId}/projects/${projectId}/aiLogs`).add({
          type: "spec-review",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          tokens,
          cost,
          input: specText,
          output: JSON.stringify(result),
        });
      }

      return {
        ...result,
        tokens,
        cost,
      };
    } catch (error: any) {
      console.error("Spec review error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Spec review failed",
        error.message
      );
    }
  }
);

// Proposal generation function
export const generateProposal = functions.https.onCall(
  async (data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User must be authenticated"
      );
    }

    const { projectSummary, template, companyId, projectId } = data;

    if (!projectSummary) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Project summary is required"
      );
    }

    try {
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
      const cost = (tokens / 1000) * 0.15; // Approximate cost

      // Log usage
      if (companyId && projectId) {
        await admin.firestore().collection(`companies/${companyId}/projects/${projectId}/aiLogs`).add({
          type: "proposal",
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          tokens,
          cost,
          input: projectSummary,
          output: proposal,
        });
      }

      return {
        proposal,
        tokens,
        cost,
      };
    } catch (error: any) {
      console.error("Proposal generation error:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Proposal generation failed",
        error.message
      );
    }
  }
);

