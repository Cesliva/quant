"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Send, Bot, User, X, Minimize2, Maximize2, Sparkles, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { processVoiceCommand, VoiceAgentResponse, ConversationMessage } from "@/lib/openai/voiceAgent";
import { EstimatingLine } from "@/components/estimating/EstimatingGrid";
import { getProjectPath, getDocument, setDocument } from "@/lib/firebase/firestore";
import { isFirebaseConfigured } from "@/lib/firebase/config";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Load conversation from Firestore on mount
  useEffect(() => {
    const loadConversation = async () => {
      if (!isFirebaseConfigured() || !companyId || !projectId) {
        console.log("Firebase not configured or missing IDs, skipping conversation load");
        return;
      }

      try {
        const conversationPath = getProjectPath(companyId, projectId, "conversations", "current");
        const saved = await getDocument<{ messages: ConversationMessage[] }>(conversationPath);
        
        if (saved && saved.messages && saved.messages.length > 0) {
          console.log(`Loaded ${saved.messages.length} messages from conversation history`);
          setConversation(saved.messages);
        } else {
          console.log("No saved conversation found, starting fresh");
        }
      } catch (error: any) {
        console.error("Failed to load conversation:", error);
        // Don't show error to user, just start fresh
      }
    };

    loadConversation();
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

  // Debug: Log when component mounts
  useEffect(() => {
    console.log("🎯 VoiceAgent component mounted", { 
      companyId, 
      projectId, 
      existingLinesCount: existingLines.length,
      isManualMode 
    });
  }, [companyId, projectId, existingLines.length, isManualMode]);

  // Listen for custom event to open the agent
  useEffect(() => {
    const handleOpenEvent = () => {
      setIsOpen(true);
    };
    window.addEventListener('openVoiceAgent', handleOpenEvent);
    return () => {
      window.removeEventListener('openVoiceAgent', handleOpenEvent);
    };
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  const startRecording = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      alert("Speech recognition not supported in this browser. Please type your commands.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = "en-US";

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

        if (finalTranscript.trim()) {
          handleUserMessage(finalTranscript.trim());
          recognition.stop();
        }
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error !== "no-speech") {
          alert(`Speech recognition error: ${event.error}`);
        }
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (error: any) {
      console.error("Failed to start speech recognition:", error);
      alert("Failed to start recording. Please check microphone permissions.");
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
  };

  const handleUserMessage = async (message: string) => {
    if (!message.trim()) return;

    // Add user message to conversation
    const userMessage: ConversationMessage = { role: "user", content: message };
    setConversation((prev) => [...prev, userMessage]);
    setInputText("");
    setIsProcessing(true);

    try {
      console.log("Processing user message:", message);
      console.log("Existing lines:", existingLines.length);
      
      // Process with AI agent
      const response = await processVoiceCommand(
        message,
        existingLines,
        conversation
      );

      console.log("AI response received:", response);

      // Add assistant response to conversation
      const assistantMessage: ConversationMessage = {
        role: "assistant",
        content: response.message,
      };
      setConversation((prev) => [...prev, assistantMessage]);

      // Execute the action
      if (response.action !== "unknown" && response.confidence > 0.5) {
        console.log("Executing action:", response.action);
        await onAction(response);
        console.log("Action executed successfully");
      } else {
        console.warn("Low confidence or unknown action:", response);
        const warningMessage: ConversationMessage = {
          role: "assistant",
          content: `I'm not confident about that command (confidence: ${response.confidence}). Please try rephrasing.`,
        };
        setConversation((prev) => [...prev, warningMessage]);
      }
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
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isProcessing) {
      handleUserMessage(inputText.trim());
    }
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
          {conversation.length > 0 && (
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

