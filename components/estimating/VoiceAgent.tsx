"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Bot, User, X, Minimize2, Maximize2, Sparkles, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { processVoiceCommand, VoiceAgentResponse, ConversationMessage } from "@/lib/openai/voiceAgent";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getProjectPath, getDocument, setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";
import { TRAINING_PHRASES, storeSpeechPattern, applyCorrections, generateTrainingContext, type SpeechPattern } from "@/lib/utils/speechTraining";
import { getNextLineId, extractLineNumber } from "@/lib/utils/lineIdManager";
import { parseNumberFieldFormat } from "@/lib/utils/fieldNumberMap";

interface VoiceAgentProps {
  companyId: string;
  projectId: string;
  existingLines: EstimatingLine[];
  onAction: (response: VoiceAgentResponse) => Promise<void>;
  isManualMode?: boolean;
}

export default function VoiceAgent({
  companyId,
  projectId,
  existingLines,
  onAction,
  isManualMode = false,
}: VoiceAgentProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversation, setConversation] = useState<ConversationMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isAwake, setIsAwake] = useState(true); // Track if AI is "awake" - auto-awake by default
  const [pendingAction, setPendingAction] = useState<VoiceAgentResponse | null>(null); // Pending action waiting for confirmation
  const [accumulatedData, setAccumulatedData] = useState<Partial<EstimatingLine>>({}); // Data being built up before "enter"
  const [currentLineId, setCurrentLineId] = useState<string | null>(null); // Current line being worked on
  const [isTrainingMode, setIsTrainingMode] = useState(false); // Training/calibration mode
  
  // Keep refs in sync with state (must be after state declarations)
  useEffect(() => {
    isAwakeRef.current = isAwake;
  }, [isAwake]);
  
  useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);
  
  useEffect(() => {
    isTrainingModeRef.current = isTrainingMode;
  }, [isTrainingMode]);
  const [trainingProgress, setTrainingProgress] = useState(0); // Current training phrase index
  const [speechPatterns, setSpeechPatterns] = useState<SpeechPattern[]>([]); // Learned speech patterns
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false); // Track recording state for onend handler
  const streamRef = useRef<MediaStream | null>(null); // Keep microphone stream active for Bluetooth devices
  const silenceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Track silence timeout for processing transcripts
  const isAwakeRef = useRef(false); // Track awake state to avoid stale closures
  const isProcessingRef = useRef(false); // Track processing state to avoid stale closures
  const isTrainingModeRef = useRef(false); // Track training mode to avoid stale closures
  const audioContextRef = useRef<AudioContext | null>(null); // For voice activity detection
  const analyserRef = useRef<AnalyserNode | null>(null); // For analyzing audio levels
  const voiceActivityCheckRef = useRef<number | null>(null); // Animation frame for voice detection

  // Load conversation and speech patterns from Firestore on mount
  useEffect(() => {
    const loadData = async () => {
      if (!isFirebaseConfigured() || !companyId || !projectId) {
        console.log("Firebase not configured or missing IDs, skipping data load");
        return;
      }

      try {
        // Load conversation
        const conversationPath = getProjectPath(companyId, projectId, "conversations", "current");
        const saved = await getDocument<{ messages: ConversationMessage[] }>(conversationPath);
        
        if (saved && saved.messages && saved.messages.length > 0) {
          console.log(`Loaded ${saved.messages.length} messages from conversation history`);
          setConversation(saved.messages);
        }
        
        // Load speech patterns
        try {
          const patternsPath = getProjectPath(companyId, projectId, "speechPatterns");
          const patternsData = await getDocument<{ patterns: SpeechPattern[] }>(patternsPath);
          
          if (patternsData && patternsData.patterns) {
            console.log(`Loaded ${patternsData.patterns.length} speech patterns`);
            setSpeechPatterns(patternsData.patterns);
          }
        } catch (error) {
          // No patterns yet, that's okay
          console.log("No speech patterns found yet");
        }
      } catch (error: any) {
        console.error("Failed to load data:", error);
      }
    };

    loadData();
  }, [companyId, projectId]);

  // Save conversation to Firestore when it changes
  useEffect(() => {
    const saveConversation = async () => {
      if (!isFirebaseConfigured() || !companyId || !projectId || conversation.length === 0) {
        return;
      }

      try {
        const conversationPath = getProjectPath(companyId, projectId, "conversations", "current");
        await setDocument(conversationPath, {
          messages: conversation,
          projectId,
          companyId,
        }, true); // merge = true to update existing
        
        console.log(`Saved ${conversation.length} messages to conversation history`);
      } catch (error: any) {
        console.error("Failed to save conversation:", error);
        // Don't show error to user, just log it
      }
    };

    // Debounce saves - only save after user stops typing/adding messages
    const timeoutId = setTimeout(() => {
      saveConversation();
    }, 1000); // Wait 1 second after last change

    return () => clearTimeout(timeoutId);
  }, [conversation, companyId, projectId]);

  // Save speech patterns to Firestore when they change
  useEffect(() => {
    const savePatterns = async () => {
      if (!isFirebaseConfigured() || !companyId || !projectId || speechPatterns.length === 0) {
        return;
      }

      try {
        const patternsPath = getProjectPath(companyId, projectId, "speechPatterns");
        await setDocument(patternsPath, {
          patterns: speechPatterns,
          projectId,
          companyId,
          lastUpdated: Date.now(),
        }, true);
        
        console.log(`Saved ${speechPatterns.length} speech patterns`);
      } catch (error: any) {
        console.error("Failed to save speech patterns:", error);
      }
    };

    const timeoutId = setTimeout(() => {
      savePatterns();
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [speechPatterns, companyId, projectId]);

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("🎯 VoiceAgent component mounted", { 
      companyId, 
      projectId, 
      existingLinesCount: existingLines.length,
      isManualMode 
    });
  }, [companyId, projectId, existingLines.length, isManualMode]);

  // Voice Activity Detection - automatically start recording when speech is detected
  const startVoiceActivityDetection = async () => {
    // Don't start if already recording or if voice detection is already active
    if (isRecordingRef.current || voiceActivityCheckRef.current) {
      return;
    }
    
    try {
      console.log("Starting voice activity detection...");
      // Request microphone access for voice activity detection
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      // Create audio context for analyzing audio levels
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      microphone.connect(analyser);
      
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream; // Keep stream active
      
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const VOICE_THRESHOLD = 30; // Adjust based on testing
      let consecutiveVoiceFrames = 0;
      const FRAMES_TO_TRIGGER = 5; // Need 5 consecutive frames of voice to trigger (reduces false positives)
      
      const checkVoiceActivity = () => {
        if (!analyserRef.current || isRecordingRef.current) {
          // Stop checking if we're already recording
          return;
        }
        
        analyserRef.current.getByteFrequencyData(dataArray);
        
        // Calculate average volume
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        
        if (average > VOICE_THRESHOLD) {
          consecutiveVoiceFrames++;
          if (consecutiveVoiceFrames >= FRAMES_TO_TRIGGER) {
            // Voice detected - start speech recognition
            console.log("🎤 Voice activity detected - starting speech recognition automatically");
            consecutiveVoiceFrames = 0; // Reset
            startRecording();
            return;
          }
        } else {
          consecutiveVoiceFrames = 0;
        }
        
        // Continue checking
        voiceActivityCheckRef.current = requestAnimationFrame(checkVoiceActivity);
      };
      
      // Start voice activity detection
      voiceActivityCheckRef.current = requestAnimationFrame(checkVoiceActivity);
      console.log("✅ Voice activity detection started - mic will auto-activate when you speak");
      
    } catch (error: any) {
      console.error("Failed to start voice activity detection:", error);
      // Don't show alert - just log it, user can still click mic button
    }
  };

  // Listen for custom event to open the agent and start voice activity detection
  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true);
      setIsMinimized(false);
      // Start voice activity detection when agent opens
      if (!isRecordingRef.current && !voiceActivityCheckRef.current) {
        startVoiceActivityDetection();
      }
    };
    window.addEventListener('openVoiceAgent', handleOpenEvent);
    
    // Also start voice activity detection when component mounts and is open
    if (isOpen && !isRecordingRef.current && !voiceActivityCheckRef.current) {
      startVoiceActivityDetection();
    }
    
    return () => {
      window.removeEventListener('openVoiceAgent', handleOpenEvent);
    };
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  // Cleanup on unmount - CRITICAL for preventing memory leaks
  useEffect(() => {
    return () => {
      console.log("VoiceAgent unmounting - cleaning up resources");
      
      // Clear silence timeout
      if (silenceTimeoutRef.current) {
        clearTimeout(silenceTimeoutRef.current);
        silenceTimeoutRef.current = null;
      }
      
      // Stop voice activity detection
      if (voiceActivityCheckRef.current) {
        cancelAnimationFrame(voiceActivityCheckRef.current);
        voiceActivityCheckRef.current = null;
      }
      
      // Close audio context
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      
      // Stop recognition
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
          recognitionRef.current.abort();
        } catch (e) {
          // Ignore errors during cleanup
        }
        recognitionRef.current = null;
      }
      
      // Stop microphone stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      // Reset recording state
      isRecordingRef.current = false;
    };
  }, []);

  const startRecording = async () => {
    // If already recording, don't start again
    if (isRecordingRef.current || recognitionRef.current) {
      return;
    }
    
    // Stop voice activity detection when starting actual recording
    if (voiceActivityCheckRef.current) {
      cancelAnimationFrame(voiceActivityCheckRef.current);
      voiceActivityCheckRef.current = null;
    }
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Please type your commands.");
      return;
    }

    // Use existing stream if available (from voice activity detection), otherwise request new one
    let stream: MediaStream | null = streamRef.current;
    
    if (!stream || !stream.active) {
      try {
        console.log("Requesting microphone access...");
        stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          } 
        });
        console.log("Microphone access granted, stream active:", stream.active);
        streamRef.current = stream;
      } catch (error: any) {
        console.error("Failed to get microphone access:", error);
        alert(`Microphone access denied. Please allow microphone access in your browser settings.\n\nError: ${error.message}`);
        return;
      }
    } else {
      console.log("Using existing microphone stream from voice activity detection");
    }
    
    // Verify stream is still active before proceeding
    if (!stream || !stream.active) {
      console.error("Stream is not active after getUserMedia");
      alert("Microphone stream is not active. Please try again.");
      return;
    }
    
    // Log which device is being used
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length > 0) {
      const track = audioTracks[0];
      const settings = track.getSettings();
      console.log("Using audio input device:", {
        label: track.label,
        deviceId: settings.deviceId,
        groupId: settings.groupId,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
      
      // Ensure the track is enabled
      if (!track.enabled) {
        track.enabled = true;
        console.log("Enabled audio track");
      }
    }
    
    // Keep the stream active - DO NOT stop it
    // The Web Speech API will use this active stream
    // For Bluetooth devices, the stream must stay active
    console.log("Microphone stream is active and ready for Web Speech API");

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true; // Keep listening continuously
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      // Force Chrome to use the correct audio input device
      // This helps with Bluetooth devices
      if ((navigator as any).mediaDevices && (navigator as any).mediaDevices.enumerateDevices) {
        try {
          const devices = await (navigator as any).mediaDevices.enumerateDevices();
          const audioInputs = devices.filter((d: any) => d.kind === 'audioinput');
          console.log("Available audio inputs:", audioInputs.map((d: any) => d.label || d.deviceId));
          
          // If we have a Bluetooth device, we can try to select it
          // Note: Web Speech API doesn't directly support device selection,
          // but requesting getUserMedia first helps Chrome activate the right device
        } catch (e) {
          console.log("Could not enumerate devices:", e);
        }
      }

      const SILENCE_TIMEOUT_MS = 2000; // 2 seconds of silence before processing

      recognition.onstart = () => {
        console.log("Speech recognition started - microphone should be active now");
        // Verify stream is still active
        if (streamRef.current) {
          console.log("Stream status on recognition start:", {
            active: streamRef.current.active,
            tracks: streamRef.current.getTracks().length,
            trackEnabled: streamRef.current.getTracks()[0]?.enabled,
            trackReadyState: streamRef.current.getTracks()[0]?.readyState,
          });
        }
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }
        
        // Log when we receive results - confirms mic is working
        if (interimTranscript || finalTranscript) {
          console.log("Received speech input:", { interimTranscript, finalTranscript });
        }

        // Update input text with live transcript
        if (interimTranscript || finalTranscript) {
          setInputText((interimTranscript + finalTranscript).trim());
        }

        // Clear previous timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }

        // AI is awake by default - no wake word needed
        // (Wake word detection removed - AI responds immediately)

        // Process transcript after silence - use both interim and final
        // Web Speech API might not mark results as "final" immediately
        const combinedTranscript = (interimTranscript + " " + finalTranscript).trim();
        if (combinedTranscript) {
        // Clear previous timeout
        if (silenceTimeoutRef.current) {
          clearTimeout(silenceTimeoutRef.current);
          silenceTimeoutRef.current = null;
        }
        
        // Set new timeout to process after silence
        // Use refs to avoid stale closure issues
        silenceTimeoutRef.current = setTimeout(() => {
          const textToProcess = combinedTranscript.trim();
          
          // Use refs to get current values (avoid stale closures)
          const currentAwake = isAwakeRef.current;
          const currentProcessing = isProcessingRef.current;
          const currentTraining = isTrainingModeRef.current;
          
          console.log("Silence timeout fired. Processing:", {
            textToProcess,
            isAwake: currentAwake,
            isProcessing: currentProcessing,
            willProcess: textToProcess && !currentProcessing && currentAwake
          });
          
          if (textToProcess && !currentProcessing && currentAwake) {
            console.log("✅ Processing transcript after silence:", textToProcess);
            
            // Check if user wants to exit training mode
            if (currentTraining) {
              const lowerText = textToProcess.toLowerCase();
              if (lowerText.includes("exit training") || lowerText.includes("stop training") || lowerText.includes("cancel training")) {
                setIsTrainingMode(false);
                setTrainingProgress(0);
                const exitMessage: ConversationMessage = {
                  role: "assistant",
                  content: "Training mode exited. You can now use regular commands.",
                };
                setConversation((prev) => [...prev, exitMessage]);
                setInputText("");
                silenceTimeoutRef.current = null;
                return;
              }
            }
            
            // Process the message
            handleUserMessage(textToProcess);
            // Clear the input after processing
            setInputText("");
            // Don't stop - keep listening for follow-up
          } else if (!currentAwake) {
            console.log("⚠️ AI not awake, ignoring transcript:", textToProcess);
          } else if (currentProcessing) {
            console.log("⚠️ Already processing, ignoring transcript:", textToProcess);
          }
          
          silenceTimeoutRef.current = null;
        }, SILENCE_TIMEOUT_MS);
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error, event);
        if (event.error === "no-speech") {
          // This is normal, just continue listening
          console.log("No speech detected (normal)");
          return;
        }
        if (event.error === "not-allowed") {
          console.error("❌ Microphone access denied by user");
          alert("Microphone access was denied. Please allow microphone access in your browser settings and try again.");
          setIsRecording(false);
          isRecordingRef.current = false;
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        if (event.error === "audio-capture") {
          console.error("❌ No microphone found or microphone not accessible");
          alert("No microphone found or microphone is not accessible. Please check your microphone connection.");
          setIsRecording(false);
          isRecordingRef.current = false;
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
          }
          return;
        }
        if (event.error === "network") {
          console.error("❌ Network error - speech recognition requires internet connection");
          alert("Network error. Speech recognition requires an internet connection.");
          setIsRecording(false);
          isRecordingRef.current = false;
          return;
        }
        if (event.error !== "aborted") {
          console.warn(`⚠️ Speech recognition error: ${event.error}`);
        }
        // Don't stop recording on other errors - keep trying
      };

      recognition.onend = async () => {
        // Auto-restart if we're still supposed to be recording
        if (isRecordingRef.current && !isProcessing) {
          console.log("Recognition ended, auto-restarting...");
          
          // Web Speech API will request its own microphone access on restart
          // No need to keep our stream active - Web Speech API handles it
          try {
            recognition.start();
            console.log("Recognition restarted successfully - Web Speech API will request mic access");
          } catch (e: any) {
            // If already started or other error, that's okay
            console.log("Recognition restart:", e.message || "already active");
          }
        } else {
          console.log("Recognition ended, not restarting (user stopped or processing)");
          setIsRecording(false);
          // Stream should already be released, but clean up just in case
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
              track.stop();
              console.log("Stopped microphone track - recognition ended");
            });
            streamRef.current = null;
          }
        }
      };

      recognitionRef.current = recognition;
      isRecordingRef.current = true;
      
      // IMPORTANT: Web Speech API requests its own microphone access
      // We requested getUserMedia to activate Bluetooth device, but now we need to
      // let Web Speech API get exclusive access. Stop our stream right before starting.
      // The Bluetooth device should stay activated even after we release our stream.
      const tempStream = streamRef.current;
      
      // Small delay to ensure Bluetooth device is fully activated
      setTimeout(() => {
        try {
          // Stop our stream so Web Speech API can get exclusive microphone access
          // The Bluetooth device should remain activated from our initial request
          if (tempStream) {
            console.log("Releasing getUserMedia stream so Web Speech API can acquire mic");
            tempStream.getTracks().forEach(track => {
              track.stop();
              console.log("Stopped getUserMedia track");
            });
            streamRef.current = null; // Clear reference
          }
          
          // Small additional delay to ensure stream is fully released
          setTimeout(() => {
            try {
              // Now start Web Speech API - it will request its own microphone access
              // The Bluetooth device should already be activated and ready
              console.log("Attempting to start Web Speech API recognition...");
              recognition.start();
              setIsRecording(true);
              console.log("✅ recognition.start() called successfully");
              console.log("Started continuous speech recognition - Web Speech API should have mic access");
            } catch (e: any) {
              console.error("❌ Failed to start recognition:", e);
              console.error("Error details:", {
                name: e.name,
                message: e.message,
                stack: e.stack,
              });
              alert(`Failed to start recording: ${e.message}. Please check the browser console for details.`);
              setIsRecording(false);
              isRecordingRef.current = false;
            }
          }, 150); // Slightly longer delay
        } catch (e: any) {
          console.error("Failed to release stream:", e);
          // Try to start anyway
          try {
            recognition.start();
            setIsRecording(true);
            console.log("Started recognition despite stream release error");
          } catch (startError: any) {
            console.error("Failed to start recognition:", startError);
            alert(`Failed to start recording: ${startError.message}. Please try again.`);
            setIsRecording(false);
            isRecordingRef.current = false;
          }
        }
      }, 200); // Delay to ensure Bluetooth device is activated
    } catch (error: any) {
      console.error("Failed to start speech recognition:", error);
      // Clean up stream if recognition setup fails
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped microphone track - error during setup");
        });
        streamRef.current = null;
      }
      alert("Failed to start recording. Please check microphone permissions.");
      setIsRecording(false);
      isRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    isRecordingRef.current = false; // Set flag first to prevent auto-restart
    if (recognitionRef.current) {
      try {
        // Remove onend handler to prevent auto-restart
        recognitionRef.current.onend = () => {
          console.log("Recording stopped by user");
          setIsRecording(false);
        };
        recognitionRef.current.stop();
        recognitionRef.current.abort();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
      recognitionRef.current = null;
    }
    
    // Stop the microphone stream to release the Bluetooth device
    // This allows Chrome to properly deactivate the Bluetooth mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log("Stopped microphone track, releasing Bluetooth device");
      });
      streamRef.current = null;
    }
    
    setIsRecording(false);
    setInputText(""); // Clear input when stopping
  };

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    // Handle training mode
    if (isTrainingMode) {
      await handleTrainingMessage(message);
      return;
    }
    
    // AI is awake by default - no wake word needed, process all commands immediately
    const lowerMessage = message.toLowerCase();

    // Check for "add new line" command
    if (lowerMessage.includes("add new line") || lowerMessage.includes("new line")) {
      const userMessage: ConversationMessage = { role: "user", content: message };
      setConversation((prev) => [...prev, userMessage]);
      setInputText("");
      setIsProcessing(true);
      
      try {
        // Get next sequential line ID using proper line ID manager
        // This ensures L1, L2, L3 format and prevents duplicates
        const newLineId = getNextLineId(existingLines);
        
        // Check for duplicates - if line ID already exists, get next one
        let finalLineId = newLineId;
        let attempts = 0;
        while (existingLines.some(l => l.lineId === finalLineId) && attempts < 100) {
          const num = extractLineNumber(finalLineId);
          finalLineId = `L${num + 1}`;
          attempts++;
        }
        
        if (attempts >= 100) {
          throw new Error("Could not generate unique line ID after 100 attempts");
        }
        
        setCurrentLineId(finalLineId);
        setAccumulatedData({ lineId: finalLineId });
        
        // Create blank line immediately
        const blankLine: Partial<EstimatingLine> = {
          lineId: finalLineId,
          itemDescription: "",
          category: "Misc Metals",
          materialType: "Rolled",
          status: "Active",
        };
        
        const createResponse: VoiceAgentResponse = {
          action: "create",
          lineId: finalLineId,
          data: blankLine,
          message: `Created new blank line ${finalLineId}`,
          confidence: 1.0,
        };
        
        await onAction(createResponse);
        
        const confirmMessage: ConversationMessage = {
          role: "assistant",
          content: `✅ Created new blank line ${finalLineId}. You can now speak the data for this line.`,
        };
        setConversation((prev) => [...prev, confirmMessage]);
      } catch (error: any) {
        const errorMessage: ConversationMessage = {
          role: "assistant",
          content: `❌ Error creating line: ${error.message}`,
        };
        setConversation((prev) => [...prev, errorMessage]);
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    // Check for "enter" command - show confirmation
    if (lowerMessage === "enter" || lowerMessage === "enter data") {
      if (Object.keys(accumulatedData).length === 0 || !currentLineId) {
        const userMessage: ConversationMessage = { role: "user", content: message };
        setConversation((prev) => [...prev, userMessage]);
        const errorMessage: ConversationMessage = {
          role: "assistant",
          content: "No data to enter. Please speak the data first, or say 'add new line' to start.",
        };
        setConversation((prev) => [...prev, errorMessage]);
        setInputText("");
        return;
      }

      const userMessage: ConversationMessage = { role: "user", content: message };
      setConversation((prev) => [...prev, userMessage]);
      setInputText("");
      
      // Build confirmation message
      let confirmationMessage = `I will be entering the following data:\n\n`;
      if (accumulatedData.itemDescription) confirmationMessage += `• Item: ${accumulatedData.itemDescription}\n`;
      if (accumulatedData.category) confirmationMessage += `• Category: ${accumulatedData.category}\n`;
      if (accumulatedData.sizeDesignation) confirmationMessage += `• Size: ${accumulatedData.sizeDesignation}\n`;
      if (accumulatedData.qty) confirmationMessage += `• Quantity: ${accumulatedData.qty}\n`;
      if (accumulatedData.lengthFt) confirmationMessage += `• Length: ${accumulatedData.lengthFt} ft`;
      if (accumulatedData.lengthIn) confirmationMessage += ` ${accumulatedData.lengthIn} in\n`;
      if (accumulatedData.grade) confirmationMessage += `• Grade: ${accumulatedData.grade}\n`;
      
      // Check for issues
      const warnings: string[] = [];
      if (!accumulatedData.itemDescription) warnings.push("Missing item description");
      if (!accumulatedData.sizeDesignation && accumulatedData.materialType === "Rolled") warnings.push("Missing size");
      if (!accumulatedData.qty || accumulatedData.qty <= 0) warnings.push("Missing quantity");
      
      if (warnings.length > 0) {
        confirmationMessage += `\n⚠️ I noticed: ${warnings.join(", ")}.\n`;
      }
      
      confirmationMessage += `\nDo you want me to proceed?`;
      
      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: confirmationMessage,
      };
      setConversation((prev) => [...prev, assistantMessage]);
      setPendingAction({
        action: "create",
        lineId: currentLineId,
        data: { ...accumulatedData, lineId: currentLineId },
        message: confirmationMessage,
        confidence: 0.95,
      });
      return;
    }

    // Check if this is a confirmation response for pending action
    if (pendingAction) {
      const confirmationPhrases = [
        "yes", "yeah", "yep", "correct", "right", "that's right", "that's correct",
        "proceed", "go ahead", "do it", "execute", "confirm", "continue",
        "ok", "okay", "sure", "sounds good", "looks good", "good", "fine"
      ];
      
      const isConfirmation = confirmationPhrases.some(phrase => 
        lowerMessage.includes(phrase)
      );
      
      if (isConfirmation) {
        // User confirmed - execute the action immediately
        const userMessage: ConversationMessage = { role: "user", content: message };
        setConversation((prev) => [...prev, userMessage]);
        setInputText("");
        setIsProcessing(true);
        
        try {
          // Execute the pending action
          await onAction(pendingAction);
          
          // Clear all state after successful execution
          const actionToClear = pendingAction;
          setPendingAction(null);
          setAccumulatedData({});
          setCurrentLineId(null);
          
          // Show success message
          const confirmMessage: ConversationMessage = {
            role: "assistant",
            content: `✅ Data entered successfully for line ${actionToClear.lineId || 'new line'}! Say 'add new line' to create another line.`,
          };
          setConversation((prev) => [...prev, confirmMessage]);
        } catch (error: any) {
          const errorMessage: ConversationMessage = {
            role: "assistant",
            content: `❌ Error entering data: ${error.message}. Please try again.`,
          };
          setConversation((prev) => [...prev, errorMessage]);
          setPendingAction(null);
        } finally {
          setIsProcessing(false);
        }
        return; // CRITICAL: Don't process this message further
      }
      
      // Check if user wants to amend/correct
      const correctionPhrases = [
        "no", "wrong", "incorrect", "change", "amend", "correct", "fix", "update",
        "that's wrong", "not right", "cancel", "stop"
      ];
      
      const isCorrection = correctionPhrases.some(phrase => 
        lowerMessage.includes(phrase)
      );
      
      if (isCorrection) {
        // User wants to correct - clear pending action and ask what to change
        const userMessage: ConversationMessage = { role: "user", content: message };
        setConversation((prev) => [...prev, userMessage]);
        setInputText("");
        setPendingAction(null);
        const correctionMessage: ConversationMessage = {
          role: "assistant",
          content: "No problem! What would you like to change?",
        };
        setConversation((prev) => [...prev, correctionMessage]);
        return;
      }
    }

    // Check for "edit" command - if just "edit", ask what to edit
    // If "edit X to Y", process it through AI
    if (lowerMessage === "edit" || lowerMessage === "edit data") {
      const userMessage: ConversationMessage = { role: "user", content: message };
      setConversation((prev) => [...prev, userMessage]);
      setInputText("");
      
      if (!currentLineId || Object.keys(accumulatedData).length === 0) {
        const errorMessage: ConversationMessage = {
          role: "assistant",
          content: "What would you like me to edit? Please speak the data first or say 'add new line' to start.",
        };
        setConversation((prev) => [...prev, errorMessage]);
        return;
      }
      
      const editMessage: ConversationMessage = {
        role: "assistant",
        content: "What would you like me to edit?",
      };
      setConversation((prev) => [...prev, editMessage]);
      return;
    }
    
    // If message contains "edit" with details (e.g., "edit W12x14 to W12x12"), process it
    // This will be handled in the AI response processing below

    // Add user message to conversation
    const userMessage: ConversationMessage = { role: "user", content: message };
    setConversation((prev) => [...prev, userMessage]);
    setInputText(""); // Clear input after sending
    setIsProcessing(true);

    try {
      console.log("Processing user message:", message);
      console.log("Existing lines:", existingLines.length);
      
      // Declare correctedMessage at the top
      let correctedMessage: string;
      
      // Check for number format first (e.g., "1. column", "1 column", "1, column", "number 1 column", "number one column")
      const numberFormat = parseNumberFieldFormat(message);
      if (numberFormat && numberFormat.field) {
        // User spoke in number format - convert to field name format for AI
        const fieldName = numberFormat.field;
        const value = numberFormat.value;
        // Convert to "fieldName, value" format for AI processing
        correctedMessage = `${fieldName}, ${value}`;
      } else {
        // Apply speech pattern corrections before processing
        const corrections = speechPatterns.reduce((acc, pattern) => {
          if (pattern.correctedTranscription) {
            acc[pattern.userSpoke.toLowerCase()] = pattern.correctedTranscription;
          } else if (pattern.userSpoke.toLowerCase() !== pattern.intendedCommand.toLowerCase()) {
            acc[pattern.userSpoke.toLowerCase()] = pattern.intendedCommand;
          }
          return acc;
        }, {} as Record<string, string>);
        
        let correctedMessageTemp = message;
        Object.entries(corrections).forEach(([wrong, correct]) => {
          if (correctedMessageTemp.toLowerCase().includes(wrong)) {
            correctedMessageTemp = correctedMessageTemp.replace(
              new RegExp(wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'),
              correct
            );
          }
        });
        correctedMessage = correctedMessageTemp;
      }

      // Process with AI agent (use corrected message and training context)
      const response = await processVoiceCommand(
        correctedMessage,
        existingLines,
        conversation,
        generateTrainingContext(speechPatterns)
      );

      console.log("AI response received:", response);

      // If we have a current line and this is data to accumulate (not "add new line" or "enter")
      if (currentLineId && response.action === "create" && response.data) {
        // Merge new data with accumulated data
        const mergedData = { ...accumulatedData, ...response.data, lineId: currentLineId };
        setAccumulatedData(mergedData);
        
        // Try to find the line in Firestore (may not exist yet if just created)
        let existingLine = existingLines.find(l => l.lineId === currentLineId);
        
        // If line doesn't exist yet, wait a moment for Firestore subscription to update
        if (!existingLine || !existingLine.id) {
          // Wait 200ms for Firestore subscription to update
          await new Promise(resolve => setTimeout(resolve, 200));
          // Check again after waiting
          existingLine = existingLines.find(l => l.lineId === currentLineId);
        }
        
        // If line exists in Firestore (has an id), update it immediately in real-time
        if (existingLine && existingLine.id) {
          // Immediately update the line in Firestore
          const updateResponse: VoiceAgentResponse = {
            action: "update",
            lineId: currentLineId,
            data: mergedData,
            message: `Updated line ${currentLineId}`,
            confidence: 1.0,
          };
          await onAction(updateResponse);
        } else {
          // Line doesn't exist yet - this shouldn't happen, but log it
          console.warn(`Line ${currentLineId} not found in Firestore yet. Data will be saved when you say "enter".`);
        }
        
        // Show what was added in chat
        let updateMessage = `I've added to line ${currentLineId}:\n\n`;
        if (response.data.itemDescription) updateMessage += `• Item: ${response.data.itemDescription}\n`;
        if (response.data.category) updateMessage += `• Category: ${response.data.category}\n`;
        if (response.data.sizeDesignation) updateMessage += `• Size: ${response.data.sizeDesignation}\n`;
        if (response.data.qty) updateMessage += `• Quantity: ${response.data.qty}\n`;
        if (response.data.lengthFt) updateMessage += `• Length: ${response.data.lengthFt} ft`;
        if (response.data.lengthIn) updateMessage += ` ${response.data.lengthIn} in\n`;
        if (response.data.grade) updateMessage += `• Grade: ${response.data.grade}\n`;
        
        // Show all accumulated fields, not just the new one
        if (mergedData.itemDescription && !response.data.itemDescription) updateMessage += `• Item: ${mergedData.itemDescription}\n`;
        if (mergedData.category && !response.data.category) updateMessage += `• Category: ${mergedData.category}\n`;
        if (mergedData.sizeDesignation && !response.data.sizeDesignation) updateMessage += `• Size: ${mergedData.sizeDesignation}\n`;
        if (mergedData.qty && !response.data.qty) updateMessage += `• Quantity: ${mergedData.qty}\n`;
        if (mergedData.lengthFt && !response.data.lengthFt) updateMessage += `• Length: ${mergedData.lengthFt} ft`;
        if (mergedData.lengthIn && !response.data.lengthIn) updateMessage += ` ${mergedData.lengthIn} in\n`;
        if (mergedData.grade && !response.data.grade) updateMessage += `• Grade: ${mergedData.grade}\n`;
        
        updateMessage += `\nSay "enter" when ready to finalize this data.`;
        
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: updateMessage,
        };
        setConversation((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);
        return;
      }

      // Handle edit commands - parse "edit W12x14 to W12x12" or "change quantity to 6"
      if (currentLineId && response.action === "update" && response.data) {
        // Merge edit into accumulated data
        const updatedData = { ...accumulatedData, ...response.data };
        setAccumulatedData(updatedData);
        
        // Try to find the line in Firestore (may not exist yet if just created)
        let existingLine = existingLines.find(l => l.lineId === currentLineId);
        
        // If line doesn't exist yet, wait a moment for Firestore subscription to update
        if (!existingLine || !existingLine.id) {
          // Wait 200ms for Firestore subscription to update
          await new Promise(resolve => setTimeout(resolve, 200));
          // Check again after waiting
          existingLine = existingLines.find(l => l.lineId === currentLineId);
        }
        
        // If line exists in Firestore (has an id), update it immediately in real-time
        if (existingLine && existingLine.id) {
          // Immediately update the line in Firestore
          const updateResponse: VoiceAgentResponse = {
            action: "update",
            lineId: currentLineId,
            data: updatedData,
            message: `Updated line ${currentLineId}`,
            confidence: 1.0,
          };
          await onAction(updateResponse);
        } else {
          // Line doesn't exist yet - this shouldn't happen, but log it
          console.warn(`Line ${currentLineId} not found in Firestore yet. Data will be saved when you say "enter".`);
        }
        
        let editMessage = `I've updated line ${currentLineId}:\n\n`;
        Object.entries(response.data).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            editMessage += `• ${key}: ${value}\n`;
          }
        });
        editMessage += `\nSay "enter" when ready to finalize.`;
        
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: editMessage,
        };
        setConversation((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);
        return;
      }

      // Build confirmation message with verification (for other actions)
      let confirmationMessage = "";
      
      if (response.action === "create" && response.data && !currentLineId) {
        // This is a direct create (not using accumulated data flow)
        const data = response.data;
        confirmationMessage = `I understand you want to create a new line:\n\n`;
        if (data.itemDescription) confirmationMessage += `• Item: ${data.itemDescription}\n`;
        if (data.category) confirmationMessage += `• Category: ${data.category}\n`;
        if (data.sizeDesignation) confirmationMessage += `• Size: ${data.sizeDesignation}\n`;
        if (data.qty) confirmationMessage += `• Quantity: ${data.qty}\n`;
        if (data.lengthFt) confirmationMessage += `• Length: ${data.lengthFt} ft`;
        if (data.lengthIn) confirmationMessage += ` ${data.lengthIn} in\n`;
        if (data.grade) confirmationMessage += `• Grade: ${data.grade}\n`;
        
        confirmationMessage += `\n\nWould you like me to enter this data?`;
      } else if (response.action === "update" && response.lineId && response.data && !currentLineId) {
        const data = response.data;
        confirmationMessage = `I understand you want to update line ${response.lineId}:\n\n`;
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== "") {
            confirmationMessage += `• ${key}: ${value}\n`;
          }
        });
        confirmationMessage += `\nWould you like me to enter this data?`;
      } else if (response.action === "delete" && response.lineId) {
        confirmationMessage = `I understand you want to delete line ${response.lineId}.\n\n⚠️ This action cannot be undone.\n\nAre you sure you want to proceed?`;
      } else if (response.action === "copy" && response.data) {
        const data = response.data;
        confirmationMessage = `I understand you want to copy line ${data.lineId?.split('-')[0]} to ${data.lineId}.\n\nWould you like me to create this copy?`;
      } else if (response.action === "query") {
        // Queries don't need confirmation
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: response.message,
        };
        setConversation((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);
        return;
      } else if (response.action === "conversation") {
        // Pure conversational response - no action needed
        const assistantMessage: ConversationMessage = {
          role: "assistant",
          content: response.message || "I'm here to help! What would you like to do?",
        };
        setConversation((prev) => [...prev, assistantMessage]);
        setIsProcessing(false);
        return;
      } else {
        // Unknown or low confidence
        const warningMessage: ConversationMessage = {
          role: "assistant",
          content: `I'm not confident about that command (confidence: ${response.confidence || 0}). Please try rephrasing.`,
        };
        setConversation((prev) => [...prev, warningMessage]);
        setIsProcessing(false);
        return;
      }

      // Add confirmation message and set pending action
      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: confirmationMessage,
      };
      setConversation((prev) => [...prev, assistantMessage]);
      setPendingAction(response); // Store for confirmation
      setIsProcessing(false); // Done processing, waiting for confirmation
    } catch (error: any) {
      console.error("Failed to process voice command:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      
      let errorMsg = `Sorry, I encountered an error: ${error.message}`;
      
      // Provide more helpful error messages
      if (error.message.includes("OpenAI API key")) {
        errorMsg = "⚠️ OpenAI API key is not configured or invalid. Please check your API key in .env.local and restart the server.";
      } else if (error.message.includes("rate limit") || error.message.includes("Rate limit")) {
        errorMsg = "⏱️ Rate limit exceeded. You've made too many requests too quickly. Please wait 60 seconds and try again. If this persists, check your OpenAI account limits at platform.openai.com.";
      } else if (error.message.includes("Network error") || error.message.includes("connection")) {
        errorMsg = "🌐 Network connection error. Please check your internet connection and try again.";
      } else if (error.message.includes("server error")) {
        errorMsg = "🔧 OpenAI server error. Please try again in a moment.";
      } else if (error.message.includes("HTTP 500")) {
        errorMsg = `Server error: ${error.message}. Check the server console for details.`;
      } else if (error.message.includes("HTTP 400")) {
        errorMsg = `Bad request: ${error.message}. Please check your command format.`;
      } else if (error.message.includes("Invalid response")) {
        errorMsg = "The AI returned an invalid response. Please try rephrasing your command.";
      } else if (error.message.includes("Failed to fetch")) {
        errorMsg = "Network error: Could not reach the server. Is the dev server running?";
      } else if (error.message.includes("OpenAI API error")) {
        errorMsg = `OpenAI API error: ${error.message}. Check your API key and account status.`;
      }
      
      const errorMessage: ConversationMessage = {
        role: "assistant",
        content: errorMsg,
      };
      setConversation((prev) => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
      
      // Auto-restart recording if it was active and stopped
      if (isRecordingRef.current && recognitionRef.current) {
        // Check if recognition is still active, if not restart it
        setTimeout(() => {
          if (isRecordingRef.current && recognitionRef.current) {
            try {
              // Try to restart if it ended
              recognitionRef.current.start();
              console.log("Auto-restarted recording after AI response");
            } catch (e: any) {
              // If already started, that's fine
              console.log("Recognition already active:", e.message || "ok");
            }
          }
        }, 500); // Small delay to ensure processing is complete
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      handleUserMessage(inputText.trim());
    }
  };

  const startTraining = () => {
    setIsTrainingMode(true);
    setTrainingProgress(0);
    const welcomeMessage: ConversationMessage = {
      role: "assistant",
      content: `🎯 Speech Training Mode

I'll help you train me to understand your accent and speech patterns better. I'll show you ${TRAINING_PHRASES.length} phrases - you must say each phrase correctly before moving to the next.

⚠️ IMPORTANT: I can only accept the exact phrase shown. If you say something else, I'll ask you to try again.

Let's start with phrase 1 of ${TRAINING_PHRASES.length}:

"${TRAINING_PHRASES[0].phrase}"

Say it now exactly as shown.`,
    };
    setConversation((prev) => [...prev, welcomeMessage]);
  };

  const handleTrainingMessage = async (message: string) => {
    // Use a functional update to get the current trainingProgress value
    // This ensures we're always checking against the correct phrase
    setTrainingProgress((currentProgress) => {
      const currentPhrase = TRAINING_PHRASES[currentProgress];
      if (!currentPhrase) {
        setIsTrainingMode(false);
        const completeMessage: ConversationMessage = {
          role: "assistant",
          content: `✅ Training complete! I've learned ${speechPatterns.length} speech patterns. This will help me understand you better. You can start estimating now!`,
        };
        setConversation((prev) => [...prev, completeMessage]);
        return currentProgress;
      }

      // Normalize both strings for comparison
      // In steel notation, "x" and "by" are equivalent (e.g., "12x24" = "12 by 24")
      // Also, number words and digits are equivalent (e.g., "three" = "3")
      // And fractions: "quarter" = "1/4", "half" = "1/2", etc.
      const normalize = (str: string) => {
        let normalized = str.toLowerCase().trim();
        
        // FIRST: Handle fractions (before number word conversion)
        // In steel notation, "quarter" means 1/4 inch, not the number 4
        const fractions: Record<string, string> = {
          'quarter': '1/4',
          'quarters': '1/4', // plural
          'half': '1/2',
          'three quarters': '3/4',
          'three quarter': '3/4',
          'eighth': '1/8',
          'eighths': '1/8',
          'three eighths': '3/8',
          'five eighths': '5/8',
          'seven eighths': '7/8',
        };
        
        // Replace fraction words with fraction notation (using word boundaries)
        Object.entries(fractions).forEach(([word, fraction]) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          normalized = normalized.replace(regex, fraction);
        });
        
        // THEN: Convert number words to digits (for speech recognition compatibility)
        const numberWords: Record<string, string> = {
          'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
          'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
          'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
          'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
          'eighteen': '18', 'nineteen': '19', 'twenty': '20', 'thirty': '30',
          'forty': '40', 'fifty': '50', 'sixty': '60', 'seventy': '70',
          'eighty': '80', 'ninety': '90', 'hundred': '100'
        };
        
        // Replace number words with digits (using word boundaries to avoid partial matches)
        Object.entries(numberWords).forEach(([word, digit]) => {
          const regex = new RegExp(`\\b${word}\\b`, 'gi');
          normalized = normalized.replace(regex, digit);
        });
        
        // Replace " by " with "x" for steel notation equivalence
        normalized = normalized.replace(/\s+by\s+/g, 'x');
        // Remove punctuation
        normalized = normalized.replace(/[.,!?;:]/g, '');
        // Normalize spaces
        normalized = normalized.replace(/\s+/g, ' ');
        // Remove spaces around "x" for steel notation (e.g., "12 x 24" -> "12x24")
        normalized = normalized.replace(/\s*x\s*/g, 'x');
        return normalized;
      };
      const normalizedUserInput = normalize(message);
      const normalizedTarget = normalize(currentPhrase.phrase);
    
      // Check if the user's input matches the target phrase (with some tolerance for minor variations)
      const isMatch = normalizedUserInput === normalizedTarget || 
                      normalizedUserInput.includes(normalizedTarget) ||
                      normalizedTarget.includes(normalizedUserInput) ||
                      // Check if at least 70% of words match
                      (() => {
                        const userWords = normalizedUserInput.split(' ').filter(w => w.length > 0);
                        const targetWords = normalizedTarget.split(' ').filter(w => w.length > 0);
                        if (targetWords.length === 0) return false;
                        const matchingWords = userWords.filter(word => targetWords.includes(word));
                        return matchingWords.length >= Math.ceil(targetWords.length * 0.7);
                      })();

      if (!isMatch) {
        // User said something incorrect - show error and repeat the same phrase
        const errorMessage: ConversationMessage = {
          role: "assistant",
          content: `❌ Try again. I can only accept the proper words in this training session.

You said: "${message}"
Expected: "${currentPhrase.phrase}"

Please say exactly: "${currentPhrase.phrase}"`,
        };
        setConversation((prev) => [...prev, errorMessage]);
        return currentProgress; // Don't advance - stay on the same phrase
      }

      // User said the correct phrase - store the pattern and move to next
      const pattern = storeSpeechPattern(
        message, // What user actually said
        currentPhrase.phrase, // What they meant to say
        message === currentPhrase.phrase ? undefined : currentPhrase.phrase // Correction if different
      );
      
      setSpeechPatterns((prev) => [...prev, pattern]);

      const nextIndex = currentProgress + 1;

      if (nextIndex < TRAINING_PHRASES.length) {
        const nextPhrase = TRAINING_PHRASES[nextIndex];
        const progressMessage: ConversationMessage = {
          role: "assistant",
          content: `✅ Got it! You said "${message}" for "${currentPhrase.phrase}".

Phrase ${nextIndex + 1} of ${TRAINING_PHRASES.length}:

"${nextPhrase.phrase}"

Say it naturally.`,
        };
        setConversation((prev) => [...prev, progressMessage]);
        return nextIndex; // Advance to next phrase
      } else {
        // Training complete - close training mode
        setIsTrainingMode(false);
        const completeMessage: ConversationMessage = {
          role: "assistant",
          content: `✅ Training complete! I've learned ${speechPatterns.length + 1} speech patterns. This will help me understand your accent and speech patterns better. You can start estimating now!`,
        };
        setConversation((prev) => [...prev, completeMessage]);
        return nextIndex;
      }
    });
  };

  const handleClearConversation = async () => {
    if (!confirm("Clear conversation history? This cannot be undone.")) {
      return;
    }

    setConversation([]);
    
    // Also clear from Firestore
    if (isFirebaseConfigured() && companyId && projectId) {
      try {
        const conversationPath = getProjectPath(companyId, projectId, "conversations", "current");
        await setDocument(conversationPath, {
          messages: [],
          projectId,
          companyId,
        }, true);
        console.log("Cleared conversation history");
      } catch (error: any) {
        console.error("Failed to clear conversation:", error);
      }
    }
  };

  // Always render - make it very visible for testing
  if (!isOpen) {
    return (
      <>
        {/* Floating button - bottom right with AI label */}
        <div 
          style={{ 
            position: 'fixed',
            bottom: '96px',
            right: '16px',
            zIndex: 9999,
            pointerEvents: 'auto'
          }}
        >
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => {
                console.log("AI Assistant button clicked");
                setIsOpen(true);
              }}
              className="rounded-full w-24 h-24 shadow-2xl bg-gradient-to-br from-purple-600 via-purple-500 to-pink-500 hover:from-purple-700 hover:via-purple-600 hover:to-pink-600 text-white flex items-center justify-center transition-all hover:scale-110 border-4 border-white relative"
              title="AI Assistant - Speak naturally to add/update lines"
              style={{ 
                boxShadow: '0 10px 40px rgba(147, 51, 234, 0.7)',
                cursor: 'pointer'
              }}
            >
              <Sparkles className="w-12 h-12" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full border-2 border-white animate-pulse"></div>
            </button>
            <div className="bg-purple-600 text-white px-5 py-2.5 rounded-lg text-base font-bold shadow-lg whitespace-nowrap border-2 border-purple-300">
              ✨ AI Assistant
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className={`fixed ${
        isMinimized ? "bottom-4 right-4 w-80" : "bottom-4 right-4 w-96 h-[600px]"
      } bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-[100] transition-all`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500 text-white rounded-t-lg">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5" />
          <h3 className="font-semibold">AI Estimating Assistant</h3>
          <span className="text-xs bg-yellow-400 text-purple-900 px-2 py-0.5 rounded-full font-bold">AI</span>
        </div>
        <div className="flex items-center gap-2">
          {isTrainingMode && (
            <button
              onClick={() => {
                setIsTrainingMode(false);
                setTrainingProgress(0);
                const exitMessage: ConversationMessage = {
                  role: "assistant",
                  content: "Training mode exited. You can now use regular commands.",
                };
                setConversation((prev) => [...prev, exitMessage]);
              }}
              className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 rounded font-semibold"
              title="Exit training mode"
            >
              ✖ Exit Training
            </button>
          )}
          {!isTrainingMode && (
            <button
              onClick={startTraining}
              className="px-3 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 rounded font-semibold"
              title="Train AI to understand your accent"
            >
              🎯 Train
            </button>
          )}
          {conversation.length > 0 && !isTrainingMode && (
            <button
              onClick={handleClearConversation}
              className="p-1 hover:bg-red-600 rounded"
              title="Clear conversation history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-blue-700 rounded"
          >
            {isMinimized ? (
              <Maximize2 className="w-4 h-4" />
            ) : (
              <Minimize2 className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setIsOpen(false);
              setIsMinimized(false);
            }}
            className="p-1 hover:bg-blue-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {conversation.length === 0 && (
              <div className="text-center text-gray-500 text-sm py-8">
                <Bot className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                <p>Hi! I'm your AI estimating assistant.</p>
                <p className="mt-2">Try saying:</p>
                <ul className="mt-2 text-left max-w-xs mx-auto space-y-1">
                  <li>• "Add a column W12x14, 5 pieces, 20 feet"</li>
                  <li>• "Update line 3, change quantity to 6"</li>
                  <li>• "Delete line 5"</li>
                  <li>• "What's on line 2?"</li>
                </ul>
              </div>
            )}

            {conversation.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {msg.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-blue-600" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                {msg.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-gray-600" />
                  </div>
                )}
              </div>
            ))}

            {isProcessing && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-600" />
                </div>
                <div className="bg-gray-100 rounded-lg px-4 py-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 p-4">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type or speak your command..."
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isProcessing || isRecording}
              />
              <Button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                variant={isRecording ? "destructive" : "outline"}
                className="px-4"
              >
                {isRecording ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                {isAwake && (
                  <span className="ml-2 text-xs text-green-500 font-semibold">● Awake</span>
                )}
              </Button>
              <Button
                type="submit"
                disabled={!inputText.trim() || isProcessing || isRecording}
                className="px-4"
              >
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

