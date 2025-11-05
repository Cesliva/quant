"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Square, Keyboard, Volume2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { transcribeAudio } from "@/lib/openai/whisper";
import { logAIUsage } from "@/lib/openai/usageTracker";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

interface VoiceHUDProps {
  companyId: string;
  projectId: string;
  onTranscriptionComplete?: (text: string) => void;
  isManualMode?: boolean;
  onManualModeToggle?: (enabled: boolean) => void;
}

export default function VoiceHUD({
  companyId,
  projectId,
  onTranscriptionComplete,
  isManualMode = false,
  onManualModeToggle,
}: VoiceHUDProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isRecording) {
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
        durationIntervalRef.current = null;
      }
      setRecordingDuration(0);
    }

    return () => {
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });

        setIsTranscribing(true);
        try {
          if (isFirebaseConfigured()) {
            const result = await transcribeAudio(audioBlob);

            // Log usage
            await logAIUsage(companyId, projectId, {
              type: "whisper",
              duration: result.duration,
              cost: result.cost,
              input: "audio",
              output: result.text,
            });

            if (onTranscriptionComplete) {
              onTranscriptionComplete(result.text);
            }
          } else {
            // Demo mode - simulate transcription
            setTimeout(() => {
              const demoText = "W12x65 column, 8 pieces, 20 feet each";
              if (onTranscriptionComplete) {
                onTranscriptionComplete(demoText);
              }
            }, 1000);
          }
        } catch (error) {
          console.error("Transcription error:", error);
          alert("Failed to transcribe audio. Please try again.");
        } finally {
          setIsTranscribing(false);
        }

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
      alert("Failed to access microphone. Please check permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    // Stop stream if still active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <>
      {/* Voice Input Controls - Top Bar */}
      <div className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={!isManualMode}
                onChange={(e) => onManualModeToggle?.(!e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Mic className="w-4 h-4" />
                Voice Input
              </span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isManualMode}
                onChange={(e) => onManualModeToggle?.(e.target.checked)}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                <Keyboard className="w-4 h-4" />
                Manual Entry
              </span>
            </label>
          </div>
        </div>

        {!isManualMode && (
          <div className="flex items-center gap-3">
            {!isRecording ? (
              <Button
                variant="primary"
                onClick={startRecording}
                disabled={isTranscribing}
                className="gap-2"
              >
                <Mic className="w-4 h-4" />
                {isTranscribing ? "Transcribing..." : "Start Recording"}
              </Button>
            ) : (
              <Button variant="outline" onClick={stopRecording} className="gap-2">
                <Square className="w-4 h-4" />
                Stop ({formatDuration(recordingDuration)})
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Pulsating Orb - Fixed in Lower Center */}
      {!isManualMode && (isRecording || isTranscribing) && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none">
          <div className="relative">
            {/* Outer pulsating rings */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className={`absolute rounded-full ${
                  isRecording ? "bg-blue-500" : "bg-purple-500"
                } opacity-20 animate-ping`}
                style={{
                  width: "120px",
                  height: "120px",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
              <div
                className={`absolute rounded-full ${
                  isRecording ? "bg-blue-500" : "bg-purple-500"
                } opacity-30 animate-ping`}
                style={{
                  width: "100px",
                  height: "100px",
                  animationDelay: "0.5s",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }}
              />
            </div>

            {/* Main orb */}
            <div
              className={`relative flex items-center justify-center rounded-full shadow-2xl ${
                isRecording
                  ? "bg-gradient-to-br from-blue-500 to-blue-600"
                  : "bg-gradient-to-br from-purple-500 to-purple-600"
              } animate-pulse`}
              style={{
                width: "80px",
                height: "80px",
              }}
            >
              {isRecording ? (
                <Mic className="w-8 h-8 text-white" />
              ) : (
                <Volume2 className="w-8 h-8 text-white animate-spin" style={{ animationDuration: "1s" }} />
              )}
            </div>

            {/* Status text */}
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
              <div className="bg-gray-900 text-white px-3 py-1 rounded-lg text-sm font-medium shadow-lg">
                {isRecording ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                      Recording... {formatDuration(recordingDuration)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                      Transcribing...
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
