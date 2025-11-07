"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Square, Keyboard, Volume2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { transcribeAudio } from "@/lib/openai/whisper";
import { logAIUsage } from "@/lib/openai/usageTracker";
import { getProjectPath } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { parseStructuredVoiceInput, createLineFromStructuredData, StructuredVoiceState } from "@/lib/utils/structuredVoiceParser";

interface VoiceHUDProps {
  companyId: string;
  projectId: string;
  onTranscriptionComplete?: (text: string) => void;
  onStructuredDataComplete?: (data: Partial<any>, shouldProcess: boolean, createNewLine?: boolean) => void;
  isManualMode?: boolean;
  onManualModeToggle?: (enabled: boolean) => void;
}

// Web Speech API types
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
}

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare var webkitSpeechRecognition: {
  new (): SpeechRecognition;
};

export default function VoiceHUD({
  companyId,
  projectId,
  onTranscriptionComplete,
  onStructuredDataComplete,
  isManualMode = false,
  onManualModeToggle,
}: VoiceHUDProps) {
  // Structured voice state
  const [structuredState, setStructuredState] = useState<StructuredVoiceState>({
    context: null,
    currentField: null,
    accumulatedData: {},
    isComplete: false,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [structuredMode] = useState(true); // Enable structured mode by default
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isRecordingRef = useRef(false);

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
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors on cleanup
        }
        recognitionRef.current = null;
      }
    };
  }, [isRecording]);

  const startRecording = async () => {
    // Check if Web Speech API is available (preferred for real-time)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    console.log("Checking for Web Speech API:", {
      SpeechRecognition: !!SpeechRecognition,
      webkitSpeechRecognition: !!(window as any).webkitSpeechRecognition,
    });
    
    if (SpeechRecognition) {
      console.log("Web Speech API is available, starting recognition...");
      // Use Web Speech API for real-time transcription
      try {
        const recognition = new SpeechRecognition() as SpeechRecognition;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          console.log("Speech recognition result:", event);
          let interimTranscript = "";
          let newFinalText = "";
          
          // Only process new results (from resultIndex onwards)
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcript = result[0].transcript;
            if (result.isFinal) {
              newFinalText += transcript + " ";
            } else {
              interimTranscript += transcript;
            }
          }
          
          console.log("Interim:", interimTranscript, "New Final:", newFinalText);
          
          // Update live transcript display
          if (interimTranscript) {
            setLiveTranscript(interimTranscript);
          }
          
          // If we have final text, process it immediately in structured mode
          if (newFinalText.trim()) {
            const newFinal = newFinalText.trim();
            
            if (structuredMode && onStructuredDataComplete) {
              // Process immediately in structured mode
              setStructuredState((prevState) => {
                const result = parseStructuredVoiceInput(newFinal, prevState);
                
                // Check for stop recording command
                if ((result as any).stopRecording) {
                  stopRecording();
                  return prevState;
                }
                
                // Check for create new line command
                if ((result as any).createNewLine) {
                  const lineId = (result as any).lineId || result.state.accumulatedData.lineId;
                  onStructuredDataComplete({ lineId: lineId || `L${Date.now()}` }, false, true); // Pass createNewLine flag
                  // Keep the state to continue building the line
                  setLiveTranscript(""); // Clear interim
                  return result.state;
                }
                
                if (result.shouldProcess) {
                  // Process the accumulated data (Enter command)
                  onStructuredDataComplete(result.state.accumulatedData, true);
                  // Reset state for next line
                  setFinalTranscript("");
                  setLiveTranscript("");
                  return {
                    context: "material", // Default to material for next line
                    currentField: null,
                    accumulatedData: {},
                    isComplete: false,
                  };
                } else {
                  // Update accumulated data in real-time (don't reset, keep building)
                  onStructuredDataComplete(result.state.accumulatedData, false);
                  // Don't accumulate final transcript - we process immediately
                  setLiveTranscript(""); // Clear interim
                  return result.state;
                }
              });
            } else {
              // Old mode: accumulate and process after silence
              setFinalTranscript((prev) => {
                const updated = prev ? prev + " " + newFinal : newFinal;
                
                // Process the command when we get final text
                // Wait a bit to see if more is coming
                if (silenceTimeoutRef.current) {
                  clearTimeout(silenceTimeoutRef.current);
                }
                
                silenceTimeoutRef.current = setTimeout(() => {
                  if (updated && onTranscriptionComplete) {
                    console.log("Processing final transcript:", updated);
                    onTranscriptionComplete(updated);
                    setFinalTranscript(""); // Clear after processing
                  }
                }, 1500); // Wait 1.5 seconds of silence before processing
                
                return updated;
              });
              setLiveTranscript(""); // Clear interim after adding to final
            }
          }
        };
        
        recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
          console.error("Speech recognition error:", event.error, event.message);
          if (event.error === "no-speech") {
            // No speech detected, that's okay - just continue
            return;
          }
          if (event.error === "aborted") {
            // User stopped it, that's fine
            return;
          }
          if (event.error === "not-allowed") {
            alert("Microphone permission denied. Please allow microphone access and try again.");
            setIsRecording(false);
            return;
          }
          // For other errors, show a message but don't fall back automatically
          console.warn(`Speech recognition error: ${event.error}. Continuing...`);
        };
        
        recognition.onend = () => {
          console.log("Recognition ended, isRecordingRef:", isRecordingRef.current);
          // Only restart if we're still supposed to be recording
          // Use ref to check current state
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              // Small delay before restart to avoid immediate restart issues
              setTimeout(() => {
                if (isRecordingRef.current && recognitionRef.current) {
                  console.log("Restarting recognition...");
                  recognitionRef.current.start();
                }
              }, 100);
            } catch (e) {
              console.error("Failed to restart recognition:", e);
              isRecordingRef.current = false;
              setIsRecording(false);
            }
          }
        };
        
        recognitionRef.current = recognition;
        isRecordingRef.current = true;
        setIsRecording(true);
        setLiveTranscript("");
        setFinalTranscript("");
        
        try {
          recognition.start();
          console.log("Web Speech API started successfully");
        } catch (error: any) {
          console.error("Failed to start recognition:", error);
          isRecordingRef.current = false;
          setIsRecording(false);
          alert("Failed to start voice recognition. Please try again or use a different browser.");
          return;
        }
        return;
      } catch (error: any) {
        console.error("Failed to start speech recognition:", error);
        alert("Web Speech API is not working. Falling back to audio recording mode.");
        // Fall back to MediaRecorder
        startMediaRecorder();
        return;
      }
    } else {
      console.log("Web Speech API not available, using MediaRecorder fallback");
      // Fallback to MediaRecorder if Web Speech API not available
      startMediaRecorder();
      return;
    }
  };
  
  const startMediaRecorder = async () => {
    // Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        "Microphone access is not available in this browser.\n\n" +
        "Please use a modern browser like Chrome, Edge, or Firefox.\n" +
        "Note: Microphone access requires HTTPS (or localhost for development)."
      );
      return;
    }

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
        } catch (error: any) {
          console.error("Transcription error:", error);
          const errorMessage = error?.message || error?.error || "Unknown error";
          console.error("Full error details:", error);
          alert(`Failed to transcribe audio: ${errorMessage}\n\nPlease check:\n1. OpenAI API key is valid\n2. Browser console for more details`);
        } finally {
          setIsTranscribing(false);
        }

        // Stop all tracks
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error("Error accessing microphone:", error);
      
      let errorMessage = "Failed to access microphone.\n\n";
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorMessage += 
          "Microphone permission was denied.\n\n" +
          "To fix this:\n" +
          "1. Click the lock/padlock icon in your browser's address bar\n" +
          "2. Find 'Microphone' in the permissions list\n" +
          "3. Change it to 'Allow'\n" +
          "4. Refresh the page and try again\n\n" +
          "Or go to your browser settings:\n" +
          "- Chrome: Settings > Privacy and security > Site settings > Microphone\n" +
          "- Edge: Settings > Cookies and site permissions > Microphone\n" +
          "- Firefox: Settings > Privacy & Security > Permissions > Microphone";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorMessage += 
          "No microphone found.\n\n" +
          "Please ensure:\n" +
          "1. A microphone is connected to your computer\n" +
          "2. The microphone is not being used by another application\n" +
          "3. Your microphone drivers are installed and working";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorMessage += 
          "Microphone is already in use.\n\n" +
          "Please:\n" +
          "1. Close other applications using the microphone\n" +
          "2. Check if another browser tab is using it\n" +
          "3. Try refreshing the page";
      } else {
        errorMessage += 
          "Error: " + (error.message || error.name || "Unknown error") + "\n\n" +
          "Please check:\n" +
          "1. Your browser supports microphone access\n" +
          "2. You're using HTTPS or localhost\n" +
          "3. Your microphone is working in other applications";
      }
      
      alert(errorMessage);
    }
  };

  const stopRecording = () => {
    console.log("Stopping recording...");
    
    // Set flag first to prevent auto-restart
    isRecordingRef.current = false;
    setIsRecording(false);
    
    // Stop Web Speech API if active
    if (recognitionRef.current) {
      try {
        // Remove onend handler to prevent auto-restart
        recognitionRef.current.onend = () => {
          console.log("Recognition ended after stop");
        };
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
      recognitionRef.current = null;
    }
    
    // Clear silence timeout
    if (silenceTimeoutRef.current) {
      clearTimeout(silenceTimeoutRef.current);
      silenceTimeoutRef.current = null;
    }
    
    // Process any remaining final transcript
    const remainingText = finalTranscript.trim() || liveTranscript.trim();
    if (remainingText) {
      if (structuredMode && onStructuredDataComplete) {
        setStructuredState((prevState) => {
          const result = parseStructuredVoiceInput(remainingText, prevState);
          if (result.shouldProcess || Object.keys(result.state.accumulatedData).length > 0) {
            onStructuredDataComplete(result.state.accumulatedData, result.shouldProcess);
          }
          // Reset state if processing
          if (result.shouldProcess) {
            return {
              context: null,
              currentField: null,
              accumulatedData: {},
              isComplete: false,
            };
          }
          return result.state;
        });
      } else if (onTranscriptionComplete) {
        onTranscriptionComplete(remainingText);
      }
    }
    
    setLiveTranscript("");
    setFinalTranscript("");
    setIsRecording(false);
    
    // Stop MediaRecorder if active
    if (mediaRecorderRef.current) {
      try {
        if (mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch (e) {
        console.error("Error stopping media recorder:", e);
      }
      mediaRecorderRef.current = null;
    }
    
    // Stop stream if still active
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
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
                {isTranscribing ? "Transcribing..." : "Start Voice Input"}
              </Button>
            ) : (
              <Button variant="outline" onClick={stopRecording} className="gap-2">
                <Square className="w-4 h-4" />
                Stop ({formatDuration(recordingDuration)})
              </Button>
            )}
            {/* Live transcript display */}
            {(liveTranscript || finalTranscript || structuredState.context || Object.keys(structuredState.accumulatedData).length > 0) && (
              <div className="flex-1 max-w-lg px-4 py-2 bg-gray-50 rounded-lg border border-gray-200">
                <div className="text-xs text-gray-500 mb-1">
                  {structuredMode ? "Structured Voice Input" : "Live transcription"}:
                  {structuredState.context && (
                    <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {structuredState.context.toUpperCase()}
                    </span>
                  )}
                  {structuredState.currentField && (
                    <span className="ml-2 px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                      {structuredState.currentField}
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-800 mb-2">
                  <span className="text-gray-600">{finalTranscript}</span>
                  <span className="text-blue-600 italic">{liveTranscript}</span>
                </div>
                {structuredMode && Object.keys(structuredState.accumulatedData).length > 0 && (
                  <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-200">
                    <div className="font-medium mb-1">Accumulated:</div>
                    <div className="space-y-0.5">
                      {Object.entries(structuredState.accumulatedData).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500">{key}:</span>
                          <span className="text-gray-800">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs text-blue-600 italic">
                      Say "Enter" to process this line
                    </div>
                  </div>
                )}
              </div>
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
