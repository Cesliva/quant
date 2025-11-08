"use client";

import { useState, useEffect } from "react";

/**
 * Smoke Test Component for Voice Recognition
 * Tests basic Web Speech API functionality
 */
export default function VoiceRecognitionSmokeTest() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [isListening, setIsListening] = useState(false);

  const addResult = (message: string) => {
    console.log("SMOKE TEST:", message);
    setTestResults((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const testWebSpeechAPI = () => {
    addResult("🧪 Starting Voice Recognition Smoke Test...");
    
    // Test 1: Check if Web Speech API is available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addResult("❌ FAIL: Web Speech API not available");
      return;
    }
    addResult("✅ PASS: Web Speech API is available");

    // Test 2: Check if getUserMedia is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      addResult("❌ FAIL: getUserMedia not available");
      return;
    }
    addResult("✅ PASS: getUserMedia is available");

    // Test 3: Try to create recognition instance
    try {
      const rec = new SpeechRecognition();
      setRecognition(rec);
      addResult("✅ PASS: SpeechRecognition instance created");
    } catch (error: any) {
      addResult(`❌ FAIL: Cannot create SpeechRecognition: ${error.message}`);
      return;
    }

    // Test 4: Test microphone access
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        addResult("✅ PASS: Microphone access granted");
        addResult(`   Stream active: ${stream.active}`);
        addResult(`   Audio tracks: ${stream.getAudioTracks().length}`);
        if (stream.getAudioTracks().length > 0) {
          const track = stream.getAudioTracks()[0];
          addResult(`   Track label: ${track.label || 'Unknown'}`);
          addResult(`   Track enabled: ${track.enabled}`);
          addResult(`   Track readyState: ${track.readyState}`);
        }
        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());
        addResult("✅ PASS: Test stream released");
        
        // Test 5: Start recognition
        testRecognition();
      })
      .catch((error: any) => {
        addResult(`❌ FAIL: Microphone access denied: ${error.message}`);
        addResult(`   Error name: ${error.name}`);
      });
  };

  const testRecognition = () => {
    if (!recognition) {
      addResult("❌ FAIL: Recognition instance not available");
      return;
    }

    try {
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      addResult("✅ PASS: Recognition configured");

      recognition.onstart = () => {
        addResult("✅ PASS: Recognition started - microphone should be active");
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          addResult(`✅ PASS: Received speech: "${transcript}"`);
        }
      };

      recognition.onerror = (event: any) => {
        addResult(`⚠️ Recognition error: ${event.error}`);
        if (event.error === "not-allowed") {
          addResult("❌ FAIL: Microphone permission denied");
        } else if (event.error === "no-speech") {
          addResult("ℹ️ No speech detected (this is normal)");
        } else {
          addResult(`❌ FAIL: ${event.error}`);
        }
      };

      recognition.onend = () => {
        addResult("ℹ️ Recognition ended");
        setIsListening(false);
      };

      recognition.start();
      addResult("✅ PASS: recognition.start() called");
      addResult("🎤 Listening... Say something!");
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (recognition) {
          try {
            recognition.stop();
            addResult("✅ Test completed - stopped recognition");
            setIsTesting(false);
          } catch (e) {
            addResult("⚠️ Error stopping recognition (may have already stopped)");
          }
        }
      }, 10000);
    } catch (error: any) {
      addResult(`❌ FAIL: Cannot start recognition: ${error.message}`);
      setIsTesting(false);
    }
  };

  const startTest = () => {
    setTestResults([]);
    setIsTesting(true);
    testWebSpeechAPI();
  };

  const stopTest = () => {
    if (recognition) {
      try {
        recognition.stop();
        recognition.abort();
      } catch (e) {
        // Ignore
      }
    }
    setIsTesting(false);
    setIsListening(false);
    addResult("🛑 Test stopped by user");
  };

  return (
    <div className="fixed top-4 left-4 bg-white border-2 border-red-500 rounded-lg shadow-2xl p-4 z-[10000] max-w-md">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-red-600">🧪 Voice Recognition Smoke Test</h3>
        {isTesting ? (
          <button
            onClick={stopTest}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            Stop Test
          </button>
        ) : (
          <button
            onClick={startTest}
            className="px-3 py-1 bg-green-500 text-white rounded text-sm"
          >
            Run Test
          </button>
        )}
      </div>
      
      {isListening && (
        <div className="mb-2 p-2 bg-yellow-100 rounded text-center">
          <span className="animate-pulse">🎤 Listening...</span>
        </div>
      )}

      <div className="max-h-96 overflow-y-auto text-xs font-mono bg-gray-50 p-2 rounded border">
        {testResults.length === 0 ? (
          <p className="text-gray-500">Click "Run Test" to start</p>
        ) : (
          testResults.map((result, idx) => (
            <div key={idx} className="mb-1">
              {result}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

