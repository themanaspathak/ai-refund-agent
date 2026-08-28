"use client";

import { useState, useEffect } from "react";
import { Mic, MicOff, Volume2, VolumeX } from "lucide-react";

interface VoiceControlsProps {
  onTranscript: (text: string) => void;
  lastAgentResponse?: string;
}

export function VoiceControls({ onTranscript, lastAgentResponse }: VoiceControlsProps) {
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [hasSpeechRec, setHasSpeechRec] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      setHasSpeechRec(true);
    }
  }, []);

  // Text-To-Speech for agent response
  useEffect(() => {
    if (ttsEnabled && lastAgentResponse && typeof window !== "undefined" && "speechSynthesis" in window) {
      // Cancel previous speech
      window.speechSynthesis.cancel();
      // Strip markdown asterisks for cleaner audio
      const cleanText = lastAgentResponse.replace(/\*/g, "");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [lastAgentResponse, ttsEnabled]);

  const toggleListening = () => {
    if (!hasSpeechRec) {
      alert("Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        onTranscript(transcript);
      }
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="flex items-center gap-2">
      {/* Speech-to-Text Microphone */}
      <button
        type="button"
        onClick={toggleListening}
        className={`p-2 rounded-full border transition ${
          isListening
            ? "bg-red-500/20 border-red-500 text-red-400 animate-pulse"
            : "bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700"
        }`}
        title={isListening ? "Listening... Click to stop" : "Speak message (Web Speech STT)"}
      >
        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>

      {/* Text-to-Speech Toggle */}
      <button
        type="button"
        onClick={() => setTtsEnabled(!ttsEnabled)}
        className={`p-2 rounded-full border transition ${
          ttsEnabled
            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
            : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
        }`}
        title={ttsEnabled ? "Text-To-Speech active" : "Text-To-Speech muted"}
      >
        {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
      </button>
    </div>
  );
}
