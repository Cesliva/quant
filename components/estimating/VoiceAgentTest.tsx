"use client";

// Simple test component to verify rendering
export default function VoiceAgentTest() {
  return (
    <div 
      style={{
        position: 'fixed',
        top: '80px',
        right: '10px',
        zIndex: 99998,
        backgroundColor: 'orange',
        color: 'white',
        padding: '15px',
        borderRadius: '8px',
        fontSize: '14px',
        fontWeight: 'bold',
        boxShadow: '0 0 15px rgba(255,165,0,0.8)'
      }}
    >
      🧪 TEST: VoiceAgentTest Component Rendered
    </div>
  );
}

